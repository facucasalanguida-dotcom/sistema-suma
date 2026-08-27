import 'server-only';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

/**
 * Sesiones sin estado, firmadas con JWT.
 *
 * Es el patrón que documenta Next.js 16 para aplicaciones sin base de datos:
 * la sesión viaja en una cookie firmada con una clave secreta del servidor. El
 * navegador no puede leerla (`httpOnly`) ni fabricarla (va firmada), y sólo se
 * envía por HTTPS.
 *
 * La sesión tiene DOS estados a propósito:
 *
 *  - `pendiente`: la contraseña es correcta pero falta el segundo factor. No
 *    da acceso a nada; sólo sirve para saber quién está a medio entrar.
 *  - `activa`: identidad comprobada del todo.
 *
 * Separarlos evita el fallo clásico de los sistemas con doble factor: emitir
 * la sesión buena en cuanto la contraseña acierta y confiar en que la interfaz
 * pedirá el código.
 */

const ISSUER = 'suma-presupuestos';
const AUDIENCE = 'suma-app';

/** La sesión caduca sola: una pestaña olvidada en una obra no queda abierta. */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
/** La espera del segundo factor es corta: es un trámite de segundos. */
export const PENDING_MAX_AGE_SECONDS = 5 * 60;

/**
 * En producción se usa el prefijo `__Host-`, que el navegador sólo acepta si
 * la cookie es `Secure`, con `Path=/` y sin `Domain`: así ningún subdominio
 * vecino puede plantarnos una cookie de sesión. En desarrollo (http) ese
 * prefijo impediría iniciar sesión, así que se cae al nombre simple.
 */
const PRODUCTION = process.env.NODE_ENV === 'production';
export const SESSION_COOKIE = PRODUCTION ? '__Host-suma_sesion' : 'suma_sesion';
export const PENDING_COOKIE = PRODUCTION ? '__Host-suma_2fa' : 'suma_2fa';

/**
 * Permite invalidar de golpe todas las sesiones abiertas: basta con cambiar
 * `AUTH_TOKEN_VERSION` en el entorno y volver a desplegar. Sin base de datos no
 * hay forma de revocar un token concreto antes de que caduque, así que este
 * interruptor es la única salida rápida si se sospecha que alguien ha robado
 * una sesión.
 */
function tokenVersion(): string {
  return process.env.AUTH_TOKEN_VERSION?.trim() || '1';
}

export interface SessionData {
  /** Identificador estable del usuario (su nombre de acceso o su correo). */
  sub: string;
  /** Nombre para mostrar en la interfaz. */
  nombre: string;
  /** Cómo se ha identificado: con contraseña o con Google. */
  via: 'contrasena' | 'google';
}

export interface PendingData {
  sub: string;
  nombre: string;
}

/**
 * Atributos de las cookies de sesión.
 *
 * Se centralizan porque BORRAR una cookie exige repetir exactamente los mismos
 * atributos con los que se creó. Con el prefijo `__Host-` esto no es un
 * detalle: el navegador rechaza cualquier cookie con ese prefijo que no venga
 * marcada `Secure` y con `Path=/`, así que un borrado sin esos atributos se
 * descarta y la sesión sobrevive al «cerrar sesión». Comprobado en un
 * navegador de verdad: sin esto, salir no cerraba nada.
 */
function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: PRODUCTION,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

/** Borrado explícito: misma cookie, sin valor y caducada. */
async function clearCookie(name: string): Promise<void> {
  (await cookies()).set(name, '', cookieOptions(0));
}

/**
 * Clave de firma. Se lee en cada llamada —y no al cargar el módulo— para que
 * el arranque no dependa del orden en que Vercel inyecta las variables.
 */
function signingKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'Falta SESSION_SECRET o es demasiado corta (mínimo 32 caracteres). ' +
        'Genera una con: openssl rand -base64 32',
    );
  }
  return new TextEncoder().encode(secret);
}

