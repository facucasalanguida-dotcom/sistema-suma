/**
 * Sistema de unidades del presupuesto.
 *
 * Distingue dos roles muy diferentes que en construcción se confunden a menudo:
 *
 *  - **Unidad de medida** (`MeasureUnit`): lo que el usuario mide en obra.
 *    "Necesito 24 m² de porcelánico", "18 metros lineales de tubo".
 *
 *  - **Unidad de venta** (`SaleUnit`): cómo la comercializa el proveedor.
 *    "Caja de 1,44 m²", "saco de 25 kg", "barra de 6 m", "palet de 480 ud".
 *
 * El puente entre ambas es el *rendimiento* (`coverage`) de la oferta: cuánta
 * magnitud medible aporta UNA unidad de venta. Toda la aritmética vive en
 * `pricing.ts` y es determinista: la IA nunca multiplica precios, sólo aporta
 * el factor de conversión y lo justifica.
 */

/** Magnitud física a la que pertenece una unidad. */
export type Dimension = 'longitud' | 'superficie' | 'volumen' | 'masa' | 'unidades';

/** Unidades en las que un usuario puede expresar lo que necesita. */
export const MEASURE_UNITS = [
  'mm',
  'cm',
  'm',
  'km',
  'cm2',
  'm2',
  'cm3',
  'l',
  'm3',
  'g',
  'kg',
  't',
  'ud',
] as const;

export type MeasureUnit = (typeof MEASURE_UNITS)[number];

/** Unidades comerciales en las que un proveedor factura el material. */
export const SALE_UNITS = [
  'ud',
  'm',
  'm2',
  'm3',
  'kg',
  't',
  'l',
  'saco',
  'caja',
  'palet',
  'rollo',
  'panel',
  'placa',
  'plancha',
  'bote',
  'bidon',
  'barra',
  'tubo',
  'juego',
  'bloque',
  'pieza',
  'metro-lineal',
] as const;

export type SaleUnit = (typeof SALE_UNITS)[number];

interface UnitSpec {
  dimension: Dimension;
  /** Factor para convertir a la unidad base de su dimensión. */
  toBase: number;
  /** Etiqueta corta para la interfaz y el PDF. */
  label: string;
  /** Etiqueta larga, en singular. */
  long: string;
}

/** Unidad base de cada dimensión (a la que se normaliza todo). */
export const BASE_UNIT: Record<Dimension, MeasureUnit> = {
  longitud: 'm',
  superficie: 'm2',
  volumen: 'm3',
  masa: 'kg',
  unidades: 'ud',
};

const MEASURE_SPECS: Record<MeasureUnit, UnitSpec> = {
  mm: { dimension: 'longitud', toBase: 0.001, label: 'mm', long: 'milímetro' },
  cm: { dimension: 'longitud', toBase: 0.01, label: 'cm', long: 'centímetro' },
  m: { dimension: 'longitud', toBase: 1, label: 'm', long: 'metro lineal' },
  km: { dimension: 'longitud', toBase: 1000, label: 'km', long: 'kilómetro' },
  cm2: { dimension: 'superficie', toBase: 0.0001, label: 'cm²', long: 'centímetro cuadrado' },
  m2: { dimension: 'superficie', toBase: 1, label: 'm²', long: 'metro cuadrado' },
  cm3: { dimension: 'volumen', toBase: 0.000001, label: 'cm³', long: 'centímetro cúbico' },
  l: { dimension: 'volumen', toBase: 0.001, label: 'l', long: 'litro' },
  m3: { dimension: 'volumen', toBase: 1, label: 'm³', long: 'metro cúbico' },
  g: { dimension: 'masa', toBase: 0.001, label: 'g', long: 'gramo' },
  kg: { dimension: 'masa', toBase: 1, label: 'kg', long: 'kilogramo' },
  t: { dimension: 'masa', toBase: 1000, label: 't', long: 'tonelada' },
  ud: { dimension: 'unidades', toBase: 1, label: 'ud', long: 'unidad' },
};

/** Unidades de venta que se compran enteras (no se puede pedir media caja). */
const DISCRETE_SALE_UNITS = new Set<SaleUnit>([
  'ud',
  'saco',
  'caja',
  'palet',
  'rollo',
  'panel',
  'placa',
  'plancha',
  'bote',
  'bidon',
  'barra',
  'tubo',
  'juego',
  'bloque',
  'pieza',
]);

interface SaleLabel {
  singular: string;
  plural: string;
  /** Género gramatical, para concordar adjetivos ("sacos completos" / "cajas completas"). */
  gender: 'm' | 'f';
}

