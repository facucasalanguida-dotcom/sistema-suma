import { z } from 'zod';
import { SUPPLIER_DIRECTORY } from '../demo/suppliers';

/**
 * Búsqueda programática de fichas de producto con la API oficial de Google
 * (Custom Search JSON API).
 *
 * Es la capa que complementa al grounding de Gemini con más opciones aún: los
 * mismos resultados de Google, pero como JSON con contrato estable, en lugar
 * de raspar el HTML del buscador —que Google bloquea con captchas, rompe con
 * cada rediseño y prohíbe en sus condiciones de uso—. «Infalible» no existe en
 * ingeniería, pero esta es la versión más cercana: API oficial, reintentos con
 * espera creciente, validación estricta de la respuesta y degradación limpia.
 * Si esta capa falla o no está configurada, la búsqueda con grounding sigue
 * funcionando sola; nunca rompe el flujo.
 *
 * Configuración (opcional): `GOOGLE_CSE_API_KEY` y `GOOGLE_CSE_ID` en el
 * entorno. El buscador programable se crea en
 * https://programmablesearchengine.google.com (modo «buscar en toda la web»)
 * y la clave en Google Cloud con la Custom Search API activada.
 * Cuota: 100 consultas/día gratis; después ~5 USD por cada 1.000.
 */

export interface CseResult {
  title: string;
  url: string;
  snippet: string;
  /** Dominio legible («obramat.es»), para mostrar y para filtrar. */
  domain: string;
}

/**
 * Tiendas admitidas como resultado: los distribuidores del directorio que
 * tienen web, más los almacenes online nacionales que sirven en Málaga. Sin
 * este filtro, una búsqueda de «cemento cola precio» devuelve blogs, foros y
 * agregadores que no son sitios donde comprar.
 */
const EXTRA_SHOP_DOMAINS = ['manomano.es', 'bauhaus.es', 'bricodepot.es'];

export function allowedShopDomains(): Set<string> {
  const domains = new Set<string>(EXTRA_SHOP_DOMAINS);
  for (const supplier of SUPPLIER_DIRECTORY) {
    if (supplier.website) domains.add(supplier.website.replace(/^www\./, '').toLowerCase());
  }
  return domains;
}

const cseResponseSchema = z.object({
  items: z
    .array(
      z.object({
        title: z.string().default(''),
        link: z.string(),
        snippet: z.string().default(''),
        displayLink: z.string().default(''),
      }),
    )
    .default([]),
});

export function isCseConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_ID);
}

const ENDPOINT = 'https://customsearch.googleapis.com/customsearch/v1';
const PER_QUERY_TIMEOUT_MS = 6_000;
const MAX_QUERIES = 3;
const RETRIES_PER_QUERY = 2;

/**
 * Lanza hasta `MAX_QUERIES` consultas en paralelo y devuelve fichas de
 * producto de tiendas admitidas, sin duplicados y en orden de aparición.
 *
 * Nunca lanza: cada consulta captura sus propios errores y una respuesta
 * malformada cuenta como vacía. El peor caso es devolver una lista vacía.
 */
export async function searchProductPages(queries: string[]): Promise<CseResult[]> {
  if (!isCseConfigured()) return [];

  const allowed = allowedShopDomains();
  const selected = queries.filter((query) => query.trim()).slice(0, MAX_QUERIES);

  const batches = await Promise.all(selected.map((query) => runQuery(query)));

  const seen = new Set<string>();
  const results: CseResult[] = [];

  for (const batch of batches) {
    for (const item of batch) {
      const parsed = parseShopUrl(item.link, allowed);
      if (!parsed) continue;
      if (seen.has(parsed.canonical)) continue;
      seen.add(parsed.canonical);
      results.push({
        title: item.title.trim(),
        url: item.link,
        snippet: item.snippet.replace(/\s+/g, ' ').trim(),
        domain: parsed.domain,
      });
    }
  }

  return results;
}

