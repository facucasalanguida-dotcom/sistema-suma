'use client';

import { useEffect, useRef } from 'react';
import {
  CircleAlert,
  CircleCheck,
  ExternalLink,
  FileDown,
  Globe,
  ListPlus,
  MessageSquareText,
  Sparkles,
} from 'lucide-react';
import { OfferCard } from './OfferCard';
import { QuantityPrompt } from './QuantityPrompt';
import { Badge } from '@/components/ui/Badge';
import { SumaLogo } from '@/components/brand/SumaLogo';
import { formatCurrency, formatPrecise, formatTime } from '@/lib/format';
import { unitPriceExVat } from '@/lib/pricing';
import { EXPLORE_SHOPS, shopSearchUrl } from '@/lib/search/fallback-link';
import type { ChatMessage, SupplierOffer } from '@/lib/types';
import { saleUnitLabel } from '@/lib/units';
import { WELCOME_MESSAGE_ID, type AssistantStatus } from '@/lib/store';

const STATUS_LABEL: Record<Exclude<AssistantStatus, 'idle'>, string> = {
  interpretando: 'Interpretando lo que necesitas…',
  buscando: 'Buscando proveedores en Málaga y comparando precios…',
  calculando: 'Calculando la cantidad y el importe…',
  'generando-pdf': 'Generando el PDF del presupuesto…',
};

interface ChatPanelProps {
  messages: ChatMessage[];
  status: AssistantStatus;
  budgetOfferIds: Set<string>;
  hasPendingQuantity: boolean;
  onAddOffer: (offer: SupplierOffer) => void;
  onSubmitQuantity: (phrase: string, wastePct: number | null) => void;
  onCancelQuantity: () => void;
}

export function ChatPanel({
  messages,
  status,
  budgetOfferIds,
  hasPendingQuantity,
  onAddOffer,
  onSubmitQuantity,
  onCancelQuantity,
}: ChatPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status]);

  return (
    <div className="suma-scroll flex-1 overflow-y-auto px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            budgetOfferIds={budgetOfferIds}
            hasPendingQuantity={hasPendingQuantity}
            busy={status === 'calculando'}
            onAddOffer={onAddOffer}
            onSubmitQuantity={onSubmitQuantity}
            onCancelQuantity={onCancelQuantity}
          />
        ))}

        {messages.length <= 1 && status === 'idle' ? <ProcessHint /> : null}

        {status !== 'idle' ? (
          <div className="suma-rise flex items-center gap-3">
            <Avatar />
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-suma-border bg-suma-raised px-4 py-3">
              <span className="flex gap-1" aria-hidden>
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className="suma-dot size-1.5 rounded-full bg-suma-red"
                    style={{ animationDelay: `${index * 0.16}s` }}
                  />
                ))}
              </span>
              <span className="text-sm text-suma-muted">{STATUS_LABEL[status]}</span>
            </div>
          </div>
        ) : null}

        <div ref={endRef} />
      </div>
    </div>
  );
}

/**
 * El «+» de la marca en una caja oscura, como la insignia circular de SUMA.
 * Suelto y a tamaño completo dominaba cada mensaje del chat.
 */
function Avatar() {
  return (
    <span
      className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-suma-high ring-1 ring-inset ring-suma-border"
      aria-hidden
    >
      <SumaLogo size={11} markOnly />
    </span>
  );
}

interface MessageProps {
  message: ChatMessage;
  budgetOfferIds: Set<string>;
  hasPendingQuantity: boolean;
  busy: boolean;
  onAddOffer: (offer: SupplierOffer) => void;
  onSubmitQuantity: (phrase: string, wastePct: number | null) => void;
  onCancelQuantity: () => void;
}

