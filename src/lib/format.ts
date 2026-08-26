/** Formateo de números, importes y fechas con convenciones españolas. */

const currency = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const decimal = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const decimal3 = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const longDate = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const shortDate = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const time = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

export function formatCurrency(value: number): string {
  return currency.format(value);
}

export function formatNumber(value: number): string {
  return decimal.format(value);
}

export function formatPrecise(value: number): string {
  return decimal3.format(value);
}

export function formatPercent(value: number): string {
  return `${decimal.format(value)} %`;
}

export function formatLongDate(value: string | Date): string {
  return longDate.format(typeof value === 'string' ? new Date(value) : value);
}

export function formatShortDate(value: string | Date): string {
  return shortDate.format(typeof value === 'string' ? new Date(value) : value);
}

export function formatTime(value: string | Date): string {
  return time.format(typeof value === 'string' ? new Date(value) : value);
}

/**
 * Redondeo comercial ("medio hacia arriba, alejándose del cero").
 *
 * `Math.round(x * 100) / 100` falla con importes tan corrientes como 16,975 €,
 * que en coma flotante vale 16.974999999999998 y se redondearía a 16,97 € en
 * lugar de a 16,98 €. Desplazar la coma con notación exponencial *sobre la
 * representación decimal* del número evita ese error, que en un presupuesto se
 * propagaría a la base imponible y al IVA.
 */
export function roundTo(value: number, digits: number): number {
  if (!Number.isFinite(value)) return value;

  const shifted = Number(`${value}e${digits}`);
  if (!Number.isFinite(shifted)) {
    // Entradas ya en notación exponencial (1e-7): no se pueden desplazar así.
    const factor = 10 ** digits;
    return Math.sign(value) * Math.round(Math.abs(value) * factor) / factor;
  }

  const rounded = Math.sign(shifted) * Math.round(Math.abs(shifted));
  const restored = Number(`${rounded}e-${digits}`);
  return Number.isFinite(restored) ? restored : rounded / 10 ** digits;
}

/** Redondeo comercial a 2 decimales, para importes en euros. */
export function round2(value: number): number {
  return roundTo(value, 2);
}

/** Redondeo a 3 decimales, para mediciones y factores de conversión. */
export function round3(value: number): number {
  return roundTo(value, 3);
}

/** Convierte un importe a céntimos enteros, sin arrastrar error binario. */
function toIntegerScale(value: number, digits: number): number {
  const shifted = Number(`${value}e${digits}`);
  return Math.round(Number.isFinite(shifted) ? shifted : value * 10 ** digits);
}

/**
 * Multiplica una medición por un precio unitario en aritmética entera.
 *
 * `3,5 × 4,85 €` da 16.974999999999998 en coma flotante y se redondearía a
 * 16,97 € en lugar de a 16,98 €. Escalando ambos factores a enteros antes de
 * multiplicar, el resultado es el que saldría en una calculadora.
 */
export function multiplyMoney(quantity: number, unitPrice: number, quantityDigits = 3): number {
  const scaledQuantity = toIntegerScale(quantity, quantityDigits);
  const scaledPrice = toIntegerScale(unitPrice, 2);
  const product = scaledQuantity * scaledPrice;
  return roundTo(product / 10 ** (quantityDigits + 2), 2);
}

/** Suma importes en céntimos enteros para que el total no arrastre decimales. */
export function sumMoney(values: number[]): number {
  const cents = values.reduce((sum, value) => sum + toIntegerScale(value, 2), 0);
  return roundTo(cents / 100, 2);
}

/** Aplica un porcentaje a un importe con redondeo comercial. */
export function percentOf(amount: number, pct: number): number {
  return multiplyMoney(pct / 100, amount, 6);
}
