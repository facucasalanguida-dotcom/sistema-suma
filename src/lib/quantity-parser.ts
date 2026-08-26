/**
 * Intérprete determinista de cantidades escritas en español.
 *
 * Resuelve sin coste ni latencia la inmensa mayoría de respuestas del usuario
 * cuando la IA le pregunta cuánto material necesita: «24 m2», «350 centímetros»,
 * «unos 12 metros lineales», «3x4 metros», «media docena de placas».
 *
 * Cuando la frase es demasiado libre, `interpretQuantity` (en `gemini/quantity.ts`)
 * delega en el modelo. Este módulo es el camino rápido y el que funciona en modo
 * demostración.
 */

import type { MeasureUnit } from './units';
import { dimensionOf } from './units';

interface UnitAlias {
  unit: MeasureUnit;
  /** Patrones ordenados de más específico a menos. */
  patterns: string[];
}

/**
 * El orden importa: las variantes de superficie y volumen deben probarse antes
 * que las de longitud, o «metros cuadrados» se leería como «metros».
 */
const UNIT_ALIASES: UnitAlias[] = [
  { unit: 'cm2', patterns: ['cm2', 'cm²', 'cm\\^2', 'centimetros? cuadrados?', 'centímetros? cuadrados?'] },
  { unit: 'm2', patterns: ['m2', 'm²', 'm\\^2', 'metros? cuadrados?', 'metro cuadrado', 'mts2', 'metros2'] },
  { unit: 'cm3', patterns: ['cm3', 'cm³', 'cm\\^3', 'centimetros? cubicos?', 'centímetros? cúbicos?'] },
  { unit: 'm3', patterns: ['m3', 'm³', 'm\\^3', 'metros? cubicos?', 'metros? cúbicos?', 'mts3', 'metros3'] },
  { unit: 'mm', patterns: ['mm', 'milimetros?', 'milímetros?'] },
  { unit: 'cm', patterns: ['cm', 'centimetros?', 'centímetros?'] },
  { unit: 'km', patterns: ['km', 'kilometros?', 'kilómetros?'] },
  {
    unit: 'm',
    patterns: [
      'metros? lineales?',
      'metro lineal',
      'ml',
      'm\\.?l\\.?',
      'mts',
      'metros?',
      'm',
    ],
  },
  { unit: 't', patterns: ['toneladas?', 'tn', 'tm', 't'] },
  { unit: 'kg', patterns: ['kilogramos?', 'kilos?', 'kgs?', 'kg'] },
  { unit: 'g', patterns: ['gramos?', 'gr', 'g'] },
  { unit: 'l', patterns: ['litros?', 'lts?', 'l'] },
  {
    unit: 'ud',
    patterns: ['unidades?', 'uds?', 'piezas?', 'ud', 'u'],
  },
];

const NUMBER = '\\d{1,3}(?:[.\\s]\\d{3})*(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?';

export interface ParsedQuantity {
  value: number;
  unit: MeasureUnit;
  /** Cómo se obtuvo: útil para explicar el cálculo al usuario. */
  source: 'directa' | 'dimensiones' | 'sin-unidad';
  /** Texto reconocido dentro de la frase. */
  matched: string;
}

/**
 * Convierte «1.234,56», «1234.56» o «12,5» en número.
 * Sigue la convención española: la coma es el separador decimal y el punto
 * el de millares, salvo que el punto vaya seguido de menos de tres cifras.
 */
export function parseSpanishNumber(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '');
  if (!cleaned) return null;

  let normalized: string;
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    const dotParts = cleaned.split('.');
    const looksLikeThousands =
      dotParts.length > 1 && dotParts.slice(1).every((part) => part.length === 3);
    normalized = looksLikeThousands ? dotParts.join('') : cleaned;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Devuelve la expresión regular de todas las unidades, más específica primero. */
function unitPattern(): string {
  return UNIT_ALIASES.flatMap((alias) => alias.patterns).join('|');
}

function resolveUnit(token: string): MeasureUnit | null {
  const normalized = token
    .toLowerCase()
    .trim()
    .replace(/\.$/, '');
  for (const alias of UNIT_ALIASES) {
    for (const pattern of alias.patterns) {
      if (new RegExp(`^(?:${pattern})$`, 'i').test(normalized)) return alias.unit;
    }
  }
  return null;
}

/**
 * Intenta interpretar la cantidad que ha escrito el usuario.
 *
 * @param phrase   Lo que escribió, p. ej. «necesito unos 24,5 m2».
 * @param fallbackUnit Unidad a asumir cuando sólo escribe un número.
 */
export function parseQuantity(
  phrase: string,
  fallbackUnit?: MeasureUnit,
): ParsedQuantity | null {
  const text = phrase.toLowerCase().replace(/ /g, ' ').trim();
  if (!text) return null;

  // «3x4 m», «3 x 4 metros» → superficie.
  const dims = text.match(
    new RegExp(`(${NUMBER})\\s*[x×*]\\s*(${NUMBER})\\s*(${unitPattern()})?`, 'i'),
  );
  if (dims) {
    const a = parseSpanishNumber(dims[1]);
    const b = parseSpanishNumber(dims[2]);
    const rawUnit = dims[3] ? resolveUnit(dims[3]) : 'm';
    if (a !== null && b !== null && a > 0 && b > 0 && rawUnit) {
      const linear = dimensionOf(rawUnit) === 'longitud' ? rawUnit : 'm';
      const areaUnit: MeasureUnit = linear === 'cm' ? 'cm2' : 'm2';
      const factor = linear === 'cm' ? 1 : linear === 'mm' ? 0.01 : 1;
      return {
        value: round(a * b * factor),
        unit: areaUnit,
        source: 'dimensiones',
        matched: dims[0].trim(),
      };
    }
  }

  // «24 m2», «24m²», «24 metros cuadrados».
  const withUnit = text.match(new RegExp(`(${NUMBER})\\s*(${unitPattern()})(?![a-zá-ú0-9])`, 'i'));
  if (withUnit) {
    const value = parseSpanishNumber(withUnit[1]);
    const unit = resolveUnit(withUnit[2]);
    if (value !== null && value > 0 && unit) {
      return { value: round(value), unit, source: 'directa', matched: withUnit[0].trim() };
    }
  }

  // Sólo un número: se asume la unidad habitual del material.
  if (fallbackUnit) {
    const bare = text.match(new RegExp(`(?:^|[^\\d.,])(${NUMBER})(?:$|[^\\d.,a-zá-ú])`, 'i'));
    if (bare) {
      const value = parseSpanishNumber(bare[1]);
      if (value !== null && value > 0) {
        return { value: round(value), unit: fallbackUnit, source: 'sin-unidad', matched: bare[1] };
      }
    }
  }

  return null;
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
