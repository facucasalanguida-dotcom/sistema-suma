import { UTILITY_MODEL, callGemini, extractJson, type RequestBudget } from './client';
import { buildQuantitySystem } from './prompts';
import { quantityResponseSchema } from './schemas';
import { parseQuantity } from '../quantity-parser';
import type { QuantityInput, SupplierOffer } from '../types';
import { isMeasureUnit, measureLabel, saleUnitLabel } from '../units';

export interface QuantityInterpretation {
  quantity: QuantityInput | null;
  /** Merma sugerida en %, o `null` para usar la recomendada por la oferta. */
  wastePct: number | null;
  /** Pregunta a devolver al usuario si no se ha entendido la cantidad. */
  clarification: string | null;
  reasoning: string | null;
  /** Cómo se resolvió: sin coste (local) o consultando al modelo. */
  via: 'local' | 'ia';
}

/**
 * Pasos 5 y 6: interpreta cuánta cantidad quiere el usuario.
 *
 * Primero se intenta con el intérprete local, que resuelve la gran mayoría de
 * respuestas al instante y sin coste. Sólo si la frase es libre («el salón y
 * los dos dormitorios») se consulta a Gemini. El cálculo del importe no ocurre
 * aquí: lo hace `computeLinePrice`, en código determinista.
 */
export async function interpretQuantity(
  offer: SupplierOffer,
  phrase: string,
  options: { allowAi?: boolean; budget?: RequestBudget } = {},
): Promise<QuantityInterpretation> {
  const allowAi = options.allowAi ?? true;

  const local = parseQuantity(phrase, offer.coverage.unit);
  if (local) {
    return {
      quantity: { value: local.value, unit: local.unit },
      wastePct: null,
      clarification: null,
      reasoning:
        local.source === 'dimensiones'
          ? `He multiplicado las dimensiones que has indicado (${local.matched}).`
          : local.source === 'sin-unidad'
            ? `He interpretado «${local.matched}» como ${local.value} ${measureLabel(local.unit)}, que es como se mide este material.`
            : null,
      via: 'local',
    };
  }

  if (!allowAi) {
    return {
      quantity: null,
      wastePct: null,
      clarification: buildFallbackQuestion(offer),
      reasoning: null,
      via: 'local',
    };
  }

  const response = await callGemini(
    {
      model: UTILITY_MODEL,
      contents: buildQuantityPrompt(offer, phrase),
      config: {
        systemInstruction: buildQuantitySystem(),
        responseMimeType: 'application/json',
        responseSchema: quantityResponseSchema,
        temperature: 0.1,
      },
    },
    options.budget,
    'La interpretación de la cantidad',
  );

  const data = extractJson(response.text) as Record<string, unknown>;

  const value = Number(data.value ?? 0);
  const unitRaw = String(data.unit ?? '');
  const understood = Boolean(data.understood) && Number.isFinite(value) && value > 0 && isMeasureUnit(unitRaw);

  const wasteRaw = Number(data.wastePct ?? 0);

  return {
    quantity: understood ? { value, unit: unitRaw as QuantityInput['unit'] } : null,
    wastePct: Number.isFinite(wasteRaw) && wasteRaw >= 0 ? Math.min(wasteRaw, 30) : null,
    clarification: understood
      ? null
      : String(data.clarification ?? '').trim() || buildFallbackQuestion(offer),
    reasoning: String(data.reasoning ?? '').trim() || null,
    via: 'ia',
  };
}

function buildQuantityPrompt(offer: SupplierOffer, phrase: string): string {
  return `MATERIAL ELEGIDO
${offer.productName}${offer.brand ? ` (${offer.brand})` : ''}
Proveedor: ${offer.supplier.name} — ${offer.supplier.location}
Se vende por: ${saleUnitLabel(offer.saleUnit)} a ${offer.price} € (sin IVA)
Rendimiento: 1 ${saleUnitLabel(offer.saleUnit)} rinde ${offer.coverage.value} ${measureLabel(offer.coverage.unit)}${
    offer.coverage.note ? ` (${offer.coverage.note})` : ''
  }
Merma habitual de este material: ${offer.recommendedWastePct} %

RESPUESTA DEL USUARIO A «¿cuánta cantidad necesitas?»
${phrase}

Interpreta la cantidad. Si puedes, exprésala en ${measureLabel(offer.coverage.unit)}, que es la unidad en la que se mide el rendimiento de este producto.`;
}

/** Pregunta de reserva cuando no se entiende la cantidad. */
export function buildFallbackQuestion(offer: SupplierOffer): string {
  const unit = measureLabel(offer.coverage.unit);
  return `No he conseguido deducir la cantidad. ¿Cuántos ${unit} de «${offer.productName}» necesitas? Puedes escribirlo como «24 ${unit}» o darme las medidas, por ejemplo «4 x 6 metros».`;
}
