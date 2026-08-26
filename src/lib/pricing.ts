/**
 * Aritmética del presupuesto.
 *
 * Todo el cálculo de precios ocurre aquí, en código determinista. La IA aporta
 * únicamente datos (precio, unidad de venta, rendimiento, merma recomendada) y
 * la interpretación de la frase del usuario; nunca calcula el importe final.
 * Así el presupuesto es reproducible y auditable.
 */

import { multiplyMoney, percentOf, round2, round3, sumMoney } from './format';
import type {
  BudgetLine,
  BudgetTotals,
  PriceBreakdown,
  QuantityInput,
  SupplierOffer,
} from './types';
import {
  convert,
  dimensionOf,
  isDiscreteSaleUnit,
  measureLabel,
  saleUnitAsMeasure,
  saleUnitLabel,
  agreeWithSaleUnit,
} from './units';

/** IVA general aplicable a la venta de materiales de construcción en España. */
export const DEFAULT_VAT_PCT = 21;

/** IVA reducido de obras de renovación y reparación de vivienda (art. 91 LIVA). */
export const REDUCED_VAT_PCT = 10;

export class PricingError extends Error {}

/**
 * Convierte la cantidad pedida por el usuario a unidades de venta y calcula el
 * importe de la línea.
 *
 * @throws {PricingError} si la unidad pedida no es convertible al rendimiento
 *   de la oferta (p. ej. pedir kilos de un material cuyo rendimiento está en m²).
 */
export function computeLinePrice(
  offer: SupplierOffer,
  requested: QuantityInput,
  wastePctOverride?: number | null,
): PriceBreakdown {
  const coverageUnit = offer.coverage.unit;
  const coverageValue = offer.coverage.value;

  if (!(coverageValue > 0)) {
    throw new PricingError(
      `El rendimiento declarado para «${offer.productName}» no es válido (${coverageValue}).`,
    );
  }

  const converted = convert(requested.value, requested.unit, coverageUnit);
  if (converted === null) {
    throw new PricingError(
      `No se puede convertir ${requested.value} ${measureLabel(requested.unit)} a ` +
        `${measureLabel(coverageUnit)}: son magnitudes distintas ` +
        `(${dimensionOf(requested.unit)} frente a ${dimensionOf(coverageUnit)}). ` +
        `Indica la cantidad en ${measureLabel(coverageUnit)}.`,
    );
  }

  const wastePct = clampWaste(wastePctOverride ?? offer.recommendedWastePct ?? 0);
  const quantityWithWaste = round3(converted * (1 + wastePct / 100));

  const saleUnitsExact = quantityWithWaste / coverageValue;
  const discrete = isDiscreteSaleUnit(offer.saleUnit);
  const saleUnits = discrete ? Math.ceil(round3(saleUnitsExact)) : round3(saleUnitsExact);
  const roundedUp = discrete && saleUnits > round3(saleUnitsExact);

  const unitPrice = round2(offer.price);
  const lineTotal = multiplyMoney(saleUnits, unitPrice);

  return {
    requested,
    wastePct,
    quantityWithWaste,
    workingUnit: measureLabel(coverageUnit),
    coveragePerSaleUnit: coverageValue,
    saleUnitsExact: round3(saleUnitsExact),
    saleUnits,
    roundedUp,
    unitPrice,
    lineTotal,
    explanation: explain(offer, requested, {
      wastePct,
      quantityWithWaste,
      coverageUnit,
      coverageValue,
      saleUnitsExact,
      saleUnits,
      roundedUp,
      unitPrice,
      lineTotal,
    }),
  };
}

function clampWaste(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, 30);
}

interface ExplainContext {
  wastePct: number;
  quantityWithWaste: number;
  coverageUnit: PriceBreakdown['requested']['unit'];
  coverageValue: number;
  saleUnitsExact: number;
  saleUnits: number;
  roundedUp: boolean;
  unitPrice: number;
  lineTotal: number;
}

function explain(offer: SupplierOffer, requested: QuantityInput, ctx: ExplainContext): string {
  const cu = measureLabel(ctx.coverageUnit);
  const saleLabelSingular = saleUnitLabel(offer.saleUnit, 1);
  const saleLabelPlural = saleUnitLabel(offer.saleUnit, ctx.saleUnits);

  // La conclusión va primero: es lo que el usuario quiere saber.
  const parts: string[] = [
    `Para ${fmt(requested.value)} ${measureLabel(requested.unit)} necesitas ` +
      `${fmt(ctx.saleUnits)} ${saleLabelPlural}.`,
  ];

  const steps: string[] = [];

  if (requested.unit !== ctx.coverageUnit) {
    const base = convert(requested.value, requested.unit, ctx.coverageUnit) ?? 0;
    steps.push(`equivalen a ${fmt(base)} ${cu}`);
  }

  if (ctx.wastePct > 0) {
    steps.push(
      `con un ${fmt(ctx.wastePct)} % de merma por cortes y roturas son ${fmt(ctx.quantityWithWaste)} ${cu}`,
    );
  }

  if (!(saleUnitAsMeasure(offer.saleUnit) === ctx.coverageUnit && ctx.coverageValue === 1)) {
    steps.push(
      `cada ${saleLabelSingular} rinde ${fmt(ctx.coverageValue)} ${cu}` +
        (offer.coverage.note ? ` (${offer.coverage.note})` : '') +
        `, así que salen ${fmt(round3(ctx.saleUnitsExact))} ${saleLabelPlural}`,
    );
  }

  if (ctx.roundedUp) {
    steps.push(
      `al venderse por ${saleLabelSingular} ${agreeWithSaleUnit(offer.saleUnit, 1, 'completo')} ` +
        `se redondea a ${ctx.saleUnits}`,
    );
  }

  if (steps.length > 0) {
    parts.push(`${capitalize(steps.join('; '))}.`);
  }

  parts.push(
    `${fmt(ctx.saleUnits)} × ${fmtEur(ctx.unitPrice)} = ${fmtEur(ctx.lineTotal)} (IVA no incluido).`,
  );

  return parts.join(' ');
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function fmt(value: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 }).format(value);
}

function fmtEur(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

/** Totaliza el presupuesto: base imponible, descuento, IVA y total. */
export function computeTotals(
  lines: BudgetLine[],
  options: { discountPct?: number; vatPct?: number } = {},
): BudgetTotals {
  const discountPct = clampPct(options.discountPct ?? 0);
  const vatPct = clampPct(options.vatPct ?? DEFAULT_VAT_PCT);

  const subtotal = sumMoney(lines.map((line) => line.breakdown.lineTotal));
  const discountAmount = percentOf(subtotal, discountPct);
  const taxableBase = round2(subtotal - discountAmount);
  const vatAmount = percentOf(taxableBase, vatPct);
  const total = sumMoney([taxableBase, vatAmount]);

  return { subtotal, discountPct, discountAmount, taxableBase, vatPct, vatAmount, total };
}

function clampPct(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, 100);
}

/** Referencia legible del presupuesto: PRE-2026-0417. */
export function buildReference(date = new Date(), sequence?: number): string {
  const year = date.getFullYear();
  const seq = sequence ?? Math.floor((date.getTime() / 1000) % 10000);
  return `PRE-${year}-${String(seq).padStart(4, '0')}`;
}

/** Fecha de caducidad de la oferta (30 días naturales por defecto). */
export function validUntil(from = new Date(), days = 30): Date {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date;
}
