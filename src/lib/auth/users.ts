import 'server-only';
import { createHash } from 'node:crypto';
import { safeEquals, verifyPassword, verifyTotp } from './crypto';

/**
 * Quién puede entrar.
 *
 * El sistema no tiene base de datos, así que los usuarios viven en una
 * variable de entorno (`SUMA_USUARIOS`) con un JSON codificado en base64. En
 * Vercel esas variables están cifradas en reposo y sólo las ve quien tiene
 * acceso al proyecto, así que es un sitio razonable para un equipo pequeño; y
 * lo más importante: NO están en el repositorio, que es público.
 *
 * Nadie tiene que escribir ese texto a mano: la pantalla de «alta de usuario»
 * lo genera entero y sólo hay que pegarlo en Vercel.
 *
 * Limitación honesta: al no haber base de datos, dar de alta a alguien exige
 * pegar la variable y volver a desplegar. Para un equipo de obra de dos a seis
 * personas es asumible; para decenas de usuarios haría falta una base de datos.
 */

export interface StoredUser {
  /** Nombre de acceso, en minúsculas. */
  usuario: string;
  /** Nombre para mostrar. */
  nombre: string;
  /** Correo, opcional; sirve para casar la cuenta con la de Google. */
  correo?: string;
  /** Hash scrypt de la contraseña. */
  hash: string;
  /** Secreto TOTP en base32. Si falta, ese usuario no tiene segundo factor. */
  totp?: string;
  /** Hashes SHA-256 de los códigos de recuperación aún sin usar. */
  recuperacion?: string[];
  /**
   * `true` si puede dar de alta a otras personas.
   *
   * Importa más de lo que parece: la pantalla de alta devuelve el valor
   * completo de `SUMA_USUARIOS`, que contiene los hashes de contraseña y los
   * secretos del segundo factor de TODO el equipo. Dárselo a cualquiera con
   * sesión sería regalarle las credenciales de sus compañeros.
   */
  admin?: boolean;
}

/** Lee y valida la lista de usuarios configurada. Nunca lanza. */
export function loadUsers(): StoredUser[] {
  const raw = process.env.SUMA_USUARIOS?.trim();
  if (!raw) return [];

  try {
    // Se admiten las dos formas: base64 (lo que genera la aplicación) y JSON
    // en claro, por si alguien lo edita a mano.
    const text = raw.startsWith('[') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((entry) => {
      const user = entry as Record<string, unknown>;
      const usuario = String(user.usuario ?? '').trim().toLowerCase();
      const hash = String(user.hash ?? '').trim();
      if (!usuario || !hash) return [];

      return [
        {
          usuario,
          nombre: String(user.nombre ?? '').trim() || usuario,
          correo: normalizeEmail(user.correo),
          hash,
          totp: typeof user.totp === 'string' && user.totp.trim() ? user.totp.trim() : undefined,
          admin: user.admin === true,
          recuperacion: Array.isArray(user.recuperacion)
            ? user.recuperacion.map((code) => String(code))
            : undefined,
        },
      ];
    });
  } catch {
    console.error('[suma] SUMA_USUARIOS no se ha podido leer: revisa el valor en el entorno.');
    return [];
  }
}

/** Codifica una lista de usuarios en el formato que se pega en el entorno. */
export function encodeUsers(users: StoredUser[]): string {
  return Buffer.from(JSON.stringify(users), 'utf8').toString('base64');
}

function normalizeEmail(value: unknown): string | undefined {
  const email = String(value ?? '').trim().toLowerCase();
  return email.includes('@') ? email : undefined;
}

/**
 * ¿Puede esta persona administrar las cuentas?
 *
 * Se comprueba contra la configuración, no contra la sesión: aunque alguien
 * lograse fabricar un token, el permiso sale de `SUMA_USUARIOS`, que sólo se
 * cambia desde el panel de Vercel.
 */