/** `true` si el sistema de acceso está configurado y debe exigirse. */
export function authIsConfigured(): boolean {
  return Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32);
}

/**
 * `true` cuando la aplicación está DESPLEGADA de verdad (Vercel define estas
 * variables por su cuenta).
 *
 * Sirve para lo más importante de todo el módulo: en un despliegue real, una
 * variable de acceso olvidada tiene que CERRAR la aplicación, nunca abrirla.
 * En local y en las pruebas automáticas se sigue trabajando sin credenciales,
 * que es lo cómodo y no tiene ningún riesgo.
 */
export function isDeployed(): boolean {
  return Boolean(process.env.VERCEL || process.env.SUMA_FORZAR_ACCESO);
}

/**
 * `true` si hay que exigir acceso pero NO hay forma de darlo: despliegue real
 * sin cuentas y sin contraseña compartida. Es un error de configuración, y la
 * respuesta correcta es no servir nada.
 */
export function authMisconfigured(): boolean {
  return isDeployed() && !authIsConfigured() && !process.env.SUMA_ACCESS_PASSWORD;
}

async function sign(payload: JWTPayload, maxAgeSeconds: number): Promise<string> {
  return new SignJWT({ ...payload, ver: tokenVersion() })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(signingKey());
}

/**
 * Verifica y descifra un token. Nunca lanza por un token inválido: una firma
 * que no cuadra, un token caducado o uno de otro emisor son simplemente
 * «no hay sesión».
 */
async function verify(token: string | undefined): Promise<JWTPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    // Un token emitido antes de un cambio de versión deja de valer.
    if (payload.ver !== tokenVersion()) return null;

    return payload;
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Sesión activa                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export async function createSession(data: SessionData): Promise<void> {
  const token = await sign({ ...data, tipo: 'sesion' }, SESSION_MAX_AGE_SECONDS);
  const store = await cookies();

  store.set(SESSION_COOKIE, token, cookieOptions(SESSION_MAX_AGE_SECONDS));

  // Al pasar el segundo factor, la marca de «a medias» sobra.
  store.set(PENDING_COOKIE, '', cookieOptions(0));
}

/**
 * Comprueba un token de sesión suelto. Se usa desde el proxy, donde no existe
 * el almacén de cookies de `next/headers` y hay que leerlas de la petición.
 */
export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionData | null> {
  const payload = await verify(token);
  if (!payload || payload.tipo !== 'sesion') return null;

  const { sub, nombre, via } = payload as Record<string, unknown>;
  if (typeof sub !== 'string' || typeof nombre !== 'string') return null;
  if (via !== 'contrasena' && via !== 'google') return null;

  return { sub, nombre, via };
}

/** Lee la sesión activa, o `null` si no hay o no es válida. */
export async function readSession(): Promise<SessionData | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function destroySession(): Promise<void> {
  await clearCookie(SESSION_COOKIE);
  await clearCookie(PENDING_COOKIE);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Sesión a medias, esperando el segundo factor                               */
/* ────────────────────────────────────────────────────────────────────────── */

export async function createPendingSession(data: PendingData): Promise<void> {
  const token = await sign({ ...data, tipo: 'pendiente' }, PENDING_MAX_AGE_SECONDS);
  const store = await cookies();

  store.set(PENDING_COOKIE, token, cookieOptions(PENDING_MAX_AGE_SECONDS));
}

export async function readPendingSession(): Promise<PendingData | null> {
  const store = await cookies();
  const payload = await verify(store.get(PENDING_COOKIE)?.value);
  if (!payload || payload.tipo !== 'pendiente') return null;

  const { sub, nombre } = payload as Record<string, unknown>;
  if (typeof sub !== 'string' || typeof nombre !== 'string') return null;

  return { sub, nombre };
}

export async function destroyPendingSession(): Promise<void> {
  await clearCookie(PENDING_COOKIE);
}
