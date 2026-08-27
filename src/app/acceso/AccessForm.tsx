'use client';

import { useActionState } from 'react';
import { CircleAlert, LogIn, ShieldCheck } from 'lucide-react';
import { iniciarSesion, type FormState } from './actions';
import { Button } from '@/components/ui/Button';
import { fieldControlClass } from '@/components/ui/Field';

/**
 * Formulario de usuario y contraseña.
 *
 * Se envía a una acción de servidor con `useActionState`, así que la
 * contraseña no pasa por ningún estado de React ni por ninguna ruta de API que
 * se pueda llamar desde fuera: viaja en el envío del formulario y se comprueba
 * en el servidor.
 */
export function AccessForm({ googleDisponible }: { googleDisponible: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(iniciarSesion, {});

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-bold text-suma-ink">Acceso al sistema</h1>
        <p className="text-xs leading-relaxed text-suma-muted">
          Identifícate para entrar a los presupuestos y a la gestión de obra.
        </p>
      </header>

      <form action={action} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="usuario" className="text-xs font-semibold text-suma-muted">
            Usuario o correo
          </label>
          <input
            id="usuario"
            name="usuario"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            disabled={pending}
            className={fieldControlClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="contrasena" className="text-xs font-semibold text-suma-muted">
            Contraseña
          </label>
          <input
            id="contrasena"
            name="contrasena"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            className={fieldControlClass}
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
          icon={<LogIn className="size-4" aria-hidden />}
        >
          Entrar
        </Button>
      </form>

      {googleDisponible ? (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-suma-border" aria-hidden />
            <span className="text-[11px] font-semibold tracking-wide text-suma-faint uppercase">
              o bien
            </span>
            <span className="h-px flex-1 bg-suma-border" aria-hidden />
          </div>

          {/*
            Enlace y no botón: el flujo de Google es una navegación completa al
            servidor de Google, no una petición en segundo plano.
          */}
          <a
            href="/api/auth/google"
            className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-white text-[15px] font-semibold text-[#1f1f1f] transition-opacity hover:opacity-90"
          >
            <GoogleMark />
            Continuar con Google
          </a>
        </>
      ) : null}

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-suma-faint">
        <ShieldCheck className="mt-0.5 size-3 shrink-0" aria-hidden />
        Conexión cifrada. Tras varios intentos fallidos el acceso se bloquea un rato.
      </p>
    </div>
  );
}

/** Logotipo de Google, en su versión oficial de cuatro colores. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
