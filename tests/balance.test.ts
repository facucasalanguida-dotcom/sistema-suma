import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/balance/route';
import { computeTotals } from '@/lib/pricing';
import { supplierOfferSchema, type BudgetLine } from '@/lib/types';

function line(id: string, lineTotal: number, product: string): BudgetLine {
  return {
    id,
    offer: supplierOfferSchema.parse({
      id: `offer-${id}`,
      productName: product,
      supplier: { name: 'Obramat Málaga', location: 'Málaga capital' },
      price: lineTotal,
      saleUnit: 'ud',
      coverage: { value: 1, unit: 'ud' },
      confidence: 'alta',
    }),
    breakdown: {
      requested: { value: 1, unit: 'ud' },
      wastePct: 0,
      quantityWithWaste: 1,
      workingUnit: 'ud',
      coveragePerSaleUnit: 1,
      saleUnitsExact: 1,
      saleUnits: 1,
      roundedUp: false,
      unitPrice: lineTotal,
      lineTotal,
      explanation: '',
    },
    addedAt: '2026-08-02T09:00:00.000Z',
  };
}

function requestBody() {
  const lines = [line('a', 600, 'Cemento gris'), line('b', 400, 'Placas de pladur')];
  const laborLines = [
    { id: 'l1', description: 'Albañilería', detail: '2 oficiales × 5 días', amount: 500 },
  ];

  return {
    project: {
      id: 'proj-1',
      name: 'Reforma Larios 12',
      createdAt: '2026-08-01T09:00:00.000Z',
      budgets: [
        {
          id: 'b1',
          reference: 'PRE-2026-0001',
          savedAt: '2026-08-02T09:00:00.000Z',
          clientName: 'Promociones Costa del Sol',
          lines,
          laborLines,
          marginPct: 20,
          discountPct: 0,
          vatPct: 21,
          notes: '',
          totals: computeTotals(lines, { laborLines, vatPct: 21, marginPct: 20 }),
        },
      ],
      paidLineIds: ['a'],
      extraPayments: [
        { id: 'p1', concept: 'Portes', supplier: 'Transportes SL', amount: 100, date: '2026-08-03T09:00:00.000Z' },
      ],
      collections: [{ id: 'c1', amount: 800, date: '2026-08-10T09:00:00.000Z', note: 'Anticipo' }],
    },
    teams: [{ id: 't1', name: 'Cuadrilla A', employees: [{ id: 'e1', name: 'Juan' }] }],
    salaryPayments: [
      {
        id: 's1',
        employeeId: 'e1',
        employeeName: 'Juan',
        teamId: 't1',
        projectId: 'proj-1',
        amount: 300,
        date: '2026-08-08T09:00:00.000Z',
        note: 'Semana 32',
      },
    ],
  };
}

async function generate(body: unknown): Promise<Response> {
  return POST(
    new Request('http://localhost/api/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('balance en Excel', () => {
  it('genera un libro con todas las secciones desglosadas', async () => {
    const response = await generate(requestBody());
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('spreadsheetml');
    expect(response.headers.get('Content-Disposition')).toContain('Balance-SUMA-Reforma-Larios-12');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Resumen',
      'Presupuestos',
      'Materiales y pagos',
      'Mano de obra',
      'Salarios',
      'Cobros',
    ]);
  });

  it('el resumen recalcula las cifras del proyecto', async () => {
    const response = await generate(requestBody());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());

    const summary = workbook.getWorksheet('Resumen');
    const values = new Map<string, number>();
    summary?.eachRow((row) => {
      const label = String(row.getCell(1).value ?? '');
      const value = row.getCell(2).value;
      if (label && typeof value === 'number') values.set(label, value);
    });

    expect(values.get('Materiales (sin IVA)')).toBe(1000);
    expect(values.get('Mano de obra (sin IVA)')).toBe(500);
    expect(values.get('Coste de la obra (sin IVA)')).toBe(1500);
    // 20 % sobre 1.500 € de coste.
    expect(values.get('Margen de ganancia')).toBe(300);
    // (1.500 + 300) × 1,21 = 2.178 €.
    expect(values.get('Debo cobrar (con margen e IVA)')).toBeCloseTo(2178, 2);
    expect(values.get('Materiales ya pagados')).toBe(600);
    expect(values.get('Materiales pendientes de pagar')).toBe(400);
    expect(values.get('Otros pagos a proveedores')).toBe(100);
    expect(values.get('Salarios imputados al proyecto')).toBe(300);
    expect(values.get('He cobrado')).toBe(800);
    // 800 cobrado − (600 + 100 + 300) = −200
    expect(values.get('Cobrado − pagado (materiales + proveedores + salarios)')).toBe(-200);
  });

  it('la hoja de materiales marca lo pagado y lo pendiente', async () => {
    const response = await generate(requestBody());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());

    const sheet = workbook.getWorksheet('Materiales y pagos');
    const rows: Array<[string, string]> = [];
    sheet?.eachRow((row) => {
      const label = String(row.getCell(1).value ?? '');
      const paid = String(row.getCell(5).value ?? '');
      if (label.includes('Cemento') || label.includes('pladur')) rows.push([label, paid]);
    });

    expect(rows).toEqual([
      ['Cemento gris', 'Sí'],
      ['Placas de pladur', 'No'],
    ]);
  });

  it('unos datos inválidos se rechazan con un 400', async () => {
    const response = await generate({ project: { name: 'sin id' } });
    expect(response.status).toBe(400);
  });
});
