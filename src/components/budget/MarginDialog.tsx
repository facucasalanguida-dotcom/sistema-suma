'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, HardHat, Package, TrendingUp, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fieldControlClass } from '@/components/ui/Field';
import { SumaLogo } from '@/components/brand/SumaLogo';
import { formatCurrency, formatPrecise } from '@/lib/format';
import type { BudgetTotals } from '@/lib/types';
import { cn } from '@/lib/cn';

/**
 * Paso previo a finalizar: el margen de ganancia.
 *
 * Con los materiales y la mano de obra ya puestos, el sistema conoce el COSTE
 * de la obra. Aquí el usuario decide cuánto quiere ganar sobre ese coste, y
 * ve al momento lo que tendrá que cobrarle al cliente.
 */

/** Márgenes habituales en reforma y obra, para no teclear. */
const QUICK_MARGINS = [10, 15, 20, 25, 30, 40];

interface MarginDialogProps {
  open: boolean;
  onClose: () => void;
  marginPct: number;
  onMarginChange: (value: number) => void;
  /** Totales ya calculados con el margen actual. */
  totals: BudgetTotals;
  onContinue: () => void;
}

export function MarginDialog({
  open,
  onClose,
  marginPct,
  onMarginChange,
  totals,
  onContinue,
}: MarginDialogProps) {
  // Texto libre mientras se escribe, para poder borrar el campo sin que salte
  // a cero de golpe.
  const [draft, setDraft] = useState(String(marginPct));

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function apply(value: string) {
    setDraft(value);
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 0) onMarginChange(parsed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="suma-margen-titulo"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="suma-scroll flex max-h-[92dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl bg-suma-raised shadow-2xl sm:rounded-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-suma-border bg-suma-raised px-5 py-4">
          <div className="flex items-center gap-3">
            <SumaLogo size={15} />
            <div>
              <h2 id="suma-margen-titulo" className="text-base font-bold text-suma-ink">
                ¿Qué margen quieres ganar?
              </h2>
              <p className="text-xs text-suma-muted">
                Se aplica sobre el coste de la obra.
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

        <div className="flex flex-col gap-4 px-5 py-4">
          {/* Lo que cuesta la obra. */}
          <section className="rounded-xl bg-suma-canvas px-4 py-3">
            <p className="text-[11px] font-bold tracking-wide text-suma-muted uppercase">
              Lo que te cuesta la obra
            </p>
            <dl className="mt-2 flex flex-col gap-1.5 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-suma-muted">
                  <Package className="size-3.5" aria-hidden />
                  Materiales
                </dt>
                <dd className="font-medium text-suma-ink tabular-nums">
                  {formatCurrency(totals.materialsSubtotal)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-suma-muted">
                  <HardHat className="size-3.5" aria-hidden />
                  Mano de obra
                </dt>
                <dd className="font-medium text-suma-ink tabular-nums">
                  {formatCurrency(totals.laborTotal)}
                </dd>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2 border-t border-suma-border pt-1.5">
                <dt className="font-semibold text-suma-ink">Coste total</dt>
                <dd className="font-bold text-suma-ink tabular-nums">
                  {formatCurrency(totals.costSubtotal)}
                </dd>
              </div>
            </dl>
          </section>

          {/* Elección del margen. */}
          <section>
            <label
              htmlFor="suma-margen"
              className="flex items-center gap-1.5 text-xs font-semibold text-suma-muted"
            >
              <TrendingUp className="size-3.5" aria-hidden />
              Margen de ganancia
            </label>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_MARGINS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => apply(String(value))}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 transition-colors ring-inset',
                    marginPct === value
                      ? 'bg-suma-red text-white ring-suma-red'
                      : 'bg-suma-high text-suma-muted ring-suma-border hover:text-suma-ink hover:ring-suma-muted',
                  )}
                  aria-pressed={marginPct === value}
                >
                  {value} %
                </button>
              ))}
            </div>

            <div className="relative mt-2">
              <input
                id="suma-margen"
                value={draft}
                onChange={(event) => apply(event.target.value)}
                inputMode="decimal"
                placeholder="Otro porcentaje"
                className={cn(fieldControlClass, 'pr-8 text-lg font-bold tabular-nums')}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-suma-muted">
                %
              </span>
            </div>

            <p className="mt-1.5 text-[11px] leading-relaxed text-suma-faint">
              Sobre {formatCurrency(totals.costSubtotal)} de coste, un{' '}
              {formatPrecise(totals.marginPct)} % son{' '}
              <span className="font-semibold text-suma-success">
                {formatCurrency(totals.marginAmount)}
              </span>{' '}
              de ganancia.
            </p>
          </section>

          {/* Lo que hay que cobrar. */}
          <section className="rounded-xl border border-suma-red/40 bg-suma-red-tint px-4 py-3">
            <p className="text-[11px] font-bold tracking-wide text-suma-muted uppercase">
              Tienes que cobrar
            </p>
            <p className="mt-1 text-3xl font-bold text-suma-red-bright tabular-nums">
              {formatCurrency(totals.total)}
            </p>
            <p className="mt-1 text-[11px] text-suma-muted">
              IVA ({formatPrecise(totals.vatPct)} %) incluido · base imponible{' '}
              {formatCurrency(totals.taxableBase)}
            </p>
          </section>
        </div>

        <footer className="sticky bottom-0 flex flex-col gap-2 border-t border-suma-border bg-suma-raised px-5 py-4 sm:flex-row-reverse">
          <Button
            size="lg"
            className="flex-1"
            onClick={onContinue}
            icon={<ArrowRight className="size-4" aria-hidden />}
          >
            Continuar
          </Button>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Volver
          </Button>
        </footer>
      </div>
    </div>
  );
}
