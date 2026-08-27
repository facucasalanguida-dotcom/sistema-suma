import 'server-only';
import { createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { randomToken } from './crypto';

/**
 * Acceso con Google (OpenID Connect).
 *
 * Es, con diferencia, la forma más segura de entrar al sistema: Google se
 * encarga de la contraseña, del segundo factor y de detectar accesos raros, y
 * aquí no se guarda ninguna credencial. El sistema sólo comprueba que quien
 * llega es de verdad quien Google dice y que su correo está en la lista de
 * personas autorizadas.
 *
 * Se implementa el flujo «authorization code» con PKCE, más `state` contra
 * falsificación de petición y `nonce` contra reutilización del token. La firma
 * del `id_token` se verifica contra las claves públicas de Google.
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/** Las claves públicas de Google se cachean solas entre peticiones. */
const jwks = createRemoteJWKSet(new URL(JWKS_URI));

export interface OAuthStart {
  url: string;
  state: string;
  nonce: string;
  verifier: string;
}

/** PKCE: reto derivado del verificador con SHA-256 (método S256). */
function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Construye la URL a la que se manda al usuario y los secretos de un solo uso
 * que hay que guardar para comprobar la vuelta.
 */
export function startGoogleLogin(redirectUri: string): OAuthStart {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error('Falta GOOGLE_OAUTH_CLIENT_ID.');

  const state = randomToken(24);
  const nonce = randomToken(24);
  const verifier = randomToken(48);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: challengeFor(verifier),
    code_challenge_method: 'S256',
    // Se pide siempre elegir cuenta: en un móvil compartido evita entrar sin
    // querer con la sesión de Google de otra persona.
    prompt: 'select_account',
  });

  return { url: `${AUTH_ENDPOINT}?${params.toString()}`, state, nonce, verifier };
}

export interface GoogleIdentity {
  email: string;
  name: string;
  emailVerified: boolean;
}

/**
 * Canjea el código por los tokens y comprueba la identidad.
 *
 * Devuelve `null` si algo no cuadra: no se distingue el motivo hacia fuera
 * para no dar pistas a quien esté probando.
 */
export async function completeGoogleLogin(params: {
  code: string;
  verifier: string;
  nonce: string;
  redirectUri: string;
}): Promise<GoogleIdentity | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  let idToken: string;
  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: params.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: params.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: params.verifier,
      }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[suma] Google rechazó el canje del código:', response.status);
      return null;
    }

    const body = (await response.json()) as { id_token?: string };
    if (!body.id_token) return null;
    idToken = body.id_token;
  } catch (error) {
    console.warn('[suma] no se ha podido contactar con Google:', error);
    return null;
  }

  try {
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: ISSUERS,
      audience: clientId,
      algorithms: ['RS256'],
      // Un token con más de cinco minutos no es de este intento de acceso.
      maxTokenAge: '5 minutes',
    });

    // El nonce ata este token a ESTA petición: sin comprobarlo, un token
    // robado de otra sesión valdría para entrar.
    if (typeof payload.nonce !== 'string' || payload.nonce !== params.nonce) {
      console.warn('[suma] el nonce del id_token no coincide.');
      return null;
    }

    const email = String(payload.email ?? '').trim().toLowerCase();
    if (!email.includes('@')) return null;

    // Google marca si ha verificado el correo. Sin esa marca, el correo no
    // prueba nada y no debe servir para casar con la lista de autorizados.
    const emailVerified = payload.email_verified === true;

    return {
      email,
      name: String(payload.name ?? '').trim() || email,
      emailVerified,
    };
  } catch (error) {
    console.warn('[suma] el id_token de Google no es válido:', error);
    return null;
  }
}

/**
 * La URL de vuelta que hay que declarar en Google Cloud. Se calcula a partir
 * de la petición para que funcione igual en local, en las vistas previas de
 * Vercel y en el dominio definitivo, y se puede fijar con
 * `SUMA_URL_PUBLICA` cuando haya un dominio propio.
 */
export function callbackUrl(request: Request): string {
  const configured = process.env.SUMA_URL_PUBLICA?.trim().replace(/\/+$/, '');
  if (configured) return `${configured}/api/auth/google/callback`;
  return new URL('/api/auth/google/callback', request.url).toString();
}
