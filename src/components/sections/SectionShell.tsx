'use client';

import type { ReactNode } from 'react';
import { fieldControlClass } from '@/components/ui/Field';
import type { Project } from '@/lib/types';
import { cn } from '@/lib/cn';

/** Armazón común de las secciones de gestión (Proyectos, Salarios, Pagos…). */
export function SectionShell({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="suma-scroll flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <header className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-suma-red-tint text-suma-red-bright ring-1 ring-suma-red/30 ring-inset">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-suma-ink">{title}</h2>
            <p className="text-xs leading-relaxed text-suma-muted">{subtitle}</p>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

/** Tarjeta base de las secciones. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn('rounded-xl border border-suma-border bg-suma-raised p-4', className)}
    >
      {children}
    </section>
  );
}

/** Cifra destacada con etiqueta, para las filas de indicadores. */
export function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'ok' | 'bad' | 'brand';
}) {
  const valueClass = {
    neutral: 'text-suma-ink',
    ok: 'text-suma-success',
    bad: 'text-suma-danger',
    brand: 'text-suma-red-bright',
  }[tone];

  return (
    <div className="min-w-0 rounded-lg bg-suma-high px-3 py-2.5">
      <p className="truncate text-[11px] font-semibold tracking-wide text-suma-muted uppercase">
        {label}
      </p>
      <p className={cn('mt-0.5 truncate text-lg font-bold tabular-nums', valueClass)}>{value}</p>
    </div>
  );
}

/** Selector de proyecto compartido por Pagos y Cobros. */
export function ProjectPicker({
  projects,
  value,
  onChange,
}: {
  projects: Project[];
  value: string;
  onChange: (projectId: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-suma-muted">Proyecto</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldControlClass}
      >
        <option value="">Elige un proyecto…</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Aviso de sección vacía, con la indicación de qué hacer primero. */
export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <Card className="border-dashed">
      <p className="text-center text-sm leading-relaxed text-suma-muted">{children}</p>
    </Card>
  );
}

/** Barra de progreso fina con el rojo de la marca. */
export function ProgressBar({ ratio }: { ratio: number }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0)) * 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-suma-high">
      <div
        className="h-full rounded-full bg-suma-red transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
