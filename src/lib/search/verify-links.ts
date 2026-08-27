/**
 * Verificación en vivo de las fichas de producto enlazadas.
 *
 * Antes de enseñar una oferta, el servidor comprueba que su `sourceUrl`
 * responde de verdad: así un enlace muerto (producto retirado, catálogo
 * renovado, URL mal recordada por el modelo) no llega nunca al usuario como
 * si fuera un sitio donde comprar.
 *
 * La comprobación es deliberadamente conservadora. Sólo se da un enlace por
 * muerto con una señal inequívoca (404/410, o una redirección a la portada de
 * la tienda, que es el «página no encontrada» encubierto de muchos
 * comercios). Un 403, un 429 o un timeout no demuestran nada —las tiendas
 * grandes tienen protecciones antibot que rechazan peticiones de servidores—
 * así que en esos casos el enlace se conserva, simplemente sin la marca de
 * verificado. Perder una ficha buena por un cortafuegos sería peor que dejar
 * pasar una dudosa.
 */

export type LinkStatus = 'ok' | 'gone' | 'unknown';

/** Reparto de tiempo: la verificación nunca puede comerse la respuesta. */
const VERIFY_CAP_MS = 6_500;
const RESPONSE_RESERVE_MS = 2_000;
const VERIFY_MIN_WORTH_MS = 1_500;
const PER_ATTEMPT_MS = 4_000;
const MIN_ATTEMPT_MS = 400;
/** Enlaces distintos a comprobar como máximo por búsqueda. */
const MAX_LINKS = 10;

/** Tope para la verificación, o `null` si no queda tiempo digno. */
export function verificationCap(remainingMs: number): number | null {
  const cap = Math.min(VERIFY_CAP_MS, remainingMs - RESPONSE_RESERVE_MS);
  return cap >= VERIFY_MIN_WORTH_MS ? cap : null;
}

/** Presupuesto por defecto cuando la llamada no viene con presupuesto. */
export const VERIFY_DEFAULT_REMAINING_MS = VERIFY_CAP_MS + RESPONSE_RESERVE_MS;

/**
 * Cabeceras de navegador real: bastantes tiendas devuelven 403 a la cabecera
 * por defecto de Node aunque la página exista. No es una evasión —la petición
 * es un único GET a una ficha pública, lo mismo que hace el navegador del
 * usuario al pinchar el enlace—, sólo evita falsos negativos.
 */
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9',
};

/**
 * URL reducida a su identidad (esquema fuera, sin «www.», sin parámetros ni
 * barra final), para poder comparar la ficha de una oferta con la misma ficha
 * vista por la búsqueda programática.
 */
export function canonicalUrl(link: string): string | null {
  try {
    const parsed = new URL(link);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${host}${path}`;
  } catch {
    return null;
  }
}

/** Clasifica la respuesta HTTP de una ficha. */
export function classifyResponse(
  status: number,
  finalUrl: string,
  requestedUrl: string,
): LinkStatus {
  // Redirigir la ficha a la portada es el «no existe» encubierto de muchas
  // tiendas: devuelve 200, pero el producto ya no está.
  if (finalUrl && finalUrl !== requestedUrl) {
    try {
      const parsed = new URL(finalUrl);
      if (parsed.pathname === '/' && !parsed.search) return 'gone';
    } catch {
      // Una URL final ilegible no aporta información; se sigue por el estado.
    }
  }

  if (status >= 200 && status < 300) return 'ok';
  if (status === 404 || status === 410) return 'gone';
  return 'unknown';
}

/**
 * Comprueba una ficha: primero con HEAD (barato) y, si no es concluyente,
 * con un GET del que sólo se leen las cabeceras. Nunca lanza.
 */
export async function checkProductUrl(
  link: string,
  capMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<LinkStatus> {
  const startedAt = Date.now();

  const attempt = async (method: 'HEAD' | 'GET'): Promise<LinkStatus | null> => {
    const remaining = capMs - (Date.now() - startedAt);
    if (remaining < MIN_ATTEMPT_MS) return null;

    try {
      const response = await fetchImpl(link, {
        method,
        headers: BROWSER_HEADERS,
        redirect: 'follow',
        cache: 'no-store',
        signal: AbortSignal.timeout(Math.min(PER_ATTEMPT_MS, remaining)),
      });
      // Sólo interesan el estado y la URL final: el cuerpo se descarta sin
      // descargarlo.
      try {
        await response.body?.cancel();
      } catch {
        // Cuerpo ya consumido o no cancelable: irrelevante.
      }
      return classifyResponse(response.status, response.url, link);
    } catch {
      // Timeout, DNS, red cortada… no demuestran que la ficha no exista.
      return null;
    }
  };

  const viaHead = await attempt('HEAD');
  if (viaHead === 'ok' || viaHead === 'gone') return viaHead;

  // Muchas tiendas rechazan HEAD (405 o antibot) pero sirven el GET normal.
  const viaGet = await attempt('GET');
  return viaGet ?? 'unknown';
}

/**
 * Comprueba en paralelo todos los enlaces distintos de una lista de ofertas.
 * Devuelve el estado por URL; una URL ausente del mapa cuenta como `unknown`.
 */
export async function checkLinks(
  links: Array<string | null>,
  capMs: number | null,
  fetchImpl: typeof fetch = fetch,
): Promise<Map<string, LinkStatus>> {
  const statuses = new Map<string, LinkStatus>();
  if (capMs === null) return statuses;

  const unique = [...new Set(links.filter((link): link is string => link !== null))].slice(
    0,
    MAX_LINKS,
  );

  await Promise.all(
    unique.map(async (link) => {
      statuses.set(link, await checkProductUrl(link, capMs, fetchImpl));
    }),
  );

  return statuses;
}
