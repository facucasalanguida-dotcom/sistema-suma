import 'server-only';
import { NextResponse } from 'next/server';
import { sessionForApi } from './dal';

/**
 * Guardián de las rutas de API.
 *
 * El proxy ya rechaza las peticiones sin sesión, pero la documentación de
 * Next.js avisa de que esa comprobación es optimista y no debe ser la única:
 * una regla mal escrita en el `matcher`, o una ruta que en el futuro se
 * excluya sin darse cuenta, dejaría el dato al aire. Comprobarlo también aquí
 * cuesta una línea por ruta y cierra esa puerta.
 *
 * Devuelve la respuesta de error si hay que cortar, o `null` si se puede
 * seguir.
 */
export async function requireApiSession(): Promise<NextResponse | null> {
  const session = await sessionForApi();
  if (session) return null;

  return NextResponse.json(
    { error: 'Tu sesión ha caducado. Vuelve a entrar en el sistema.' },
    { status: 401 },
  );
}
