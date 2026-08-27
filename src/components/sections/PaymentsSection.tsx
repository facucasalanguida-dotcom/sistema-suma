'use client';

import { useState } from 'react';
import { CircleCheck, Plus, Receipt, Trash2 } from 'lucide-react';
import { Card, EmptyHint, ProgressBar, ProjectPicker, SectionShell, Stat } from './SectionShell';
import { Button } from '@/components/ui/Button';
import { fieldControlClass } from '@/components/ui/Field';
import { formatCurrency } from '@/lib/format';
import {
  projectExtraPaymentsTotal,
  projectMaterialLines,
  projectMaterialsTotal,
  projectPaidMaterialsTotal,
  projectPendingMaterialsTotal,
} from '@/lib/projects';
import { useProjectsStore } from '@/lib/projects-store';
import { cn } from '@/lib/cn';

/**
 * Pagos: los materiales del presupuesto del proyecto, para ir tachando lo ya
 * pagado, más los pagos sueltos a proveedores. El pendiente baja y sube al
 * tachar y destachar (solo materiales; la mano de obra queda fuera).
 */
export function PaymentsSection() {
  const projects = useProjectsStore((state) => state.projects);
  const togglePaidLine = useProjectsStore((state) => state.togglePaidLine);
  const addExtraPayment = useProjectsStore((state) => state.addExtraPayment);
  const removeExtraPayment = useProjectsStore((state) => state.removeExtraPayment);

  const [projectId, setProjectId] = useState('');
  const [concept, setConcept] = useState('');
  const [supplier, setSupplier] = useState('');
  const [amount, setAmount] = useState('');

  const project = projects.find((entry) => entry.id === projectId) ?? null;

  return (
    <SectionShell
      icon={<Receipt className="size-5" aria-hidden />}
      title="Pagos"
      subtitle="Tacha los materiales del presupuesto que ya hayas pagado y anota los pagos sueltos a proveedores."
    >
      <Card>
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />
      </Card>

      {projects.length === 0 ? (
        <EmptyHint>
          Primero crea un proyecto en la pestaña «Proyectos» y guarda dentro un presupuesto
          finalizado: sus materiales aparecerán aquí para ir marcando lo pagado.
        </EmptyHint>
      ) : null}

      {project ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Materiales" value={formatCurrency(projectMaterialsTotal(project))} />
            <Stat
              label="Pagado"
              value={formatCurrency(projectPaidMaterialsTotal(project))}
              tone="ok"
            />
            <Stat
              label="Pendiente"
              value={formatCurrency(projectPendingMaterialsTotal(project))}
              tone="bad"
            />
          </div>
          {projectMaterialsTotal(project) > 0 ? (
            <ProgressBar
              ratio={projectPaidMaterialsTotal(project) / projectMaterialsTotal(project)}
            />
          ) : null}

          <Card>
            <h3 className="text-sm font-bold text-suma-ink">Materiales del presupuesto</h3>
            <p className="mt-0.5 text-[11px] text-suma-muted">
              Importes sin IVA. Toca una partida para marcarla como pagada; vuelve a tocarla para
              desmarcarla.
            </p>

            {projectMaterialLines(project).length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-suma-border px-3 py-2 text-[11px] text-suma-muted">
                Este proyecto aún no tiene presupuestos guardados con materiales.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1.5">
                {projectMaterialLines(project).map((line) => {
                  const paid = project.paidLineIds.includes(line.lineId);
                  return (
                    <li key={line.lineId}>
                      <button
                        type="button"
                        onClick={() => togglePaidLine(project.id, line.lineId)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left ring-1 ring-inset transition-colors',
                          paid
                            ? 'bg-suma-success/10 ring-suma-success/30'
                            : 'bg-suma-high ring-suma-border hover:ring-suma-muted',
                        )}
                        aria-pressed={paid}
                      >
                        <CircleCheck
                          className={cn(
                            'size-4 shrink-0',
                            paid ? 'text-suma-success' : 'text-suma-border',
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              'block truncate text-xs font-semibold',
                              paid ? 'text-suma-muted line-through' : 'text-suma-ink',
                            )}
                          >
                            {line.label}
                          </span>
                          <span className="block text-[11px] text-suma-muted">
                            {line.supplier} · {line.budget.reference}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'text-sm font-bold tabular-nums',
                            paid ? 'text-suma-muted line-through' : 'text-suma-ink',
                          )}
                        >
                          {formatCurrency(line.amount)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-bold text-suma-ink">Otros pagos a proveedores</h3>
            <p className="mt-0.5 text-[11px] text-suma-muted">
              Gastos que no están en el presupuesto: portes, tasas, material menudo…
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-[2fr_1.5fr_1fr_auto]">
              <input
                value={concept}
                onChange={(event) => setConcept(event.target.value)}
                placeholder="Concepto"
                className={fieldControlClass}
              />
              <input
                value={supplier}
                onChange={(event) => setSupplier(event.target.value)}
                placeholder="Proveedor (opcional)"
                className={fieldControlClass}
              />
              <div className="relative">
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="Importe"
                  className={`${fieldControlClass} pr-8 tabular-nums`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-suma-muted">
                  €
                </span>
              </div>
              <Button
                onClick={() => {
                  const value = Number(amount.replace(',', '.'));
                  if (!concept.trim() || !(value > 0)) return;
                  addExtraPayment(project.id, {
                    concept: concept.trim(),
                    supplier: supplier.trim() || null,
                    amount: Math.round(value * 100) / 100,
                  });
                  setConcept('');
                  setSupplier('');
                  setAmount('');
                }}
                disabled={!concept.trim() || !(Number(amount.replace(',', '.')) > 0)}
                icon={<Plus className="size-4" aria-hidden />}
              >
                Anotar
              </Button>
            </div>

            {project.extraPayments.length > 0 ? (
              <>
                <ul className="mt-3 divide-y divide-suma-border-soft">
                  {project.extraPayments.map((payment) => (
                    <li key={payment.id} className="flex items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-suma-ink">
                          {payment.concept}
                          {payment.supplier ? (
                            <span className="font-normal text-suma-muted">
                              {' '}
                              · {payment.supplier}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-suma-muted">
                          {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
                            new Date(payment.date),
                          )}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-suma-ink tabular-nums">
                        {formatCurrency(payment.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeExtraPayment(project.id, payment.id)}
                        className="rounded-md p-1 text-suma-muted hover:bg-suma-red-tint hover:text-suma-danger"
                        aria-label="Eliminar este pago"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-right text-xs font-semibold text-suma-muted">
                  Total otros pagos:{' '}
                  <span className="text-suma-ink tabular-nums">
                    {formatCurrency(projectExtraPaymentsTotal(project))}
                  </span>
                </p>
              </>
            ) : null}
          </Card>
        </>
      ) : null}
    </SectionShell>
  );
}
