import { sumMoney } from './format';
import type { Project, SalaryPayment, SavedBudget } from './types';

/**
 * Cifras derivadas de un proyecto: todas puras y en céntimos exactos, para
 * que «Pagos», «Cobros» y el balance en Excel cuenten siempre lo mismo.
 */

/** Materiales presupuestados (sin IVA) de todos los presupuestos guardados. */
export function projectMaterialsTotal(project: Project): number {
  return sumMoney(
    project.budgets.flatMap((budget) => budget.lines.map((line) => line.breakdown.lineTotal)),
  );
}

/** Materiales ya pagados: las partidas tachadas en la sección «Pagos». */
export function projectPaidMaterialsTotal(project: Project): number {
  const paid = new Set(project.paidLineIds);
  return sumMoney(
    project.budgets.flatMap((budget) =>
      budget.lines
        .filter((line) => paid.has(line.id))
        .map((line) => line.breakdown.lineTotal),
    ),
  );
}

/** Materiales pendientes de pagar (sin IVA). */
export function projectPendingMaterialsTotal(project: Project): number {
  return Math.round((projectMaterialsTotal(project) - projectPaidMaterialsTotal(project)) * 100) / 100;
}

/** Pagos manuales apuntados a proveedores, fuera de las partidas. */
export function projectExtraPaymentsTotal(project: Project): number {
  return sumMoney(project.extraPayments.map((payment) => payment.amount));
}

/** Mano de obra presupuestada (sin IVA). */
export function projectLaborTotal(project: Project): number {
  return sumMoney(
    project.budgets.flatMap((budget) => budget.laborLines.map((line) => line.amount)),
  );
}

/** Coste de la obra presupuestado: materiales + mano de obra, sin margen. */
export function projectCostTotal(project: Project): number {
  return sumMoney(project.budgets.map((budget) => budget.totals.costSubtotal));
}

/** Ganancia prevista: el margen aplicado en los presupuestos de la obra. */
export function projectMarginTotal(project: Project): number {
  return sumMoney(project.budgets.map((budget) => budget.totals.marginAmount));
}

/**
 * Lo que hay que cobrarle al cliente («debo cobrar»): el total presupuestado,
 * con el margen de ganancia y el IVA ya incluidos.
 */
export function projectBilledTotal(project: Project): number {
  return sumMoney(project.budgets.map((budget) => budget.totals.total));
}

/** Cobros recibidos hasta la fecha. */
export function projectCollectedTotal(project: Project): number {
  return sumMoney(project.collections.map((entry) => entry.amount));
}

/** Lo que queda por cobrar del proyecto. */
export function projectOwedTotal(project: Project): number {
  return Math.round((projectBilledTotal(project) - projectCollectedTotal(project)) * 100) / 100;
}

/** Salarios imputados a un proyecto concreto. */
export function salariesTotalForProject(
  payments: SalaryPayment[],
  projectId: string,
): number {
  return sumMoney(
    payments.filter((payment) => payment.projectId === projectId).map((payment) => payment.amount),
  );
}

/** Salarios pagados a un empleado (en total). */
export function salariesTotalForEmployee(
  payments: SalaryPayment[],
  employeeId: string,
): number {
  return sumMoney(
    payments.filter((payment) => payment.employeeId === employeeId).map((payment) => payment.amount),
  );
}

/**
 * Balance de caja del proyecto hasta hoy: lo cobrado menos lo gastado
 * (materiales pagados + pagos manuales + salarios imputados).
 */
export function projectCashBalance(project: Project, salaryPayments: SalaryPayment[]): number {
  const spent = sumMoney([
    projectPaidMaterialsTotal(project),
    projectExtraPaymentsTotal(project),
    salariesTotalForProject(salaryPayments, project.id),
  ]);
  return Math.round((projectCollectedTotal(project) - spent) * 100) / 100;
}

/** Todas las partidas de material del proyecto, con su presupuesto de origen. */
export function projectMaterialLines(
  project: Project,
): Array<{ budget: SavedBudget; lineId: string; label: string; supplier: string; amount: number }> {
  return project.budgets.flatMap((budget) =>
    budget.lines.map((line) => ({
      budget,
      lineId: line.id,
      label: line.offer.productName,
      supplier: line.offer.supplier.name,
      amount: line.breakdown.lineTotal,
    })),
  );
}