function Message({
  message,
  budgetOfferIds,
  hasPendingQuantity,
  busy,
  onAddOffer,
  onSubmitQuantity,
  onCancelQuantity,
}: MessageProps) {
  if (message.role === 'user') {
    return (
      <div className="suma-rise flex flex-col items-end gap-1">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-suma-surface px-4 py-3 text-sm text-white">
          {message.imageDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.imageDataUrl}
              alt="Fotografía enviada"
              className="mb-2 max-h-56 rounded-lg object-cover"
            />
          ) : null}
          <p className="whitespace-pre-wrap">{message.text}</p>
        </div>
        <time className="text-[11px] text-suma-muted">{formatTime(message.at)}</time>
      </div>
    );
  }

  return (
    <div className="suma-rise flex gap-3">
      <Avatar />
      <div className="min-w-0 flex-1">
        {message.kind === 'error' ? (
          <div className="flex items-start gap-2 rounded-2xl rounded-tl-sm border border-suma-danger/35 bg-suma-red-tint px-4 py-3">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-suma-danger" aria-hidden />
            <p className="text-sm text-suma-danger">{message.text}</p>
          </div>
        ) : (
          <div className="rounded-2xl rounded-tl-sm border border-suma-border bg-suma-raised px-4 py-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-suma-ink">
              {message.text}
            </p>

            {message.kind === 'results' ? (
              <ResultsBlock
                message={message}
                budgetOfferIds={budgetOfferIds}
                hasPendingQuantity={hasPendingQuantity}
                onAddOffer={onAddOffer}
              />
            ) : null}

            {message.kind === 'line-added' ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-suma-success/30 bg-suma-success/10 px-3 py-2.5">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-suma-success" aria-hidden />
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-suma-ink">
                    Añadido al presupuesto ·{' '}
                    {formatPrecise(message.line.breakdown.saleUnits)}{' '}
                    {saleUnitLabel(
                      message.line.offer.saleUnit,
                      message.line.breakdown.saleUnits,
                    )}{' '}
                    · {formatCurrency(message.line.breakdown.lineTotal)}
                  </p>
                  <p className="mt-0.5 text-suma-muted">{message.line.offer.productName}</p>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {message.kind === 'quantity-request' ? (
          <div className="mt-3">
            <QuantityPrompt
              offer={message.offer}
              resolved={message.resolved}
              busy={busy}
              onSubmit={onSubmitQuantity}
              onCancel={onCancelQuantity}
            />
          </div>
        ) : null}

        {message.id === WELCOME_MESSAGE_ID ? null : (
          <time className="mt-1 block text-[11px] text-suma-muted">{formatTime(message.at)}</time>
        )}
      </div>
    </div>
  );
}

/** Guía breve del proceso, mientras la conversación está en blanco. */
function ProcessHint() {
  const steps = [
    {
      icon: <MessageSquareText className="size-4" aria-hidden />,
      title: 'Describe o fotografía',
      text: 'Escribe el material que necesitas o sube una foto: la IA la interpreta.',
    },
    {
      icon: <ListPlus className="size-4" aria-hidden />,
      title: 'Compara y añade',
      text: 'El sistema lee en vivo las tiendas y te enseña opciones con su precio de hoy. También puedes pegar el enlace de un producto de cualquier tienda.',
    },
    {
      icon: <FileDown className="size-4" aria-hidden />,
      title: 'Finaliza en PDF',
      text: 'Indica la cantidad de cada partida y descarga el presupuesto con la marca de SUMA.',
    },
  ];

  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => (
        <li
          key={step.title}
          className="rounded-xl border border-suma-border bg-suma-high/60 px-4 py-3.5"
        >
          <div className="flex items-center gap-2 text-suma-muted">
            <span className="flex size-6 items-center justify-center rounded-md bg-suma-high text-[11px] font-bold">
              {index + 1}
            </span>
            {step.icon}
          </div>
          <p className="mt-2 text-[13px] font-semibold text-suma-ink">{step.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-suma-muted">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}

function ResultsBlock({
  message,
  budgetOfferIds,
  hasPendingQuantity,
  onAddOffer,
}: {
  message: Extract<ChatMessage, { kind: 'results' }>;
  budgetOfferIds: Set<string>;
  hasPendingQuantity: boolean;
  onAddOffer: (offer: SupplierOffer) => void;
}) {
  const cheapestIds = findCheapest(message.offers);

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="brand" icon={<Sparkles className="size-3" aria-hidden />}>
          {message.offers.length}{' '}
          {message.offers.length === 1 ? 'opción encontrada' : 'opciones encontradas'}
        </Badge>
        <Badge tone="neutral">{message.request.material}</Badge>
        {message.demoMode ? <Badge tone="warning">Modo demostración</Badge> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {message.offers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            onAdd={onAddOffer}
            disabled={hasPendingQuantity}
            alreadyInBudget={budgetOfferIds.has(offer.id)}
            cheapest={cheapestIds.has(offer.id)}
          />
        ))}
      </div>

      <ExploreShops material={message.request.material} />

      {message.sources.length > 0 ? (
        <details className="mt-3 rounded-lg border border-suma-border bg-suma-canvas px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-suma-muted">
            <Globe className="mr-1 inline size-3" aria-hidden />
            Fuentes consultadas ({message.sources.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {message.sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[11px] text-suma-muted hover:underline"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/**
 * Invitación a explorar las tiendas: el usuario abre la que quiera con todas
 * sus opciones y, cuando un producto le convence, pega su enlace en el chat
 * para que el sistema lo lea y lo deje listo para el presupuesto.
 */
function ExploreShops({ material }: { material: string }) {
  return (
    <div className="mt-3 rounded-lg border border-suma-border bg-suma-canvas px-3 py-2.5">
      <p className="text-xs font-semibold text-suma-muted">
        ¿Quieres ver más opciones tú mismo? Busca «{material}» en:
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXPLORE_SHOPS.map((shop) => (
          <a
            key={shop.domain}
            href={shopSearchUrl(material, shop.domain)}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 rounded-full bg-suma-high px-2.5 py-1 text-[11px] font-semibold text-suma-ink ring-1 ring-suma-border transition-colors ring-inset hover:text-suma-red-bright hover:ring-suma-red"
          >
            {shop.name}
            <ExternalLink className="size-2.5" aria-hidden />
          </a>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-suma-faint">
        Cuando un producto te convenza, copia el enlace de su página (de cualquier tienda) y
        pégalo aquí en el chat: leeré la ficha y la dejaré lista para agregarla al presupuesto.
      </p>
    </div>
  );
}

/**
 * Identifica, dentro de cada familia de producto, la oferta con mejor precio
 * por unidad de medida.
 *
 * La comparación se hace sobre el precio normalizado (€/m², €/m, €/kg…), no
 * sobre el precio de venta: una caja de 18 € puede salir más barata por metro
 * cuadrado que un porcelánico a 15 €/m². Y sólo se comparan ofertas de la misma
 * familia y la misma magnitud, porque comparar una baldosa con una lámina
 * asfáltica no le sirve de nada a nadie.
 */
function findCheapest(offers: SupplierOffer[]): Set<string> {
  const best = new Map<string, { id: string; unitPrice: number }>();
  const counts = new Map<string, number>();

  for (const offer of offers) {
    if (offer.coverage.value <= 0) continue;

    const key = `${offer.group ?? 'general'}|${offer.coverage.unit}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);

    // Comparación en base sin IVA, para no enfrentar un PVP con una tarifa neta.
    const unitPrice = unitPriceExVat(offer) / offer.coverage.value;
    const current = best.get(key);
    if (!current || unitPrice < current.unitPrice) {
      best.set(key, { id: offer.id, unitPrice });
    }
  }

  // Con una sola opción no hay nada que comparar, así que no se etiqueta.
  return new Set(
    [...best.entries()]
      .filter(([key]) => (counts.get(key) ?? 0) > 1)
      .map(([, entry]) => entry.id),
  );
}
