import {
  SEARCH_MODEL,
  UTILITY_MODEL,
  callGemini,
  extractJson,
  type RequestBudget,
} from './client';
import { BASE_SYSTEM, buildImportPrompt, buildImportSearchPrompt } from './prompts';
import { offersResponseSchema } from './schemas';
import { normalizeOffersResponse } from './suppliers';
import {
  cleanProductUrl,
  describeUrlSlug,
  extractPageEvidence,
  fetchProductPage,
  looksLikeHomepage,
  supplierForDomain,
} from '../import/product-page';
import { isCseConfigured, searchShopProducts, type CseResult } from '../search/google-cse';
import { canonicalUrl } from '../search/verify-links';
import type { MaterialRequest, SupplierOffer } from '../types';

/**
 * Flujo «tráete el producto de la tienda»: el usuario navega por CUALQUIER
 * tienda online, elige el producto que le convence y pega aquí su enlace.
 *
 * Plan A: descargar la ficha en el momento y leerla tal cual.
 * Plan B: muchas tiendas grandes (Leroy Merlin, por ejemplo) bloquean las
 * descargas automáticas desde servidores. Entonces el producto se reconstruye
 * con lo que sí está disponible: la descripción que la propia URL lleva
 * escrita, lo que el índice de Google guarda de esa ficha y una búsqueda en
 * Internet sobre ese producto exacto. El precio jamás se inventa: si ninguna
 * fuente lo da, se le dice al usuario con claridad.
 */

const IMPORT_STRUCTURE_CAP_MS = 20_000;
/** Búsqueda anclada de la ficha bloqueada: sólo si queda tiempo de sobra. */
const IMPORT_SEARCH_CAP_MS = 14_000;
const IMPORT_SEARCH_MIN_REMAINING_MS = 30_000;

export type ImportResult =
  | { ok: true; offer: SupplierOffer; request: MaterialRequest; reply: string }
  | { ok: false; reply: string };

export async function importProductFromUrl(
  url: string,
  budget?: RequestBudget,
  fetchImpl: typeof fetch = fetch,
): Promise<ImportResult> {
  if (looksLikeHomepage(url)) {
    return {
      ok: false,
      reply:
        'Ese enlace es la portada de la tienda, no la ficha de un producto. ' +
        'Entra en el producto que te interese y pégame el enlace de su página.',
    };
  }

  const cleanUrl = cleanProductUrl(url);

  // Plan A: leer la página directamente (con la URL original y, si falla,
  // con la URL limpia de parámetros publicitarios).
  let page = await fetchProductPage(url, fetchImpl);
  if (!page && cleanUrl !== url) {
    page = await fetchProductPage(cleanUrl, fetchImpl);
  }

  if (page) {
    const evidence = extractPageEvidence(page.html);
    if (evidence) {
      return structureImport({
        url: cleanProductUrl(page.finalUrl),
        evidence,
        mode: 'pagina',
        linkVerified: true,
        budget,
      });
    }
  }

  // Plan B: la tienda bloquea la lectura. Se reconstruye la ficha con la
  // URL, el índice de Google y una búsqueda sobre ese producto exacto.
  const indirect = await gatherIndirectEvidence(cleanUrl, budget);

  if (!indirect.evidence) {
    return {
      ok: false,
      reply:
        'Esa tienda bloquea la lectura automática de su web y no he encontrado ' +
        'datos de esa ficha en el índice de Google. Dime el nombre del producto ' +
        '(por ejemplo, como aparece en el título de la página) y lo busco yo.',
    };
  }

  const result = await structureImport({
    url: cleanUrl,
    evidence: indirect.evidence,
    mode: 'indice',
    linkVerified: indirect.confirmedByIndex,
    budget,
  });

  if (result.ok) {
    return {
      ...result,
      reply:
        'La tienda no permite leer su web automáticamente, así que he tomado los ' +
        `datos del índice de Google sobre esa misma ficha.\n\n${result.reply}`,
    };
  }
  return result;
}

/**
 * Evidencia indirecta de una ficha que no se deja descargar: lo que dice la
 * URL, lo que guarda el índice de Google y lo que encuentra una búsqueda.
 */
