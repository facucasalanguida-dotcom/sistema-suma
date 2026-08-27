import { notFound } from 'next/navigation';
import { AltaForm } from './AltaForm';
import { getSession } from '@/lib/auth/dal';
import { loadUsers } from '@/lib/auth/users';

export const dynamic = 'force-dynamic';

/**
 * Alta de cuentas.
 *
 * Sólo existe si hay una sesión abierta o si hay contraseña de instalación
 * configurada. En cualquier otro caso la página se comporta como inexistente:
 * en una herramienta interna no hace falta anunciar qué rutas hay.
 */
export default async function AltaPage() {
  const sesion = await getSession();
  const hayInstalacion = Boolean(process.env.SUMA_ACCESS_PASSWORD);

  if (!sesion && !hayInstalacion) notFound();

  return <AltaForm conSesion={Boolean(sesion)} hayUsuarios={loadUsers().length > 0} />;
}
