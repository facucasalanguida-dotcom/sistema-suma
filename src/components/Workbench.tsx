'use client';

import { useMemo, useState } from 'react';
import {
  ClipboardList,
  FolderKanban,
  HandCoins,
  HardHat,
  MessagesSquare,
  Receipt,
  RotateCcw,
  TriangleAlert,
  X,
} from 'lucide-react';
import { BudgetPanel } from '@/components/budget/BudgetPanel';
import { FinalizeDialog } from '@/components/budget/FinalizeDialog';
import { LaborDialog } from '@/components/budget/LaborDialog';
import { MarginDialog } from '@/components/budget/MarginDialog';
import { SaveToProjectDialog } from '@/components/budget/SaveToProjectDialog';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { Composer } from '@/components/chat/Composer';
import { CollectionsSection } from '@/components/sections/CollectionsSection';
import { PaymentsSection } from '@/components/sections/PaymentsSection';
import { ProjectsSection } from '@/components/sections/ProjectsSection';
import { SalariesSection } from '@/components/sections/SalariesSection';
import { SumaLogo } from '@/components/brand/SumaLogo';
import { UserMenu } from '@/components/auth/UserMenu';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/format';
import type { PreparedImage } from '@/lib/image';
import { computeTotals } from '@/lib/pricing';
import { useProjectsStore } from '@/lib/projects-store';
import { useBudgetStore } from '@/lib/store';
import { useHydrated } from '@/lib/use-hydrated';
import { searchScope } from '@/lib/brand';
import { cn } from '@/lib/cn';
import type { SavedBudget } from '@/lib/types';

const SUGGESTIONS = [
  'Porcelánico 60x60 antideslizante para 35 m² de terraza',
  'Cemento cola para alicatar un baño',
  'Placas de pladur y aislamiento para un tabique de 12 m²',
  'Tubo de PVC de 110 para la bajante',
];

type SectionId = 'presupuesto' | 'proyectos' | 'salarios' | 'pagos' | 'cobros';

const SECTIONS: Array<{ id: SectionId; label: string; short: string; icon: typeof ClipboardList }> = [
  { id: 'presupuesto', label: 'Presupuesto', short: 'Presup.', icon: MessagesSquare },
  { id: 'proyectos', label: 'Proyectos', short: 'Obras', icon: FolderKanban },
  { id: 'salarios', label: 'Salarios', short: 'Salarios', icon: HardHat },
  { id: 'pagos', label: 'Pagos', short: 'Pagos', icon: Receipt },
  { id: 'cobros', label: 'Cobros', short: 'Cobros', icon: HandCoins },
];

interface WorkbenchProps {
  aiEnabled: boolean;
  /** Nombre de quien ha entrado, para la cabecera. */
  usuario?: string;
  /** `true` si ha entrado con Google, para decirlo en el menú. */
  viaGoogle?: boolean;
  /** `true` si puede dar de alta a otras personas. */
  esAdmin?: boolean;
}

