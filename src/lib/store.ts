'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_VAT_PCT } from './pricing';
import type {
  BudgetLine,
  ChatMessage,
  ChatResponsePayload,
  ClientDetails,
  QuantityResponsePayload,
  SupplierOffer,
} from './types';

/** Fase del asistente, para que la interfaz cuente qué está pasando. */
export type AssistantStatus =
  | 'idle'
  | 'interpretando'
  | 'buscando'
  | 'calculando'
  | 'generando-pdf';

interface BudgetState {
  messages: ChatMessage[];
  lines: BudgetLine[];
  /** Oferta a la espera de que el usuario indique la cantidad (paso 5). */
  pendingOffer: SupplierOffer | null;
  pendingMessageId: string | null;
  client: ClientDetails;
  discountPct: number;
  vatPct: number;
  notes: string;
  status: AssistantStatus;
  hasHydrated: boolean;

  sendMessage: (text: string, image?: { mimeType: string; data: string; dataUrl: string }) => Promise<void>;
  requestQuantity: (offer: SupplierOffer) => void;
  cancelQuantity: () => void;
  submitQuantity: (phrase: string, wastePct?: number | null) => Promise<void>;
  removeLine: (id: string) => void;
  updateLineNote: (id: string, note: string) => void;
  clearBudget: () => void;
  resetConversation: () => void;
  setClient: (client: Partial<ClientDetails>) => void;
  setDiscountPct: (value: number) => void;
  setVatPct: (value: number) => void;
  setNotes: (value: string) => void;
  downloadPdf: () => Promise<void>;
  setHasHydrated: (value: boolean) => void;
}

const EMPTY_CLIENT: ClientDetails = {
  name: '',
  taxId: '',
  address: '',
  contact: '',
  email: '',
  projectName: '',
  siteAddress: '',
};

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  kind: 'text',
  text:
    'Hola. Dime qué material necesitas y busco proveedores en la provincia de Málaga comparando precios. ' +
    'Puedes escribirlo («porcelánico 60x60 para 40 m² de salón») o subir una foto del material.',
  at: new Date(0).toISOString(),
};

