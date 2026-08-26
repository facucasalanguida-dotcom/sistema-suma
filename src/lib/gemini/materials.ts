import type { Content, Part } from '@google/genai';
import {
  VISION_MODEL,
  extractJson,
  getGemini,
  withTimeout,
  type RequestBudget,
} from './client';
import { MATERIAL_SYSTEM } from './prompts';
import { materialRequestResponseSchema } from './schemas';
import { materialRequestSchema, type ChatRequestPayload, type MaterialRequest } from '../types';
import { isMeasureUnit } from '../units';
import { demoTypicalUnit } from '../demo/catalog';

/** Tamaño máximo de imagen aceptado en línea, antes de codificar en base64. */
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
];

/**
 * Paso 2 del proceso: entiende qué material quiere el usuario a partir de su
 * texto y, si la hay, de la imagen adjunta.
 */
export async function interpretMaterial(
  payload: ChatRequestPayload,
  budget?: RequestBudget,
): Promise<MaterialRequest> {
  const ai = getGemini();

  const parts: Part[] = [];

  if (payload.image) {
    parts.push({
      inlineData: { mimeType: payload.image.mimeType, data: payload.image.data },
    });
  }

  parts.push({ text: buildUserTurn(payload) });

  const contents: Content[] = [{ role: 'user', parts }];

  const response = await withTimeout(
    ai.models.generateContent({
      model: VISION_MODEL,
      contents,
      config: {
        systemInstruction: MATERIAL_SYSTEM,
        responseMimeType: 'application/json',
        responseSchema: materialRequestResponseSchema,
        temperature: 0.2,
        abortSignal: budget?.signal,
      },
    }),
    budget?.remaining(),
    'La interpretación del material',
  );

  return normalizeMaterialResponse(extractJson(response.text), payload);
}

function buildUserTurn(payload: ChatRequestPayload): string {
  const sections: string[] = [];

  if (payload.history.length > 0) {
    const transcript = payload.history
      .slice(-6)
      .map((turn) => `${turn.role === 'user' ? 'Usuario' : 'Asistente'}: ${turn.text}`)
      .join('\n');
    sections.push(`CONVERSACIÓN PREVIA (para resolver referencias como «el mismo pero en blanco»)\n${transcript}`);
  }

  if (payload.image) {
    sections.push(
      'El usuario ha adjuntado una fotografía. Identifica el material que aparece en ella.',
    );
  }

  sections.push(
    payload.text.trim()
      ? `MENSAJE DEL USUARIO\n${payload.text.trim()}`
      : 'El usuario no ha escrito texto: guíate únicamente por la imagen.',
  );

  return sections.join('\n\n');
}

/**
 * Adapta la forma plana que devuelve el modelo al tipo del dominio y aplica
 * los valores por defecto que el esquema de Gemini no permite expresar.
 */
export function normalizeMaterialResponse(raw: unknown, payload: ChatRequestPayload): MaterialRequest {
  const data = raw as Record<string, unknown>;

  const quantityValue = Number(data.quantityValue ?? 0);
  const quantityUnitRaw = String(data.quantityUnit ?? '');
  const quantityHint =
    Number.isFinite(quantityValue) && quantityValue > 0 && isMeasureUnit(quantityUnitRaw)
      ? { value: quantityValue, unit: quantityUnitRaw }
      : null;

  const typicalRaw = String(data.typicalMeasureUnit ?? '');
  const typicalMeasureUnit = isMeasureUnit(typicalRaw)
    ? typicalRaw
    : (demoTypicalUnit(String(data.material ?? payload.text)) ?? 'ud');

  const material = String(data.material ?? '').trim() || payload.text.trim() || 'Material sin identificar';

  const searchQueries = Array.isArray(data.searchQueries)
    ? data.searchQueries.map(String).filter(Boolean)
    : [];

  return materialRequestSchema.parse({
    material,
    category: String(data.category ?? '').trim() || 'Material de construcción',
    attributes: Array.isArray(data.attributes)
      ? data.attributes
          .map((entry) => entry as Record<string, unknown>)
          .filter((entry) => entry && entry.key && entry.value)
          .map((entry) => ({ key: String(entry.key), value: String(entry.value) }))
      : [],
    quantityHint,
    typicalMeasureUnit,
    searchQueries: searchQueries.length > 0 ? searchQueries : [`${material} precio Málaga`],
    confidence: clamp01(Number(data.confidence ?? 0.5)),
    clarifyingQuestion: emptyToNull(data.clarifyingQuestion),
    imageDescription: emptyToNull(data.imageDescription),
  });
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(Math.max(value, 0), 1);
}

function emptyToNull(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

/**
 * Interpretación de respaldo cuando no hay clave de Gemini: se apoya en el
 * catálogo local para deducir la unidad de medida habitual del material.
 */
export function interpretMaterialOffline(payload: ChatRequestPayload): MaterialRequest {
  const text = payload.text.trim();
  const material = text || 'Material de construcción';

  return materialRequestSchema.parse({
    material,
    category: 'Material de construcción',
    attributes: [],
    quantityHint: null,
    typicalMeasureUnit: demoTypicalUnit(material) ?? 'ud',
    searchQueries: [material],
    confidence: text ? 0.5 : 0.2,
    clarifyingQuestion: text
      ? null
      : 'Describe el material que necesitas y lo busco entre los proveedores de Málaga.',
    imageDescription: payload.image
      ? 'En modo demostración no se analizan imágenes: describe el material con palabras o configura GEMINI_API_KEY.'
      : null,
  });
}
