import 'server-only';

/**
 * Freno a los intentos de acceso.
 *
 * Cuenta los fallos por identificador (usuario o IP) y bloquea temporalmente
 * cuando se pasan de la raya, con una espera que crece a cada bloqueo.
 *
 * LIMITACIÓN QUE CONVIENE CONOCER: en Vercel cada función vive en su propia
 * instancia y el contador va en memoria, así que un atacante muy repartido
 * podría esquivarlo parcialmente. No es la única defensa ni la principal: el
 * hash de la contraseña cuesta más de medio segundo de CPU por intento, lo que
 * ya limita el ritmo por sí solo, y el segundo factor exige acertar además un
 * código que cambia cada 30 segundos. Con una base de datos o un Redis este
 * contador sería global; se ha preferido no obligar a contratar nada.
 */

interface Attempt {
  fallos: number;
  /** Momento (ms) hasta el que está bloqueado. */
  bloqueadoHasta: number;
  /** Última actividad, para poder limpiar entradas viejas. */
  visto: number;
}

const attempts = new Map<string, Attempt>();

/** Fallos consentidos antes del primer bloqueo. */
const FREE_ATTEMPTS = 5;
/** Espera base del bloqueo; se duplica con cada bloqueo sucesivo. */
const BASE_LOCK_MS = 30_000;
const MAX_LOCK_MS = 15 * 60_000;
/** Las entradas inactivas se olvidan, para que el mapa no crezca sin fin. */
const FORGET_AFTER_MS = 60 * 60_000;
const MAX_ENTRIES = 5_000;

export interface RateVerdict {
  permitido: boolean;
  /** Segundos que faltan para poder reintentar, si está bloqueado. */
  esperaSegundos: number;
  /** Intentos que quedan antes del bloqueo. */
  restantes: number;
}

/** ¿Puede este identificador intentarlo ahora? No cuenta el intento. */
export function checkRate(key: string, now: number = Date.now()): RateVerdict {
  sweep(now);
  const entry = attempts.get(key);

  if (!entry) return { permitido: true, esperaSegundos: 0, restantes: FREE_ATTEMPTS };

  if (entry.bloqueadoHasta > now) {
    return {
      permitido: false,
      esperaSegundos: Math.ceil((entry.bloqueadoHasta - now) / 1000),
      restantes: 0,
    };
  }

  return {
    permitido: true,
    esperaSegundos: 0,
    restantes: Math.max(0, FREE_ATTEMPTS - entry.fallos),
  };
}

/** Apunta un intento fallido y devuelve el veredicto resultante. */
export function registerFailure(key: string, now: number = Date.now()): RateVerdict {
  sweep(now);
  const entry = attempts.get(key) ?? { fallos: 0, bloqueadoHasta: 0, visto: now };

  entry.fallos += 1;
  entry.visto = now;

  if (entry.fallos > FREE_ATTEMPTS) {
    // Espera creciente: 30 s, 60 s, 120 s… hasta un cuarto de hora.
    const strikes = entry.fallos - FREE_ATTEMPTS;
    const wait = Math.min(BASE_LOCK_MS * 2 ** (strikes - 1), MAX_LOCK_MS);
    entry.bloqueadoHasta = now + wait;
  }

  attempts.set(key, entry);

  return entry.bloqueadoHasta > now
    ? {
        permitido: false,
        esperaSegundos: Math.ceil((entry.bloqueadoHasta - now) / 1000),
        restantes: 0,
      }
    : { permitido: true, esperaSegundos: 0, restantes: Math.max(0, FREE_ATTEMPTS - entry.fallos) };
}

/** Un acceso correcto limpia el historial de ese identificador. */
export function registerSuccess(key: string): void {
  attempts.delete(key);
}

/** Sólo para las pruebas: vacía el contador. */
export function resetRateLimit(): void {
  attempts.clear();
}

function sweep(now: number): void {
  if (attempts.size < MAX_ENTRIES) {
    // Barrido barato: sólo cuando el mapa empieza a crecer de verdad.
    if (attempts.size < 256) return;
  }
  for (const [key, entry] of attempts) {
    if (now - entry.visto > FORGET_AFTER_MS && entry.bloqueadoHasta < now) {
      attempts.delete(key);
    }
  }
}

/**
 * Identificador de quien pide, para el contador. Se prefiere la cabecera que
 * pone Vercel; si no está, se cae a las de proxys habituales.
 */
export function clientKey(request: Request, scope: string): string {
  const headers = request.headers;
  const ip =
    headers.get('x-real-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'desconocida';
  return `${scope}:${ip}`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Códigos de un solo uso                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Códigos TOTP ya gastados, para que un código interceptado no valga dos
 * veces dentro de su ventana de 30 segundos.
 *
 * LIMITACIÓN: al ir en memoria, sólo protege dentro de la misma instancia.
 * Evitarlo del todo exigiría un almacén compartido (una base de datos o un
 * Redis). Aun así cubre el caso realista —el mismo atacante reintentando por
 * la misma conexión— y no cuesta nada.
 */
const usedCodes = new Map<string, number>();

/**
 * Marca un código como usado. Devuelve `false` si ya se había usado, en cuyo
 * caso hay que rechazarlo.
 */
export function consumeOnce(user: string, counter: number, now: number = Date.now()): boolean {
  // Se limpian los contadores viejos: pasada su ventana ya no valen de todos
  // modos, porque `verifyTotp` no los aceptaría.
  const cutoff = Math.floor(now / 1000 / 30) - 2;
  for (const [key, value] of usedCodes) {
    if (value < cutoff) usedCodes.delete(key);
  }

  const key = `${user}:${counter}`;
  if (usedCodes.has(key)) return false;

  usedCodes.set(key, counter);
  return true;
}

/** Sólo para las pruebas. */
export function resetUsedCodes(): void {
  usedCodes.clear();
}

/**
 * Códigos de recuperación ya gastados.
 *
 * MISMA LIMITACIÓN, y conviene decirla clara: al no haber base de datos, esto
 * sólo impide la reutilización dentro de la misma instancia. La invalidación
 * definitiva es responsabilidad de quien administra: al usarse un código, el
 * registro avisa de que hay que retirarlo de `SUMA_USUARIOS`.
 */
const usedRecovery = new Set<string>();

/** Marca un código de recuperación como gastado. `false` si ya lo estaba. */
export function consumeRecovery(user: string, codeHash: string): boolean {
  const key = `${user}:${codeHash}`;
  if (usedRecovery.has(key)) return false;
  usedRecovery.add(key);
  return true;
}

/** Sólo para las pruebas. */
export function resetUsedRecovery(): void {
  usedRecovery.clear();
}
