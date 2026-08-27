import type { GenerateContentResponse } from '@google/genai';
import {
  SEARCH_MODEL,
  UTILITY_MODEL,
  callGemini,
  extractJson,
  type RequestBudget,
} from './client';
import {
  BASE_SYSTEM,
  buildKnowledgeOnlyPrompt,
  buildSearchPrompt,
  buildStructuringPrompt,
} from './prompts';
import { offersResponseSchema } from './schemas';
import { searchDemoCatalog } from '../demo/catalog';
import {
  findProductPageOnSite,
  formatCseEvidence,
  isCseConfigured,
  searchProductPages,
} from '../search/google-cse';
import { productSearchTerms, siteDomain } from '../search/fallback-link';
import { formatLiveEvidence, scrapeShops, type LivePage } from '../search/live-shops';
import {
  VERIFY_DEFAULT_REMAINING_MS,
  canonicalUrl,
  checkLinks,
  verificationCap,
  type LinkStatus,
} from '../search/verify-links';
import {
  supplierOfferSchema,
  type GroundingSource,
  type MaterialRequest,
  type SupplierOffer,
} from '../types';
import { isMeasureUnit, isSaleUnit, saleUnitAsMeasure } from '../units';

/**
 * Reparto del tiempo dentro de una búsqueda.
 *
 * El grounding es el paso lento y prescindible (hay plan B); estructurar es
 * rápido e imprescindible. Así que el grounding recibe como mucho 25 s y
 * siempre se le reserva tiempo al estructurado; si ni siquiera hay hueco
 * digno para el grounding, se salta directamente.
 */
const GROUNDED_CAP_MS = 25_000;
const STRUCTURE_RESERVE_MS = 18_000;
const GROUNDED_MIN_WORTH_MS = 8_000;
const STRUCTURE_CAP_MS = 20_000;

/** Tope para la llamada con grounding, o `null` si no merece la pena lanzarla. */
export function groundedSearchCap(remainingMs: number): number | null {
  const cap = Math.min(GROUNDED_CAP_MS, remainingMs - STRUCTURE_RESERVE_MS);
  return cap >= GROUNDED_MIN_WORTH_MS ? cap : null;
}

export interface SupplierSearchResult {
  summary: string;
  offers: SupplierOffer[];
  sources: GroundingSource[];
  /** `true` si los precios salen del catálogo local y no de una búsqueda. */
  demoMode: boolean;
}

/**
 * Paso 3 del proceso: busca proveedores en Málaga y compara precios.
 *
 * Se hace en dos llamadas a propósito. La API no admite anclaje en Google
 * Search y salida JSON estructurada en la misma petición: la primera llamada
 * busca y razona en texto libre con la herramienta de búsqueda activada, y la
 * segunda convierte ese informe en datos estructurados sin herramientas.
 * De paso, la separación permite conservar las fuentes citadas.
 */
