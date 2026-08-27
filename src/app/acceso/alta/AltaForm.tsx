'use client';

import { useActionState, useState } from 'react';
import { CircleAlert, Copy, KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import { crearUsuario, type AltaState } from './actions';
import { Button } from '@/components/ui/Button';
import { fieldControlClass } from '@/components/ui/Field';

/**
 * Alta de una cuenta. Al terminar no redirige: enseña el código QR, los
 * códigos de recuperación y el texto que hay que pegar en el entorno, porque
 * son datos que sólo se muestran UNA vez.
 */
export function AltaForm({ conSesion, hayUsuarios }: { conSesion: boolean; hayUsuarios: boolean }) {
  const [state, action, pending] = useActionState<AltaState, FormData>(crearUsuario, {});

  if (state.resultado) return <Resultado resultado={state.resultado} />;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-bold text-suma-ink">
          {hayUsuarios ? 'Dar de alta a alguien' : 'Crear la primera cuenta'}
        </h1>
        <p className="text-xs leading-relaxed text-suma-muted">
          {hayUsuarios
            ? 'Se generará su contraseña, su segundo factor y sus códigos de recuperación.'
            : 'Esta será la cuenta de administración del sistema.'}
        </p>
      </header>

      <form action={action} className="flex flex-col gap-3">
        {!conSesion ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="instalacion" className="text-xs font-semibold text-suma-muted">
              Contraseña de instalación
            </label>
            <input
              id="instalacion"
              name="instalacion"
              type="password"
              required
              disabled={pending}
              className={fieldControlClass}
            />
            <p className="text-[11px] text-suma-faint">
              Es la contraseña compartida que hay hoy en el sistema.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <label htmlFor="nombre" className="text-xs font-semibold text-suma-muted">
            Nombre y apellidos
          </label>
          <input id="nombre" name="nombre" required disabled={pending} className={fieldControlClass} />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="usuario" className="text-xs font-semibold text-suma-muted">
            Usuario
          </label>
          <input
            id="usuario"
            name="usuario"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="facu"
            disabled={pending}
            className={fieldControlClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="correo" className="text-xs font-semibold text-suma-muted">
            Correo (opcional)
          </label>
          <input
            id="correo"
            name="correo"
            type="email"
            autoCapitalize="none"
            placeholder="nombre@gruposuma.eu"
            disabled={pending}
            className={fieldControlClass}
          />
          <p className="text-[11px] text-suma-faint">
            Si lo pones, esta persona también podrá entrar con Google.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="contrasena" className="text-xs font-semibold text-suma-muted">
            Contraseña
          </label>
          <input
            id="contrasena"
            name="contrasena"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            disabled={pending}
            className={fieldControlClass}
          />
          <p className="text-[11px] text-suma-faint">
            Mínimo 12 caracteres. Una frase que recuerdes es mejor que algo corto y raro.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="repetir" className="text-xs font-semibold text-suma-muted">
            Repite la contraseña
          </label>
          <input
            id="repetir"
            name="repetir"
            type="password"
            required
            autoComplete="new-password"
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
          icon={<UserPlus className="size-4" aria-hidden />}
        >
          Crear cuenta
        </Button>
      </form>
    </div>
  );
}

function Resultado({ resultado }: { resultado: NonNullable<AltaState['resultado']> }) {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-bold text-suma-success">
          <ShieldCheck className="size-5" aria-hidden />
          Cuenta preparada
        </h1>
        <p className="text-xs leading-relaxed text-suma-muted">
          {resultado.nombre} · usuario <strong className="text-suma-ink">{resultado.usuario}</strong>
        </p>
      </header>

      <ol className="flex flex-col gap-5">
        <Paso
          numero={1}
          titulo="Escanea este código con tu aplicación de autenticación"
          detalle="Google Authenticator, Authy, 1Password… cualquiera vale."
        >
          <div
            className="mx-auto w-44 rounded-xl bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
            // El SVG lo genera el servidor a partir del secreto; no hay
            // ninguna entrada del usuario dentro de él.
            dangerouslySetInnerHTML={{ __html: resultado.qrSvg }}
          />
          <p className="mt-2 text-center text-[11px] text-suma-faint">
            ¿No puedes escanear? Introduce la clave a mano:
            <br />
            <code className="font-mono text-suma-muted">{resultado.secreto}</code>
          </p>
        </Paso>

        <Paso
          numero={2}
          titulo="Guarda los códigos de recuperación"
          detalle="Sirven para entrar si pierdes el teléfono. Cada uno vale una sola vez."
        >
          <ul className="grid grid-cols-2 gap-1.5 rounded-lg bg-suma-canvas p-3">
            {resultado.codigosRecuperacion.map((codigo) => (
              <li key={codigo} className="font-mono text-[11px] text-suma-ink">
                {codigo}
              </li>
            ))}
          </ul>
        </Paso>

        <Paso
          numero={3}
          titulo="Pega esto en Vercel"
          detalle={
            resultado.primera
              ? 'Crea la variable SUMA_USUARIOS con este valor y vuelve a desplegar.'
              : 'Sustituye el valor de SUMA_USUARIOS por este y vuelve a desplegar.'
          }
        >
          <CopiaVariable valor={resultado.variable} />
        </Paso>
      </ol>

      <p className="rounded-lg border border-suma-warning/30 bg-suma-warning/10 px-3 py-2.5 text-[11px] leading-relaxed text-suma-warning">
        Esta pantalla no se puede volver a ver. Escanea el código y guarda los códigos de
        recuperación <strong>antes</strong> de cerrarla.
      </p>

      <a href="/acceso" className="text-center text-xs text-suma-muted hover:text-suma-ink">
        Ir al acceso
      </a>
    </div>
  );
}

function Paso({
  numero,
  titulo,
  detalle,
  children,
}: {
  numero: number;
  titulo: string;
  detalle: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded bg-suma-red text-[11px] font-bold text-white">
          {numero}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-suma-ink">{titulo}</p>
          <p className="text-[11px] leading-relaxed text-suma-muted">{detalle}</p>
        </div>
      </div>
      {children}
    </li>
  );
}

/** El valor es largo: se muestra recortado con un botón para copiarlo entero. */
function CopiaVariable({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <code className="block max-h-24 overflow-y-auto rounded-lg bg-suma-canvas p-2.5 font-mono text-[10px] leading-relaxed break-all text-suma-muted">
        {valor}
      </code>
      <Button
        type="button"
        variant="neutral"
        size="sm"
        icon={<Copy className="size-3.5" aria-hidden />}
        onClick={() => {
          void navigator.clipboard.writeText(valor).then(() => {
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2500);
          });
        }}
      >
        {copiado ? '¡Copiado!' : 'Copiar el valor de SUMA_USUARIOS'}
      </Button>
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-suma-faint">
        <KeyRound className="mt-0.5 size-3 shrink-0" aria-hidden />
        En Vercel: Settings → Environment Variables → SUMA_USUARIOS. Después, Redeploy.
      </p>
    </div>
  );
}
