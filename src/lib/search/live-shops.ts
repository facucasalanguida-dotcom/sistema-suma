import { isCseConfigured, searchShopProducts } from './google-cse';
import { extractPageEvidence, fetchProductPage } from '../import/product-page';

/**
 * Lectura en vivo de las tiendas: el corazón de la búsqueda.
 *
 * Para cada material pedido, el sistema hace lo que haría una persona con
 * cinco pestañas abiertas: entra en las webs de los principales proveedores,
 * busca el material en cada una, abre las fichas que encajan y lee AHORA
 * MISMO lo que dice cada página (nombre, marca, precio publicado hoy,
 * disponibilidad). Nada sale de catálogos guardados ni de PDFs viejos: si
 * una ficha no responde en el momento, no se usa.
 *
 * El descubrimiento de fichas se hace con el índice oficial de Google
 * acotado a cada tienda (`searchShopProducts`) y la lectura con una descarga
 * directa de cada página. Todo en paralelo y con topes de tiempo: esta capa
 * corre a la vez que la búsqueda con grounding y nunca la retrasa.
 */

/** Tiendas online que se consultan en vivo en cada búsqueda. */
const DEFAULT_SHOPS = [
  'obramat.es',
  'leroymerlin.es',
  'manomano.es',
  'bauhaus.es',
  'bricodepot.es',
];

/**
 * Lista final de tiendas: las de siempre más las que el usuario añada en
 * `SUMA_EXTRA_SHOPS` (dominios separados por comas, p. ej.
 * «isolana.es, ferreteriamalaga.com»).
 */
export function scrapeTargets(): string[] {
  const extra = (process.env.SUMA_EXTRA_SHOPS ?? '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase().replace(/^www\./, ''))
    .filter((domain) => domain.includes('.'));
  return [...new Set([...DEFAULT_SHOPS, ...extra])];
}

export interface LivePage {
  url: string;
  domain: string;
  /** Evidencia destilada de la página: datos schema.org + texto visible. */
  evidence: string;
  /**
   * `true` si la página se descargó y leyó de verdad; `false` si la tienda
   * bloquea la descarga y la evidencia procede del índice de Google (título
   * y extracto de esa misma ficha).
   */
  fetched: boolean;
}

/** Fichas que se piden al buscador de cada tienda. */
const PAGES_PER_SHOP = 2;
/** Fichas que se descargan como máximo entre todas las tiendas. */
const MAX_PAGES = 8;
/** Evidencia que se conserva por ficha, para que el informe no se desborde. */
const EVIDENCE_CHARS_PER_PAGE = 2_600;

/**
 * Busca el material en cada tienda y descarga las fichas encontradas.
 * Las tiendas se reparten los huecos por turnos (una ficha de cada una antes
 * que dos de la misma), para que el resultado cubra varias tiendas y no solo
 * la primera. Nunca lanza; el peor caso es una lista vacía.
 */
export async function scrapeShops(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LivePage[]> {
  if (!isCseConfigured() || !query.trim()) return [];

  const domains = scrapeTargets();
  const discovered = await Promise.all(
    domains.map((domain) =>
      searchShopProducts(query, domain, PAGES_PER_SHOP).catch(() => []),
    ),
  );

  const candidates = interleave(discovered).slice(0, MAX_PAGES);

  const pages = await Promise.all(
    candidates.map(async (candidate) => {
      const page = await fetchProductPage(candidate.url, fetchImpl);
      if (page) {
        const evidence = extractPageEvidence(page.html).slice(0, EVIDENCE_CHARS_PER_PAGE);
        if (evidence) {
          return { url: page.finalUrl, domain: candidate.domain, evidence, fetched: true };
        }
      }

      // La tienda bloquea la descarga (antibot) o la página no se dejó leer:
      // se aprovecha lo que el índice de Google guarda de esa misma ficha,
      // que es mejor que perder la tienda entera.
      const snippet = candidate.snippet.trim();
      if (!snippet) return null;
      return {
        url: candidate.url,
        domain: candidate.domain,
        evidence: `Título: ${candidate.title}\nExtracto del índice de Google: ${snippet}`,
        fetched: false,
      };
    }),
  );

  return pages.filter((page): page is LivePage => page !== null);
}

/** Una de cada tienda, luego la segunda de cada una, y así sucesivamente. */
function interleave<T>(groups: T[][]): T[] {
  const result: T[] = [];
  const longest = Math.max(0, ...groups.map((group) => group.length));
  for (let round = 0; round < longest; round += 1) {
    for (const group of groups) {
      if (group[round] !== undefined) result.push(group[round]);
    }
  }
  return result;
}

/** Formatea las fichas leídas como evidencia para el paso de estructuración. */
export function formatLiveEvidence(pages: LivePage[]): string {
  if (pages.length === 0) return '';

  const blocks = pages.map((page, index) => {
    const label = page.fetched
      ? `--- FICHA EN VIVO ${index + 1} · ${page.domain}`
      : `--- FICHA DEL ÍNDICE ${index + 1} · ${page.domain} (la tienda bloquea la descarga directa; título y extracto del índice de Google)`;
    return `${label}\nURL: ${page.url}\n${page.evidence}`;
  });

  return (
    'FICHAS DESCARGADAS EN VIVO DE LAS TIENDAS (fuente principal: cada bloque ' +
    'es el contenido REAL de una ficha de producto leída ahora mismo de la web ' +
    'de la tienda, o —si la tienda bloquea la descarga— lo que el índice de ' +
    'Google guarda de esa ficha; las URLs son literales)\n' +
    blocks.join('\n')
  );
}
