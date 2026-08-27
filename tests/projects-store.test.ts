import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectsStore } from '@/lib/projects-store';
import { computeTotals } from '@/lib/pricing';
import { projectMaterialLines, projectPaidMaterialsTotal } from '@/lib/projects';
import { supplierOfferSchema, type BudgetLine, type SavedBudget } from '@/lib/types';

function line(id: string, lineTotal: number): BudgetLine {
  return {
    id,
    offer: supplierOfferSchema.parse({
      id: `offer-${id}`,
      productName: `Material ${id}`,
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
    addedAt: '2026-08-02T09:00:00.000Z',
  };
}

function snapshot(id: string, lines: BudgetLine[]): SavedBudget {
  return {
    id,
    reference: `PRE-${id}`,
    savedAt: '2026-08-02T09:00:00.000Z',
    clientName: 'Cliente',
    lines,
    laborLines: [],
    marginPct: 0,
    discountPct: 0,
    vatPct: 21,
    notes: '',
    totals: computeTotals(lines),
  };
}

beforeEach(() => {
  useProjectsStore.setState({ projects: [], teams: [], salaryPayments: [] });
});

describe('guardar presupuestos en un proyecto', () => {
  it('el mismo presupuesto guardado dos veces no repite identificadores de partida', () => {
    const store = useProjectsStore.getState();
    const project = store.createProject('Reforma Larios 12');
    expect(project).not.toBeNull();

    const lines = [line('a', 600), line('b', 400)];
    store.saveBudgetToProject(project!.id, snapshot('b1', lines));
    store.saveBudgetToProject(project!.id, snapshot('b2', lines));

    const saved = useProjectsStore.getState().projects[0];
    const ids = projectMaterialLines(saved).map((entry) => entry.lineId);

    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });

  it('tachar una partida no arrastra a su gemela del otro presupuesto', () => {
    const store = useProjectsStore.getState();
    const project = store.createProject('Obra')!;
    const lines = [line('a', 600)];

    store.saveBudgetToProject(project.id, snapshot('b1', lines));
    store.saveBudgetToProject(project.id, snapshot('b2', lines));

    const first = projectMaterialLines(useProjectsStore.getState().projects[0])[0];
    useProjectsStore.getState().togglePaidLine(project.id, first.lineId);

    expect(projectPaidMaterialsTotal(useProjectsStore.getState().projects[0])).toBe(600);
  });

  it('quitar un presupuesto limpia también sus partidas pagadas', () => {
    const store = useProjectsStore.getState();
    const project = store.createProject('Obra')!;
    store.saveBudgetToProject(project.id, snapshot('b1', [line('a', 600)]));

    const saved = useProjectsStore.getState().projects[0];
    const lineId = projectMaterialLines(saved)[0].lineId;
    useProjectsStore.getState().togglePaidLine(project.id, lineId);
    expect(useProjectsStore.getState().projects[0].paidLineIds).toHaveLength(1);

    useProjectsStore.getState().removeBudgetFromProject(project.id, saved.budgets[0].id);
    expect(useProjectsStore.getState().projects[0].paidLineIds).toHaveLength(0);
  });
});

describe('equipos y salarios', () => {
  it('borrar un proyecto deja sus salarios como gasto general', () => {
    const store = useProjectsStore.getState();
    const project = store.createProject('Obra')!;
    const team = store.createTeam('Cuadrilla')!;
    useProjectsStore.getState().addEmployee(team.id, 'Juan');

    const employee = useProjectsStore.getState().teams[0].employees[0];
    useProjectsStore.getState().addSalaryPayment({
      employeeId: employee.id,
      employeeName: employee.name,
      teamId: team.id,
      projectId: project.id,
      amount: 300,
      note: null,
    });

    useProjectsStore.getState().deleteProject(project.id);

    expect(useProjectsStore.getState().projects).toHaveLength(0);
    expect(useProjectsStore.getState().salaryPayments[0].projectId).toBeNull();
  });

  it('los importes que no son positivos se rechazan', () => {
    const store = useProjectsStore.getState();
    const project = store.createProject('Obra')!;

    store.addCollection(project.id, { amount: 0, note: null });
    store.addExtraPayment(project.id, { concept: 'Nada', supplier: null, amount: -5 });

    const saved = useProjectsStore.getState().projects[0];
    expect(saved.collections).toHaveLength(0);
    expect(saved.extraPayments).toHaveLength(0);
  });

  it('no se crean proyectos ni equipos sin nombre', () => {
    const store = useProjectsStore.getState();
    expect(store.createProject('   ')).toBeNull();
    expect(store.createTeam('')).toBeNull();
    expect(useProjectsStore.getState().projects).toHaveLength(0);
  });
});
