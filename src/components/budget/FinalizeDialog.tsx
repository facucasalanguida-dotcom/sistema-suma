'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FileDown, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextAreaField, fieldControlClass } from '@/components/ui/Field';
import { SumaLogo } from '@/components/brand/SumaLogo';
import { formatCurrency, formatLongDate, formatPrecise } from '@/lib/format';
import { issuerIsPlaceholder } from '@/lib/brand';
import { DEFAULT_VAT_PCT, REDUCED_VAT_PCT, validUntil } from '@/lib/pricing';
import type { BudgetTotals, ClientDetails } from '@/lib/types';
import { cn } from '@/lib/cn';

/**
 * Paso 7 del proceso: datos del cliente y condiciones económicas antes de
 * generar el PDF.
 *
 * Ningún campo es obligatorio a propósito: en obra se pide muchas veces un
 * presupuesto orientativo antes de tener los datos fiscales del cliente, y
 * bloquear la descarga por eso sólo estorba.
 */

interface FinalizeDialogProps {
  open: boolean;
  onClose: () => void;
  client: ClientDetails;
  onClientChange: (client: Partial<ClientDetails>) => void;
  discountPct: number;
  onDiscountChange: (value: number) => void;
  vatPct: number;
  onVatChange: (value: number) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  totals: BudgetTotals;
  lineCount: number;
  busy: boolean;
  onGenerate: () => void;
}

