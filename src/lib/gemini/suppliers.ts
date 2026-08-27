import type { GenerateContentResponse } from '@google/genai';
import {
  SEARCH_MODEL,
  UTILITY_MODEL,
  extractJson,
  getGemini,
  withTimeout,
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
import { formatCseEvidence, searchProductPages } from '../search/google-cse';
import {
  supplierOfferSchema,
  type GroundingSource,
  type MaterialRequest,
  type SupplierOffer,
} from '../types';
import { isMeasureUnit, isSaleUnit, saleUnitAsMeasure } from '../units';

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

  // Dos fuentes en paralelo, para que la segunda no añada latencia:
  //  - el grounding de Gemini sobre Google Search (razonamiento + fuentes), y
  //  - la búsqueda programática con la API oficial de Google Custom Search,
  //    que aporta más fichas de producto con URL literal. Cada una puede
  //    fallar sin arrastrar a la otra.
  const [grounded, cseResults] = await Promise.all([
    runGroundedSearch(description, request.searchQueries, budget).catch((error) => {
      console.warn('[suma] búsqueda anclada no disponible:', error);
      return null;
    }),
    searchProductPages(
      request.searchQueries.length > 0
        ? request.searchQueries
        : [`${request.material} precio comprar`],
    ),
  ]);

  let findings = grounded?.text ?? '';
  const sources: GroundingSource[] = grounded?.sources ?? [];

  const cseEvidence = formatCseEvidence(cseResults);
  if (cseEvidence) {
    findings = findings ? `${findings}\n\n${cseEvidence}` : cseEvidence;
  }

  // Las fichas de la API se suman a las fuentes visibles, sin duplicados.
  const seenSources = new Set(sources.map((source) => source.url));
  for (const result of cseResults.slice(0, 6)) {
    if (seenSources.has(result.url)) continue;
    seenSources.add(result.url);
    sources.push({ title: `${result.title} · ${result.domain}`, url: result.url });
  }

  const structured = findings
    ? await structureFindings(description, findings, budget)
    : await runKnowledgeOnlySearch(description, budget);

  const offers = structured.offers.filter((offer) => offer.price > 0);

  if (offers.length === 0) {
    const fallback = searchDemoCatalog(`${request.material} ${request.category}`);
    if (fallback.length > 0) {
      return {
        summary:
          'No he podido confirmar precios publicados para este material, así que te muestro ' +
          'referencias de mercado orientativas de distribuidores que sirven en Málaga. ' +
          'Conviene confirmarlas con el proveedor antes de cerrar el presupuesto.',
        offers: fallback,
        sources,
        demoMode: true,
      };
    }
  }

  return { summary: structured.summary, offers, sources, demoMode: false };
}

/** Primera llamada: búsqueda en Google con razonamiento en texto libre. */
async function runGroundedSearch(
  description: string,
  queries: string[],
  budget?: RequestBudget,
): Promise<{ text: string; sources: GroundingSource[] }> {
  const ai = getGemini();

  const response = await withTimeout(
    ai.models.generateContent({
      model: SEARCH_MODEL,
      contents: buildSearchPrompt(description, queries),
      config: {
        systemInstruction: BASE_SYSTEM,
        tools: [{ googleSearch: {} }],
        temperature: 0.3,
        abortSignal: budget?.signal,
      },
    }),
    budget?.remaining(),
    'La búsqueda de proveedores',
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
  const ai = getGemini();

  const response = await withTimeout(
    ai.models.generateContent({
      model: UTILITY_MODEL,
      contents: buildStructuringPrompt(description, findings),
      config: {
        systemInstruction: BASE_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: offersResponseSchema,
        temperature: 0.1,
        abortSignal: budget?.signal,
      },
    }),
    budget?.remaining(),
    'La estructuración de las ofertas',
  );

  return normalizeOffersResponse(extractJson(response.text));
}

/** Respaldo cuando la herramienta de búsqueda no está disponible. */
async function runKnowledgeOnlySearch(
  description: string,
  budget?: RequestBudget,
): Promise<{ summary: string; offers: SupplierOffer[] }> {
  const ai = getGemini();

  const response = await withTimeout(
    ai.models.generateContent({
      model: SEARCH_MODEL,
      contents: buildKnowledgeOnlyPrompt(description),
      config: {
        systemInstruction: BASE_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: offersResponseSchema,
        temperature: 0.4,
        abortSignal: budget?.signal,
      },
    }),
    budget?.remaining(),
    'La búsqueda de proveedores',
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
