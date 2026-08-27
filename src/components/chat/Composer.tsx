'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { ImagePlus, SendHorizonal, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ImageError, imageFromClipboard, prepareImage, type PreparedImage } from '@/lib/image';
import { cn } from '@/lib/cn';

/**
 * Paso 1 del proceso: el usuario escribe el material o adjunta una fotografía.
 *
 * Admite tres formas de aportar la imagen porque en obra se usan las tres:
 * el botón de adjuntar, arrastrar el archivo sobre el chat y pegar desde el
 * portapapeles (una captura del catálogo del proveedor, por ejemplo).
 */

/** `true` cuando la ventana es estrecha, para acortar los textos de ayuda. */
function useNarrowViewport(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia('(max-width: 639px)');
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia('(max-width: 639px)').matches,
    () => false,
  );
}

interface ComposerProps {
  onSend: (text: string, image: PreparedImage | null) => void;
  busy: boolean;
  /** Texto de ayuda distinto cuando se está esperando una cantidad. */
  awaitingQuantity: boolean;
  suggestions?: string[];
}

export function Composer({ onSend, busy, awaitingQuantity, suggestions = [] }: ComposerProps) {
  // En pantallas estrechas el ejemplo largo se cortaba dentro del campo.
  const placeholder = useNarrowViewport()
    ? 'Describe el material o pega el enlace de un producto…'
    : 'Describe el material («porcelánico 60x60 para 40 m²») o pega el enlace de un producto de cualquier tienda';

  const [text, setText] = useState('');
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [dragging, setDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attach = useCallback(async (file: File) => {
    setImageError(null);
    setPreparing(true);
    try {
      setImage(await prepareImage(file));
    } catch (error) {
      setImageError(
        error instanceof ImageError ? error.message : 'No se ha podido preparar la imagen.',
      );
    } finally {
      setPreparing(false);
    }
  }, []);

  // Pegar una captura directamente en el chat.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const file = imageFromClipboard(event);
      if (file) {
        event.preventDefault();
        void attach(file);
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [attach]);

  // El área de escritura crece con el contenido, hasta un límite.
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }, [text]);

  function submit() {
    if (busy || preparing) return;
    if (!text.trim() && !image) return;
    onSend(text.trim(), image);
    setText('');
    setImage(null);
    setImageError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void attach(file);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void attach(file);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'border-t border-suma-border bg-suma-raised px-4 py-3 transition-colors sm:px-6',
        dragging && 'bg-suma-red-tint/60',
      )}
    >
      {suggestions.length > 0 && !text && !image ? (
        <div className="suma-scroll mb-3 flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-x-visible sm:pb-0">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setText(suggestion);
                textareaRef.current?.focus();
              }}
              className="shrink-0 rounded-full border border-suma-border px-3 py-1 text-xs whitespace-nowrap text-suma-muted transition-colors hover:border-suma-muted hover:bg-suma-high hover:text-suma-ink"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      {image ? (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-suma-border bg-suma-canvas p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.dataUrl}
            alt="Fotografía adjunta"
            className="size-14 rounded-md object-cover"
          />
          <div className="min-w-0 flex-1 text-xs text-suma-muted">
            <p className="font-medium text-suma-ink">Fotografía lista para analizar</p>
            <p className="tabular-nums">
              {image.width} × {image.height} px · {Math.round(image.bytes / 1024)} kB
            </p>
          </div>
          <button
            type="button"
            onClick={() => setImage(null)}
            className="rounded-md p-1.5 text-suma-muted transition-colors hover:bg-suma-raised hover:text-suma-danger"
            aria-label="Quitar la fotografía"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      {imageError ? (
        <p className="mb-2 text-xs font-medium text-suma-danger">{imageError}</p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
          onChange={handleFileChange}
          className="hidden"
        />

        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => fileInputRef.current?.click()}
          loading={preparing}
          className="size-10 px-0"
          aria-label="Adjuntar una fotografía del material"
          title="Adjuntar una fotografía del material"
        >
          {preparing ? null : <ImagePlus className="size-4" aria-hidden />}
        </Button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy}
          placeholder={
            awaitingQuantity ? 'Escribe la cantidad: «24 m2», «4 por 5 metros»…' : placeholder
          }
          className="max-h-40 min-h-10 flex-1 resize-none rounded-lg border border-suma-border bg-suma-raised px-3 py-2.5 text-sm text-suma-ink placeholder:text-suma-faint focus:border-suma-red focus:ring-2 focus:ring-suma-red/25 focus:outline-none disabled:bg-suma-high"
        />

        <Button
          type="submit"
          size="md"
          loading={busy}
          disabled={!text.trim() && !image}
          className="size-10 px-0"
          aria-label="Enviar"
          title="Enviar (Intro)"
        >
          {busy ? null : <SendHorizonal className="size-4" aria-hidden />}
        </Button>
      </form>

      <p className="mt-2 text-[11px] text-suma-muted">
        Intro envía · Mayús + Intro salta de línea
        <span className="hidden sm:inline"> · puedes arrastrar o pegar una imagen</span>
      </p>
    </div>
  );
}
