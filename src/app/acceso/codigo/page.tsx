import { redirect } from 'next/navigation';
import { CodeForm } from './CodeForm';
import { getSession } from '@/lib/auth/dal';
import { authIsConfigured, readPendingSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Segundo paso del acceso. Sólo se llega aquí con una sesión «a medias», la
 * que se emite cuando la contraseña es correcta pero falta el código.
 */
export default async function CodePage() {
  if (!authIsConfigured()) redirect('/');
  if (await getSession()) redirect('/');

  const pending = await readPendingSession();
  if (!pending) redirect('/acceso');

  return <CodeForm nombre={pending.nombre} />;
}
