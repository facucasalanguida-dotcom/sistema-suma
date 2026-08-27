'use client';

import { useState } from 'react';
import {
  BadgeCheck,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  MapPin,
  Plus,
  Search,
  ShoppingCart,
  Store,
  Truck,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatPrecise } from '@/lib/format';
import { unitPriceExVat } from '@/lib/pricing';
import { productSearchUrl, siteDomain } from '@/lib/search/fallback-link';
import type { SupplierOffer } from '@/lib/types';
import { measureLabel, saleUnitLabel, saleUnitAsMeasure } from '@/lib/units';
import { cn } from '@/lib/cn';

const CONFIDENCE: Record<
  SupplierOffer['confidence'],
  { tone: 'success' | 'brand' | 'warning'; label: string; title: string }
> = {
  alta: {
    tone: 'success',
    label: 'Precio verificado',
    title: 'Procede de una tarifa o ficha de producto consultada.',
  },
  media: {
    tone: 'brand',
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

/** «obramat.es», sin «www.» ni ruta: suficiente para saber a dónde se va. */
function hostLabel(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    return 'la tienda';
  }
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

  // El presupuesto trabaja siempre sin IVA: si la tienda publica PVP con IVA,
  // se enseña también la base imponible para que no haya sorpresas.
  const netPrice = unitPriceExVat(offer);

  // Precio normalizado por unidad de medida (sin IVA): es lo único que
  // permite comparar de verdad una caja de 1,44 m² con un precio por m².
  const normalizedPrice = offer.coverage.value > 0 ? netPrice / offer.coverage.value : null;
  const showNormalized =
    normalizedPrice !== null &&
    !(saleUnitAsMeasure(offer.saleUnit) === offer.coverage.unit && offer.coverage.value === 1);

  const visibleSpecs = expanded ? offer.specs : offer.specs.slice(0, 3);

  return (
    <article
      className={cn(
        'flex flex-col rounded-xl border bg-suma-raised transition-shadow hover:shadow-md',
        cheapest ? 'border-suma-red/45 ring-1 ring-suma-red/40' : 'border-suma-border',
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
            <p className="text-lg leading-none font-bold text-suma-ink tabular-nums">
              {formatCurrency(offer.price)}
            </p>
            <p className="mt-1 text-[11px] text-suma-muted">
              por {saleLabel}
              {offer.priceIncludesVat ? ' · IVA incl.' : ' · sin IVA'}
            </p>
            {offer.priceIncludesVat ? (
              <p className="mt-0.5 text-[11px] text-suma-faint tabular-nums">
                = {formatCurrency(netPrice)} sin IVA
              </p>
            ) : null}
          </div>
        </div>

        {showNormalized ? (
          <p className="-mt-1 text-right text-[11px] font-medium text-suma-red tabular-nums">
            ≈ {formatCurrency(normalizedPrice)} / {coverageLabel} sin IVA
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {cheapest ? <Badge tone="brand">Más económica</Badge> : null}
          <Badge tone={confidence.tone}>
            <span title={confidence.title}>{confidence.label}</span>
          </Badge>
          {offer.sourceUrl && offer.linkVerified ? (
            <Badge tone="success">
              <span
                title="El sistema comprobó que la ficha del producto respondía en el momento de la búsqueda."
                className="inline-flex items-center gap-1"
              >
                <BadgeCheck className="size-3" aria-hidden />
                Enlace comprobado
              </span>
            </Badge>
          ) : null}
          {offer.recommendedWastePct > 0 ? (
            <Badge tone="neutral">Merma {formatPrecise(offer.recommendedWastePct)} %</Badge>
          ) : null}
        </div>

        <dl className="flex flex-col gap-1.5 text-xs text-suma-muted">
          <div className="flex items-start gap-1.5">
            <Store className="mt-0.5 size-3.5 shrink-0 text-suma-muted" aria-hidden />
            <dd className="font-medium text-suma-ink">{offer.supplier.name}</dd>
          </div>
          <div className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-suma-muted" aria-hidden />
            <dd>{offer.supplier.location}</dd>
          </div>
          {offer.delivery ? (
            <div className="flex items-start gap-1.5">
              <Truck className="mt-0.5 size-3.5 shrink-0 text-suma-muted" aria-hidden />
              <dd>{offer.delivery}</dd>
            </div>
          ) : null}
        </dl>

        <div className="rounded-lg bg-suma-high px-3 py-2">
          <p className="text-[11px] leading-relaxed text-suma-muted">
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
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-suma-muted hover:text-suma-ink"
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
            <CircleAlert className="mt-0.5 size-3 shrink-0 text-suma-faint" aria-hidden />
            {offer.highlight}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-suma-border px-4 py-3">
        {offer.sourceUrl ? (
          <a
            href={offer.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-suma-high text-[13px] font-semibold text-suma-ink ring-1 ring-suma-border transition-colors ring-inset hover:text-suma-red-bright hover:ring-suma-red"
            title={offer.sourceUrl}
          >
            <ShoppingCart className="size-3.5" aria-hidden />
            Ver producto en {hostLabel(offer.sourceUrl)}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : (
          <div className="flex flex-col gap-1.5">
            <a
              href={productSearchUrl(offer)}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-suma-high text-[13px] font-semibold text-suma-ink ring-1 ring-suma-border transition-colors ring-inset hover:text-suma-red-bright hover:ring-suma-red"
              title="No hay ficha directa: este enlace busca el producto para que no tengas que teclearlo."
            >
              <Search className="size-3.5" aria-hidden />
              Buscar este producto en{' '}
              {siteDomain(offer.supplier.website) ?? 'Google'}
              <ExternalLink className="size-3" aria-hidden />
            </a>
            <p className="flex items-start gap-1.5 text-[11px] text-suma-faint">
              <CircleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
              Sin ficha directa del producto: confirma precio y disponibilidad con{' '}
              {offer.supplier.name}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[11px] text-suma-faint">
            {offer.availability ?? ''}
          </span>
          <Button
            size="sm"
            variant={cheapest ? 'primary' : 'neutral'}
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
      </div>
    </article>
  );
}
