import { redirect } from 'next/navigation';
import { AccessForm } from './AccessForm';
import { getSession } from '@/lib/auth/dal';
import { authIsConfigured } from '@/lib/auth/session';
import { googleIsConfigured } from '@/lib/auth/users';

export const dynamic = 'force-dynamic';

const ERRORES: Record<string, string> = {
  'google-no-configurado':
    'El acceso con Google todavía no está configurado. Entra con tu usuario y contraseña.',
  'google-cancelado': 'Has cancelado el acceso con Google.',
  'google-fallido': 'No se ha podido completar el acceso con Google. Vuelve a intentarlo.',
  'no-autorizado':
    'Esa cuenta de Google no tiene acceso a este sistema. Pide que añadan tu correo.',
  'demasiados-intentos': 'Demasiados intentos. Espera un momento y vuelve a probar.',
  'sesion-caducada': 'Tu sesión ha caducado. Vuelve a entrar.',
};

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Sin sistema de acceso configurado no hay nada que pedir: la aplicación
  // funciona en abierto (desarrollo local y pruebas automáticas).
  if (!authIsConfigured()) redirect('/');

  // Quien ya tiene sesión no debería ver esta pantalla.
  if (await getSession()) redirect('/');

  const { error } = await searchParams;
  const mensaje = error ? ERRORES[error] : undefined;

  return (
    <>
      {mensaje ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-suma-warning/30 bg-suma-warning/10 px-3 py-2 text-xs text-suma-warning"
        >
          {mensaje}
        </p>
      ) : null}
      <AccessForm googleDisponible={googleIsConfigured()} />
    </>
  );
}
