import { describe, expect, it } from 'vitest';
import {
  projectBilledTotal,
  projectCashBalance,
  projectCollectedTotal,
  projectExtraPaymentsTotal,
  projectLaborTotal,
  projectMaterialLines,
  projectMaterialsTotal,
  projectOwedTotal,
  projectPaidMaterialsTotal,
  projectPendingMaterialsTotal,
  salariesTotalForEmployee,
  salariesTotalForProject,
} from '@/lib/projects';
import { computeTotals } from '@/lib/pricing';
import { supplierOfferSchema, type BudgetLine, type Project, type SalaryPayment } from '@/lib/types';

function line(id: string, lineTotal: number, product = 'Material'): BudgetLine {
  return {
    id,
    offer: supplierOfferSchema.parse({
      id: `offer-${id}`,
      productName: product,
      supplier: { name: 'Obramat Málaga', location: 'Málaga' },
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
    addedAt: new Date().toISOString(),
  };
}

/** Proyecto de prueba: 1.000 € de materiales, 500 € de mano de obra. */
function sampleProject(overrides: Partial<Project> = {}): Project {
  const lines = [line('a', 600, 'Cemento'), line('b', 400, 'Pladur')];
  const laborLines = [{ id: 'l1', description: 'Albañilería', detail: null, amount: 500 }];

  return {
    id: 'proj-1',
    name: 'Reforma Larios 12',
    createdAt: '2026-08-01T09:00:00.000Z',
    budgets: [
      {
        id: 'b1',
        reference: 'PRE-2026-0001',
        savedAt: '2026-08-02T09:00:00.000Z',
        clientName: 'Cliente',
        lines,
        laborLines,
        marginPct: 0,
        discountPct: 0,
        vatPct: 21,
        notes: '',
        totals: computeTotals(lines, { laborLines, vatPct: 21 }),
      },
    ],
    paidLineIds: [],
    extraPayments: [],
    collections: [],
    ...overrides,
  };
}

describe('totales de materiales y pagos', () => {
  it('suma los materiales de todos los presupuestos guardados', () => {
    expect(projectMaterialsTotal(sampleProject())).toBe(1000);
  });

  it('sin nada tachado, todo está pendiente', () => {
    const project = sampleProject();
    expect(projectPaidMaterialsTotal(project)).toBe(0);
    expect(projectPendingMaterialsTotal(project)).toBe(1000);
  });

  it('tachar una partida la pasa a pagada y baja el pendiente', () => {
    const project = sampleProject({ paidLineIds: ['a'] });
    expect(projectPaidMaterialsTotal(project)).toBe(600);
    expect(projectPendingMaterialsTotal(project)).toBe(400);
  });

  it('destachar la devuelve a pendiente', () => {
    const project = sampleProject({ paidLineIds: [] });
    expect(projectPendingMaterialsTotal(project)).toBe(1000);
  });

  it('la mano de obra no cuenta como material', () => {
    const project = sampleProject();
    expect(projectLaborTotal(project)).toBe(500);
    expect(projectMaterialsTotal(project)).toBe(1000);
  });

  it('los pagos sueltos se suman aparte', () => {
    const project = sampleProject({
      extraPayments: [
        { id: 'p1', concept: 'Portes', supplier: null, amount: 80, date: '2026-08-03T09:00:00Z' },
        { id: 'p2', concept: 'Tasas', supplier: null, amount: 20.5, date: '2026-08-04T09:00:00Z' },
      ],
    });
    expect(projectExtraPaymentsTotal(project)).toBe(100.5);
  });

  it('enumera las partidas de material con su presupuesto de origen', () => {
    const materials = projectMaterialLines(sampleProject());
    expect(materials).toHaveLength(2);
    expect(materials[0].label).toBe('Cemento');
    expect(materials[0].budget.reference).toBe('PRE-2026-0001');
  });
});

describe('cobros', () => {
  it('lo facturado es el total con IVA de los presupuestos', () => {
    // (1000 + 500) × 1,21 = 1.815
    expect(projectBilledTotal(sampleProject())).toBeCloseTo(1815, 2);
  });

  it('cada cobro reduce lo pendiente', () => {
    const project = sampleProject({
      collections: [
        { id: 'c1', amount: 800, date: '2026-08-10T09:00:00Z', note: 'anticipo' },
        { id: 'c2', amount: 200, date: '2026-08-20T09:00:00Z', note: null },
      ],
    });
    expect(projectCollectedTotal(project)).toBe(1000);
    expect(projectOwedTotal(project)).toBeCloseTo(815, 2);
  });
});

describe('salarios', () => {
  const payments: SalaryPayment[] = [
    {
      id: 's1',
      employeeId: 'e1',
      employeeName: 'Juan',
      teamId: 't1',
      projectId: 'proj-1',
      amount: 600,
      date: '2026-08-08T09:00:00Z',
      note: null,
    },
    {
      id: 's2',
      employeeId: 'e1',
      employeeName: 'Juan',
      teamId: 't1',
      projectId: null,
      amount: 150,
      date: '2026-08-15T09:00:00Z',
      note: null,
    },
    {
      id: 's3',
      employeeId: 'e2',
      employeeName: 'Ana',
      teamId: 't1',
      projectId: 'proj-1',
      amount: 400,
      date: '2026-08-16T09:00:00Z',
      note: null,
    },
  ];

  it('suma sólo los pagos imputados a ese proyecto', () => {
    expect(salariesTotalForProject(payments, 'proj-1')).toBe(1000);
  });

  it('suma todo lo pagado a un empleado, con proyecto o sin él', () => {
    expect(salariesTotalForEmployee(payments, 'e1')).toBe(750);
    expect(salariesTotalForEmployee(payments, 'e2')).toBe(400);
  });

  it('el balance de caja resta materiales pagados, pagos sueltos y salarios', () => {
    const project = sampleProject({
      paidLineIds: ['a'],
      extraPayments: [
        { id: 'p1', concept: 'Portes', supplier: null, amount: 100, date: '2026-08-03T09:00:00Z' },
      ],
      collections: [{ id: 'c1', amount: 2000, date: '2026-08-10T09:00:00Z', note: null }],
    });

    // 2000 cobrado − (600 materiales + 100 portes + 1000 salarios) = 300
    expect(projectCashBalance(project, payments)).toBe(300);
  });
});
