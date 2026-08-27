'use client';

import { useState } from 'react';
import { HandCoins, Plus, Receipt, Trash2, Wallet } from 'lucide-react';
import { Card, EmptyHint, ProgressBar, ProjectPicker, SectionShell } from './SectionShell';
import { Button } from '@/components/ui/Button';
import { fieldControlClass } from '@/components/ui/Field';
import { formatCurrency } from '@/lib/format';
import {
  projectBilledTotal,
  projectCollectedTotal,
  projectOwedTotal,
} from '@/lib/projects';
import { useProjectsStore } from '@/lib/projects-store';

/**
 * Cobros: cuánto debe el cliente de cada proyecto y el registro de lo que va
 * pagando. Cada cobro reduce el pendiente.
 */
export function CollectionsSection() {
  const projects = useProjectsStore((state) => state.projects);
  const addCollection = useProjectsStore((state) => state.addCollection);
  const removeCollection = useProjectsStore((state) => state.removeCollection);

  const [projectId, setProjectId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const project = projects.find((entry) => entry.id === projectId) ?? null;
  const billed = project ? projectBilledTotal(project) : 0;
  const collected = project ? projectCollectedTotal(project) : 0;
  const owed = project ? projectOwedTotal(project) : 0;

  return (
    <SectionShell
      icon={<HandCoins className="size-5" aria-hidden />}
      title="Cobros"
      subtitle="Lo que debes cobrar de cada obra —con tu margen incluido— y lo que ya has cobrado."
    >
      <Card>
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />
      </Card>

      {projects.length === 0 ? (
        <EmptyHint>
          Crea un proyecto y guarda dentro un presupuesto finalizado: su total (con IVA) será lo
          que el cliente debe, y aquí irás registrando lo que te vaya pagando.
        </EmptyHint>
      ) : null}

      {project ? (
        <>
          {/*
            Los dos carteles que pidió el usuario: lo que hay que cobrar
            (presupuestado con margen e IVA) y lo que ya se ha cobrado.
          */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="border-suma-red/45 bg-suma-red-tint">
              <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-suma-muted uppercase">
                <Receipt className="size-3.5" aria-hidden />
                Debo cobrar
              </p>
              <p className="mt-1 text-3xl font-bold text-suma-red-bright tabular-nums">
                {formatCurrency(billed)}
              </p>
              <p className="mt-1 text-[11px] text-suma-muted">
                Total presupuestado con margen e IVA
              </p>
            </Card>

            <Card className="border-suma-success/40 bg-suma-success/10">
              <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-suma-muted uppercase">
                <Wallet className="size-3.5" aria-hidden />
                He cobrado
              </p>
              <p className="mt-1 text-3xl font-bold text-suma-success tabular-nums">
                {formatCurrency(collected)}
              </p>
              <p className="mt-1 text-[11px] text-suma-muted">
                {project.collections.length}{' '}
                {project.collections.length === 1 ? 'cobro registrado' : 'cobros registrados'}
              </p>
            </Card>
          </div>

          <Card>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[11px] font-bold tracking-wide text-suma-muted uppercase">
                Queda por cobrar · {project.name}
              </p>
              <p className="text-xl font-bold text-suma-ink tabular-nums">
                {formatCurrency(owed)}
              </p>
            </div>
            <div className="mt-2">
              <ProgressBar ratio={billed > 0 ? collected / billed : 0} />
            </div>
            {billed === 0 ? (
              <p className="mt-2 text-[11px] text-suma-muted">
                Este proyecto no tiene presupuestos guardados todavía, así que no hay nada que
                cobrar. Guarda un presupuesto finalizado para fijar lo que debe el cliente.
              </p>
            ) : null}
          </Card>

          <Card>
            <h3 className="text-sm font-bold text-suma-ink">Registrar un cobro</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
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
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Nota: «anticipo», «certificación 1»… (opcional)"
                className={fieldControlClass}
              />
              <Button
                onClick={() => {
                  const value = Number(amount.replace(',', '.'));
                  if (!(value > 0)) return;
                  addCollection(project.id, {
                    amount: Math.round(value * 100) / 100,
                    note: note.trim() || null,
                  });
                  setAmount('');
                  setNote('');
                }}
                disabled={!(Number(amount.replace(',', '.')) > 0)}
                icon={<Plus className="size-4" aria-hidden />}
              >
                Registrar
              </Button>
            </div>
          </Card>

          {project.collections.length > 0 ? (
            <Card>
              <h3 className="text-sm font-bold text-suma-ink">Historial de cobros</h3>
              <ul className="mt-2 divide-y divide-suma-border-soft">
                {project.collections.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-suma-ink">
                        {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
                          new Date(entry.date),
                        )}
                      </p>
                      {entry.note ? (
                        <p className="truncate text-[11px] text-suma-muted">{entry.note}</p>
                      ) : null}
                    </div>
                    <span className="text-sm font-bold text-suma-success tabular-nums">
                      +{formatCurrency(entry.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCollection(project.id, entry.id)}
                      className="rounded-md p-1 text-suma-muted hover:bg-suma-red-tint hover:text-suma-danger"
                      aria-label="Eliminar este cobro"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : null}
    </SectionShell>
  );
}