async function gatherIndirectEvidence(
  url: string,
  budget?: RequestBudget,
): Promise<{ evidence: string; confirmedByIndex: boolean }> {
  const sections: string[] = [];
  let confirmedByIndex = false;

  const slug = describeUrlSlug(url);
  if (slug.text || slug.reference) {
    sections.push(
      'LO QUE DICE LA PROPIA URL\n' +
        (slug.text ? `Descripción deducida de la dirección: ${slug.text}\n` : '') +
        (slug.reference ? `Referencia del producto: ${slug.reference}` : ''),
    );
  }

  // Índice de Google acotado a la tienda: primero por referencia (unívoca) y,
  // si no la hay, por la descripción del slug.
  let indexResults: CseResult[] = [];
  const domain = hostOf(url);
  if (isCseConfigured() && domain) {
    const query = slug.reference ?? slug.text.split(' ').slice(0, 10).join(' ');
    if (query) {
      indexResults = await searchShopProducts(query, domain, 3).catch(() => []);
    }
  }
  if (indexResults.length > 0) {
    const target = canonicalUrl(url);
    confirmedByIndex = indexResults.some(
      (result) => target !== null && canonicalUrl(result.url) === target,
    );
    sections.push(
      'LO QUE GUARDA EL ÍNDICE DE GOOGLE DE ESTA TIENDA\n' +
        indexResults
          .map(
            (result, index) =>
              `${index + 1}. ${result.title}\n   URL: ${result.url}\n   Extracto: ${result.snippet}`,
          )
          .join('\n'),
    );
  }

  // Búsqueda anclada sobre la ficha exacta, si queda tiempo de sobra.
  if ((budget?.remaining() ?? Number.POSITIVE_INFINITY) > IMPORT_SEARCH_MIN_REMAINING_MS) {
    try {
      const response = await callGemini(
        {
          model: SEARCH_MODEL,
          contents: buildImportSearchPrompt(url, slug.text),
          config: {
            systemInstruction: BASE_SYSTEM,
            tools: [{ googleSearch: {} }],
            temperature: 0.2,
          },
        },
        budget,
        'La búsqueda de la ficha',
        IMPORT_SEARCH_CAP_MS,
      );
      const text = response.text?.trim();
      if (text) {
        sections.push(`INFORME DE UNA BÚSQUEDA EN INTERNET SOBRE ESTA FICHA\n${text}`);
      }
    } catch {
      // Sin búsqueda anclada se sigue con lo que haya.
    }
  }

  // La URL sola no identifica precio ni producto con garantías suficientes.
  const evidence = sections.length >= 2 ? sections.join('\n\n') : '';
  return { evidence, confirmedByIndex };
}

/** Convierte la evidencia (directa o indirecta) en la oferta final. */
async function structureImport(params: {
  url: string;
  evidence: string;
  mode: 'pagina' | 'indice';
  linkVerified: boolean;
  budget?: RequestBudget;
}): Promise<ImportResult> {
  const response = await callGemini(
    {
      model: UTILITY_MODEL,
      contents: buildImportPrompt(params.url, params.evidence, params.mode),
      config: {
        systemInstruction: BASE_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: offersResponseSchema,
        temperature: 0.1,
      },
    },
    params.budget,
    'La lectura de la ficha',
    IMPORT_STRUCTURE_CAP_MS,
  );

  const structured = normalizeOffersResponse(extractJson(response.text));
  const extracted = structured.offers[0];

  if (!extracted) {
    return {
      ok: false,
      reply:
        `${structured.summary}\n\n` +
        'Si es una página de listado, entra en el producto concreto que te guste ' +
        'y pégame el enlace de su ficha.',
    };
  }

  // La URL real, el proveedor deducido del dominio y la marca de verificación
  // los pone el sistema, no el modelo.
  const offer: SupplierOffer = {
    ...extracted,
    id: `import-${extracted.id}`,
    supplier: supplierForDomain(params.url),
    sourceUrl: params.url,
    linkVerified: params.linkVerified,
    confidence: params.mode === 'pagina' ? 'alta' : extracted.confidence,
  };

  const request: MaterialRequest = {
    material: offer.productName,
    category: 'Producto elegido por el usuario',
    attributes: [],
    quantityHint: null,
    typicalMeasureUnit: offer.coverage.unit,
    searchQueries: [],
    confidence: 1,
    clarifyingQuestion: null,
    imageDescription: null,
  };

  return {
    ok: true,
    offer,
    request,
    reply:
      `${structured.summary}\n\n` +
      'Si te convence, pulsa «Agregar al presupuesto» y te pregunto la cantidad.',
  };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}
