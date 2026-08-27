import { NextResponse } from 'next/server';
import { audit } from '@/lib/auth/audit';
import { safeEquals } from '@/lib/auth/crypto';
import { callbackUrl, completeGoogleLogin } from '@/lib/auth/google';
import { checkRate, registerFailure, registerSuccess, clientKey } from '@/lib/auth/rate-limit';
import { createSession } from '@/lib/auth/session';
import { findUser, googleEmailAllowed, googleIsConfigured } from '@/lib/auth/users';
import { OAUTH_COOKIES, oauthCookieOptions } from '@/lib/auth/oauth-cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vuelta de Google. Aquí se comprueba TODO antes de dar sesión: el estado
 * contra falsificación, el código con su verificador PKCE, la firma del token
 * contra las claves de Google, el nonce, que el correo esté verificado y que
 * esté en la lista de personas autorizadas.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const loginUrl = new URL('/acceso', request.url);

  if (!googleIsConfigured()) {
    loginUrl.searchParams.set('error', 'google-no-configurado');
    return NextResponse.redirect(loginUrl);
  }

  const rateKey = clientKey(request, 'google');
  if (!checkRate(rateKey).permitido) {
    loginUrl.searchParams.set('error', 'demasiados-intentos');
    return NextResponse.redirect(loginUrl);
  }

  // Google avisa aquí si el usuario ha cancelado.
  if (url.searchParams.get('error')) {
    loginUrl.searchParams.set('error', 'google-cancelado');
    return clearOauthCookies(NextResponse.redirect(loginUrl));
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookies = request.headers.get('cookie') ?? '';
  const expectedState = readCookie(cookies, OAUTH_COOKIES.state);
  const nonce = readCookie(cookies, OAUTH_COOKIES.nonce);
  const verifier = readCookie(cookies, OAUTH_COOKIES.verifier);

  if (!code || !state || !expectedState || !nonce || !verifier) {
    registerFailure(rateKey);
    audit('google-error', { motivo: 'faltan-parametros' });
    loginUrl.searchParams.set('error', 'google-fallido');
    return clearOauthCookies(NextResponse.redirect(loginUrl));
  }

  if (!safeEquals(state, expectedState)) {
    registerFailure(rateKey);
    audit('google-error', { motivo: 'estado-no-coincide' });
    loginUrl.searchParams.set('error', 'google-fallido');
    return clearOauthCookies(NextResponse.redirect(loginUrl));
  }

  const identity = await completeGoogleLogin({
    code,
    verifier,
    nonce,
    redirectUri: callbackUrl(request),
  });

  if (!identity || !identity.emailVerified) {
    registerFailure(rateKey);
    audit('google-error', { motivo: identity ? 'correo-sin-verificar' : 'token-invalido' });
    loginUrl.searchParams.set('error', 'google-fallido');
    return clearOauthCookies(NextResponse.redirect(loginUrl));
  }

  if (!googleEmailAllowed(identity.email)) {
    registerFailure(rateKey);
    audit('google-rechazado', { usuario: identity.email });
    loginUrl.searchParams.set('error', 'no-autorizado');
    return clearOauthCookies(NextResponse.redirect(loginUrl));
  }

  registerSuccess(rateKey);
  audit('google-correcto', { usuario: identity.email });

  // Si ese correo corresponde a un usuario dado de alta, se conserva su
  // nombre de acceso; si no, la identidad es el propio correo.
  const known = findUser(identity.email);
  const response = NextResponse.redirect(new URL('/', request.url));

  await createSession({
    sub: known?.usuario ?? identity.email,
    nombre: known?.nombre ?? identity.name,
    via: 'google',
  });

  return clearOauthCookies(response);
}

/**
 * Lee una cookie de la cabecera. Nunca lanza: una cookie con codificación
 * porcentual mal formada («%zz») haría estallar `decodeURIComponent` y con
 * ella todo el retorno de Google, que es un 500 que cualquiera puede provocar
 * poniéndose una cookie a mano.
 */
function readCookie(header: string, name: string): string | null {
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key !== name) continue;

    const raw = rest.join('=');
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/**
 * Los secretos de un solo uso se retiran SIEMPRE: al usarlos y también en cada
 * rama de error. Si quedasen en el navegador, un `state` válido seguiría
 * disponible para otro intento.
 *
 * El borrado repite los atributos exactos con los que se crearon: con el
 * prefijo `__Host-`, una cookie de borrado sin `Secure` y sin `Path=/` la
 * rechaza el navegador y el borrado no llega a ocurrir.
 */
function clearOauthCookies(response: NextResponse): NextResponse {
  for (const name of Object.values(OAUTH_COOKIES)) {
    response.cookies.set(name, '', oauthCookieOptions(0));
  }
  return response;
}