export async function searchSuppliers(
  request: MaterialRequest,
  budget?: RequestBudget,
): Promise<SupplierSearchResult> {
  const description = describeMaterial(request);

  // Tres fuentes en paralelo, para que ninguna añada latencia a las demás:
  //  - la lectura EN VIVO de las tiendas (buscar el material en cada una y
  //    descargar sus fichas ahora mismo): la fuente principal,
  //  - el grounding de Gemini sobre Google Search (razonamiento + fuentes), y
  //  - la búsqueda programática general, que aporta fichas de tiendas que no
  //    están en la lista de lectura en vivo.
  // Cada una puede fallar sin arrastrar a las otras.
  const cap = groundedSearchCap(budget?.remaining() ?? GROUNDED_CAP_MS + STRUCTURE_RESERVE_MS);
  const scrapeQuery = request.searchQueries[0] ?? `${request.material}`;

  const [grounded, cseResults, livePages] = await Promise.all([
    cap === null
      ? Promise.resolve(null)
      : runGroundedSearch(description, request.searchQueries, budget, cap).catch((error) => {
          console.warn('[suma] búsqueda anclada no disponible:', error);
          return null;
        }),
    searchProductPages(
      request.searchQueries.length > 0
        ? request.searchQueries
        : [`${request.material} precio comprar`],
    ),
    withCap(scrapeShops(scrapeQuery), SCRAPE_CAP_MS, [] as LivePage[]).catch(() => []),
  ]);

  let findings = grounded?.text ?? '';
  const sources: GroundingSource[] = grounded?.sources ?? [];

  // La evidencia en vivo va la primera: es la fuente que manda.
  const liveEvidence = formatLiveEvidence(livePages);
  if (liveEvidence) {
    findings = findings ? `${liveEvidence}\n\n${findings}` : liveEvidence;
  }

  const cseEvidence = formatCseEvidence(cseResults);
  if (cseEvidence) {
    findings = findings ? `${findings}\n\n${cseEvidence}` : cseEvidence;
  }

  // Las fichas leídas y las de la API se suman a las fuentes visibles.
  const seenSources = new Set(sources.map((source) => source.url));
  for (const page of livePages) {
    if (seenSources.has(page.url)) continue;
    seenSources.add(page.url);
    sources.push({ title: `Ficha leída en vivo · ${page.domain}`, url: page.url });
  }
  for (const result of cseResults.slice(0, 6)) {
    if (seenSources.has(result.url)) continue;
    seenSources.add(result.url);
    sources.push({ title: `${result.title} · ${result.domain}`, url: result.url });
  }

  const structured = findings
    ? await structureFindings(description, findings, budget)
    : await runKnowledgeOnlySearch(description, budget);

  let summary = structured.summary;
  let offers = structured.offers.filter((offer) => offer.price > 0);
  let demoMode = false;

  // El catálogo local sólo entra en juego cuando la lectura en vivo de las
  // tiendas no está disponible (falta la clave de Custom Search): con la
  // lectura en vivo activa, el usuario quiere datos leídos hoy de las
  // tiendas, no referencias guardadas.
  if (offers.length === 0 && livePages.length === 0 && !isCseConfigured()) {
    const fallback = searchDemoCatalog(`${request.material} ${request.category}`);
    if (fallback.length > 0) {
      summary =
        'No he podido confirmar precios publicados para este material, así que te muestro ' +
        'referencias de mercado orientativas de distribuidores que sirven en Málaga. ' +
        'Conviene confirmarlas con el proveedor antes de cerrar el presupuesto.';
      offers = fallback;
      demoMode = true;
    }
  }

  // Las fichas leídas en vivo ya están comprobadas por definición: acaban de
  // responder con su contenido. Cuentan como verificadas y no se re-visitan.
  const liveCanonicals = new Set<string>();
  for (const page of livePages) {
    const canonical = canonicalUrl(page.url);
    if (canonical) liveCanonicals.add(canonical);
  }

  const indexed = new Set<string>(liveCanonicals);
  for (const result of cseResults) {
    const canonical = canonicalUrl(result.url);
    if (canonical) indexed.add(canonical);
  }

  // Rescate de enlaces: a las ofertas que llegan sin ficha se les pregunta al
  // índice de Google si la web de SU proveedor tiene una página para ese
  // producto. Si aparece, la oferta gana su enlace directo; si no, la
  // interfaz enseñará una búsqueda del producto en la tienda, nunca la
  // portada.
  if (!demoMode) {
    const recovered = await recoverMissingLinks(offers, budget);
    for (const url of recovered.values()) {
      const canonical = canonicalUrl(url);
      if (canonical) indexed.add(canonical);
    }
    offers = attachRecoveredLinks(offers, recovered);
  }

  // Último control de calidad antes de responder: se comprueba en vivo que
  // cada ficha enlazada sigue existiendo. Los enlaces muertos se retiran y
  // los confirmados (por respuesta directa o por estar en el índice de la
  // búsqueda programática) se marcan como verificados.
  if (offers.some((offer) => offer.sourceUrl !== null)) {
    const cap = verificationCap(budget?.remaining() ?? VERIFY_DEFAULT_REMAINING_MS);
    const statuses = await checkLinks(
      offers.map((offer) => {
        if (!offer.sourceUrl) return null;
        const canonical = canonicalUrl(offer.sourceUrl);
        // Las fichas leídas en vivo no se re-visitan.
        return canonical && liveCanonicals.has(canonical) ? null : offer.sourceUrl;
      }),
      cap,
    );
    offers = applyLinkVerification(offers, statuses, indexed);
  }

  return { summary, offers, sources, demoMode };
}

/** Tope de la lectura en vivo; corre en paralelo al grounding y nunca lo frena. */
const SCRAPE_CAP_MS = 15_000;

