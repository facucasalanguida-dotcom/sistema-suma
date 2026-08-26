'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Calculator, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fieldControlClass } from '@/components/ui/Field';
import { formatCurrency, formatPrecise } from '@/lib/format';
import { computeLinePrice, PricingError } from '@/lib/pricing';
import type { SupplierOffer } from '@/lib/types';
import {
  measureLabel,
  measureLong,
  saleUnitLabel,
  suggestedMeasureUnits,
  type MeasureUnit,
} from '@/lib/units';
import { cn } from '@/lib/cn';

/**
 * Paso 5 del proceso: tras pulsar «Agregar al presupuesto», el asistente pide
 * la cantidad.
 *
 * Ofrece dos caminos: un campo numérico con selector de unidad, que es lo más
 * rápido, y la posibilidad de escribirlo en el chat con lenguaje natural («el
 * salón mide 4 por 5 metros»). Mientras se teclea se muestra una previsualización
 * del importe calculada en el navegador con la misma función que usa el
 * servidor, así que el número que se ve es el que acabará en el PDF.
 */

interface QuantityPromptProps {
  offer: SupplierOffer;
  onSubmit: (phrase: string, wastePct: number | null) => void;
  onCancel: () => void;
  busy: boolean;
  resolved: boolean;
}

export function QuantityPrompt({
  offer,
  onSubmit,
  onCancel,
  busy,
  resolved,
}: QuantityPromptProps) {
  const units = useMemo(
    () => suggestedMeasureUnits(offer.coverage.unit),
    [offer.coverage.unit],
  );

  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<MeasureUnit>(offer.coverage.unit);
  const [waste, setWaste] = useState(offer.recommendedWastePct);

  const parsedAmount = Number(amount.replace(',', '.'));
  const valid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const preview = useMemo(() => {
    if (!valid) return null;
    try {
      return computeLinePrice(offer, { value: parsedAmount, unit }, waste);
    } catch (error) {
      return error instanceof PricingError ? error : null;
    }
  }, [offer, parsedAmount, unit, valid, waste]);

  if (resolved) {
    return (
      <p className="text-xs text-suma-muted italic">Cantidad confirmada.</p>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    onSubmit(`${parsedAmount} ${unit}`, waste);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-suma-red/45 bg-suma-red-tint/60 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-suma-ink">
            ¿Cuánta cantidad vas a utilizar?
          </p>
          <p className="mt-0.5 text-xs text-suma-muted">
            {offer.productName} · {offer.supplier.name}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-suma-muted transition-colors hover:bg-suma-raised hover:text-suma-danger"
          aria-label="Cancelar esta partida"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-30 flex-1 flex-col gap-1">
          <label htmlFor="suma-cantidad" className="text-[11px] font-semibold text-suma-muted">
            Cantidad
          </label>
          <input
            id="suma-cantidad"
            type="text"
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={`p. ej. 24`}
            className={cn(fieldControlClass, 'tabular-nums')}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="suma-unidad" className="text-[11px] font-semibold text-suma-muted">
            Unidad
          </label>
          <select
            id="suma-unidad"
            value={unit}
            onChange={(event) => setUnit(event.target.value as MeasureUnit)}
            className={cn(fieldControlClass, 'w-28')}
          >
            {units.map((option) => (
              <option key={option} value={option}>
                {measureLabel(option)} · {measureLong(option)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="suma-merma" className="text-[11px] font-semibold text-suma-muted">
            Merma
          </label>
          <div className="relative">
            <input
              id="suma-merma"
              type="number"
              min={0}
              max={30}
              step={1}
              value={waste}
              onChange={(event) => setWaste(Number(event.target.value) || 0)}
              className={cn(fieldControlClass, 'w-24 pr-7 tabular-nums')}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-suma-muted">
              %
            </span>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          disabled={!valid}
          loading={busy}
          icon={<Calculator className="size-4" aria-hidden />}
        >
          Calcular y añadir
        </Button>
      </div>

      {preview instanceof PricingError ? (
        <p className="text-xs font-medium text-suma-danger">{preview.message}</p>
      ) : preview ? (
        <div className="rounded-lg bg-suma-high/70 px-3 py-2.5 text-xs">
          <p className="font-semibold text-suma-ink tabular-nums">
            {formatPrecise(preview.saleUnits)}{' '}
            {saleUnitLabel(offer.saleUnit, preview.saleUnits)} ·{' '}
            <span className="text-suma-red">{formatCurrency(preview.lineTotal)}</span>{' '}
            <span className="font-normal text-suma-muted">(sin IVA)</span>
          </p>
          <p className="mt-1 leading-relaxed text-suma-muted">{preview.explanation}</p>
        </div>
      ) : (
        <p className="text-xs text-suma-muted">
          También puedes responder en el chat: «el salón mide 4 por 5 metros» o «unos 350 cm».
        </p>
      )}
    </form>
  );
}
