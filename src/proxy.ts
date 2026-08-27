import { NextResponse, type NextRequest } from 'next/server';
import {
  SESSION_COOKIE,
  authIsConfigured,
  misconfigurationReason,
  verifySessionToken,
} from '@/lib/auth/session';

/**
 * Primera línea de defensa, en cada petición.
 *
 * Hace tres cosas:
 *
 *  1. **Cabeceras de seguridad**, incluida una política de contenido estricta
 *     con «nonce» por petición, que es lo que corta de raíz los ataques de
 *     inyección de scripts.
 *  2. **Comprobación de sesión** antes de que se renderice nada.
 *  3. **Compatibilidad**: si todavía no se ha configurado el sistema de
 *     cuentas, mantiene la contraseña compartida de siempre, para que nadie se
 *     quede fuera de su propia herramienta durante la transición.
 *
 * Ojo: esto NO es la única defensa. La documentación de Next.js avisa de que
 * la comprobación del proxy es optimista y de que las decisiones de verdad
 * deben tomarse junto a los datos; de eso se encarga `src/lib/auth/dal.ts`,
 * que vuelve a verificar la sesión en cada página y en cada ruta de API.
 */

/** Rutas que tienen que ser accesibles sin sesión, o no habría forma de entrar. */
const PUBLIC_PATHS = ['/acceso', '/api/auth/'];

const REALM = 'Presupuestos SUMA';

/** Un mensaje por cada forma de dejar el acceso a medio configurar. */
const MISCONFIG_MESSAGES = {
  'faltan-cuentas':
    'Falta la clave que firma las sesiones.\n\n' +
    'Las cuentas (SUMA_USUARIOS) están puestas, pero sin SESSION_SECRET no ' +
    'sirven: es la clave con la que se firma la sesión de cada persona.\n\n' +
    'En Vercel: Settings -> Environment Variables -> añade SESSION_SECRET con ' +
    'un texto largo y aleatorio (mínimo 32 caracteres) y vuelve a desplegar.',

  'clave-corta':
    'La clave SESSION_SECRET es demasiado corta.\n\n' +
    'Necesita al menos 32 caracteres. Con una más corta, la firma de las ' +
    'sesiones sería fácil de romper, así que el sistema prefiere no arrancar ' +
    'antes que dar una seguridad aparente.\n\n' +
    'Alárgala en Vercel y vuelve a desplegar.',

  'sin-puerta':
    'Este sistema todavía no tiene configurado el acceso.\n\n' +
    'Define SESSION_SECRET (y crea la primera cuenta en /acceso/alta) o, de ' +
    'momento, SUMA_ACCESS_PASSWORD.',
} as const;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

  /*
   * `strict-dynamic` hace que sólo se ejecuten los scripts que Next firma con
   * el nonce de esta petición, y los que ellos carguen. Un script inyectado
   * por un tercero no tiene nonce, así que el navegador no lo ejecuta.
   *
   * `style-src-attr 'unsafe-inline'` es necesario y seguro: React escribe
   * atributos `style` en línea (barras de progreso, retardos de animación) y
   * un atributo de estilo no puede ejecutar código.
   */
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-inline'" : ''}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const allow = () => {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', csp);
    return response;
  };

  /* ── Sistema de cuentas configurado ─────────────────────────────────── */
  if (authIsConfigured()) {
    if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path))) {
      return allow();
    }

    const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (session) return allow();

    // Las rutas de API contestan en JSON: devolver HTML de una pantalla de
    // acceso rompería al cliente que esperaba datos.
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json(
        { error: 'Tu sesión ha caducado. Vuelve a entrar.' },
        { status: 401 },
      );
      response.headers.set('Content-Security-Policy', csp);
      return response;
    }

    const login = new URL('/acceso', request.url);
    if (pathname !== '/') login.searchParams.set('error', 'sesion-caducada');
    const response = NextResponse.redirect(login);
    response.headers.set('Content-Security-Policy', csp);
    return response;
  }

  /* ── Todavía con la contraseña compartida de siempre ─────────────────── */
  const shared = process.env.SUMA_ACCESS_PASSWORD;
  if (shared) {
    const header = request.headers.get('authorization') ?? '';
    const [scheme, encoded] = header.split(' ');

    if (scheme?.toLowerCase() === 'basic' && encoded) {
      const decoded = safeDecode(encoded);
      const password = decoded.slice(decoded.indexOf(':') + 1);
      if (constantTimeEquals(password, shared)) return allow();
    }

    return new NextResponse('Acceso restringido al equipo de SUMA.', {
      status: 401,
      headers: {
        'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Security-Policy': csp,
      },
    });
  }

  /* ── Desplegado pero sin ninguna puerta ──────────────────────────────── */
  const problema = misconfigurationReason();
  if (problema) {
    // Antes esto dejaba pasar a cualquiera. Una variable olvidada en el
    // despliegue no puede traducirse en una aplicación abierta al mundo con
    // una clave de IA de pago detrás: se cierra y se explica qué falta,
    // distinguiendo el caso concreto para no obligar a adivinar.
    return new NextResponse(MISCONFIG_MESSAGES[problema], {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': csp,
      },
    });
  }

  // Sin nada configurado y sin desplegar: desarrollo local y pruebas.
  return allow();
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
