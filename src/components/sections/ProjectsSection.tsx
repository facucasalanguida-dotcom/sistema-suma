'use client';

import { useState } from 'react';
import {
  CalendarDays,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  FolderPlus,
  Trash2,
} from 'lucide-react';
import { Card, EmptyHint, ProgressBar, SectionShell, Stat } from './SectionShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { fieldControlClass } from '@/components/ui/Field';
import { formatCurrency } from '@/lib/format';
import {
  projectBilledTotal,
  projectCollectedTotal,
  projectOwedTotal,
  projectPendingMaterialsTotal,
} from '@/lib/projects';
import { useProjectsStore } from '@/lib/projects-store';
import type { Project } from '@/lib/types';

/**
 * Proyectos: la carpeta de cada obra. Aquí se crean, se ven sus presupuestos
 * guardados y se descarga el balance en Excel con todo desglosado.
 */
export function ProjectsSection() {
  const projects = useProjectsStore((state) => state.projects);
  const teams = useProjectsStore((state) => state.teams);
  const salaryPayments = useProjectsStore((state) => state.salaryPayments);
  const createProject = useProjectsStore((state) => state.createProject);
  const deleteProject = useProjectsStore((state) => state.deleteProject);
  const removeBudgetFromProject = useProjectsStore((state) => state.removeBudgetFromProject);

  const [name, setName] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    if (createProject(name)) setName('');
  }

  async function handleBalance(project: Project) {
    setDownloading(project.id);
    setError(null);
    try {
      const response = await fetch('/api/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, teams, salaryPayments }),
      });
      if (!response.ok) throw new Error('No se ha podido generar el balance.');

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = match?.[1] ?? `Balance-SUMA-${project.name}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('No se ha podido generar el balance en Excel. Vuelve a intentarlo.');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <SectionShell
      icon={<FolderKanban className="size-5" aria-hidden />}
      title="Proyectos"
      subtitle="Cada obra tiene su carpeta: sus presupuestos guardados, sus pagos, sus cobros y su balance en Excel."
    >
      <Card>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleCreate();
            }}
            placeholder="Nombre de la obra: «Reforma piso Calle Larios 12»"
            className={fieldControlClass}
          />
          <Button
            onClick={handleCreate}
            disabled={!name.trim()}
            icon={<FolderPlus className="size-4" aria-hidden />}
            className="shrink-0"
          >
            Crear proyecto
          </Button>
        </div>
      </Card>

      {error ? <p className="text-xs text-suma-danger">{error}</p> : null}

      {projects.length === 0 ? (
        <EmptyHint>
          Todavía no hay proyectos. Crea el primero con el nombre de la obra y, al finalizar un
          presupuesto, podrás guardarlo dentro.
        </EmptyHint>
      ) : (
        <div className="flex flex-col gap-4">
          {projects.map((project) => {
            const billed = projectBilledTotal(project);
            const collected = projectCollectedTotal(project);
            return (
              <Card key={project.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-suma-ink">{project.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-suma-muted">
                      <CalendarDays className="size-3" aria-hidden />
                      Creado el{' '}
                      {new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(
                        new Date(project.createdAt),
                      )}
                    </p>
                  </div>
                  <Badge tone={project.budgets.length > 0 ? 'brand' : 'neutral'}>
                    {project.budgets.length}{' '}
                    {project.budgets.length === 1 ? 'presupuesto' : 'presupuestos'}
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Presupuestado" value={formatCurrency(billed)} />
                  <Stat label="Cobrado" value={formatCurrency(collected)} tone="ok" />
                  <Stat
                    label="Por cobrar"
                    value={formatCurrency(projectOwedTotal(project))}
                    tone="brand"
                  />
                  <Stat
                    label="Materiales sin pagar"
                    value={formatCurrency(projectPendingMaterialsTotal(project))}
                  />
                </div>

                {billed > 0 ? (
                  <div className="mt-2">
                    <ProgressBar ratio={collected / billed} />
                  </div>
                ) : null}

                {project.budgets.length > 0 ? (
                  <ul className="mt-3 divide-y divide-suma-border-soft rounded-lg bg-suma-canvas px-3">
                    {project.budgets.map((budget) => (
                      <li key={budget.id} className="flex items-center gap-2 py-2">
                        <FileText className="size-3.5 shrink-0 text-suma-muted" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-suma-ink">
                            {budget.reference}
                            {budget.clientName ? ` · ${budget.clientName}` : ''}
                          </p>
                          <p className="text-[11px] text-suma-muted">
                            {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
                              new Date(budget.savedAt),
                            )}{' '}
                            · {budget.lines.length}{' '}
                            {budget.lines.length === 1 ? 'partida' : 'partidas'}
                            {budget.laborLines.length > 0 ? ' + mano de obra' : ''}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-suma-ink tabular-nums">
                          {formatCurrency(budget.totals.total)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `¿Quitar el presupuesto ${budget.reference} de este proyecto?`,
                              )
                            ) {
                              removeBudgetFromProject(project.id, budget.id);
                            }
                          }}
                          className="rounded-md p-1 text-suma-muted hover:bg-suma-red-tint hover:text-suma-danger"
                          aria-label={`Quitar el presupuesto ${budget.reference}`}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 rounded-lg border border-dashed border-suma-border px-3 py-2 text-[11px] text-suma-muted">
                    Sin presupuestos todavía: crea uno en la pestaña «Presupuesto» y guárdalo aquí
                    al finalizarlo.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <Button
                    variant="neutral"
                    size="sm"
                    onClick={() => void handleBalance(project)}
                    loading={downloading === project.id}
                    icon={<FileSpreadsheet className="size-3.5" aria-hidden />}
                  >
                    Balance en Excel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Eliminar el proyecto «${project.name}» con sus presupuestos, pagos y cobros? Esta acción no se puede deshacer.`,
                        )
                      ) {
                        deleteProject(project.id);
                      }
                    }}
                    icon={<Trash2 className="size-3.5" aria-hidden />}
                  >
                    Eliminar
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}