export function Workbench({
  aiEnabled,
  usuario,
  viaGoogle = false,
  esAdmin = false,
}: WorkbenchProps) {
  const messages = useBudgetStore((state) => state.messages);
  const lines = useBudgetStore((state) => state.lines);
  const laborLines = useBudgetStore((state) => state.laborLines);
  const status = useBudgetStore((state) => state.status);
  const pendingOffer = useBudgetStore((state) => state.pendingOffer);
  const client = useBudgetStore((state) => state.client);
  const marginPct = useBudgetStore((state) => state.marginPct);
  const discountPct = useBudgetStore((state) => state.discountPct);
  const vatPct = useBudgetStore((state) => state.vatPct);
  const notes = useBudgetStore((state) => state.notes);

  const sendMessage = useBudgetStore((state) => state.sendMessage);
  const requestQuantity = useBudgetStore((state) => state.requestQuantity);
  const cancelQuantity = useBudgetStore((state) => state.cancelQuantity);
  const submitQuantity = useBudgetStore((state) => state.submitQuantity);
  const removeLine = useBudgetStore((state) => state.removeLine);
  const addLaborLines = useBudgetStore((state) => state.addLaborLines);
  const removeLaborLine = useBudgetStore((state) => state.removeLaborLine);
  const clearBudget = useBudgetStore((state) => state.clearBudget);
  const resetConversation = useBudgetStore((state) => state.resetConversation);
  const setClient = useBudgetStore((state) => state.setClient);
  const setMarginPct = useBudgetStore((state) => state.setMarginPct);
  const setDiscountPct = useBudgetStore((state) => state.setDiscountPct);
  const setVatPct = useBudgetStore((state) => state.setVatPct);
  const setNotes = useBudgetStore((state) => state.setNotes);
  const downloadPdf = useBudgetStore((state) => state.downloadPdf);

  const saveBudgetToProject = useProjectsStore((state) => state.saveBudgetToProject);

  const [section, setSection] = useState<SectionId>('presupuesto');
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [laborOpen, setLaborOpen] = useState(false);
  const [marginOpen, setMarginOpen] = useState(false);
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);
  const [savedReference, setSavedReference] = useState<string | null>(null);

  // El presupuesto vive en `localStorage`: hasta que el navegador no toma el
  // control se pinta vacío, que es exactamente lo que devolvió el servidor.
  const hydrated = useHydrated();
  const visibleLines = useMemo(() => (hydrated ? lines : []), [hydrated, lines]);
  const visibleLabor = useMemo(() => (hydrated ? laborLines : []), [hydrated, laborLines]);

  const totals = useMemo(
    () => computeTotals(visibleLines, { discountPct, vatPct, laborLines: visibleLabor, marginPct }),
    [visibleLines, discountPct, vatPct, visibleLabor, marginPct],
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
    const reference = await downloadPdf();
    if (reference) {
      setFinalizeOpen(false);
      setSavedReference(reference);
    }
  }

  /** Archiva el presupuesto recién generado dentro de un proyecto. */
  function handleSaveToProject(projectId: string) {
    if (!savedReference) return;

    const snapshot: SavedBudget = {
      id: `${savedReference}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      reference: savedReference,
      savedAt: new Date().toISOString(),
      clientName: client.name,
      lines: visibleLines,
      laborLines: visibleLabor,
      marginPct,
      discountPct,
      vatPct,
      notes,
      totals,
    };

    saveBudgetToProject(projectId, snapshot);
    setSavedReference(null);
    setSection('proyectos');
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="z-20 flex shrink-0 items-center justify-between gap-3 border-b border-suma-border bg-suma-raised px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <SumaLogo size={32} />
          <div className="hidden min-w-0 border-l border-suma-border pl-3 sm:block">
            <p className="truncate text-sm font-semibold text-suma-ink">
              Presupuestos y gestión de obra
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

          {section === 'presupuesto' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetConversation}
              icon={<RotateCcw className="size-3.5" aria-hidden />}
              title="Empezar una conversación nueva sin borrar el presupuesto"
            >
              <span className="hidden sm:inline">Nueva consulta</span>
            </Button>
          ) : null}

          {usuario ? (
            <UserMenu nombre={usuario} viaGoogle={viaGoogle} esAdmin={esAdmin} />
          ) : null}
        </div>
      </header>

      <nav
        className="suma-scroll z-10 flex shrink-0 gap-1 overflow-x-auto border-b border-suma-border bg-suma-canvas px-2 py-1.5 sm:px-4"
        aria-label="Secciones"
      >
        {SECTIONS.map((entry) => {
          const Icon = entry.icon;
          const active = section === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSection(entry.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors',
                active
                  ? 'bg-suma-red text-white'
                  : 'text-suma-muted hover:bg-suma-high hover:text-suma-ink',
              )}
            >
              <Icon className="size-4" aria-hidden />
              <span className="hidden sm:inline">{entry.label}</span>
              <span className="sm:hidden">{entry.short}</span>
            </button>
          );
        })}
      </nav>

      {!aiEnabled && section === 'presupuesto' ? (
        <div className="shrink-0 border-b border-suma-warning/30 bg-suma-warning/10 px-4 py-2 text-center text-xs text-suma-warning sm:px-6">
          Sin clave de Gemini: precios orientativos de un catálogo local.
          <span className="hidden sm:inline">
            {' '}
            Añade <code className="font-mono">GEMINI_API_KEY</code> a{' '}
            <code className="font-mono">.env.local</code> para buscar tarifas reales en Internet.
          </span>
        </div>
      ) : null}

      {section === 'presupuesto' ? (
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
              laborLines={visibleLabor}
              totals={totals}
              onRemove={removeLine}
              onRemoveLabor={removeLaborLine}
              onClear={clearBudget}
              onLabor={() => setLaborOpen(true)}
              onMargin={() => setMarginOpen(true)}
              onFinalize={() => setMarginOpen(true)}
              busy={status === 'generando-pdf'}
            />
          ) : (
            <div
              className="hidden w-96 shrink-0 border-l border-suma-border bg-suma-raised lg:block"
              aria-hidden
            />
          )}
        </div>
      ) : null}

      {section === 'proyectos' ? <ProjectsSection /> : null}
      {section === 'salarios' ? <SalariesSection /> : null}
      {section === 'pagos' ? <PaymentsSection /> : null}
      {section === 'cobros' ? <CollectionsSection /> : null}

      {/* En móvil el presupuesto vive en una hoja que sube desde abajo. */}
      {section === 'presupuesto' && (visibleLines.length > 0 || visibleLabor.length > 0) ? (
        <button
          type="button"
          onClick={() => setBudgetSheetOpen(true)}
          className="flex shrink-0 items-center justify-between gap-3 border-t-2 border-suma-red bg-suma-surface px-4 py-3 text-suma-ink lg:hidden"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardList className="size-4" aria-hidden />
            {visibleLines.length} {visibleLines.length === 1 ? 'partida' : 'partidas'}
            {visibleLabor.length > 0 ? ' + mano de obra' : ''}
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
              laborLines={visibleLabor}
              totals={totals}
              onRemove={removeLine}
              onRemoveLabor={removeLaborLine}
              onClear={clearBudget}
              onLabor={() => {
                setBudgetSheetOpen(false);
                setLaborOpen(true);
              }}
              onMargin={() => {
                setBudgetSheetOpen(false);
                setMarginOpen(true);
              }}
              onFinalize={() => {
                setBudgetSheetOpen(false);
                setMarginOpen(true);
              }}
              busy={status === 'generando-pdf'}
            />
          </div>
        </div>
      ) : null}

      <LaborDialog
        open={laborOpen}
        onClose={() => setLaborOpen(false)}
        laborLines={visibleLabor}
        onAdd={addLaborLines}
        onRemove={removeLaborLine}
        onContinue={() => {
          setLaborOpen(false);
          setMarginOpen(true);
        }}
        aiEnabled={aiEnabled}
      />

      <MarginDialog
        /*
         * Se vuelve a montar cada vez que se abre, para que el campo muestre
         * el margen vigente aunque se haya cambiado desde la pantalla final.
         */
        key={marginOpen ? 'margen-abierto' : 'margen-cerrado'}
        open={marginOpen}
        onClose={() => setMarginOpen(false)}
        marginPct={marginPct}
        onMarginChange={setMarginPct}
        totals={totals}
        onContinue={() => {
          setMarginOpen(false);
          setFinalizeOpen(true);
        }}
      />

      <FinalizeDialog
        open={finalizeOpen}
        onClose={() => setFinalizeOpen(false)}
        client={client}
        onClientChange={setClient}
        marginPct={marginPct}
        onMarginChange={setMarginPct}
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

      <SaveToProjectDialog
        key={savedReference ?? 'cerrado'}
        open={savedReference !== null}
        onClose={() => setSavedReference(null)}
        reference={savedReference ?? ''}
        totals={totals}
        onSave={handleSaveToProject}
      />
    </div>
  );
}