export function isAdmin(identifier: string): boolean {
  const user = findUser(identifier);
  if (!user) return false;
  if (user.admin) return true;

  // Compatibilidad: si nadie está marcado como administrador (configuración
  // creada antes de que existiera el permiso), lo es el primero de la lista.
  const users = loadUsers();
  return !users.some((entry) => entry.admin) && users[0]?.usuario === user.usuario;
}

/** Busca un usuario por su nombre de acceso o por su correo. */
export function findUser(identifier: string): StoredUser | null {
  const needle = identifier.trim().toLowerCase();
  if (!needle) return null;

  const users = loadUsers();
  return (
    users.find((user) => user.usuario === needle) ??
    users.find((user) => user.correo !== undefined && user.correo === needle) ??
    null
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Comprobación de credenciales                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export type CredentialResult =
  | { ok: true; user: StoredUser; necesitaSegundoFactor: boolean }
  | { ok: false };

/**
 * Comprueba usuario y contraseña.
 *
 * Cuando el usuario no existe se verifica igualmente contra un hash señuelo:
 * así responder «usuario inexistente» cuesta lo mismo que «contraseña mala» y
 * nadie puede averiguar qué nombres existen midiendo el tiempo de respuesta.
 */
export async function checkCredentials(
  identifier: string,
  password: string,
): Promise<CredentialResult> {
  const user = findUser(identifier);

  if (!user) {
    await verifyPassword(password, DECOY_HASH);
    return { ok: false };
  }

  const valid = await verifyPassword(password, user.hash);
  if (!valid) return { ok: false };

  return { ok: true, user, necesitaSegundoFactor: Boolean(user.totp) };
}

/**
 * Hash señuelo con los mismos parámetros que uno real, de una contraseña
 * aleatoria que nadie conoce. Sólo existe para gastar el mismo tiempo.
 */
const DECOY_HASH =
  'scrypt$131072$8$1$c3VtYS1kZWNveS1zYWx0MDA$' +
  'ZGVjb3ktaGFzaC1uby1jb3JyZXNwb25kZS1hLW5hZGE9';

/**
 * Comprueba el código del segundo factor. Devuelve el contador con el que ha
 * casado, para que quien llame pueda impedir que ese mismo código se use dos
 * veces; `null` si no es válido.
 */
export function checkTotp(user: StoredUser, code: string): number | null {
  if (!user.totp) return null;
  return verifyTotp(user.totp, code);
}

/** Hash de un código de recuperación. Son aleatorios, así que basta SHA-256. */
export function hashRecoveryCode(code: string): string {
  return createHash('sha256')
    .update(code.trim().toLowerCase().replace(/\s/g, ''))
    .digest('hex')
    .slice(0, 32);
}

/**
 * Comprueba un código de recuperación. Devuelve el hash consumido para que
 * quien llame pueda avisar de que hay que retirarlo de la configuración.
 */
export function checkRecoveryCode(user: StoredUser, code: string): string | null {
  const candidate = hashRecoveryCode(code);
  for (const stored of user.recuperacion ?? []) {
    if (safeEquals(stored, candidate)) return stored;
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Acceso con Google                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

/** Correos autorizados a entrar con Google, del entorno. */
export function allowedGoogleEmails(): string[] {
  return (process.env.SUMA_CORREOS_PERMITIDOS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.includes('@'));
}

export function googleIsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      allowedGoogleEmails().length > 0,
  );
}

/**
 * ¿Puede entrar este correo de Google?
 *
 * Vale tanto si está en la lista de correos permitidos como si coincide con el
 * correo de un usuario ya dado de alta. La comparación es en tiempo constante
 * por costumbre, aunque aquí el correo no sea un secreto.
 */
export function googleEmailAllowed(email: string): boolean {
  const needle = email.trim().toLowerCase();
  if (!needle.includes('@')) return false;

  if (allowedGoogleEmails().some((allowed) => safeEquals(allowed, needle))) return true;
  return loadUsers().some((user) => user.correo !== undefined && safeEquals(user.correo, needle));
}