export function FinalizeDialog({
  open,
  onClose,
  client,
  onClientChange,
  discountPct,
  onDiscountChange,
  vatPct,
  onVatChange,
  notes,
  onNotesChange,
  totals,
  lineCount,
  busy,
  onGenerate,
}: FinalizeDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [today] = useState(() => new Date());

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onGenerate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="suma-finalizar-titulo"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="suma-scroll flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-t-2xl bg-suma-raised shadow-2xl sm:rounded-2xl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-suma-border bg-suma-raised px-5 py-4">
          <div className="flex items-center gap-3">
            <SumaLogo size={15} />
            <div>
              <h2 id="suma-finalizar-titulo" className="text-base font-bold text-suma-ink">
                Finalizar presupuesto
              </h2>
              <p className="text-xs text-suma-muted">
                {lineCount} {lineCount === 1 ? 'partida' : 'partidas'} ·{' '}
                {formatCurrency(totals.total)} IVA incluido
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md p-1.5 text-suma-muted transition-colors hover:bg-suma-canvas hover:text-suma-ink disabled:opacity-40"
            aria-label="Cerrar"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-5 py-5">
          {issuerIsPlaceholder ? (
            <p className="rounded-lg border border-suma-warning/30 bg-suma-warning/10 px-3 py-2.5 text-xs text-suma-warning">
              <strong className="font-semibold">Faltan los datos fiscales de SUMA.</strong> El PDF
              saldrá marcado como documento de prueba, con el NIF y el domicilio de ejemplo.
              Se arregla definiendo las variables <code className="font-mono">NEXT_PUBLIC_SUMA_*</code>{' '}
              en el entorno.
            </p>
          ) : null}

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-bold tracking-wide text-suma-red uppercase">
              Datos del cliente
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Razón social o nombre"
                value={client.name}
                onChange={(event) => onClientChange({ name: event.target.value })}
                placeholder="Promociones Costa del Sol, S.L."
                autoComplete="organization"
              />
              <Field
                label="CIF / NIF"
                value={client.taxId}
                onChange={(event) => onClientChange({ taxId: event.target.value })}
                placeholder="B29123456"
              />
              <Field
                label="Domicilio"
                className="sm:col-span-2"
                value={client.address}
                onChange={(event) => onClientChange({ address: event.target.value })}
                placeholder="Avenida de Andalucía 24, 29006 Málaga"
                autoComplete="street-address"
              />
              <Field
                label="Persona de contacto"
                value={client.contact}
                onChange={(event) => onClientChange({ contact: event.target.value })}
                placeholder="Dirección técnica"
              />
              <Field
                label="Correo electrónico"
                type="email"
                value={client.email}
                onChange={(event) => onClientChange({ email: event.target.value })}
                placeholder="obras@cliente.es"
                autoComplete="email"
              />
              <Field
                label="Obra o proyecto"
                className="sm:col-span-2"
                value={client.projectName}
                onChange={(event) => onClientChange({ projectName: event.target.value })}
                placeholder="Reforma integral de 6 viviendas · Fase 1"
              />
              <Field
                label="Emplazamiento de la obra"
                className="sm:col-span-2"
                value={client.siteAddress}
                onChange={(event) => onClientChange({ siteAddress: event.target.value })}
                placeholder="Urbanización Los Álamos, parcela 12 · 29631 Benalmádena"
                hint="Dirección de entrega, si es distinta del domicilio fiscal."
              />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-bold tracking-wide text-suma-red uppercase">
              Condiciones económicas
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="suma-descuento"
                  className="text-xs font-semibold text-suma-muted"
                >
                  Descuento comercial
                </label>
                <div className="relative">
                  <input
                    id="suma-descuento"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={discountPct}
                    onChange={(event) => onDiscountChange(Number(event.target.value) || 0)}
                    className={cn(fieldControlClass, 'pr-8 tabular-nums')}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-suma-muted">
                    %
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="suma-iva" className="text-xs font-semibold text-suma-muted">
                  Tipo de IVA
                </label>
                <select
                  id="suma-iva"
                  value={vatPct}
                  onChange={(event) => onVatChange(Number(event.target.value))}
                  className={fieldControlClass}
                >
                  <option value={DEFAULT_VAT_PCT}>
                    {DEFAULT_VAT_PCT} % · general (venta de materiales)
                  </option>
                  <option value={REDUCED_VAT_PCT}>
                    {REDUCED_VAT_PCT} % · reducido (renovación y reparación de vivienda)
                  </option>
                  <option value={0}>0 % · operación exenta o intracomunitaria</option>
                </select>
                <p className="text-[11px] text-suma-muted">
                  La venta de material sin instalación tributa siempre al 21 %. El 10 % sólo cabe
                  en una obra de renovación o reparación de vivienda cuyo material no supere el
                  40 % de la base imponible (art. 91 de la Ley del IVA).
                </p>
              </div>
            </div>

            <TextAreaField
              label="Observaciones"
              rows={3}
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Plazos, condiciones de entrega, exclusiones…"
              hint="Aparecerán destacadas en el PDF, justo debajo del resumen económico."
            />
          </section>

          <section className="rounded-xl border border-suma-border bg-suma-canvas px-4 py-3">
            <h3 className="mb-2 text-xs font-bold tracking-wide text-suma-red uppercase">
              Resumen
            </h3>
            <dl className="flex flex-col gap-1 text-sm">
              {totals.laborTotal > 0 ? (
                <>
                  <SummaryRow
                    label="Materiales"
                    value={formatCurrency(totals.materialsSubtotal)}
                  />
                  <SummaryRow label="Mano de obra" value={formatCurrency(totals.laborTotal)} />
                </>
              ) : null}
              <SummaryRow label="Suma de partidas" value={formatCurrency(totals.subtotal)} />
              {totals.discountPct > 0 ? (
                <SummaryRow
                  label={`Descuento (${formatPrecise(totals.discountPct)} %)`}
                  value={`-${formatCurrency(totals.discountAmount)}`}
                />
              ) : null}
              <SummaryRow label="Base imponible" value={formatCurrency(totals.taxableBase)} />
              <SummaryRow
                label={`IVA (${formatPrecise(totals.vatPct)} %)`}
                value={formatCurrency(totals.vatAmount)}
              />
              <div className="mt-1 flex items-baseline justify-between border-t border-suma-border pt-2">
                <dt className="text-sm font-bold text-suma-ink">TOTAL</dt>
                <dd className="text-lg font-bold text-suma-ink tabular-nums">
                  {formatCurrency(totals.total)}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-[11px] text-suma-muted">
              Oferta válida hasta el {formatLongDate(validUntil(today))}.
            </p>
          </section>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Seguir añadiendo materiales
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={busy}
              icon={<FileDown className="size-4" aria-hidden />}
            >
              Generar PDF del presupuesto
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-suma-muted">{label}</dt>
      <dd className="font-medium text-suma-ink tabular-nums">{value}</dd>
    </div>
  );
}
