import { describe, expect, it } from 'vitest';
import { normalizeLaborResponse, parseLaborOffline } from '@/lib/labor';
import { MAX_MARGIN_PCT, computeTotals, laborTotalOf } from '@/lib/pricing';
import type { BudgetLine, LaborLine } from '@/lib/types';
import { supplierOfferSchema } from '@/lib/types';

function materialLine(lineTotal: number): BudgetLine {
  return {
    id: `line-${lineTotal}`,
    offer: supplierOfferSchema.parse({
      id: 'offer-1',
      productName: 'Cemento gris 25 kg',
      supplier: { name: 'Obramat Málaga', location: 'Málaga' },
      price: 3.14,
      saleUnit: 'saco',
      coverage: { value: 25, unit: 'kg' },
      confidence: 'alta',
    }),
    breakdown: {
      requested: { value: 100, unit: 'kg' },
      wastePct: 0,
      quantityWithWaste: 100,
      workingUnit: 'kg',
      coveragePerSaleUnit: 25,
      saleUnitsExact: 4,
      saleUnits: 4,
      roundedUp: false,
      unitPrice: lineTotal / 4,
      lineTotal,
      explanation: '',
    },
    addedAt: new Date().toISOString(),
  };
}

describe('normalizeLaborResponse', () => {
  it('convierte la respuesta del modelo en partidas con importe', () => {
    const result = normalizeLaborResponse({
      summary: 'He valorado dos trabajos.',
      lines: [
        { description: 'Albañilería', detail: '2 oficiales × 5 días × 120 €/día', amount: 1200 },
        { description: 'Fontanería', detail: '', amount: 450 },
      ],
    });

    expect(result.summary).toBe('He valorado dos trabajos.');
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].detail).toBe('2 oficiales × 5 días × 120 €/día');
    expect(result.lines[1].detail).toBeNull();
    expect(laborTotalOf(result.lines)).toBe(1650);
  });

  it('descarta partidas sin concepto o sin importe', () => {
    const result = normalizeLaborResponse({
      lines: [
        { description: '', amount: 100 },
        { description: 'Peón una semana', amount: 0 },
        { description: 'Pintura', amount: -50 },
        { description: 'Válida', amount: 300 },
      ],
    });

    expect(result.lines.map((line) => line.description)).toEqual(['Válida']);
  });

  it('una respuesta vacía no rompe nada', () => {
    expect(normalizeLaborResponse(null).lines).toEqual([]);
    expect(normalizeLaborResponse({}).summary).toBe('Mano de obra interpretada.');
  });
});

describe('parseLaborOffline', () => {
  it('saca una partida por línea con importe', () => {
    const lines = parseLaborOffline('Albañilería 1200\nFontanero 450 €');
    expect(lines).toHaveLength(2);
    expect(lines[0].description).toBe('Albañilería');
    expect(lines[0].amount).toBe(1200);
    expect(lines[1].amount).toBe(450);
  });

  it('entiende el formato español de miles y decimales', () => {
    const [line] = parseLaborOffline('Estructura 1.250,50');
    expect(line.amount).toBe(1250.5);
  });

  it('ignora las líneas sin importe', () => {
    expect(parseLaborOffline('hace falta un peón\notro día más')).toEqual([]);
  });
});

describe('computeTotals con mano de obra', () => {
  const laborLines: LaborLine[] = [
    { id: 'l1', description: 'Albañilería', detail: null, amount: 1200 },
    { id: 'l2', description: 'Fontanería', detail: null, amount: 450 },
  ];

  it('separa materiales de mano de obra y suma ambos', () => {
    const totals = computeTotals([materialLine(500)], { laborLines });

    expect(totals.materialsSubtotal).toBe(500);
    expect(totals.laborTotal).toBe(1650);
    expect(totals.subtotal).toBe(2150);
    expect(totals.vatAmount).toBeCloseTo(451.5, 2);
    expect(totals.total).toBeCloseTo(2601.5, 2);
  });

  it('sin mano de obra el total sigue siendo el de siempre', () => {
    const totals = computeTotals([materialLine(500)]);
    expect(totals.laborTotal).toBe(0);
    expect(totals.materialsSubtotal).toBe(500);
    expect(totals.subtotal).toBe(500);
  });

  it('el descuento se aplica sobre materiales y mano de obra juntos', () => {
    const totals = computeTotals([materialLine(1000)], { laborLines, discountPct: 10 });
    expect(totals.subtotal).toBe(2650);
    expect(totals.discountAmount).toBe(265);
    expect(totals.taxableBase).toBe(2385);
  });
});

describe('margen de ganancia', () => {
  const laborLines: LaborLine[] = [
    { id: 'l1', description: 'Albañilería', detail: null, amount: 500 },
  ];

  it('se aplica sobre el coste de la obra, no sobre el precio de venta', () => {
    const totals = computeTotals([materialLine(1000)], { laborLines, marginPct: 20 });

    expect(totals.costSubtotal).toBe(1500);
    expect(totals.marginPct).toBe(20);
    expect(totals.marginAmount).toBe(300);
    expect(totals.subtotal).toBe(1800);
    // (1.500 + 300) × 1,21
    expect(totals.total).toBeCloseTo(2178, 2);
  });

  it('sin margen, lo que se cobra es el coste', () => {
    const totals = computeTotals([materialLine(1000)], { laborLines });
    expect(totals.marginAmount).toBe(0);
    expect(totals.subtotal).toBe(totals.costSubtotal);
  });

  it('el descuento comercial se aplica después del margen', () => {
    const totals = computeTotals([materialLine(1000)], {
      laborLines,
      marginPct: 20,
      discountPct: 10,
    });
    expect(totals.subtotal).toBe(1800);
    expect(totals.discountAmount).toBe(180);
    expect(totals.taxableBase).toBe(1620);
  });

  it('un margen absurdo o negativo se acota', () => {
    expect(computeTotals([materialLine(100)], { marginPct: -5 }).marginPct).toBe(0);
    expect(computeTotals([materialLine(100)], { marginPct: 1000 }).marginPct).toBe(MAX_MARGIN_PCT);
    expect(computeTotals([materialLine(100)], { marginPct: Number.NaN }).marginPct).toBe(0);
  });

  it('los céntimos del margen se redondean con exactitud', () => {
    // 15 % de 16,99 € = 2,5485 -> 2,55 €
    const totals = computeTotals([materialLine(16.99)], { marginPct: 15 });
    expect(totals.marginAmount).toBe(2.55);
    expect(totals.subtotal).toBe(19.54);
  });
});
