'use client';

import { useEffect, useState } from 'react';
import { FolderPlus, FolderKanban, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fieldControlClass } from '@/components/ui/Field';
import { SumaLogo } from '@/components/brand/SumaLogo';
import { formatCurrency } from '@/lib/format';
import { useProjectsStore } from '@/lib/projects-store';
import type { BudgetTotals } from '@/lib/types';
import { cn } from '@/lib/cn';

/**
 * Tras generar el PDF se pregunta en qué proyecto guardar el presupuesto,
 * para que quede archivado en la carpeta de su obra y alimente las secciones
 * de pagos, cobros y balance.
 */

interface SaveToProjectDialogProps {
  open: boolean;
  onClose: () => void;
  reference: string;
  totals: BudgetTotals;
  onSave: (projectId: string) => void;
}

export function SaveToProjectDialog({
  open,
  onClose,
  reference,
  totals,
  onSave,
}: SaveToProjectDialogProps) {
  const projects = useProjectsStore((state) => state.projects);
  const createProject = useProjectsStore((state) => state.createProject);

  // El diálogo se monta de nuevo con cada presupuesto generado (`key` en el
  // Workbench), así que el estado inicial ya es el correcto: el primer
  // proyecto preseleccionado y el nombre nuevo en blanco.
  const [selected, setSelected] = useState(projects[0]?.id ?? '');
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function handleSave() {
    if (selected) {
      onSave(selected);
      return;
    }
    const created = createProject(newName);
    if (created) onSave(created.id);
  }

  const canSave = Boolean(selected) || newName.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="suma-guardar-titulo"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-lg flex-col rounded-t-2xl bg-suma-raised shadow-2xl sm:rounded-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-suma-border px-5 py-4">
          <div className="flex items-center gap-3">
            <SumaLogo size={15} />
            <div>
              <h2 id="suma-guardar-titulo" className="text-base font-bold text-suma-ink">
                ¿En qué proyecto lo guardo?
              </h2>
              <p className="text-xs text-suma-muted">
                {reference} · {formatCurrency(totals.total)} IVA incluido
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-suma-muted transition-colors hover:bg-suma-canvas hover:text-suma-ink"
            aria-label="Cerrar"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="flex flex-col gap-3 px-5 py-4">
          {projects.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => {
                    setSelected(project.id);
                    setNewName('');
                  }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left ring-1 ring-inset transition-colors',
                    selected === project.id
                      ? 'bg-suma-red-tint ring-suma-red'
                      : 'bg-suma-high ring-suma-border hover:ring-suma-muted',
                  )}
                  aria-pressed={selected === project.id}
                >
                  <FolderKanban
                    className={cn(
                      'size-4 shrink-0',
                      selected === project.id ? 'text-suma-red-bright' : 'text-suma-muted',
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-suma-ink">
                      {project.name}
                    </span>
                    <span className="block text-[11px] text-suma-muted">
                      {project.budgets.length}{' '}
                      {project.budgets.length === 1
                        ? 'presupuesto guardado'
                        : 'presupuestos guardados'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <label htmlFor="suma-nuevo-proyecto" className="text-xs font-semibold text-suma-muted">
              {projects.length > 0 ? 'O crear uno nuevo' : 'Nombre de la obra'}
            </label>
            <input
              id="suma-nuevo-proyecto"
              value={newName}
              onChange={(event) => {
                setNewName(event.target.value);
                if (event.target.value.trim()) setSelected('');
              }}
              placeholder="«Reforma piso Calle Larios 12»"
              className={fieldControlClass}
            />
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-suma-border px-5 py-4 sm:flex-row-reverse">
          <Button
            size="lg"
            className="flex-1"
            onClick={handleSave}
            disabled={!canSave}
            icon={<FolderPlus className="size-4" aria-hidden />}
          >
            Guardar en el proyecto
          </Button>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Ahora no
          </Button>
        </footer>
      </div>
    </div>
  );
}