const SALE_LABELS: Record<SaleUnit, SaleLabel> = {
  ud: { singular: 'ud', plural: 'ud', gender: 'f' },
  m: { singular: 'm', plural: 'm', gender: 'm' },
  m2: { singular: 'm²', plural: 'm²', gender: 'm' },
  m3: { singular: 'm³', plural: 'm³', gender: 'm' },
  kg: { singular: 'kg', plural: 'kg', gender: 'm' },
  t: { singular: 't', plural: 't', gender: 'f' },
  l: { singular: 'l', plural: 'l', gender: 'm' },
  saco: { singular: 'saco', plural: 'sacos', gender: 'm' },
  caja: { singular: 'caja', plural: 'cajas', gender: 'f' },
  palet: { singular: 'palet', plural: 'palets', gender: 'm' },
  rollo: { singular: 'rollo', plural: 'rollos', gender: 'm' },
  panel: { singular: 'panel', plural: 'paneles', gender: 'm' },
  placa: { singular: 'placa', plural: 'placas', gender: 'f' },
  plancha: { singular: 'plancha', plural: 'planchas', gender: 'f' },
  bote: { singular: 'bote', plural: 'botes', gender: 'm' },
  bidon: { singular: 'bidón', plural: 'bidones', gender: 'm' },
  barra: { singular: 'barra', plural: 'barras', gender: 'f' },
  tubo: { singular: 'tubo', plural: 'tubos', gender: 'm' },
  juego: { singular: 'juego', plural: 'juegos', gender: 'm' },
  bloque: { singular: 'bloque', plural: 'bloques', gender: 'm' },
  pieza: { singular: 'pieza', plural: 'piezas', gender: 'f' },
  'metro-lineal': { singular: 'ml', plural: 'ml', gender: 'm' },
};

/** Unidades de venta que son en sí mismas una unidad de medida. */
const SALE_TO_MEASURE: Partial<Record<SaleUnit, MeasureUnit>> = {
  ud: 'ud',
  m: 'm',
  m2: 'm2',
  m3: 'm3',
  kg: 'kg',
  t: 't',
  l: 'l',
  'metro-lineal': 'm',
};

export function isMeasureUnit(value: string): value is MeasureUnit {
  return (MEASURE_UNITS as readonly string[]).includes(value);
}

export function isSaleUnit(value: string): value is SaleUnit {
  return (SALE_UNITS as readonly string[]).includes(value);
}

export function dimensionOf(unit: MeasureUnit): Dimension {
  return MEASURE_SPECS[unit].dimension;
}

export function measureLabel(unit: MeasureUnit): string {
  return MEASURE_SPECS[unit].label;
}

export function measureLong(unit: MeasureUnit): string {
  return MEASURE_SPECS[unit].long;
}

export function saleUnitLabel(unit: SaleUnit, quantity = 1): string {
  const labels = SALE_LABELS[unit];
  return Math.abs(quantity) === 1 ? labels.singular : labels.plural;
}

export function isDiscreteSaleUnit(unit: SaleUnit): boolean {
  return DISCRETE_SALE_UNITS.has(unit);
}

/**
 * Concuerda un adjetivo con el género y el número de la unidad de venta:
 * "sacos completos", "cajas completas", "placa completa".
 */
export function agreeWithSaleUnit(
  unit: SaleUnit,
  quantity: number,
  masculineSingular: string,
): string {
  const { gender } = SALE_LABELS[unit];
  const stem = masculineSingular.replace(/o$/, '');
  const singular = gender === 'f' ? `${stem}a` : `${stem}o`;
  return Math.abs(quantity) === 1 ? singular : `${singular}s`;
}

/** Devuelve la unidad de medida equivalente a una unidad de venta, si existe. */
export function saleUnitAsMeasure(unit: SaleUnit): MeasureUnit | null {
  return SALE_TO_MEASURE[unit] ?? null;
}

/**
 * Convierte una cantidad entre dos unidades de la misma dimensión.
 * Devuelve `null` si las dimensiones no son compatibles (p. ej. m² → kg),
 * caso en el que hace falta un factor de rendimiento explícito.
 */
export function convert(value: number, from: MeasureUnit, to: MeasureUnit): number | null {
  const a = MEASURE_SPECS[from];
  const b = MEASURE_SPECS[to];
  if (!a || !b || a.dimension !== b.dimension) return null;
  return (value * a.toBase) / b.toBase;
}

/** Normaliza una cantidad a la unidad base de su dimensión. */
export function toBase(value: number, unit: MeasureUnit): number {
  return value * MEASURE_SPECS[unit].toBase;
}

/**
 * Unidades que tiene sentido ofrecer al usuario cuando indica la cantidad de
 * un material que se vende en `saleUnit` y cuyo rendimiento se expresa en
 * `coverageUnit`. Siempre se incluye la unidad de rendimiento y sus vecinas.
 */
export function suggestedMeasureUnits(coverageUnit: MeasureUnit): MeasureUnit[] {
  const dimension = dimensionOf(coverageUnit);
  const byDimension: Record<Dimension, MeasureUnit[]> = {
    longitud: ['cm', 'm'],
    superficie: ['cm2', 'm2'],
    volumen: ['l', 'm3'],
    masa: ['kg', 't'],
    unidades: ['ud'],
  };
  const list = byDimension[dimension];
  return list.includes(coverageUnit) ? list : [coverageUnit, ...list];
}
