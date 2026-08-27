import { UTILITY_MODEL, callGemini, extractJson, type RequestBudget } from './client';
import { BASE_SYSTEM, buildImportPrompt } from './prompts';
import { offersResponseSchema } from './schemas';
import { normalizeOffersResponse } from './suppliers';
import {
  extractPageEvidence,
  fetchProductPage,
  looksLikeHomepage,
  supplierForDomain,
} from '../import/product-page';
import type { MaterialRequest, SupplierOffer } from '../types';

/**
 * Flujo «tráete el producto de la tienda»: el usuario navega por CUALQUIER
 * tienda online, elige el producto que le convence y pega aquí su enlace. El
 * servidor descarga esa ficha en el momento, el modelo la convierte en una
 * oferta y la tarjeta queda lista para «Agregar al presupuesto».
 */

const IMPORT_STRUCTURE_CAP_MS = 20_000;

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

  const page = await fetchProductPage(url, fetchImpl);
  if (!page) {
    return {
      ok: false,
      reply:
        'No he podido abrir ese enlace: la tienda no responde o bloquea la consulta. ' +
        'Comprueba que el enlace funciona en tu navegador y vuelve a pegarlo; ' +
        'si sigue fallando, dime el nombre exacto del producto y lo busco yo.',
    };
  }

  const evidence = extractPageEvidence(page.html);
  if (!evidence) {
    return {
      ok: false,
      reply:
        'He abierto la página pero no he podido leer su contenido. ' +
        'Dime el nombre exacto del producto y su precio y lo preparo a mano.',
    };
  }

  const response = await callGemini(
    {
      model: UTILITY_MODEL,
      contents: buildImportPrompt(page.finalUrl, evidence),
      config: {
        systemInstruction: BASE_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: offersResponseSchema,
        temperature: 0.1,
      },
    },
    budget,
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

  // La ficha se acaba de leer: la URL real, el proveedor deducido del dominio
  // y la marca de verificación los pone el sistema, no el modelo.
  const offer: SupplierOffer = {
    ...extracted,
    id: `import-${extracted.id}`,
    supplier: supplierForDomain(page.finalUrl),
    sourceUrl: page.finalUrl,
    linkVerified: true,
    confidence: 'alta',
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
