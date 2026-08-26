import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';
import { proxy } from '@/proxy';

const PASSWORD = 'obra-2026';

function request(authorization?: string) {
  return new NextRequest('https://presupuestos.gruposuma.eu/', {
    headers: authorization ? { authorization } : undefined,
  });
}

function basic(user: string, password: string) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}

afterEach(() => {
  delete process.env.SUMA_ACCESS_PASSWORD;
});

describe('puerta de acceso', () => {
  it('no estorba cuando no hay contraseña configurada', () => {
    expect(proxy(request()).status).toBe(200);
  });

  it('exige credenciales cuando hay contraseña', () => {
    process.env.SUMA_ACCESS_PASSWORD = PASSWORD;
    const response = proxy(request());
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('Basic realm=');
  });

  it('deja pasar con la contraseña correcta, sea cual sea el usuario', () => {
    process.env.SUMA_ACCESS_PASSWORD = PASSWORD;
    expect(proxy(request(basic('suma', PASSWORD))).status).toBe(200);
    expect(proxy(request(basic('quien.sea', PASSWORD))).status).toBe(200);
  });

  it('rechaza la contraseña equivocada', () => {
    process.env.SUMA_ACCESS_PASSWORD = PASSWORD;
    expect(proxy(request(basic('suma', 'incorrecta'))).status).toBe(401);
    expect(proxy(request(basic('suma', ''))).status).toBe(401);
  });

  it('no acepta un prefijo de la contraseña', () => {
    process.env.SUMA_ACCESS_PASSWORD = PASSWORD;
    expect(proxy(request(basic('suma', 'obra'))).status).toBe(401);
    expect(proxy(request(basic('suma', `${PASSWORD}-de-mas`))).status).toBe(401);
  });

  it('tolera cabeceras malformadas sin reventar', () => {
    process.env.SUMA_ACCESS_PASSWORD = PASSWORD;
    expect(proxy(request('Basic no-es-base64-válido!!')).status).toBe(401);
    expect(proxy(request('Bearer token')).status).toBe(401);
    expect(proxy(request('Basic')).status).toBe(401);
    expect(proxy(request('')).status).toBe(401);
  });

  it('admite contraseñas con dos puntos', () => {
    process.env.SUMA_ACCESS_PASSWORD = 'a:b:c';
    expect(proxy(request(basic('suma', 'a:b:c'))).status).toBe(200);
  });
});
