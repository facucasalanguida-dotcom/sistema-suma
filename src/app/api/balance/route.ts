import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { company } from '@/lib/brand';
import {
  projectBilledTotal,
  projectCashBalance,
  projectCollectedTotal,
  projectExtraPaymentsTotal,
  projectCostTotal,
  projectLaborTotal,
  projectMarginTotal,
  projectMaterialsTotal,
  projectOwedTotal,
  projectPaidMaterialsTotal,
  projectPendingMaterialsTotal,
  salariesTotalForProject,
} from '@/lib/projects';
import type { Project, SalaryPayment, Team } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Balance del proyecto en Excel: todas las secciones desglosadas (resumen,
 * presupuestos, materiales y pagos, mano de obra, salarios y cobros) con la
 * identidad de SUMA. Los totales se recalculan aquí con las mismas funciones
 * puras que usa la interfaz, no se aceptan cifras del navegador.
 */

const totalsSchema = z.object({
  materialsSubtotal: z.number().default(0),
  laborTotal: z.number().default(0),
  costSubtotal: z.number().default(0),
  marginPct: z.number().default(0),
  marginAmount: z.number().default(0),
  subtotal: z.number(),
  discountPct: z.number(),
  discountAmount: z.number(),
  taxableBase: z.number(),
  vatPct: z.number(),
  vatAmount: z.number(),
  total: z.number(),
});

const lineSchema = z.object({
  id: z.string(),
  offer: z.object({
    productName: z.string(),
    supplier: z.object({ name: z.string(), location: z.string().default('') }),
    saleUnit: z.string().default('ud'),
  }),
  breakdown: z.object({
    saleUnits: z.number(),
    unitPrice: z.number(),
    lineTotal: z.number(),
  }),
});

const budgetSchema = z.object({
  id: z.string(),
  reference: z.string(),
  savedAt: z.string(),
  clientName: z.string().default(''),
  lines: z.array(lineSchema).default([]),
  laborLines: z
    .array(
      z.object({
        id: z.string(),
        description: z.string(),
        detail: z.string().nullable().default(null),
        amount: z.number(),
      }),
    )
    .default([]),
  marginPct: z.number().default(0),
  discountPct: z.number().default(0),
  vatPct: z.number().default(21),
  notes: z.string().default(''),
  totals: totalsSchema,
});

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  budgets: z.array(budgetSchema).default([]),
  paidLineIds: z.array(z.string()).default([]),
  extraPayments: z
    .array(
      z.object({
        id: z.string(),
        concept: z.string(),
        supplier: z.string().nullable().default(null),
        amount: z.number(),
        date: z.string(),
      }),
    )
    .default([]),
  collections: z
    .array(
      z.object({
        id: z.string(),
        amount: z.number(),
        date: z.string(),
        note: z.string().nullable().default(null),
      }),
    )
    .default([]),
});

const bodySchema = z.object({
  project: projectSchema,
  teams: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        employees: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
      }),
    )
    .default([]),
  salaryPayments: z
    .array(
      z.object({
        id: z.string(),
        employeeId: z.string(),
        employeeName: z.string(),
        teamId: z.string(),
        projectId: z.string().nullable().default(null),
        amount: z.number(),
        date: z.string(),
        note: z.string().nullable().default(null),
      }),
    )
    .default([]),
});

/* Identidad SUMA para el libro. */
const INK = 'FF101116';
const RED = 'FFD2202A';
const PAPER = 'FFFFFFFF';
const SOFT = 'FFF2F2F4';
const MUTED = 'FF6B6B74';

const EURO_FMT = '#,##0.00 "€"';

