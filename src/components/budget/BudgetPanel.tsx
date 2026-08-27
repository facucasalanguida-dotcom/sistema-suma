'use client';

import { useState } from 'react';
import { FileDown, HardHat, Info, Package, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatPrecise } from '@/lib/format';
import type { BudgetLine, BudgetTotals, LaborLine } from '@/lib/types';
import { measureLabel, saleUnitLabel } from '@/lib/units';
import { cn } from '@/lib/cn';

/**
 * Paso 4 del proceso: la lista de partidas que se va formando y el botón de
 * finalizar presupuesto.
 */

interface BudgetPanelProps {
  lines: BudgetLine[];
  laborLines: LaborLine[];
  totals: BudgetTotals;
  onRemove: (id: string) => void;
  onRemoveLabor: (id: string) => void;
  onClear: () => void;
  /** Abre el paso de mano de obra, previo a finalizar. */
  onLabor: () => void;
  onFinalize: () => void;
  busy: boolean;
  className?: string;
}

export function BudgetPanel({
  lines,
  laborLines,
  totals,
  onRemove,
  onRemoveLabor,
  onClear,
  onLabor,
  onFinalize,
  busy,
  className,
}: BudgetPanelProps) {
  const hasEstimates = lines.some((line) => line.offer.confidence === 'estimada');

  return (
    <aside
      className={cn(
        'flex min-h-0 flex-col border-suma-border bg-suma-raised',
        className,
      )}
      aria-label="Presupuesto en curso"
    >
      <header className="flex items-center justify-between gap-2 border-b border-suma-border px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Package className="size-4 text-suma-muted" aria-hidden />
          <h2 className="text-sm font-bold tracking-wide text-suma-red uppercase">
            Presupuesto
          </h2>
          <Badge tone={lines.length > 0 ? 'brand' : 'neutral'}>
            {lines.length} {lines.length === 1 ? 'partida' : 'partidas'}
          </Badge>
        </div>

        {lines.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-suma-red-tint hover:text-suma-danger"
            onClick={onClear}
            icon={<Trash2 className="size-3.5" aria-hidden />}
          >
            Vaciar
          </Button>
        ) : null}
      </header>

      <div className="suma-scroll min-h-0 flex-1 overflow-y-auto">
        {lines.length === 0 && laborLines.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <ol className="divide-y divide-suma-border-soft">
              {lines.map((line, index) => (
                <BudgetLineRow key={line.id} line={line} index={index} onRemove={onRemove} />
              ))}
            </ol>

            {laborLines.length > 0 ? (
              <div className="border-t-2 border-suma-border">
                <p className="flex items-center gap-1.5 bg-suma-canvas px-4 py-2 text-[11px] font-bold tracking-wide text-suma-muted uppercase">
                  <HardHat className="size-3.5" aria-hidden />
                  Mano de obra
                </p>
                <ul className="divide-y divide-suma-border-soft">
                  {laborLines.map((laborLine) => (
                    <li key={laborLine.id} className="group flex items-start gap-2 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-snug font-semibold text-suma-ink">
                          {laborLine.description}
                        </p>
                        {laborLine.detail ? (
                          <p className="mt-0.5 text-[11px] text-suma-muted">{laborLine.detail}</p>
                        ) : null}
                      </div>
                      <span className="text-sm font-bold text-suma-ink tabular-nums">
                        {formatCurrency(laborLine.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveLabor(laborLine.id)}
                        className="rounded-md p-1 text-suma-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-suma-red-tint hover:text-suma-danger focus-visible:opacity-100"
                        aria-label={`Quitar «${laborLine.description}»`}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>

      <footer className="border-t border-suma-border bg-suma-canvas px-4 py-4">
        <dl className="flex flex-col gap-1.5 text-sm">
          {totals.laborTotal > 0 ? (
            <>
              <Row label="Materiales" value={formatCurrency(totals.materialsSubtotal)} />
              <Row label="Mano de obra" value={formatCurrency(totals.laborTotal)} />
            </>
          ) : null}
          <Row label="Suma de partidas" value={formatCurrency(totals.subtotal)} />
          {totals.discountPct > 0 ? (
            <Row
              label={`Descuento (${formatPrecise(totals.discountPct)} %)`}
              value={`-${formatCurrency(totals.discountAmount)}`}
            />
          ) : null}
          <Row label="Base imponible" value={formatCurrency(totals.taxableBase)} />
          <Row
            label={`IVA (${formatPrecise(totals.vatPct)} %)`}
            value={formatCurrency(totals.vatAmount)}
          />
        </dl>

        <div className="mt-3 flex items-baseline justify-between rounded-r-lg border-l-4 border-suma-red bg-suma-high px-3 py-2.5">
          <span className="text-xs font-bold tracking-wide text-suma-muted uppercase">Total</span>
          <span className="text-xl font-bold text-suma-ink tabular-nums">
            {formatCurrency(totals.total)}
          </span>
        </div>

        {hasEstimates ? (
          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-suma-warning">
            <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
            Alguna partida usa precios estimados. Confírmalos con el proveedor antes de contratar.
          </p>
        ) : null}

        <div className="mt-3 flex flex-col gap-2">
          <Button
            variant="neutral"
            size="md"
            className="w-full"
            disabled={lines.length === 0}
            onClick={onLabor}
            icon={<HardHat className="size-4" aria-hidden />}
          >
            {laborLines.length > 0
              ? `Mano de obra (${laborLines.length})`
              : 'Añadir mano de obra'}
          </Button>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={lines.length === 0}
            loading={busy}
            onClick={onFinalize}
            icon={<FileDown className="size-4" aria-hidden />}
          >
            Finalizar presupuesto
          </Button>
        </div>
      </footer>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-suma-muted">{label}</dt>
      <dd className="font-medium text-suma-ink tabular-nums">{value}</dd>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <Package className="size-8 text-suma-border" aria-hidden />
      <p className="text-sm font-medium text-suma-ink">Todavía no hay partidas</p>
      <p className="max-w-60 text-xs text-suma-muted">
        Busca un material en el chat y pulsa «Agregar al presupuesto» en la opción que prefieras.
      </p>
    </div>
  );
}

function BudgetLineRow({
  line,
  index,
  onRemove,
}: {
  line: BudgetLine;
  index: number;
  onRemove: (id: string) => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const { offer, breakdown } = line;

  return (
    <li className="group px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-suma-high text-[11px] font-bold text-suma-muted tabular-nums">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-snug font-semibold text-suma-ink">
            {offer.productName}
          </p>
          <p className="mt-0.5 text-[11px] text-suma-muted">
            {offer.supplier.name} · {offer.supplier.location}
          </p>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[11px] text-suma-muted">
            <span className="tabular-nums">
              {formatPrecise(breakdown.saleUnits)}{' '}
              {saleUnitLabel(offer.saleUnit, breakdown.saleUnits)}
            </span>
            <span aria-hidden>×</span>
            <span className="tabular-nums">{formatCurrency(breakdown.unitPrice)}</span>
            <span className="ml-auto text-sm font-bold text-suma-ink tabular-nums">
              {formatCurrency(breakdown.lineTotal)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowDetail((value) => !value)}
            className="mt-1 text-[11px] font-medium text-suma-muted hover:underline"
            aria-expanded={showDetail}
          >
            {showDetail ? 'Ocultar cálculo' : 'Ver cómo se ha calculado'}
          </button>

          {showDetail ? (
            <p className="mt-1.5 rounded-md bg-suma-canvas px-2.5 py-2 text-[11px] leading-relaxed text-suma-muted">
              {breakdown.explanation}
              <br />
              <span className="text-suma-muted">
                Medición solicitada: {formatPrecise(breakdown.requested.value)}{' '}
                {measureLabel(breakdown.requested.unit)}
              </span>
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onRemove(line.id)}
          className="rounded-md p-1 text-suma-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-suma-red-tint hover:text-suma-danger focus-visible:opacity-100"
          aria-label={`Quitar «${offer.productName}» del presupuesto`}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>
    </li>
  );
}
