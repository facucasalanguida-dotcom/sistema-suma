'use client';

import { useActionState } from 'react';
import { CircleAlert, ShieldCheck } from 'lucide-react';
import { verificarCodigo, type FormState } from '../actions';
import { Button } from '@/components/ui/Button';
import { fieldControlClass } from '@/components/ui/Field';
import { cn } from '@/lib/cn';

/**
 * Segundo factor: el código de seis dígitos de la aplicación del teléfono.
 *
 * El campo admite también un código de recuperación, para quien haya perdido
 * el móvil; por eso no se limita la longitud a seis caracteres.
 */
export function CodeForm({ nombre }: { nombre: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(verificarCodigo, {});

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-bold text-suma-ink">Confirma que eres tú</h1>
        <p className="text-xs leading-relaxed text-suma-muted">
          Hola, {nombre}. Escribe el código de seis dígitos que muestra tu aplicación de
          autenticación.
        </p>
      </header>

      <form action={action} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="codigo" className="text-xs font-semibold text-suma-muted">
            Código de verificación
          </label>
          <input
            id="codigo"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            placeholder="000000"
            disabled={pending}
            className={cn(
              fieldControlClass,
              'text-center text-2xl font-bold tracking-[0.3em] tabular-nums',
            )}
          />
        </div>

        {state.error ? (
          <p
            role="alert"
            className="flex items-start gap-1.5 rounded-lg border border-suma-danger/35 bg-suma-red-tint px-3 py-2 text-xs text-suma-danger"
          >
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {state.error}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="mt-1 w-full"
          loading={pending}
          icon={<ShieldCheck className="size-4" aria-hidden />}
        >
          Verificar
        </Button>
      </form>

      <p className="text-[11px] leading-relaxed text-suma-faint">
        ¿Has perdido el teléfono? Escribe aquí uno de tus códigos de recuperación.
      </p>

      <a href="/acceso" className="text-center text-xs text-suma-muted hover:text-suma-ink">
        Volver al acceso
      </a>
    </div>
  );
}
