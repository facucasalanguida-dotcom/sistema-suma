import { notFound } from 'next/navigation';
import { AltaForm } from './AltaForm';
import { getSession } from '@/lib/auth/dal';
import { isAdmin, loadUsers } from '@/lib/auth/users';

export const dynamic = 'force-dynamic';

/**
 * Alta de cuentas.
 *
 * Sólo la ve quien administra las cuentas, o quien tenga la contraseña de
 * instalación cuando todavía no hay ninguna. Para el resto la página se
 * comporta como inexistente: en una herramienta interna no hace falta
 * anunciar qué rutas hay ni quién tiene permiso sobre ellas.
 */
export default async function AltaPage() {
  const sesion = await getSession();
  const hayInstalacion = Boolean(process.env.SUMA_ACCESS_PASSWORD);

  if (sesion && !isAdmin(sesion.sub)) notFound();
  if (!sesion && !hayInstalacion) notFound();

  return <AltaForm conSesion={Boolean(sesion)} hayUsuarios={loadUsers().length > 0} />;
}
