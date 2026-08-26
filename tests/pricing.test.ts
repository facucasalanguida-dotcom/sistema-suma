import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VAT_PCT,
  PricingError,
  buildReference,
  computeLinePrice,
  computeTotals,
  validUntil,
} from '@/lib/pricing';
import type { BudgetLine, SupplierOffer } from '@/lib/types';
import { round2, round3 } from '@/lib/format';

function offer(overrides: Partial<SupplierOffer> = {}): SupplierOffer {
  return {
    id: 'test-1',
    productName: 'Pavimento porcelánico 60x60 gris',
    brand: 'Genérico',
    supplier: { name: 'Proveedor de prueba', location: 'Málaga', website: null, phone: null },
    price: 12.4,
    saleUnit: 'caja',
    priceIncludesVat: false,
    coverage: { value: 1.44, unit: 'm2', note: 'caja de 4 piezas de 60×60 cm' },
    recommendedWastePct: 0,
    specs: [],
    availability: null,
    delivery: null,
    sourceUrl: null,
    confidence: 'alta',
    highlight: null,
    group: null,
    ...overrides,
  };
}

describe('computeLinePrice', () => {
  it('convierte m² a cajas y redondea hacia arriba', () => {
    const result = computeLinePrice(offer(), { value: 24, unit: 'm2' });
    expect(result.saleUnitsExact).toBeCloseTo(16.667, 3);
    expect(result.saleUnits).toBe(17);
    expect(result.roundedUp).toBe(true);
    expect(result.lineTotal).toBeCloseTo(17 * 12.4, 2);
  });

  it('aplica la merma recomendada antes de repartir en cajas', () => {
    const result = computeLinePrice(offer({ recommendedWastePct: 10 }), {
      value: 24,
      unit: 'm2',
    });
    expect(result.wastePct).toBe(10);
    expect(result.quantityWithWaste).toBeCloseTo(26.4, 3);
    expect(result.saleUnits).toBe(19); // 26,4 / 1,44 = 18,33 -> 19
  });

  it('permite anular la merma desde la interfaz', () => {
    const result = computeLinePrice(offer({ recommendedWastePct: 10 }), { value: 24, unit: 'm2' }, 0);
    expect(result.wastePct).toBe(0);
    expect(result.saleUnits).toBe(17);
  });

  it('limita la merma a un máximo razonable', () => {
    const result = computeLinePrice(offer(), { value: 10, unit: 'm2' }, 90);
    expect(result.wastePct).toBe(30);
  });

  it('convierte centímetros a metros lineales', () => {
    const result = computeLinePrice(
      offer({
        productName: 'Tubo PVC evacuación 110 mm',
        saleUnit: 'm',
        price: 4.85,
        coverage: { value: 1, unit: 'm', note: null },
      }),
      { value: 350, unit: 'cm' },
    );
    expect(result.saleUnits).toBeCloseTo(3.5, 3);
    expect(result.roundedUp).toBe(false);
    expect(result.lineTotal).toBeCloseTo(16.98, 2);
  });

  it('reparte metros lineales en barras completas', () => {
    const result = computeLinePrice(
      offer({
        productName: 'Barra corrugada B500S Ø12',
        saleUnit: 'barra',
        price: 9.2,
        coverage: { value: 6, unit: 'm', note: 'barra de 6 m' },
      }),
      { value: 40, unit: 'm' },
    );
    expect(result.saleUnitsExact).toBeCloseTo(6.667, 3);
    expect(result.saleUnits).toBe(7);
    expect(result.lineTotal).toBeCloseTo(64.4, 2);
  });

  it('convierte superficie a sacos usando el rendimiento', () => {
    const result = computeLinePrice(
      offer({
        productName: 'Cemento cola C2TE saco 25 kg',
        saleUnit: 'saco',
        price: 9.75,
        coverage: { value: 5, unit: 'm2', note: 'rendimiento 5 kg/m², saco de 25 kg' },
      }),
      { value: 24, unit: 'm2' },
    );
    expect(result.saleUnits).toBe(5); // 24 / 5 = 4,8 -> 5 sacos
    expect(result.lineTotal).toBeCloseTo(48.75, 2);
  });

  it('mantiene decimales cuando la unidad de venta es continua', () => {
    const result = computeLinePrice(
      offer({
        productName: 'Hormigón HA-25',
        saleUnit: 'm3',
        price: 92,
        coverage: { value: 1, unit: 'm3', note: null },
      }),
      { value: 2.5, unit: 'm3' },
    );
    expect(result.saleUnits).toBeCloseTo(2.5, 3);
    expect(result.lineTotal).toBeCloseTo(230, 2);
  });

  it('convierte toneladas a kilogramos', () => {
    const result = computeLinePrice(
      offer({
        saleUnit: 'kg',
        price: 0.95,
        coverage: { value: 1, unit: 'kg', note: null },
      }),
      { value: 1.5, unit: 't' },
    );
    expect(result.saleUnits).toBeCloseTo(1500, 3);
    expect(result.lineTotal).toBeCloseTo(1425, 2);
  });

  it('rechaza magnitudes incompatibles con un mensaje accionable', () => {
    expect(() => computeLinePrice(offer(), { value: 100, unit: 'kg' })).toThrow(PricingError);
    expect(() => computeLinePrice(offer(), { value: 100, unit: 'kg' })).toThrow(/m²/);
  });

  it('rechaza rendimientos inválidos en lugar de dividir por cero', () => {
    expect(() =>
      computeLinePrice(offer({ coverage: { value: 0, unit: 'm2', note: null } }), {
        value: 10,
        unit: 'm2',
      }),
    ).toThrow(PricingError);
  });

  it('explica el cálculo en lenguaje natural', () => {
    const result = computeLinePrice(offer({ recommendedWastePct: 10 }), { value: 24, unit: 'm2' });
    expect(result.explanation).toContain('24 m²');
    expect(result.explanation).toContain('merma');
    expect(result.explanation).toContain('IVA no incluido');
  });
});

