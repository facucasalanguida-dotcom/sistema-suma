import { SUPPLIER_DIRECTORY } from '../demo/suppliers';
import type { Supplier } from '../types';

/**
 * Importación de una ficha de producto pegada en el chat.
 *
 * Es la otra mitad del flujo «explora la tienda y tráete el producto»: el
 * usuario navega por la web del proveedor con todas sus opciones, copia el
 * enlace del producto que le convence y lo pega en el chat. Aquí se decide si
 * el mensaje es un enlace, se descarga esa página desde el servidor y se
 * destila la evidencia (datos estructurados schema.org, título y texto
 * visible) para que el modelo la convierta en una oferta del presupuesto.
 */

const URL_PATTERN = /https?:\/\/[^\s<>"'\])]+/i;

/** Bytes de HTML que se conservan como máximo de una página descargada. */
const MAX_HTML_CHARS = 1_500_000;
const FETCH_TIMEOUT_MS = 8_000;

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9',
};

/**
 * Extrae del mensaje la URL del producto, si el mensaje es eso: un enlace
 * pegado (solo o con algo de texto alrededor). Devuelve `null` si no hay URL
 * o si no es segura de visitar desde el servidor.
 */
export function extractProductUrl(text: string): string | null {
  const match = text.match(URL_PATTERN);
  if (!match) return null;

  // La puntuación pegada al final («...html.», «...html)») no es parte del enlace.
  const candidate = match[0].replace(/[.,;:!?)\]]+$/, '');
  return isSafeRemoteUrl(candidate) ? candidate : null;
}

/**
 * Sólo se visitan URLs públicas y normales de tiendas: https, con nombre de
 * dominio real y sin puerto raro. Un servidor nunca debe dejarse dirigir a
 * direcciones internas (localhost, IPs privadas) por una URL pegada en un chat.
 */
export function isSafeRemoteUrl(candidate: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;
  if (parsed.port && parsed.port !== '443') return false;
  if (parsed.username || parsed.password) return false;

  const host = parsed.hostname.toLowerCase();
  if (!host.includes('.')) return false;
  if (host.startsWith('[')) return false; // IPv6 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false; // IPv4 literal
  if (host === 'localhost' || host.endsWith('.localhost')) return false;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan')) {
    return false;
  }

  return true;
}

/** Una portada o una raíz de sección no es la ficha de un producto. */
export function looksLikeHomepage(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return parsed.pathname === '/' && !parsed.search;
  } catch {
    return false;
  }
}

export interface FetchedPage {
  html: string;
  finalUrl: string;
  status: number;
}

/**
 * Descarga la página del producto. Devuelve `null` si la tienda no responde,
 * bloquea la petición o no devuelve HTML. Nunca lanza.
 */
export async function fetchProductPage(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedPage | null> {
  try {
    const response = await fetchImpl(url, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType && !contentType.includes('html')) return null;

    const html = (await response.text()).slice(0, MAX_HTML_CHARS);
    if (!html.trim()) return null;

    return { html, finalUrl: response.url || url, status: response.status };
  } catch {
    return null;
  }
}

/**
 * Destila una página HTML a la evidencia que necesita el modelo: los bloques
 * de datos estructurados schema.org (las tiendas serias publican ahí nombre,
 * marca, precio y disponibilidad), el título y el texto visible del principio
 * de la página. Así la llamada al modelo es corta y fiel a la fuente.
 */
export function extractPageEvidence(html: string): string {
  const sections: string[] = [];

  const title = matchOne(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) sections.push(`TÍTULO DE LA PÁGINA\n${decodeEntities(collapse(title))}`);

  const jsonLdBlocks = extractJsonLd(html);
  if (jsonLdBlocks.length > 0) {
    sections.push(`DATOS ESTRUCTURADOS DE LA TIENDA (schema.org)\n${jsonLdBlocks.join('\n')}`);
  }

  const text = visibleText(html).slice(0, 8_000);
  if (text) sections.push(`TEXTO VISIBLE DE LA PÁGINA (extracto)\n${text}`);

  return sections.join('\n\n');
}

/** Bloques `application/ld+json` que describen productos u ofertas. */
function extractJsonLd(html: string): string[] {
  const blocks: string[] = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      // Sólo interesan los nodos con pinta de producto: el resto (migas de
      // pan, organización, buscador del sitio) es ruido para el modelo.
      const relevant = /"@type"\s*:\s*"?(Product|Offer|AggregateOffer)/i.test(raw);
      if (!relevant) continue;
      blocks.push(JSON.stringify(parsed).slice(0, 4_000));
    } catch {
      // JSON roto: se ignora el bloque.
    }
    if (blocks.length >= 3) break;
  }

  return blocks;
}

/** Texto visible: fuera scripts, estilos y etiquetas; espacios normalizados. */
function visibleText(html: string): string {
  const withoutBlocks = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  return decodeEntities(collapse(withoutBlocks.replace(/<[^>]+>/g, ' ')));
}

function matchOne(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match ? match[1] : null;
}

function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&euro;/gi, '€');
}

/**
 * Proveedor que corresponde al dominio de la ficha: si está en el directorio
 * de Málaga se usan sus datos; si no, la propia tienda online.
 */
export function supplierForDomain(url: string): Supplier {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    // Se cae al proveedor genérico de abajo.
  }

  for (const supplier of SUPPLIER_DIRECTORY) {
    if (!supplier.website) continue;
    const domain = supplier.website.replace(/^www\./, '').toLowerCase();
    if (host === domain || host.endsWith(`.${domain}`)) {
      return {
        name: supplier.name,
        location: supplier.location,
        website: supplier.website,
        phone: supplier.phone,
      };
    }
  }

  return {
    name: host || 'Tienda online',
    location: 'Tienda online con envío a Málaga',
    website: host || null,
    phone: null,
  };
}
