'use client';

import { useMemo, useState } from 'react';
import { ClipboardList, RotateCcw, TriangleAlert, X } from 'lucide-react';
import { BudgetPanel } from '@/components/budget/BudgetPanel';
import { FinalizeDialog } from '@/components/budget/FinalizeDialog';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { Composer } from '@/components/chat/Composer';
import { SumaLogo } from '@/components/brand/SumaLogo';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/format';
import type { PreparedImage } from '@/lib/image';
import { computeTotals } from '@/lib/pricing';
import { useBudgetStore } from '@/lib/store';
import { useHydrated } from '@/lib/use-hydrated';
import { searchScope } from '@/lib/brand';
import { cn } from '@/lib/cn';

const SUGGESTIONS = [
  'Porcelánico 60x60 antideslizante para 35 m² de terraza',
  'Cemento cola para alicatar un baño',
  'Placas de pladur y aislamiento para un tabique de 12 m²',
  'Tubo de PVC de 110 para la bajante',
];

export function Workbench({ aiEnabled }: { aiEnabled: boolean }) {
  const messages = useBudgetStore((state) => state.messages);
  const lines = useBudgetStore((state) => state.lines);
  const status = useBudgetStore((state) => state.status);
  const pendingOffer = useBudgetStore((state) => state.pendingOffer);
  const client = useBudgetStore((state) => state.client);
  const discountPct = useBudgetStore((state) => state.discountPct);
  const vatPct = useBudgetStore((state) => state.vatPct);
  const notes = useBudgetStore((state) => state.notes);

  const sendMessage = useBudgetStore((state) => state.sendMessage);
  const requestQuantity = useBudgetStore((state) => state.requestQuantity);
  const cancelQuantity = useBudgetStore((state) => state.cancelQuantity);
  const submitQuantity = useBudgetStore((state) => state.submitQuantity);
  const removeLine = useBudgetStore((state) => state.removeLine);
  const clearBudget = useBudgetStore((state) => state.clearBudget);
  const resetConversation = useBudgetStore((state) => state.resetConversation);
  const setClient = useBudgetStore((state) => state.setClient);
  const setDiscountPct = useBudgetStore((state) => state.setDiscountPct);
  const setVatPct = useBudgetStore((state) => state.setVatPct);
  const setNotes = useBudgetStore((state) => state.setNotes);
  const downloadPdf = useBudgetStore((state) => state.downloadPdf);

  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);

  // El presupuesto vive en `localStorage`: hasta que el navegador no toma el
  // control se pinta vacío, que es exactamente lo que devolvió el servidor.
  const hydrated = useHydrated();
  const visibleLines = useMemo(() => (hydrated ? lines : []), [hydrated, lines]);

  const totals = useMemo(
    () => computeTotals(visibleLines, { discountPct, vatPct }),
    [visibleLines, discountPct, vatPct],
  );

  const budgetOfferIds = useMemo(
    () => new Set(visibleLines.map((line) => line.offer.id)),
    [visibleLines],
  );

  const busy = status !== 'idle';

  function handleSend(text: string, image: PreparedImage | null) {
    void sendMessage(
      text,
      image ? { mimeType: image.mimeType, data: image.data, dataUrl: image.dataUrl } : undefined,
    );
  }

  async function handleGenerate() {
    await downloadPdf();
    if (useBudgetStore.getState().status === 'idle') setFinalizeOpen(false);
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="z-20 flex shrink-0 items-center justify-between gap-3 border-b border-suma-border bg-suma-raised px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <SumaLogo size={32} />
          <div className="hidden min-w-0 border-l border-suma-border pl-3 sm:block">
            <p className="truncate text-sm font-semibold text-suma-ink">
              Presupuestos de construcción
            </p>
            <p className="truncate text-xs text-suma-muted">
              Proveedores de {searchScope.province} comparados con inteligencia artificial
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!aiEnabled ? (
            <Badge tone="warning" icon={<TriangleAlert className="size-3" aria-hidden />}>
              <span className="hidden sm:inline">Modo demostración</span>
              <span className="sm:hidden">Demo</span>
            </Badge>
          ) : null}

          <Button
            variant="ghost"
            size="sm"
            onClick={resetConversation}
            icon={<RotateCcw className="size-3.5" aria-hidden />}
            title="Empezar una conversación nueva sin borrar el presupuesto"
          >
            <span className="hidden sm:inline">Nueva consulta</span>
          </Button>
        </div>
      </header>

      {!aiEnabled ? (
        <div className="shrink-0 border-b border-suma-warning/30 bg-suma-warning/10 px-4 py-2 text-center text-xs text-suma-warning sm:px-6">
          Sin clave de Gemini: precios orientativos de un catálogo local.
          <span className="hidden sm:inline">
            {' '}
            Añade <code className="font-mono">GEMINI_API_KEY</code> a{' '}
            <code className="font-mono">.env.local</code> para buscar tarifas reales en Internet.
          </span>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {hydrated ? (
            <>
              <ChatPanel
                messages={messages}
                status={status}
                budgetOfferIds={budgetOfferIds}
                hasPendingQuantity={pendingOffer !== null}
                onAddOffer={requestQuantity}
                onSubmitQuantity={(phrase, waste) => void submitQuantity(phrase, waste)}
                onCancelQuantity={cancelQuantity}
              />
              <Composer
                onSend={handleSend}
                busy={busy}
                awaitingQuantity={pendingOffer !== null}
                suggestions={messages.length <= 1 ? SUGGESTIONS : []}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-suma-muted">Cargando el presupuesto guardado…</p>
            </div>
          )}
        </main>

        {/* Panel lateral fijo en escritorio. */}
        {hydrated ? (
          <BudgetPanel
            className="hidden w-96 shrink-0 border-l lg:flex"
            lines={visibleLines}
            totals={totals}
            onRemove={removeLine}
            onClear={clearBudget}
            onFinalize={() => setFinalizeOpen(true)}
            busy={status === 'generando-pdf'}
          />
        ) : (
          <div
            className="hidden w-96 shrink-0 border-l border-suma-border bg-suma-raised lg:block"
            aria-hidden
          />
        )}
      </div>

      {/* En móvil el presupuesto vive en una hoja que sube desde abajo. */}
      {visibleLines.length > 0 ? (
        <button
          type="button"
          onClick={() => setBudgetSheetOpen(true)}
          className="flex shrink-0 items-center justify-between gap-3 border-t-2 border-suma-red bg-suma-surface px-4 py-3 text-suma-ink lg:hidden"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardList className="size-4" aria-hidden />
            {visibleLines.length} {visibleLines.length === 1 ? 'partida' : 'partidas'}
          </span>
          <span className="text-base font-bold tabular-nums">{formatCurrency(totals.total)}</span>
        </button>
      ) : null}

      {budgetSheetOpen ? (
        <div
          className="fixed inset-0 z-40 flex flex-col justify-end bg-black/70 backdrop-blur-sm lg:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setBudgetSheetOpen(false);
          }}
        >
          <div className="relative flex max-h-[85dvh] flex-col rounded-t-2xl bg-suma-raised">
            <button
              type="button"
              onClick={() => setBudgetSheetOpen(false)}
              className="absolute top-3 right-3 z-10 rounded-md p-1.5 text-suma-muted hover:bg-suma-canvas"
              aria-label="Cerrar el presupuesto"
            >
              <X className="size-4" aria-hidden />
            </button>
            <BudgetPanel
              className={cn('min-h-0 rounded-t-2xl')}
              lines={visibleLines}
              totals={totals}
              onRemove={removeLine}
              onClear={clearBudget}
              onFinalize={() => {
                setBudgetSheetOpen(false);
                setFinalizeOpen(true);
              }}
              busy={status === 'generando-pdf'}
            />
          </div>
        </div>
      ) : null}

      <FinalizeDialog
        open={finalizeOpen}
        onClose={() => setFinalizeOpen(false)}
        client={client}
        onClientChange={setClient}
        discountPct={discountPct}
        onDiscountChange={setDiscountPct}
        vatPct={vatPct}
        onVatChange={setVatPct}
        notes={notes}
        onNotesChange={setNotes}
        totals={totals}
        lineCount={visibleLines.length}
        busy={status === 'generando-pdf'}
        onGenerate={() => void handleGenerate()}
      />
    </div>
  );
}
