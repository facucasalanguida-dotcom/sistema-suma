'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut, ShieldCheck, UserRound, UserPlus } from 'lucide-react';
import { cerrarSesion } from '@/app/acceso/actions';
import { cn } from '@/lib/cn';

/**
 * Quién ha entrado y cómo salir.
 *
 * El botón de salir es un formulario que llama a una acción de servidor: así
 * la cookie de sesión se borra en el servidor, que es el único sitio donde se
 * puede borrar de verdad una cookie `httpOnly`.
 */
export function UserMenu({
  nombre,
  viaGoogle,
  esAdmin,
}: {
  nombre: string;
  viaGoogle: boolean;
  /** Sólo quien administra ve la opción de dar de alta a otras personas. */
  esAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const iniciales = nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={nombre}
        className={cn(
          'flex size-8 items-center justify-center rounded-full text-[11px] font-bold ring-1 transition-colors ring-inset',
          open
            ? 'bg-suma-red text-white ring-suma-red'
            : 'bg-suma-high text-suma-ink ring-suma-border hover:ring-suma-muted',
        )}
      >
        {iniciales || <UserRound className="size-4" aria-hidden />}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-suma-border bg-suma-raised p-1.5 shadow-2xl"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold text-suma-ink">{nombre}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-suma-muted">
              <ShieldCheck className="size-3 shrink-0 text-suma-success" aria-hidden />
              {viaGoogle ? 'Sesión iniciada con Google' : 'Sesión verificada'}
            </p>
          </div>

          <div className="my-1 h-px bg-suma-border" aria-hidden />

          {esAdmin ? (
            <a
              href="/acceso/alta"
              role="menuitem"
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-suma-muted transition-colors hover:bg-suma-high hover:text-suma-ink"
            >
              <UserPlus className="size-3.5" aria-hidden />
              Dar de alta a alguien
            </a>
          ) : null}

          <form action={cerrarSesion}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-suma-muted transition-colors hover:bg-suma-red-tint hover:text-suma-danger"
            >
              <LogOut className="size-3.5" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
