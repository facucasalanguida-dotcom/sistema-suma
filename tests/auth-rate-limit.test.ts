import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkRate,
  consumeOnce,
  consumeRecovery,
  registerFailure,
  registerSuccess,
  resetRateLimit,
  resetUsedCodes,
  resetUsedRecovery,
} from '@/lib/auth/rate-limit';

beforeEach(() => {
  resetRateLimit();
  resetUsedCodes();
  resetUsedRecovery();
});

describe('freno a los intentos', () => {
  it('deja probar unas cuantas veces antes de bloquear', () => {
    for (let i = 0; i < 5; i += 1) {
      expect(registerFailure('ip:1.2.3.4').permitido).toBe(true);
    }
    expect(registerFailure('ip:1.2.3.4').permitido).toBe(false);
  });

  it('la espera crece con cada bloqueo', () => {
    const key = 'ip:9.9.9.9';
    for (let i = 0; i < 6; i += 1) registerFailure(key);
    const primera = checkRate(key).esperaSegundos;

    const despues = registerFailure(key).esperaSegundos;
    expect(despues).toBeGreaterThan(primera);
  });

  it('un acceso correcto limpia el historial', () => {
    const key = 'usuario:facu';
    for (let i = 0; i < 6; i += 1) registerFailure(key);
    expect(checkRate(key).permitido).toBe(false);

    registerSuccess(key);
    expect(checkRate(key).permitido).toBe(true);
  });

  it('el bloqueo caduca solo con el tiempo', () => {
    const key = 'ip:5.5.5.5';
    const ahora = Date.UTC(2026, 7, 27, 12, 0, 0);
    for (let i = 0; i < 6; i += 1) registerFailure(key, ahora);

    expect(checkRate(key, ahora).permitido).toBe(false);
    // Pasada la espera de 30 segundos, se puede volver a intentar.
    expect(checkRate(key, ahora + 31_000).permitido).toBe(true);
  });

  it('bloquear a una IP no bloquea a otra', () => {
    for (let i = 0; i < 6; i += 1) registerFailure('ip:1.1.1.1');
    expect(checkRate('ip:1.1.1.1').permitido).toBe(false);
    expect(checkRate('ip:2.2.2.2').permitido).toBe(true);
  });

  it('el tope de espera no crece sin fin', () => {
    const key = 'ip:8.8.8.8';
    for (let i = 0; i < 40; i += 1) registerFailure(key);
    expect(checkRate(key).esperaSegundos).toBeLessThanOrEqual(15 * 60);
  });
});

describe('códigos de un solo uso', () => {
  // El contador tiene que ser el de AHORA: la limpieza descarta los viejos,
  // que es justo lo que se quiere (un código de hace un minuto ya no vale).
  const contadorActual = () => Math.floor(Date.now() / 1000 / 30);

  it('un código TOTP no vale dos veces', () => {
    const contador = contadorActual();
    expect(consumeOnce('facu', contador)).toBe(true);
    expect(consumeOnce('facu', contador)).toBe(false);
  });

  it('el mismo contador de otro usuario sí vale', () => {
    const contador = contadorActual();
    expect(consumeOnce('facu', contador)).toBe(true);
    expect(consumeOnce('otro', contador)).toBe(true);
  });

  it('el código anterior y el siguiente se controlan por separado', () => {
    const contador = contadorActual();
    expect(consumeOnce('facu', contador)).toBe(true);
    expect(consumeOnce('facu', contador + 1)).toBe(true);
    expect(consumeOnce('facu', contador + 1)).toBe(false);
  });

  it('los contadores viejos se olvidan y no llenan la memoria', () => {
    const ahora = Date.UTC(2026, 7, 27, 12, 0, 0);
    const viejo = Math.floor(ahora / 1000 / 30) - 100;

    consumeOnce('facu', viejo, ahora);
    // Mucho después, ese contador ya se ha limpiado; da igual, porque
    // `verifyTotp` tampoco aceptaría un código de hace tanto.
    expect(consumeOnce('facu', viejo, ahora + 3_600_000)).toBe(true);
  });

  it('un código de recuperación no vale dos veces', () => {
    expect(consumeRecovery('facu', 'abc123')).toBe(true);
    expect(consumeRecovery('facu', 'abc123')).toBe(false);
    // Otro código distinto del mismo usuario sí.
    expect(consumeRecovery('facu', 'def456')).toBe(true);
  });
});