/** Devuelve el resultado de la promesa, o `fallback` si tarda más de `capMs`. */
function withCap<T>(promise: Promise<T>, capMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), capMs)),
  ]);
}

/** Reparto de tiempo del rescate: sólo se intenta con hueco de sobra. */
const RECOVERY_CAP_MS = 7_000;
const RECOVERY_RESERVE_MS = 10_000;
const RECOVERY_MIN_WORTH_MS = 2_000;
/** Ofertas sin enlace que se intentan rescatar como máximo. */
const RECOVERY_MAX_OFFERS = 4;

/** Tope para el rescate de enlaces, o `null` si no queda tiempo digno. */
export function recoveryCap(remainingMs: number): number | null {
  const cap = Math.min(RECOVERY_CAP_MS, remainingMs - RECOVERY_RESERVE_MS);
  return cap >= RECOVERY_MIN_WORTH_MS ? cap : null;
}

/**
 * Qué ofertas se pueden rescatar y con qué consulta: las que no traen ficha
 * pero cuyo proveedor sí tiene web donde buscarla.
 */
export function linkRecoveryTargets(
  offers: SupplierOffer[],
): Array<{ id: string; query: string; domain: string }> {
  const targets: Array<{ id: string; query: string; domain: string }> = [];
  for (const offer of offers) {
    if (offer.sourceUrl) continue;
    const domain = siteDomain(offer.supplier.website);
    if (!domain) continue;
    const query = productSearchTerms(offer);
    if (!query) continue;
    targets.push({ id: offer.id, query, domain });
    if (targets.length >= RECOVERY_MAX_OFFERS) break;
  }
  return targets;
}

/** Aplica los enlaces rescatados (id de oferta → URL de la ficha). */
export function attachRecoveredLinks(
  offers: SupplierOffer[],
  recovered: Map<string, string>,
): SupplierOffer[] {
  if (recovered.size === 0) return offers;
  return offers.map((offer) => {
    const url = recovered.get(offer.id);
    return url ? { ...offer, sourceUrl: url } : offer;
  });
}

/**
 * Busca en paralelo la ficha de cada oferta sin enlace dentro de la web de su
 * proveedor. Si el tiempo se agota, se abandona lo que falte: el rescate es
 * un extra, no puede convertir una búsqueda buena en un timeout.
 */
async function recoverMissingLinks(
  offers: SupplierOffer[],
  budget?: RequestBudget,
): Promise<Map<string, string>> {
  const recovered = new Map<string, string>();
  if (!isCseConfigured()) return recovered;

  const targets = linkRecoveryTargets(offers);
  if (targets.length === 0) return recovered;

  const cap = recoveryCap(budget?.remaining() ?? RECOVERY_CAP_MS + RECOVERY_RESERVE_MS);
  if (cap === null) return recovered;

  const lookups = Promise.all(
    targets.map(async (target) => {
      try {
        const page = await findProductPageOnSite(target.query, target.domain);
        if (page) recovered.set(target.id, page.url);
      } catch {
        // El rescate nunca rompe la búsqueda.
      }
    }),
  );

  await Promise.race([
    lookups,
    new Promise<void>((resolve) => setTimeout(resolve, cap)),
  ]);

  return recovered;
}

/**
 * Aplica el veredicto de la verificación de enlaces a las ofertas.
 *
 * - Ficha muerta (404/410 o redirección a portada): el enlace se retira y el
 *   precio pasa a estimado, porque su fuente ya no existe.
 * - Ficha que responde, o presente en el índice de Google de la búsqueda
 *   programática: se marca `linkVerified`.
 * - Sin veredicto (antibot, timeout, sin tiempo): el enlace se conserva tal
 *   cual, sin marca. No se castiga lo que no se pudo comprobar.
 *
 * Después se reordena la preferencia por ofertas con enlace, de modo que una
 * oferta que acaba de perder su ficha se descarta si quedan alternativas
 * enlazadas suficientes.
 */
export function applyLinkVerification(
  offers: SupplierOffer[],
  statuses: Map<string, LinkStatus>,
  indexedCanonicals: Set<string>,
): SupplierOffer[] {
  const annotated = offers.map((offer): SupplierOffer => {
    if (!offer.sourceUrl) return offer;

    const status = statuses.get(offer.sourceUrl) ?? 'unknown';
    if (status === 'gone') {
      return { ...offer, sourceUrl: null, linkVerified: false, confidence: 'estimada' };
    }

    const canonical = canonicalUrl(offer.sourceUrl);
    const indexed = canonical !== null && indexedCanonicals.has(canonical);
    if (status === 'ok' || indexed) {
      return { ...offer, linkVerified: true };
    }

    return offer;
  });

  return preferLinkedOffers(annotated);
}