describe('computeTotals', () => {
  function line(total: number): BudgetLine {
    return {
      id: `l-${total}`,
      offer: offer(),
      breakdown: {
        requested: { value: 1, unit: 'm2' },
        wastePct: 0,
        quantityWithWaste: 1,
        workingUnit: 'm²',
        coveragePerSaleUnit: 1,
        saleUnitsExact: 1,
        saleUnits: 1,
        roundedUp: false,
        unitPrice: total,
        lineTotal: total,
        explanation: '',
      },
      addedAt: new Date().toISOString(),
    };
  }

  it('suma líneas y aplica el IVA general del 21 %', () => {
    const totals = computeTotals([line(100), line(50.5)]);
    expect(totals.subtotal).toBeCloseTo(150.5, 2);
    expect(totals.vatPct).toBe(DEFAULT_VAT_PCT);
    expect(totals.vatAmount).toBeCloseTo(31.61, 2);
    expect(totals.total).toBeCloseTo(182.11, 2);
  });

  it('aplica el descuento sobre el subtotal antes del IVA', () => {
    const totals = computeTotals([line(1000)], { discountPct: 10 });
    expect(totals.discountAmount).toBeCloseTo(100, 2);
    expect(totals.taxableBase).toBeCloseTo(900, 2);
    expect(totals.vatAmount).toBeCloseTo(189, 2);
    expect(totals.total).toBeCloseTo(1089, 2);
  });

  it('admite el IVA reducido del 10 % en rehabilitación', () => {
    const totals = computeTotals([line(1000)], { vatPct: 10 });
    expect(totals.vatAmount).toBeCloseTo(100, 2);
    expect(totals.total).toBeCloseTo(1100, 2);
  });

  it('devuelve ceros con un presupuesto vacío', () => {
    const totals = computeTotals([]);
    expect(totals).toMatchObject({ subtotal: 0, vatAmount: 0, total: 0 });
  });

  it('no acumula error de coma flotante', () => {
    const totals = computeTotals([line(0.1), line(0.2)]);
    expect(totals.subtotal).toBe(0.3);
  });
});

describe('metadatos del presupuesto', () => {
  it('genera una referencia con el año en curso', () => {
    expect(buildReference(new Date('2026-03-04T10:00:00Z'), 17)).toBe('PRE-2026-0017');
  });

  it('caduca a 30 días por defecto', () => {
    const from = new Date('2026-03-04T10:00:00Z');
    expect(validUntil(from).toISOString().slice(0, 10)).toBe('2026-04-03');
  });
});

describe('redondeo comercial', () => {
  it('redondea el medio céntimo hacia arriba', () => {
    expect(round2(16.975)).toBe(16.98);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(0.615)).toBe(0.62);
  });

  it('se aleja del cero también con importes negativos', () => {
    expect(round2(-16.975)).toBe(-16.98);
  });

  it('no altera importes ya redondeados', () => {
    expect(round2(19.99)).toBe(19.99);
    expect(round2(0)).toBe(0);
  });

  it('mantiene tres decimales en mediciones', () => {
    expect(round3(16.6665)).toBe(16.667);
    expect(round3(1 / 3)).toBe(0.333);
  });
});