export async function POST(request: Request) {
  let body;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Datos del proyecto no válidos.' }, { status: 400 });
  }

  const project = body.project as unknown as Project;
  const teams = body.teams as Team[];
  const salaryPayments = body.salaryPayments as SalaryPayment[];
  const projectSalaries = salaryPayments.filter((payment) => payment.projectId === project.id);

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = company.legalName;
    workbook.created = new Date();

    buildSummarySheet(workbook, project, salaryPayments);
    buildBudgetsSheet(workbook, project);
    buildMaterialsSheet(workbook, project);
    buildLaborSheet(workbook, project);
    buildSalariesSheet(workbook, projectSalaries, teams);
    buildCollectionsSheet(workbook, project);

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Balance-SUMA-${safeName(project.name)}.xlsx`;

    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[suma] error generando el balance:', error);
    return NextResponse.json(
      { error: 'No se ha podido generar el balance en Excel.' },
      { status: 500 },
    );
  }
}

/* ── Hojas ─────────────────────────────────────────────────────────────── */

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  project: Project,
  salaryPayments: SalaryPayment[],
) {
  const sheet = workbook.addWorksheet('Resumen', {
    properties: { defaultRowHeight: 18 },
  });
  sheet.columns = [{ width: 38 }, { width: 20 }];

  addBrandHeader(sheet, `Balance del proyecto · ${project.name}`, 2);

  sheet.addRow([]);
  addKeyValue(sheet, 'Proyecto', project.name);
  addKeyValue(sheet, 'Creado', formatDate(project.createdAt));
  addKeyValue(sheet, 'Balance emitido', formatDate(new Date().toISOString()));
  addKeyValue(sheet, 'Presupuestos guardados', String(project.budgets.length));

  sheet.addRow([]);
  addSectionRow(sheet, 'PRESUPUESTADO', 2);
  addMoneyRow(sheet, 'Materiales (sin IVA)', projectMaterialsTotal(project));
  addMoneyRow(sheet, 'Mano de obra (sin IVA)', projectLaborTotal(project));
  addMoneyRow(sheet, 'Coste de la obra (sin IVA)', projectCostTotal(project));
  addMoneyRow(sheet, 'Margen de ganancia', projectMarginTotal(project));
  addMoneyRow(sheet, 'Debo cobrar (con margen e IVA)', projectBilledTotal(project), true);

  sheet.addRow([]);
  addSectionRow(sheet, 'PAGOS Y GASTOS', 2);
  addMoneyRow(sheet, 'Materiales ya pagados', projectPaidMaterialsTotal(project));
  addMoneyRow(sheet, 'Materiales pendientes de pagar', projectPendingMaterialsTotal(project));
  addMoneyRow(sheet, 'Otros pagos a proveedores', projectExtraPaymentsTotal(project));
  addMoneyRow(sheet, 'Salarios imputados al proyecto', salariesTotalForProject(salaryPayments, project.id));

  sheet.addRow([]);
  addSectionRow(sheet, 'COBROS', 2);
  addMoneyRow(sheet, 'He cobrado', projectCollectedTotal(project), true);
  addMoneyRow(sheet, 'Queda por cobrar', projectOwedTotal(project));

  sheet.addRow([]);
  addSectionRow(sheet, 'BALANCE DE CAJA', 2);
  const balance = projectCashBalance(project, salaryPayments);
  const row = addMoneyRow(sheet, 'Cobrado − pagado (materiales + proveedores + salarios)', balance, true);
  row.getCell(2).font = {
    bold: true,
    color: { argb: balance >= 0 ? 'FF1B7F4B' : RED },
  };
}

function buildBudgetsSheet(workbook: ExcelJS.Workbook, project: Project) {
  const sheet = workbook.addWorksheet('Presupuestos');
  sheet.columns = [
    { width: 18 },
    { width: 14 },
    { width: 24 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
  ];

  addBrandHeader(sheet, 'Presupuestos guardados', 7);
  addTableHeader(sheet, [
    'Referencia',
    'Fecha',
    'Cliente',
    'Materiales',
    'Mano de obra',
    'Margen',
    'Debo cobrar',
  ]);

  for (const budget of project.budgets) {
    const row = sheet.addRow([
      budget.reference,
      formatDate(budget.savedAt),
      budget.clientName || '—',
      budget.totals.materialsSubtotal,
      budget.totals.laborTotal,
      budget.totals.marginAmount,
      budget.totals.total,
    ]);
    [4, 5, 6, 7].forEach((index) => (row.getCell(index).numFmt = EURO_FMT));
  }
}

function buildMaterialsSheet(workbook: ExcelJS.Workbook, project: Project) {
  const sheet = workbook.addWorksheet('Materiales y pagos');
  sheet.columns = [{ width: 44 }, { width: 24 }, { width: 12 }, { width: 14 }, { width: 12 }];

  addBrandHeader(sheet, 'Materiales del presupuesto', 5);
  addTableHeader(sheet, ['Material', 'Proveedor', 'Cantidad', 'Importe (sin IVA)', 'Pagado']);

  const paid = new Set(project.paidLineIds);
  for (const budget of project.budgets) {
    for (const line of budget.lines) {
      const isPaid = paid.has(line.id);
      const row = sheet.addRow([
        line.offer.productName,
        line.offer.supplier.name,
        `${line.breakdown.saleUnits} ${line.offer.saleUnit}`,
        line.breakdown.lineTotal,
        isPaid ? 'Sí' : 'No',
      ]);
      row.getCell(4).numFmt = EURO_FMT;
      row.getCell(5).font = { color: { argb: isPaid ? 'FF1B7F4B' : RED }, bold: true };
      if (isPaid) row.getCell(1).font = { strike: true, color: { argb: MUTED } };
    }
  }

  if (project.extraPayments.length > 0) {
    sheet.addRow([]);
    addSectionRow(sheet, 'OTROS PAGOS A PROVEEDORES', 5);
    addTableHeader(sheet, ['Concepto', 'Proveedor', 'Fecha', 'Importe', '']);
    for (const payment of project.extraPayments) {
      const row = sheet.addRow([
        payment.concept,
        payment.supplier ?? '—',
        formatDate(payment.date),
        payment.amount,
        '',
      ]);
      row.getCell(4).numFmt = EURO_FMT;
    }
  }
}

function buildLaborSheet(workbook: ExcelJS.Workbook, project: Project) {
  const sheet = workbook.addWorksheet('Mano de obra');
  sheet.columns = [{ width: 40 }, { width: 40 }, { width: 16 }];

  addBrandHeader(sheet, 'Mano de obra presupuestada', 3);
  addTableHeader(sheet, ['Concepto', 'Detalle', 'Importe (sin IVA)']);

  for (const budget of project.budgets) {
    for (const laborLine of budget.laborLines) {
      const row = sheet.addRow([laborLine.description, laborLine.detail ?? '', laborLine.amount]);
      row.getCell(3).numFmt = EURO_FMT;
    }
  }
}

function buildSalariesSheet(
  workbook: ExcelJS.Workbook,
  payments: SalaryPayment[],
  teams: Team[],
) {
  const sheet = workbook.addWorksheet('Salarios');
  sheet.columns = [{ width: 14 }, { width: 26 }, { width: 22 }, { width: 16 }, { width: 34 }];

  addBrandHeader(sheet, 'Salarios imputados al proyecto', 5);
  addTableHeader(sheet, ['Fecha', 'Empleado', 'Equipo', 'Importe', 'Nota']);

  const teamName = new Map(teams.map((team) => [team.id, team.name]));
  for (const payment of payments) {
    const row = sheet.addRow([
      formatDate(payment.date),
      payment.employeeName,
      teamName.get(payment.teamId) ?? '—',
      payment.amount,
      payment.note ?? '',
    ]);
    row.getCell(4).numFmt = EURO_FMT;
  }
}

function buildCollectionsSheet(workbook: ExcelJS.Workbook, project: Project) {
  const sheet = workbook.addWorksheet('Cobros');
  sheet.columns = [{ width: 14 }, { width: 16 }, { width: 40 }];

  addBrandHeader(sheet, 'Cobros del proyecto', 3);
  addMoneyRow(sheet, 'Debo cobrar', projectBilledTotal(project), true);
  sheet.addRow([]);
  addTableHeader(sheet, ['Fecha', 'Importe', 'Nota']);

  for (const entry of project.collections) {
    const row = sheet.addRow([formatDate(entry.date), entry.amount, entry.note ?? '']);
    row.getCell(2).numFmt = EURO_FMT;
  }

  sheet.addRow([]);
  addMoneyRow(sheet, 'He cobrado', projectCollectedTotal(project), true);
  addMoneyRow(sheet, 'Queda por cobrar', projectOwedTotal(project), true);
}

/* ── Piezas comunes ────────────────────────────────────────────────────── */

function addBrandHeader(sheet: ExcelJS.Worksheet, title: string, span: number) {
  const brand = sheet.addRow([`${company.tradeName} +`]);
  brand.height = 26;
  styleAcross(sheet, brand.number, span, {
    fill: INK,
    font: { bold: true, size: 14, color: { argb: PAPER } },
  });
  brand.getCell(1).font = { bold: true, size: 14, color: { argb: PAPER } };

  const subtitle = sheet.addRow([title]);
  subtitle.height = 20;
  styleAcross(sheet, subtitle.number, span, {
    fill: RED,
    font: { bold: true, size: 11, color: { argb: PAPER } },
  });
}

function addTableHeader(sheet: ExcelJS.Worksheet, labels: string[]) {
  const row = sheet.addRow(labels);
  row.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: PAPER } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
    cell.border = { bottom: { style: 'thin', color: { argb: RED } } };
  });
}

function addSectionRow(sheet: ExcelJS.Worksheet, label: string, span: number) {
  const row = sheet.addRow([label]);
  styleAcross(sheet, row.number, span, {
    fill: SOFT,
    font: { bold: true, size: 10, color: { argb: INK } },
  });
}

function addKeyValue(sheet: ExcelJS.Worksheet, label: string, value: string) {
  const row = sheet.addRow([label, value]);
  row.getCell(1).font = { color: { argb: MUTED }, size: 10 };
  row.getCell(2).font = { bold: true, size: 10 };
}

function addMoneyRow(
  sheet: ExcelJS.Worksheet,
  label: string,
  amount: number,
  emphasize = false,
): ExcelJS.Row {
  const row = sheet.addRow([label, amount]);
  row.getCell(2).numFmt = EURO_FMT;
  if (emphasize) {
    row.getCell(1).font = { bold: true };
    row.getCell(2).font = { bold: true };
  }
  return row;
}

function styleAcross(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  span: number,
  style: { fill: string; font: Partial<ExcelJS.Font> },
) {
  for (let column = 1; column <= span; column += 1) {
    const cell = sheet.getRow(rowNumber).getCell(column);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } };
    cell.font = style.font;
  }
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date);
}

function safeName(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'proyecto'
  );
}
