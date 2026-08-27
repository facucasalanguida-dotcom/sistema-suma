'use client';

import { useEffect, useState } from 'react';
import { HardHat, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fieldControlClass } from '@/components/ui/Field';
import { SumaLogo } from '@/components/brand/SumaLogo';
import { formatCurrency } from '@/lib/format';
import { laborTotalOf } from '@/lib/pricing';
import type { LaborLine } from '@/lib/types';

/**
 * Paso intermedio entre los materiales y el presupuesto final: los gastos de
 * mano de obra. El usuario los describe como quiera («2 albañiles 5 días a
 * 120€») y Gemini los convierte en partidas con su importe.
 */

const EXAMPLES = [
  '2 albañiles 5 días a 120 € el día',
  'Alicatado del baño a 25 €/m², son 18 m²',
  'Fontanero 450 y electricista 600',
];

interface LaborDialogProps {
  open: boolean;
  onClose: () => void;
  laborLines: LaborLine[];
  onAdd: (lines: LaborLine[]) => void;
  onRemove: (id: string) => void;
  /** Continúa hacia los datos del cliente y el PDF. */
  onContinue: () => void;
  aiEnabled: boolean;
}

export function LaborDialog({
  open,
  onClose,
  laborLines,
  onAdd,
  onRemove,
  onContinue,
  aiEnabled,
}: LaborDialogProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function interpret() {
    const description = text.trim();
    if (!description || busy) return;

    setBusy(true);
    setError(null);
    setReply(null);

    try {
      const response = await fetch('/api/labor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: description }),
      });
      if (!response.ok) throw new Error('No se ha podido interpretar la mano de obra.');

      const payload = (await response.json()) as { reply: string; lines: LaborLine[] };
      setReply(payload.reply);
      if (payload.lines.length > 0) {
        onAdd(payload.lines);
        setText('');
      }
    } catch {
      setError('No se ha podido interpretar la mano de obra. Vuelve a intentarlo.');
    } finally {
      setBusy(false);
    }
  }

  const total = laborTotalOf(laborLines);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="suma-mano-obra-titulo"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="suma-scroll flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-t-2xl bg-suma-raised shadow-2xl sm:rounded-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-suma-border bg-suma-raised px-5 py-4">
          <div className="flex items-center gap-3">
            <SumaLogo size={15} />
            <div>
              <h2 id="suma-mano-obra-titulo" className="text-base font-bold text-suma-ink">
                Gastos de mano de obra
              </h2>
              <p className="text-xs text-suma-muted">
                Descríbelos con tus palabras y la IA los convierte en partidas.
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

        <div className="flex flex-col gap-4 px-5 py-4">
          <div>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void interpret();
              }}
              rows={3}
              disabled={busy}
              placeholder="Ejemplo: 2 albañiles 5 días a 120 € el día, y el fontanero 450 €"
              className={`${fieldControlClass} resize-y`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setText((current) => (current ? `${current}\n${example}` : example))}
                  className="rounded-full bg-suma-high px-2.5 py-1 text-[11px] text-suma-muted ring-1 ring-suma-border ring-inset transition-colors hover:text-suma-ink hover:ring-suma-muted"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => void interpret()}
            disabled={!text.trim()}
            loading={busy}
            icon={<Sparkles className="size-4" aria-hidden />}
          >
            {aiEnabled ? 'Interpretar con la IA' : 'Añadir partidas'}
          </Button>

          {reply ? (
            <p className="rounded-lg bg-suma-canvas px-3 py-2.5 text-xs leading-relaxed text-suma-muted">
              {reply}
            </p>
          ) : null}
          {error ? <p className="text-xs text-suma-danger">{error}</p> : null}

          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-suma-ink">
              <HardHat className="size-4 text-suma-muted" aria-hidden />
              Partidas de mano de obra
            </h3>

            {laborLines.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed border-suma-border px-3 py-3 text-center text-[11px] text-suma-muted">
                Todavía no hay mano de obra. Puedes añadirla ahora o seguir sin ella: el
                presupuesto se generará solo con los materiales.
              </p>
            ) : (
              <>
                <ul className="mt-2 divide-y divide-suma-border-soft">
                  {laborLines.map((line) => (
                    <li key={line.id} className="flex items-start gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-suma-ink">{line.description}</p>
                        {line.detail ? (
                          <p className="text-[11px] text-suma-muted">{line.detail}</p>
                        ) : null}
                      </div>
                      <span className="text-sm font-bold text-suma-ink tabular-nums">
                        {formatCurrency(line.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemove(line.id)}
                        className="rounded-md p-1 text-suma-muted hover:bg-suma-red-tint hover:text-suma-danger"
                        aria-label={`Quitar «${line.description}»`}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-baseline justify-between rounded-r-lg border-l-4 border-suma-red bg-suma-high px-3 py-2">
                  <span className="text-[11px] font-bold tracking-wide text-suma-muted uppercase">
                    Total mano de obra
                  </span>
                  <span className="text-base font-bold text-suma-ink tabular-nums">
                    {formatCurrency(total)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-col gap-2 border-t border-suma-border bg-suma-raised px-5 py-4 sm:flex-row-reverse">
          <Button
            size="lg"
            className="flex-1"
            onClick={onContinue}
            disabled={busy}
            icon={<Plus className="size-4" aria-hidden />}
          >
            Continuar al presupuesto
          </Button>
          <Button variant="ghost" size="lg" onClick={onClose} disabled={busy}>
            Volver
          </Button>
        </footer>
      </div>
    </div>
  );
}