async function runQuery(
  query: string,
  extraParams: Record<string, string> = {},
): Promise<z.infer<typeof cseResponseSchema>['items']> {
  const url = new URL(ENDPOINT);
  url.searchParams.set('key', process.env.GOOGLE_CSE_API_KEY ?? '');
  url.searchParams.set('cx', process.env.GOOGLE_CSE_ID ?? '');
  url.searchParams.set('q', query);
  url.searchParams.set('num', '10');
  url.searchParams.set('gl', 'es');
  url.searchParams.set('hl', 'es');
  for (const [key, value] of Object.entries(extraParams)) {
    url.searchParams.set(key, value);
  }

  for (let attempt = 0; attempt <= RETRIES_PER_QUERY; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(PER_QUERY_TIMEOUT_MS),
      });

      if (response.status === 429 || response.status >= 500) {
        // Cuota o error transitorio del servicio: reintentar con espera.
        throw new RetryableError(`HTTP ${response.status}`);
      }
      if (!response.ok) {
        // 400/403: clave o buscador mal configurados. Reintentar no lo arregla.
        console.warn(`[suma] Custom Search rechazó la consulta (${response.status}).`);
        return [];
      }

      return cseResponseSchema.parse(await response.json()).items;
    } catch (error) {
      const transient =
        error instanceof RetryableError ||
        (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError'));

      if (!transient || attempt === RETRIES_PER_QUERY) {
        console.warn(`[suma] Custom Search sin respuesta para «${query}»:`, error);
        return [];
      }
      await sleep(300 * 2 ** attempt);
    }
  }
  return [];
}

/**
 * Busca fichas de producto dentro de la web de UN proveedor concreto: el
 * equivalente a entrar en esa tienda y teclear el material en su buscador,
 * pero a través del índice de Google. Devuelve hasta `limit` fichas reales
 * (https, no portadas, del dominio pedido), sin duplicados.
 */
export async function searchShopProducts(
  query: string,
  domain: string,
  limit = 3,
): Promise<CseResult[]> {
  if (!isCseConfigured() || !query.trim() || !domain.includes('.')) return [];

  const items = await runQuery(query, { siteSearch: domain, siteSearchFilter: 'i', num: '10' });
  const allowed = new Set([domain.toLowerCase()]);

  const seen = new Set<string>();
  const results: CseResult[] = [];

  for (const item of items) {
    const parsed = parseShopUrl(item.link, allowed);
    if (!parsed) continue;
    if (seen.has(parsed.canonical)) continue;
    seen.add(parsed.canonical);
    results.push({
      title: item.title.trim(),
      url: item.link,
      snippet: item.snippet.replace(/\s+/g, ' ').trim(),
      domain: parsed.domain,
    });
    if (results.length >= limit) break;
  }

  return results;
}

/**
 * La primera ficha de un producto en la web de un proveedor, o `null`. Es el
 * rescate de las ofertas que llegan sin enlace: en lugar de enseñar la
 * portada de la tienda, se le pregunta a su buscador por el producto.
 */
export async function findProductPageOnSite(
  query: string,
  domain: string,
): Promise<CseResult | null> {
  const results = await searchShopProducts(query, domain, 1);
  return results[0] ?? null;
}

class RetryableError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ParsedShopUrl {
  domain: string;
  /** URL sin parámetros de seguimiento, para deduplicar. */
  canonical: string;
}

function parseShopUrl(link: string, allowed: Set<string>): ParsedShopUrl | null {
  try {
    const parsed = new URL(link);
    if (parsed.protocol !== 'https:') return null;
    // Una portada no es una ficha de producto.
    if (parsed.pathname === '/' && !parsed.search) return null;

    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const inAllowlist = [...allowed].some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
    if (!inAllowlist) return null;

    return { domain: host, canonical: `${parsed.origin}${parsed.pathname}` };
  } catch {
    return null;
  }
}

/** Formatea los resultados como evidencia legible para el paso de estructuración. */
export function formatCseEvidence(results: CseResult[]): string {
  if (results.length === 0) return '';

  const lines = results.map(
    (result, index) =>
      `${index + 1}. ${result.title}\n   URL: ${result.url}\n   Extracto: ${result.snippet}`,
  );

  return (
    'RESULTADOS DE LA BÚSQUEDA PROGRAMÁTICA (API oficial de Google Custom Search; ' +
    'las URLs son literales de la API, aptas como ficha de producto)\n' +
    lines.join('\n')
  );
}
