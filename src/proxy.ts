import { NextResponse, type NextRequest } from 'next/server';

/**
 * Puerta de acceso opcional.
 *
 * Una vez desplegada, la aplicación queda en una URL pública y cualquiera que
 * la encuentre puede lanzar búsquedas que se facturan contra la clave de
 * Gemini de SUMA. No hay cuentas de usuario porque es una herramienta interna,
 * así que la protección más razonable es una contraseña compartida.
 *
 * Se activa **sólo** si existe `SUMA_ACCESS_PASSWORD`. Sin esa variable el
 * proxy no hace nada y la aplicación funciona igual que en local, que es lo que
 * conviene mientras se prueba.
 *
 * Se usa autenticación básica de HTTP a propósito: el navegador enseña su
 * propio diálogo y recuerda las credenciales para todas las peticiones,
 * incluidas las de las rutas de API y la descarga del PDF, sin tener que
 * construir una pantalla de acceso ni gestionar sesiones.
 */

const REALM = 'Presupuestos SUMA';

export function proxy(request: NextRequest) {
  const expected = process.env.SUMA_ACCESS_PASSWORD;
  if (!expected) return NextResponse.next();

  const header = request.headers.get('authorization') ?? '';
  const [scheme, encoded] = header.split(' ');

  if (scheme?.toLowerCase() === 'basic' && encoded) {
    const decoded = safeDecode(encoded);
    // El usuario da igual: lo que importa es la contraseña compartida.
    const password = decoded.slice(decoded.indexOf(':') + 1);
    if (constantTimeEquals(password, expected)) return NextResponse.next();
  }

  return new NextResponse('Acceso restringido al equipo de SUMA.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

function safeDecode(value: string): string {
  try {
    return atob(value);
  } catch {
    return '';
  }
}

/**
 * Comparación de duración constante: comparar con `===` filtra por el tiempo
 * de respuesta cuántos caracteres iniciales se han acertado.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export const config = {
  /**
   * Se protege todo menos los recursos estáticos: el icono se sirve sin
   * contraseña para que la pestaña del navegador no muestre un hueco.
   */
  matcher: ['/((?!_next/static|_next/image|icon.svg|favicon.ico).*)'],
};
