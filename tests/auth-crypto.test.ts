import { describe, expect, it } from 'vitest';
import {
  TOTP_PERIOD_SECONDS,
  base32Decode,
  base32Encode,
  formatSecretForHumans,
  generateRecoveryCodes,
  generateTotpSecret,
  hashPassword,
  randomToken,
  safeEquals,
  totpCode,
  totpUri,
  verifyPassword,
  verifyTotp,
} from '@/lib/auth/crypto';

describe('contraseñas', () => {
  it('el hash verifica la contraseña correcta y rechaza las demás', async () => {
    const hash = await hashPassword('Contraseña de obra 2026');

    expect(await verifyPassword('Contraseña de obra 2026', hash)).toBe(true);
    expect(await verifyPassword('contraseña de obra 2026', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('dos hashes de la misma contraseña son distintos (sal aleatoria)', async () => {
    const a = await hashPassword('misma');
    const b = await hashPassword('misma');
    expect(a).not.toBe(b);
    expect(await verifyPassword('misma', a)).toBe(true);
    expect(await verifyPassword('misma', b)).toBe(true);
  });

  it('el hash guarda sus parámetros y no la contraseña', async () => {
    const hash = await hashPassword('secreta');
    expect(hash.startsWith('scrypt$131072$8$1$')).toBe(true);
    expect(hash).not.toContain('secreta');
  });

  it('un hash corrupto o vacío no lanza, sólo falla', async () => {
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'basura')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$1$1$1$$')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$a$b$c$d$e')).toBe(false);
  });

  it('las contraseñas equivalentes en Unicode se tratan igual', async () => {
    // «á» compuesta frente a «á» descompuesta: el usuario ve lo mismo.
    const hash = await hashPassword('camión');
    expect(await verifyPassword('camión', hash)).toBe(true);
  });
});

describe('safeEquals', () => {
  it('compara sin filtrar por longitud', () => {
    expect(safeEquals('abc', 'abc')).toBe(true);
    expect(safeEquals('abc', 'abd')).toBe(false);
    expect(safeEquals('abc', 'abcd')).toBe(false);
    expect(safeEquals('', '')).toBe(true);
  });
});

describe('base32', () => {
  it('ida y vuelta conserva los bytes', () => {
    const data = Buffer.from([0, 1, 2, 250, 255, 128, 64]);
    expect(base32Decode(base32Encode(data)).equals(data)).toBe(true);
  });

  it('acepta minúsculas, espacios y relleno', () => {
    const secret = generateTotpSecret();
    const messy = `${secret.toLowerCase().replace(/(.{4})/g, '$1 ')}==`;
    expect(base32Decode(messy).equals(base32Decode(secret))).toBe(true);
  });

  it('rechaza caracteres fuera del alfabeto', () => {
    expect(() => base32Decode('AAAA1111')).toThrow();
  });
});

describe('segundo factor TOTP', () => {
  it('acepta el código del momento', () => {
    const secret = generateTotpSecret();
    const now = Date.UTC(2026, 7, 27, 12, 0, 0);
    expect(verifyTotp(secret, totpCode(secret, now), now)).not.toBeNull();
  });

  it('tolera un periodo de desfase de reloj, pero no dos', () => {
    const secret = generateTotpSecret();
    const now = Date.UTC(2026, 7, 27, 12, 0, 0);
    const step = TOTP_PERIOD_SECONDS * 1000;

    expect(verifyTotp(secret, totpCode(secret, now - step), now)).not.toBeNull();
    expect(verifyTotp(secret, totpCode(secret, now + step), now)).not.toBeNull();
    expect(verifyTotp(secret, totpCode(secret, now - 2 * step), now)).toBeNull();
    expect(verifyTotp(secret, totpCode(secret, now + 2 * step), now)).toBeNull();
  });

  it('devuelve el contador, para poder impedir que se repita un código', () => {
    const secret = generateTotpSecret();
    const now = Date.UTC(2026, 7, 27, 12, 0, 0);
    const counter = verifyTotp(secret, totpCode(secret, now), now);
    expect(counter).toBe(Math.floor(now / 1000 / TOTP_PERIOD_SECONDS));
  });

  it('rechaza lo que no sean seis dígitos', () => {
    const secret = generateTotpSecret();
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 56 78']) {
      expect(verifyTotp(secret, bad)).toBeNull();
    }
  });

  it('un secreto inválido no lanza', () => {
    expect(verifyTotp('no-es-base32-!!', '123456')).toBeNull();
  });

  it('el código cambia al pasar de periodo', () => {
    const secret = generateTotpSecret();
    const now = Date.UTC(2026, 7, 27, 12, 0, 0);
    expect(totpCode(secret, now)).not.toBe(
      totpCode(secret, now + TOTP_PERIOD_SECONDS * 1000),
    );
  });

  /**
   * Vector de prueba del RFC 6238 (apéndice B): con el secreto ASCII
   * «12345678901234567890» y T=59 s, el código SHA-1 de 6 dígitos es 287082.
   */
  it('coincide con el vector de prueba del RFC 6238', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890', 'ascii'));
    expect(totpCode(secret, 59_000)).toBe('287082');
    expect(totpCode(secret, 1_111_111_109_000)).toBe('081804');
    expect(totpCode(secret, 1_234_567_890_000)).toBe('005924');
  });
});

describe('enrolamiento', () => {
  it('la URL otpauth lleva lo que necesitan las aplicaciones', () => {
    const secret = generateTotpSecret();
    const uri = totpUri(secret, 'facu@gruposuma.eu');

    expect(uri.startsWith('otpauth://totp/GRUPO%20SUMA:facu%40gruposuma.eu?')).toBe(true);
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });

  it('el secreto se muestra en grupos de cuatro', () => {
    expect(formatSecretForHumans('ABCDEFGHIJKLMNOP')).toBe('ABCD EFGH IJKL MNOP');
  });

  it('los códigos de recuperación son únicos y con formato legible', () => {
    const codes = generateRecoveryCodes(8);
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const code of codes) expect(code).toMatch(/^[a-z2-7]{4}(-[a-z2-7]{4}){3}$/);
  });

  it('cada secreto y cada token son distintos', () => {
    expect(new Set(Array.from({ length: 20 }, () => generateTotpSecret())).size).toBe(20);
    expect(new Set(Array.from({ length: 20 }, () => randomToken())).size).toBe(20);
  });
});
