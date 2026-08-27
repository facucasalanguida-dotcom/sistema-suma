/**
 * Nombres y borrado de las cookies de un solo uso del flujo de Google.
 *
 * Llevan el prefijo `__Host-` en producción por el mismo motivo que la cookie
 * de sesión: con ese prefijo el navegador sólo acepta la cookie si es
 * `Secure`, con `Path=/` y sin `Domain`, de modo que ningún subdominio vecino
 * —ni una vista previa de Vercel comprometida— puede plantarnos un `state` o
 * un `verifier` a nuestro nombre y desviar el inicio de sesión.
 *
 * No lleva `server-only` porque el proxy también necesita conocer los nombres.
 */

export const PRODUCTION = process.env.NODE_ENV === 'production';

const prefix = PRODUCTION ? '__Host-' : '';

export const OAUTH_COOKIES = {
  state: `${prefix}suma_oauth_state`,
  nonce: `${prefix}suma_oauth_nonce`,
  verifier: `${prefix}suma_oauth_verifier`,
} as const;

/** Atributos con los que se crean, y por tanto con los que hay que borrarlas. */
export function oauthCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: PRODUCTION,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
