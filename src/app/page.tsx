import { Workbench } from '@/components/Workbench';
import { requireSession } from '@/lib/auth/dal';
import { isAdmin } from '@/lib/auth/users';
import { isGeminiConfigured } from '@/lib/gemini/client';

export const dynamic = 'force-dynamic';

/**
 * La comprobación de sesión se hace aquí, en el servidor y junto a los datos,
 * y no sólo en el proxy: es lo que recomienda la documentación de Next.js para
 * que una regla mal escrita en el proxy no deje la aplicación al aire.
 *
 * El estado de la clave de Gemini baja al cliente como un simple booleano, sin
 * exponer nunca la clave al navegador.
 */
export default async function Home() {
  const session = await requireSession();

  return (
    <Workbench
      aiEnabled={isGeminiConfigured()}
      usuario={session.nombre}
      viaGoogle={session.via === 'google'}
      esAdmin={isAdmin(session.sub)}
    />
  );
}
