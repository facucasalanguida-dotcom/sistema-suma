import 'server-only';
import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

/**
 * Primitivas criptográficas de la autenticación de SUMA.
 *
 * Todo se apoya en `node:crypto`, que forma parte de la plataforma: no hay
 * dependencias externas que auditar ni que puedan comprometerse en la cadena
 * de suministro. Este módulo lleva `server-only`, así que si algún día alguien
 * lo importa por error desde un componente de cliente, la compilación falla en
 * lugar de filtrar el código al navegador.
 */

/**
 * `promisify` pierde la sobrecarga de `scrypt` que acepta opciones, así que se
 * envuelve a mano conservando los tipos.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Contraseñas                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Parámetros de scrypt recomendados por OWASP (Password Storage Cheat Sheet):
 * coste de CPU/memoria 2^17, bloque 8, paralelismo 1. Son deliberadamente
 * caros —unos cientos de milisegundos y 128 MiB por intento— para que probar
 * contraseñas a lo bruto salga prohibitivo.
 */
const SCRYPT_N = 2 ** 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_BYTES = 32;
const SALT_BYTES = 16;
/** `maxmem` por defecto en Node son 32 MiB: con estos parámetros no basta. */
const SCRYPT_MAXMEM = 256 * 1024 * 1024;

/**
 * Hash de una contraseña, en un formato autodescriptivo que guarda los
 * parámetros usados. Así, si mañana hay que subir el coste, los hashes viejos
 * se siguen verificando con los suyos.
 *
 * Formato: `scrypt$N$r$p$saltBase64$hashBase64`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(password.normalize('NFKC'), salt, SCRYPT_KEY_BYTES, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });

  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * Comprueba una contraseña contra su hash. Nunca lanza: una entrada
 * malformada es simplemente un fallo de verificación, para que un hash
 * corrupto en la configuración no delate nada ni tumbe el servidor.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'scrypt') return false;

    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    if (salt.length === 0 || expected.length === 0) return false;

    const derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT_MAXMEM,
    });

    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Comparación en tiempo constante de dos cadenas (tokens, códigos, estados). */
export function safeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  // `timingSafeEqual` exige la misma longitud; se compara el hash de ambas
  // para no filtrar la longitud por la vía del error.
  if (bufferA.length !== bufferB.length) {
    const digestA = createHmac('sha256', 'suma-compare').update(bufferA).digest();
    const digestB = createHmac('sha256', 'suma-compare').update(bufferB).digest();
    timingSafeEqual(digestA, digestB);
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Base32 (RFC 4648), el alfabeto de los secretos TOTP                        */
/* ────────────────────────────────────────────────────────────────────────── */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(data: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];

  return output;
}

export function base32Decode(input: string): Buffer {
  // Se aceptan minúsculas, espacios y el relleno «=» porque las aplicaciones
  // de autenticación muestran el secreto en grupos de cuatro.
  const clean = input.toUpperCase().replace(/[\s=]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Secreto en base32 no válido.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Segundo factor: TOTP (RFC 6238)                                            */
/* ────────────────────────────────────────────────────────────────────────── */

/** Duración de cada código, en segundos. Es el valor que esperan las apps. */
export const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
/**
 * Ventana de tolerancia: se aceptan el código anterior y el siguiente para
 * absorber relojes desajustados. Una ventana mayor multiplicaría los códigos
 * válidos a la vez y facilitaría adivinarlos.
 */
const TOTP_WINDOW = 1;

/** Secreto nuevo de 20 bytes (160 bits), el tamaño que recomienda el RFC. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Código de 6 dígitos para un contador concreto (HOTP, RFC 4226). */
function hotp(secret: Buffer, counter: number): string {
  const buffer = Buffer.alloc(8);
  // El contador es de 64 bits; con `BigInt` se escribe sin perder precisión.
  buffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', secret).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

/** Código válido en un instante dado (por defecto, ahora). */
export function totpCode(secret: string, atMs: number = Date.now()): string {
  const counter = Math.floor(atMs / 1000 / TOTP_PERIOD_SECONDS);
  return hotp(base32Decode(secret), counter);
}

/**
 * Verifica un código de 6 dígitos. Devuelve el contador con el que ha casado
 * —para poder rechazar su reutilización— o `null` si no es válido.
 */
export function verifyTotp(
  secret: string,
  code: string,
  atMs: number = Date.now(),
): number | null {
  const clean = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return null;

  let key: Buffer;
  try {
    key = base32Decode(secret);
  } catch {
    return null;
  }

  const counter = Math.floor(atMs / 1000 / TOTP_PERIOD_SECONDS);
  for (let drift = -TOTP_WINDOW; drift <= TOTP_WINDOW; drift += 1) {
    if (safeEquals(hotp(key, counter + drift), clean)) return counter + drift;
  }
  return null;
}

/**
 * URL `otpauth://` que leen Google Authenticator, Authy, 1Password y demás al
 * escanear el código QR.
 */
export function totpUri(secret: string, account: string, issuer = 'GRUPO SUMA'): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** El secreto en grupos de cuatro, para poder teclearlo sin equivocarse. */
export function formatSecretForHumans(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Códigos de recuperación                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Códigos de un solo uso para entrar si se pierde el teléfono. Se entregan en
 * claro una única vez y se guardan siempre hasheados.
 */
export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const raw = base32Encode(randomBytes(10)).slice(0, 16).toLowerCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
  });
}

/** Token aleatorio en base64url, para estados de OAuth y similares. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