/** Primera llamada: búsqueda en Google con razonamiento en texto libre. */
async function runGroundedSearch(
  description: string,
  queries: string[],
  budget: RequestBudget | undefined,
  capMs: number,
): Promise<{ text: string; sources: GroundingSource[] }> {
  const response = await callGemini(
    {
      model: SEARCH_MODEL,
      contents: buildSearchPrompt(description, queries),
      config: {
        systemInstruction: BASE_SYSTEM,
        tools: [{ googleSearch: {} }],
        temperature: 0.3,
      },
    },
    budget,
    'La búsqueda de proveedores',
    capMs,
  );

  const text = response.text?.trim() ?? '';
  if (!text) throw new Error('La búsqueda no devolvió resultados.');

  return { text, sources: extractSources(response) };
}

/** Segunda llamada: estructuración del informe, ya sin herramientas. */
async function structureFindings(
  description: string,
  findings: string,
  budget?: RequestBudget,
): Promise<{ summary: string; offers: SupplierOffer[] }> {
  const response = await callGemini(
    {
      model: UTILITY_MODEL,
      contents: buildStructuringPrompt(description, findings),
      config: {
        systemInstruction: BASE_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: offersResponseSchema,
        temperature: 0.1,
      },
    },
    budget,
    'La estructuración de las ofertas',
    STRUCTURE_CAP_MS,
  );

  return normalizeOffersResponse(extractJson(response.text));
}

/** Respaldo cuando la herramienta de búsqueda no está disponible. */
async function runKnowledgeOnlySearch(
  description: string,
  budget?: RequestBudget,
): Promise<{ summary: string; offers: SupplierOffer[] }> {
  const response = await callGemini(
    {
      model: SEARCH_MODEL,
      contents: buildKnowledgeOnlyPrompt(description),
      config: {
        systemInstruction: BASE_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: offersResponseSchema,
        temperature: 0.4,
      },
    },
    budget,
    'La búsqueda de proveedores',
    STRUCTURE_CAP_MS,
  );

  return normalizeOffersResponse(extractJson(response.text));
}

