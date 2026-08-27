import type { LaborLine } from './types';

/**
 * Mano de obra: lógica pura compartida por la API y la interfaz.
 *
 * La IA interpreta el texto libre del usuario («2 albañiles 5 días a 120€»)
 * y aquí se normaliza su respuesta. Cuando no hay IA disponible, un
 * intérprete sencillo saca partidas de las líneas que traen un importe.
 */

/** Convierte la respuesta del modelo en partidas de mano de obra válidas. */
export function normalizeLaborResponse(raw: unknown): { summary: string; lines: LaborLine[] } {
  const data = (raw ?? {}) as Record<string, unknown>;
  const rawLines = Array.isArray(data.lines) ? data.lines : [];

  const lines: LaborLine[] = [];
  rawLines.forEach((entry, index) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    const description = String(item.description ?? '').trim();
    const amount = Number(item.amount);
    if (!description || !Number.isFinite(amount) || amount <= 0) return;

    const detail = String(item.detail ?? '').trim();
    lines.push({
      id: `labor-${index}-${slug(description)}`,
      description,
      detail: detail && detail.toLowerCase() !== 'n/a' ? detail : null,
      amount: Math.round(amount * 100) / 100,
    });
  });

  return {
    summary: String(data.summary ?? '').trim() || 'Mano de obra interpretada.',
    lines,
  };
}

/**
 * Intérprete sin IA: una partida por línea de texto que termine (o contenga)
 * un importe. Entiende el formato español («1.200,50», «450 €»).
 */
export function parseLaborOffline(text: string): LaborLine[] {
  const segments = text
    .split(/[\n;]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const lines: LaborLine[] = [];

  segments.forEach((segment, index) => {
    const amount = lastAmountIn(segment);
    if (amount === null || amount <= 0) return;

    const description =
      segment
        .replace(/[\d.,]+\s*(?:€|eur(?:os)?)?\s*$/i, '')
        .replace(/\s*[-–—:·]\s*$/, '')
        .trim() || `Mano de obra ${index + 1}`;

    lines.push({
      id: `labor-off-${index}-${slug(description)}`,
      description,
      detail: null,
      amount,
    });
  });

  return lines;
}

/** El último número con pinta de importe del texto, en euros. */
function lastAmountIn(segment: string): number | null {
  const matches = [...segment.matchAll(/(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g)];
  if (matches.length === 0) return null;

  const raw = matches[matches.length - 1][1];
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;

  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}