function id(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function now(): string {
  return new Date().toISOString();
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return typeof body?.error === 'string' ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set, get) => ({
      messages: [WELCOME],
      lines: [],
      pendingOffer: null,
      pendingMessageId: null,
      client: EMPTY_CLIENT,
      discountPct: 0,
      vatPct: DEFAULT_VAT_PCT,
      notes: '',
      status: 'idle',
      hasHydrated: false,

      /* Pasos 1-3: mensaje del usuario -> material -> ofertas. */
      async sendMessage(text, image) {
        const trimmed = text.trim();
        if (!trimmed && !image) return;
        if (get().status !== 'idle') return;

        const userMessage: ChatMessage = {
          id: id(),
          role: 'user',
          kind: 'text',
          text: trimmed || 'Identifica el material de esta fotografía.',
          imageDataUrl: image?.dataUrl,
          at: now(),
        };

        const history = get()
          .messages.filter((message) => message.kind === 'text' || message.kind === 'results')
          .slice(-6)
          .map((message) => ({ role: message.role, text: message.text }));

        set((state) => ({
          messages: [...state.messages, userMessage],
          status: 'interpretando',
          pendingOffer: null,
          pendingMessageId: null,
        }));

        try {
          set({ status: 'buscando' });

          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: trimmed,
              image: image ? { mimeType: image.mimeType, data: image.data } : null,
              history,
            }),
          });

          if (!response.ok) {
            throw new Error(await readError(response, 'No se ha podido completar la búsqueda.'));
          }

          const payload: ChatResponsePayload = await response.json();

          const assistantMessage: ChatMessage =
            payload.offers.length > 0
              ? {
                  id: id(),
                  role: 'assistant',
                  kind: 'results',
                  text: payload.reply,
                  request: payload.request!,
                  offers: payload.offers,
                  sources: payload.sources,
                  demoMode: payload.demoMode,
                  at: now(),
                }
              : { id: id(), role: 'assistant', kind: 'text', text: payload.reply, at: now() };

          set((state) => ({ messages: [...state.messages, assistantMessage], status: 'idle' }));
        } catch (error) {
          set((state) => ({
            messages: [
              ...state.messages,
              {
                id: id(),
                role: 'assistant',
                kind: 'error',
                text: error instanceof Error ? error.message : 'Ha ocurrido un error inesperado.',
                at: now(),
              },
            ],
            status: 'idle',
          }));
        }
      },

      /* Paso 5: se pide la cantidad antes de añadir la partida. */
      requestQuantity(offer) {
        const messageId = id();
        set((state) => ({
          pendingOffer: offer,
          pendingMessageId: messageId,
          messages: [
            ...state.messages,
            {
              id: messageId,
              role: 'assistant',
              kind: 'quantity-request',
              text: `¿Cuánta cantidad de «${offer.productName}» vas a utilizar?`,
              offer,
              resolved: false,
              at: now(),
            },
          ],
        }));
      },

      cancelQuantity() {
        const { pendingMessageId } = get();
        set((state) => ({
          pendingOffer: null,
          pendingMessageId: null,
          messages: state.messages.filter((message) => message.id !== pendingMessageId),
        }));
      },

      /* Paso 6: se calcula el importe y se añade la partida al presupuesto. */
      async submitQuantity(phrase, wastePct = null) {
        const { pendingOffer, pendingMessageId } = get();
        if (!pendingOffer || get().status !== 'idle') return;

        set({ status: 'calculando' });

        try {
          const response = await fetch('/api/quantity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ offer: pendingOffer, phrase, wastePct }),
          });

          const payload: QuantityResponsePayload & { error?: string } = await response.json();

          if (!response.ok || !payload.breakdown) {
            const question =
              payload.clarification ??
              payload.error ??
              'No he entendido la cantidad. ¿Puedes indicármela con su unidad?';

            set((state) => ({
              status: 'idle',
              messages: [
                ...state.messages,
                { id: id(), role: 'assistant', kind: 'text', text: question, at: now() },
              ],
            }));
            return;
          }

          const line: BudgetLine = {
            id: id(),
            offer: pendingOffer,
            breakdown: payload.breakdown,
            addedAt: now(),
          };

          set((state) => ({
            status: 'idle',
            lines: [...state.lines, line],
            pendingOffer: null,
            pendingMessageId: null,
            messages: [
              ...state.messages.map((message) =>
                message.id === pendingMessageId && message.kind === 'quantity-request'
                  ? { ...message, resolved: true }
                  : message,
              ),
              {
                id: id(),
                role: 'assistant',
                kind: 'line-added',
                text: payload.reply,
                line,
                at: now(),
              },
            ],
          }));
        } catch (error) {
          set((state) => ({
            status: 'idle',
            messages: [
              ...state.messages,
              {
                id: id(),
                role: 'assistant',
                kind: 'error',
                text:
                  error instanceof Error
                    ? error.message
                    : 'No se ha podido calcular la cantidad.',
                at: now(),
              },
            ],
          }));
        }
      },

      removeLine(lineId) {
        set((state) => ({ lines: state.lines.filter((line) => line.id !== lineId) }));
      },

      updateLineNote(lineId, note) {
        set((state) => ({
          lines: state.lines.map((line) => (line.id === lineId ? { ...line, note } : line)),
        }));
      },

      clearBudget() {
        set({ lines: [] });
      },

      resetConversation() {
        set({
          messages: [WELCOME],
          pendingOffer: null,
          pendingMessageId: null,
          status: 'idle',
        });
      },

      setClient(client) {
        set((state) => ({ client: { ...state.client, ...client } }));
      },

      setDiscountPct(value) {
        set({ discountPct: Math.min(Math.max(value, 0), 100) });
      },

      setVatPct(value) {
        set({ vatPct: Math.min(Math.max(value, 0), 100) });
      },

      setNotes(value) {
        set({ notes: value });
      },

      setHasHydrated(value) {
        set({ hasHydrated: value });
      },

      /* Paso 7: se genera y descarga el PDF. */
      async downloadPdf() {
        const state = get();
        if (state.lines.length === 0 || state.status !== 'idle') return;

        set({ status: 'generando-pdf' });

        try {
          const response = await fetch('/api/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lines: state.lines,
              client: state.client,
              discountPct: state.discountPct,
              vatPct: state.vatPct,
              notes: state.notes,
            }),
          });

          if (!response.ok) {
            throw new Error(await readError(response, 'No se ha podido generar el PDF.'));
          }

          const blob = await response.blob();
          const disposition = response.headers.get('Content-Disposition') ?? '';
          const match = disposition.match(/filename="([^"]+)"/);
          const fileName = match?.[1] ?? 'Presupuesto-SUMA.pdf';

          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = fileName;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);

          set((current) => ({
            status: 'idle',
            messages: [
              ...current.messages,
              {
                id: id(),
                role: 'assistant',
                kind: 'text',
                text: `Presupuesto generado: ${fileName}. Se ha descargado en tu equipo con los colores y el logotipo de SUMA.`,
                at: now(),
              },
            ],
          }));
        } catch (error) {
          set((current) => ({
            status: 'idle',
            messages: [
              ...current.messages,
              {
                id: id(),
                role: 'assistant',
                kind: 'error',
                text: error instanceof Error ? error.message : 'No se ha podido generar el PDF.',
                at: now(),
              },
            ],
          }));
        }
      },
    }),
    {
      name: 'suma-presupuesto',
      version: 1,
      /**
       * No se guardan las fotografías en el almacenamiento local: una sola
       * imagen puede llenar la cuota de 5 MB y dejar el presupuesto sin
       * guardar, que es lo que de verdad importa conservar.
       */
      partialize: (state) => ({
        messages: state.messages.map((message) =>
          message.role === 'user' && message.imageDataUrl
            ? { ...message, imageDataUrl: undefined }
            : message,
        ),
        lines: state.lines,
        client: state.client,
        discountPct: state.discountPct,
        vatPct: state.vatPct,
        notes: state.notes,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
