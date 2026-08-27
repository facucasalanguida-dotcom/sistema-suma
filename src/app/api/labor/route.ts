import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  UTILITY_MODEL,
  callGemini,
  createBudget,
  extractJson,
  isGeminiConfigured,
} from '@/lib/gemini/client';
import { buildLaborSystem } from '@/lib/gemini/prompts';
import { laborResponseSchema } from '@/lib/gemini/schemas';
import { normalizeLaborResponse, parseLaborOffline } from '@/lib/labor';
import type { LaborLine } from '@/lib/types';
import { requireApiSession } from '@/lib/auth/guard';

export const runtime = 'nodejs';
export const maxDuration = 30;

const bodySchema = z.object({
  text: z.string().min(1).max(2000),
});

export interface LaborResponsePayload {
  reply: string;
  lines: LaborLine[];
}

/**
 * Interpreta los gastos de mano de obra descritos por el usuario y devuelve
 * partidas con importe, listas para añadir al presupuesto. Con IA cuando hay
 * clave; con un intérprete sencillo (una partida por línea con importe) si no.
 */
export async function POST(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;

  let body;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: 'Describe los trabajos y su coste para poder interpretarlos.' },
      { status: 400 },
    );
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json(offlinePayload(body.text));
  }

  const budget = createBudget(25_000);
  try {
    const response = await callGemini(
      {
        model: UTILITY_MODEL,
        contents: body.text,
        config: {
          systemInstruction: buildLaborSystem(),
          responseMimeType: 'application/json',
          responseSchema: laborResponseSchema,
          temperature: 0.1,
        },
      },
      budget,
      'La interpretación de la mano de obra',
    );

    const structured = normalizeLaborResponse(extractJson(response.text));
    const payload: LaborResponsePayload = {
      reply:
        structured.lines.length > 0
          ? structured.summary
          : `${structured.summary}\n\nNo he podido valorar ninguna partida: indica el importe de cada trabajo (por ejemplo «fontanería 450» o «2 albañiles 5 días a 120€/día»).`,
      lines: structured.lines,
    };
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[suma] error interpretando mano de obra:', error);
    // Antes que fallar, el intérprete sencillo saca lo que pueda.
    return NextResponse.json(offlinePayload(body.text));
  } finally {
    budget.release();
  }
}

function offlinePayload(text: string): LaborResponsePayload {
  const lines = parseLaborOffline(text);
  return {
    reply:
      lines.length > 0
        ? `He registrado ${lines.length} ${lines.length === 1 ? 'partida' : 'partidas'} de mano de obra a partir de los importes indicados.`
        : 'No he encontrado importes en la descripción. Escribe cada trabajo con su coste, por ejemplo: «Albañilería 1200» o «Fontanero 450».',
    lines,
  };
}
