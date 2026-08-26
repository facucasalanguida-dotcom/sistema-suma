import { NextResponse } from 'next/server';
import { createBudget, describeGeminiError, isGeminiConfigured } from '@/lib/gemini/client';
import {
  MAX_IMAGE_BYTES,
  SUPPORTED_IMAGE_TYPES,
  interpretMaterial,
  interpretMaterialOffline,
} from '@/lib/gemini/materials';
import { searchSuppliers } from '@/lib/gemini/suppliers';
import { searchDemoCatalog } from '@/lib/demo/catalog';
import { chatRequestSchema, type ChatResponsePayload } from '@/lib/types';

export const runtime = 'nodejs';
// Límite de una función de Vercel en el plan gratuito. El presupuesto de
// tiempo de la IA (`GEMINI_TIMEOUT_MS`, 45 s) queda por debajo a propósito,
// para que la aplicación conteste antes de que la plataforma corte.
export const maxDuration = 60;

/**
 * Pasos 1 a 3 del proceso: recibe el mensaje (texto y/o imagen), entiende qué
 * material se pide y devuelve las opciones de proveedores de Málaga.
 */
export async function POST(request: Request) {
  let payload;
  try {
    payload = chatRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: 'La petición no tiene el formato esperado.' },
      { status: 400 },
    );
  }

  if (!payload.text.trim() && !payload.image) {
    return NextResponse.json(
      { error: 'Escribe qué material necesitas o adjunta una fotografía.' },
      { status: 400 },
    );
  }

  if (payload.image) {
    if (!SUPPORTED_IMAGE_TYPES.includes(payload.image.mimeType)) {
      return NextResponse.json(
        {
          error: `Formato de imagen no admitido (${payload.image.mimeType}). Usa JPG, PNG o WebP.`,
        },
        { status: 415 },
      );
    }
    // base64 ocupa 4 caracteres por cada 3 bytes originales.
    const approximateBytes = Math.floor((payload.image.data.length * 3) / 4);
    if (approximateBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: 'La imagen supera los 6 MB. Prueba con una fotografía más ligera.' },
        { status: 413 },
      );
    }
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json(buildDemoResponse(payload));
  }

  const budget = createBudget();

  try {
    const materialRequest = await interpretMaterial(payload, budget);

    // Sólo se interrumpe para preguntar cuando la interpretación es floja de
    // verdad; si hay algo con lo que buscar, se busca y se enseñan resultados.
    if (materialRequest.clarifyingQuestion && materialRequest.confidence < 0.45) {
      const response: ChatResponsePayload = {
        reply: materialRequest.clarifyingQuestion,
        request: materialRequest,
        offers: [],
        sources: [],
        needsClarification: true,
        demoMode: false,
      };
      return NextResponse.json(response);
    }

    const search = await searchSuppliers(materialRequest, budget);

    const response: ChatResponsePayload = {
      reply: buildReply(materialRequest, search.summary, search.offers.length),
      request: materialRequest,
      offers: search.offers,
      sources: search.sources,
      needsClarification: false,
      demoMode: search.demoMode,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[suma] error en /api/chat:', error);

    // Antes de rendirse, se intenta responder con el catálogo local para que
    // el usuario no se quede sin nada que hacer.
    const fallback = searchDemoCatalog(payload.text);
    if (fallback.length > 0) {
      const offline = interpretMaterialOffline(payload);
      const response: ChatResponsePayload = {
        reply:
          `${describeGeminiError(error)}\n\n` +
          'Mientras tanto te muestro precios de mercado orientativos de distribuidores que sirven en Málaga.',
        request: offline,
        offers: fallback,
        sources: [],
        needsClarification: false,
        demoMode: true,
      };
      return NextResponse.json(response);
    }

    return NextResponse.json({ error: describeGeminiError(error) }, { status: 502 });
  } finally {
    budget.release();
  }
}

function buildDemoResponse(
  payload: ReturnType<typeof chatRequestSchema.parse>,
): ChatResponsePayload {
  const request = interpretMaterialOffline(payload);
  const offers = searchDemoCatalog(payload.text);

  if (offers.length === 0) {
    return {
      reply:
        'Estás en modo demostración: no hay ninguna clave de Gemini configurada, así que ' +
        'sólo puedo consultar el catálogo local. No he encontrado nada para esa descripción. ' +
        'Prueba con «porcelánico 60x60», «cemento», «pladur», «aislamiento XPS», «ladrillo», ' +
        '«hormigón», «pintura plástica», «tubo de PVC» o «cable de 2,5».',
      request,
      offers: [],
      sources: [],
      needsClarification: true,
      demoMode: true,
    };
  }

  return {
    reply:
      `He encontrado ${offers.length} ${offers.length === 1 ? 'opción' : 'opciones'} en el catálogo local ` +
      'de distribuidores con servicio en Málaga. Son precios de mercado orientativos, sin IVA: ' +
      'configura GEMINI_API_KEY para que el sistema busque tarifas reales en Internet.',
    request,
    offers,
    sources: [],
    needsClarification: false,
    demoMode: true,
  };
}

function buildReply(
  request: ReturnType<typeof interpretMaterialOffline>,
  summary: string,
  count: number,
): string {
  const opening = request.imageDescription
    ? `En la imagen identifico: ${request.imageDescription}\n\n`
    : '';

  if (count === 0) {
    return (
      `${opening}No he encontrado ofertas para «${request.material}» en la provincia de Málaga. ` +
      'Prueba a concretar el formato, el acabado o la marca.'
    );
  }

  return `${opening}${summary}`;
}
