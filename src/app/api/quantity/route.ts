import { NextResponse } from 'next/server';
import { createBudget, describeGeminiError, isGeminiConfigured } from '@/lib/gemini/client';
import { buildFallbackQuestion, interpretQuantity } from '@/lib/gemini/quantity';
import { PricingError, computeLinePrice } from '@/lib/pricing';
import {
  quantityRequestSchema,
  type PriceBreakdown,
  type QuantityResponsePayload,
  type SupplierOffer,
} from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Pasos 5 y 6 del proceso: interpreta la cantidad que ha escrito el usuario y
 * calcula el importe de la partida.
 *
 * El cálculo lo hace `computeLinePrice` en código determinista; la IA sólo
 * interviene para entender frases libres como «el salón y los dos dormitorios».
 */
export async function POST(request: Request) {
  let payload;
  try {
    payload = quantityRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: 'La petición no tiene el formato esperado.' },
      { status: 400 },
    );
  }

  const { offer, phrase, wastePct } = payload;

  // Presupuesto por debajo del límite de 30 s de esta función: permite el
  // reintento corto ante un fallo transitorio, pero no la espera de 15 s del
  // cupo por minuto, que aquí no cabría.
  const budget = createBudget(22_000);

  let interpretation;
  try {
    interpretation = await interpretQuantity(offer, phrase, {
      allowAi: isGeminiConfigured(),
      budget,
    });
  } catch (error) {
    console.error('[suma] error interpretando la cantidad:', error);
    return NextResponse.json(
      {
        error: describeGeminiError(error),
        clarification: buildFallbackQuestion(offer),
      },
      { status: 502 },
    );
  } finally {
    budget.release();
  }

  if (!interpretation.quantity) {
    const response: QuantityResponsePayload = {
      breakdown: null,
      reply: '',
      clarification: interpretation.clarification ?? buildFallbackQuestion(offer),
    };
    return NextResponse.json(response, { status: 422 });
  }

  try {
    const breakdown = computeLinePrice(
      offer,
      interpretation.quantity,
      wastePct ?? interpretation.wastePct,
    );

    const response: QuantityResponsePayload = {
      breakdown,
      reply: buildReply(offer, breakdown, interpretation.reasoning),
      clarification: null,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof PricingError) {
      const response: QuantityResponsePayload = {
        breakdown: null,
        reply: '',
        clarification: error.message,
      };
      return NextResponse.json(response, { status: 422 });
    }
    console.error('[suma] error calculando la partida:', error);
    return NextResponse.json({ error: 'No se ha podido calcular la partida.' }, { status: 500 });
  }
}

function buildReply(
  offer: SupplierOffer,
  breakdown: PriceBreakdown,
  reasoning: string | null,
): string {
  // `breakdown.explanation` ya abre con la conclusión ("Para 24 m² necesitas
  // 17 cajas"), así que aquí sólo se antepone, si la hay, la interpretación de
  // la frase del usuario.
  return [reasoning, breakdown.explanation].filter(Boolean).join(' ');
}
