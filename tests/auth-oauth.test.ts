import { afterEach, describe, expect, it } from 'vitest';
import { callbackUrl } from '@/lib/auth/google';
import { OAUTH_COOKIES } from '@/lib/auth/oauth-cookies';

afterEach(() => {
  delete process.env.SUMA_URL_PUBLICA;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
});

describe('dirección de vuelta de Google', () => {
  const peticion = new Request('https://presupuestos.gruposuma.eu/api/auth/google');

  it('manda lo que configure el equipo, por encima de todo', () => {
    process.env.SUMA_URL_PUBLICA = 'https://presupuestos.gruposuma.eu/';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'otra-cosa.vercel.app';

    expect(callbackUrl(peticion)).toBe(
      'https://presupuestos.gruposuma.eu/api/auth/google/callback',
    );
  });

  it('si no, el dominio de producción que pone Vercel', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'suma.vercel.app';
    expect(callbackUrl(peticion)).toBe('https://suma.vercel.app/api/auth/google/callback');
  });

  it('y en último lugar, la propia petición', () => {
    expect(callbackUrl(peticion)).toBe(
      'https://presupuestos.gruposuma.eu/api/auth/google/callback',
    );
  });

  it('no se cuela una barra de más', () => {
    process.env.SUMA_URL_PUBLICA = 'https://suma.eu///';
    expect(callbackUrl(peticion)).toBe('https://suma.eu/api/auth/google/callback');
  });
});

describe('cookies de un solo uso del acceso con Google', () => {
  it('en pruebas y en local van sin prefijo, para que funcionen sobre http', () => {
    // NODE_ENV es 'test' aquí, así que se comprueba la variante sin prefijo.
    expect(OAUTH_COOKIES.state).toBe('suma_oauth_state');
    expect(OAUTH_COOKIES.nonce).toBe('suma_oauth_nonce');
    expect(OAUTH_COOKIES.verifier).toBe('suma_oauth_verifier');
  });

  it('los tres nombres son distintos', () => {
    const nombres = Object.values(OAUTH_COOKIES);
    expect(new Set(nombres).size).toBe(nombres.length);
  });
});
