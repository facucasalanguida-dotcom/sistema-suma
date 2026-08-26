'use client';

import { useState } from 'react';
import {
  ChevronDown,
  CircleAlert,
  ExternalLink,
  MapPin,
  Plus,
  Store,
  Truck,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatPrecise } from '@/lib/format';
import type { SupplierOffer } from '@/lib/types';
import { measureLabel, saleUnitLabel, saleUnitAsMeasure } from '@/lib/units';
import { cn } from '@/lib/cn';

const CONFIDENCE: Record<
  SupplierOffer['confidence'],
  { tone: 'success' | 'primary' | 'warning'; label: string; title: string }
> = {
  alta: {
    tone: 'success',
    label: 'Precio verificado',
    title: 'Procede de una tarifa o ficha de producto consultada.',
  },
  media: {
    tone: 'primary',
    label: 'Precio de catálogo',
    title: 'Procede de un catálogo general, puede variar según el pedido.',
  },
  estimada: {
    tone: 'warning',
    label: 'Precio estimado',
    title: 'Referencia de mercado orientativa: confírmala con el proveedor.',
  },
};

interface OfferCardProps {
  offer: SupplierOffer;
  onAdd: (offer: SupplierOffer) => void;
  /** `true` mientras hay otra partida pendiente de cantidad. */
  disabled?: boolean;
  /** `true` si esta oferta ya está en el presupuesto. */
  alreadyInBudget?: boolean;
  cheapest?: boolean;
}

export function OfferCard({
  offer,
  onAdd,
  disabled = false,
  alreadyInBudget = false,
  cheapest = false,
}: OfferCardProps) {
  const [expanded, setExpanded] = useState(false);

  const confidence = CONFIDENCE[offer.confidence];
  const saleLabel = saleUnitLabel(offer.saleUnit);
  const coverageLabel = measureLabel(offer.coverage.unit);

  // Precio normalizado por unidad de medida: es lo único que permite comparar
  // de verdad una caja de 1,44 m² con un precio por metro cuadrado.
  const normalizedPrice = offer.coverage.value > 0 ? offer.price / offer.coverage.value : null;
  const showNormalized =
    normalizedPrice !== null &&
    !(saleUnitAsMeasure(offer.saleUnit) === offer.coverage.unit && offer.coverage.value === 1);

  const visibleSpecs = expanded ? offer.specs : offer.specs.slice(0, 3);

  return (
    <article
      className={cn(
        'flex flex-col rounded-xl border bg-white transition-shadow hover:shadow-md',
        cheapest ? 'border-suma-accent-soft ring-1 ring-suma-accent-soft/60' : 'border-suma-border',
      )}
    >
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm leading-snug font-semibold text-balance text-suma-ink">
              {offer.productName}
            </h4>
            {offer.brand ? (
              <p className="mt-0.5 text-xs text-suma-muted">Marca: {offer.brand}</p>
            ) : null}
          </div>

          <div className="shrink-0 text-right">
            <p className="text-lg leading-none font-bold text-suma-primary tabular-nums">
              {formatCurrency(offer.price)}
            </p>
            <p className="mt-1 text-[11px] text-suma-muted">
              por {saleLabel}
              {offer.priceIncludesVat ? ' · IVA incl.' : ' · sin IVA'}
            </p>
          </div>
        </div>

        {showNormalized ? (
          <p className="-mt-1 text-right text-[11px] font-medium text-suma-accent tabular-nums">
            ≈ {formatCurrency(normalizedPrice)} / {coverageLabel}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {cheapest ? <Badge tone="accent">Más económica</Badge> : null}
          <Badge tone={confidence.tone}>
            <span title={confidence.title}>{confidence.label}</span>
          </Badge>
          {offer.recommendedWastePct > 0 ? (
            <Badge tone="neutral">Merma {formatPrecise(offer.recommendedWastePct)} %</Badge>
          ) : null}
        </div>

        <dl className="flex flex-col gap-1.5 text-xs text-suma-muted">
          <div className="flex items-start gap-1.5">
            <Store className="mt-0.5 size-3.5 shrink-0 text-suma-primary-soft" aria-hidden />
            <dd className="font-medium text-suma-ink">{offer.supplier.name}</dd>
          </div>
          <div className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-suma-primary-soft" aria-hidden />
            <dd>{offer.supplier.location}</dd>
          </div>
          {offer.delivery ? (
            <div className="flex items-start gap-1.5">
              <Truck className="mt-0.5 size-3.5 shrink-0 text-suma-primary-soft" aria-hidden />
              <dd>{offer.delivery}</dd>
            </div>
          ) : null}
        </dl>

        <div className="rounded-lg bg-suma-primary-tint/60 px-3 py-2">
          <p className="text-[11px] leading-relaxed text-suma-primary-soft">
            <span className="font-semibold">Rendimiento:</span> 1 {saleLabel} ={' '}
            {formatPrecise(offer.coverage.value)} {coverageLabel}
            {offer.coverage.note ? ` · ${offer.coverage.note}` : ''}
          </p>
        </div>

        {offer.specs.length > 0 ? (
          <div>
            <ul className="flex flex-col gap-1 text-[11px] text-suma-muted">
              {visibleSpecs.map((spec) => (
                <li key={`${spec.key}-${spec.value}`} className="flex gap-1.5">
                  <span className="font-medium text-suma-ink">{spec.key}:</span>
                  <span className="min-w-0">{spec.value}</span>
                </li>
              ))}
            </ul>

            {offer.specs.length > 3 ? (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-suma-primary-soft hover:text-suma-primary"
              >
                <ChevronDown
                  className={cn('size-3 transition-transform', expanded && 'rotate-180')}
                  aria-hidden
                />
                {expanded
                  ? 'Ocultar ficha técnica'
                  : `Ver ficha técnica completa (${offer.specs.length})`}
              </button>
            ) : null}
          </div>
        ) : null}

        {offer.highlight ? (
          <p className="flex items-start gap-1.5 text-[11px] text-suma-muted italic">
            <CircleAlert className="mt-0.5 size-3 shrink-0 text-suma-accent" aria-hidden />
            {offer.highlight}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-suma-border px-4 py-3">
        {offer.sourceUrl ? (
          <a
            href={offer.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-suma-primary-soft hover:underline"
          >
            <ExternalLink className="size-3" aria-hidden />
            Ver fuente
          </a>
        ) : offer.supplier.website ? (
          <a
            href={`https://${offer.supplier.website.replace(/^https?:\/\//, '')}`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-suma-primary-soft hover:underline"
          >
            <ExternalLink className="size-3" aria-hidden />
            {offer.supplier.website}
          </a>
        ) : (
          <span className="text-[11px] text-suma-muted">{offer.availability ?? ''}</span>
        )}

        <Button
          size="sm"
          variant={cheapest ? 'accent' : 'primary'}
          icon={<Plus className="size-3.5" aria-hidden />}
          onClick={() => onAdd(offer)}
          disabled={disabled}
          title={
            disabled
              ? 'Termina de indicar la cantidad de la partida anterior'
              : 'Añadir esta opción al presupuesto'
          }
        >
          {alreadyInBudget ? 'Añadir otra vez' : 'Agregar al presupuesto'}
        </Button>
      </div>
    </article>
  );
}