/** Fuentes citadas por el anclaje en Google Search, sin duplicados. */
export function extractSources(response: GenerateContentResponse): GroundingSource[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const sources: GroundingSource[] = [];

  for (const chunk of chunks) {
    const url = chunk.web?.uri;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sources.push({ title: chunk.web?.title?.trim() || hostOf(url), url });
  }

  return sources;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Convierte la respuesta plana del modelo en ofertas del dominio, corrigiendo
 * los errores más frecuentes: rendimientos a cero, unidades desconocidas o
 * incoherencias entre la unidad de venta y la del rendimiento.
 */
export function normalizeOffersResponse(raw: unknown): {
  summary: string;
  offers: SupplierOffer[];
} {
  const data = (raw ?? {}) as Record<string, unknown>;
  const rawOffers = Array.isArray(data.offers) ? data.offers : [];

  const offers: SupplierOffer[] = [];

  rawOffers.forEach((entry, index) => {
    const offer = normalizeOffer(entry as Record<string, unknown>, index);
    if (offer) offers.push(offer);
  });

  return {
    summary: String(data.summary ?? '').trim() || 'Estas son las opciones que he encontrado.',
    offers: preferLinkedOffers(offers),
  };
}

/**
 * El usuario quiere poder comprar desde el resultado, así que una oferta con
 * la ficha del producto enlazada vale más que una sin ella. Si hay al menos
 * dos opciones con enlace, las que no lo tienen se descartan; si casi ninguna
 * lo tiene, se conservan todas (con el enlace ausente señalizado en la
 * interfaz) antes que dejar al usuario sin resultados.
 */
export function preferLinkedOffers(offers: SupplierOffer[]): SupplierOffer[] {
  const linked = offers.filter((offer) => offer.sourceUrl !== null);
  if (linked.length >= 2) return linked;
  return [...linked, ...offers.filter((offer) => offer.sourceUrl === null)];
}

function normalizeOffer(entry: Record<string, unknown>, index: number): SupplierOffer | null {
  const price = Number(entry.price);
  if (!Number.isFinite(price) || price <= 0) return null;

  const saleUnitRaw = String(entry.saleUnit ?? 'ud');
  const saleUnit = isSaleUnit(saleUnitRaw) ? saleUnitRaw : 'ud';

  const coverage = resolveCoverage(entry, saleUnit);
  if (!coverage) return null;

  const productName = String(entry.productName ?? '').trim();
  if (!productName) return null;

  const candidate = {
    id: `ai-${index}-${slug(productName)}`,
    productName,
    brand: text(entry.brand),
    supplier: {
      name: String(entry.supplierName ?? '').trim() || 'Proveedor por confirmar',
      location: String(entry.supplierLocation ?? '').trim() || 'Provincia de Málaga',
      website: text(entry.supplierWebsite),
      phone: text(entry.supplierPhone),
    },
    price,
    saleUnit,
    priceIncludesVat: Boolean(entry.priceIncludesVat),
    coverage,
    recommendedWastePct: clampWaste(Number(entry.recommendedWastePct ?? 0)),
    specs: Array.isArray(entry.specs)
      ? entry.specs
          .map((spec) => spec as Record<string, unknown>)
          .filter((spec) => spec && spec.key && spec.value)
          .map((spec) => ({ key: String(spec.key), value: String(spec.value) }))
      : [],
    availability: text(entry.availability),
    delivery: text(entry.delivery),
    sourceUrl: url(entry.sourceUrl),
    confidence: ['alta', 'media', 'estimada'].includes(String(entry.confidence))
      ? String(entry.confidence)
      : 'estimada',
    highlight: text(entry.highlight),
    // Una búsqueda responde siempre a un único material, así que todas las
    // ofertas son comparables entre sí.
    group: null,
  };

  const parsed = supplierOfferSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * Determina el rendimiento de una unidad de venta.
 *
 * Cuando el modelo no lo indica o lo deja a cero, se deduce: si la unidad de
 * venta es en sí una unidad de medida (€/m², €/m, €/kg…), el rendimiento es 1.
 * Sólo se descarta la oferta si la unidad de venta es un envase (caja, saco,
 * palet) sin rendimiento declarado, porque entonces no se puede presupuestar.
 */
function resolveCoverage(
  entry: Record<string, unknown>,
  saleUnit: SupplierOffer['saleUnit'],
): SupplierOffer['coverage'] | null {
  const value = Number(entry.coverageValue);
  const unitRaw = String(entry.coverageUnit ?? '');
  const note = text(entry.coverageNote);

  if (Number.isFinite(value) && value > 0 && isMeasureUnit(unitRaw)) {
    return { value, unit: unitRaw, note };
  }

  const implied = saleUnitAsMeasure(saleUnit);
  if (implied) {
    return { value: 1, unit: implied, note };
  }

  return null;
}

function clampWaste(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, 30);
}

function text(value: unknown): string | null {
  const result = String(value ?? '').trim();
  return result.length > 0 && result.toLowerCase() !== 'n/a' ? result : null;
}

function url(value: unknown): string | null {
  const result = text(value);
  if (!result) return null;
  try {
    const parsed = new URL(result.startsWith('http') ? result : `https://${result}`);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    // Una portada («bigmat.es/») no lleva a ningún producto: como enlace de
    // compra no vale, y colarla como si fuera la ficha engaña al usuario.
    if (parsed.pathname === '/' && !parsed.search) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/** Descripción del material que se le pasa al buscador. */
export function describeMaterial(request: MaterialRequest): string {
  const lines = [`Material: ${request.material}`, `Familia: ${request.category}`];

  if (request.attributes.length > 0) {
    lines.push(
      `Características: ${request.attributes.map((a) => `${a.key}: ${a.value}`).join('; ')}`,
    );
  }
  if (request.imageDescription) {
    lines.push(`Lo que se aprecia en la fotografía aportada: ${request.imageDescription}`);
  }
  if (request.quantityHint) {
    lines.push(
      `Cantidad estimada por el usuario: ${request.quantityHint.value} ${request.quantityHint.unit}`,
    );
  }
  lines.push(`Se mide habitualmente en: ${request.typicalMeasureUnit}`);

  return lines.join('\n');
}
