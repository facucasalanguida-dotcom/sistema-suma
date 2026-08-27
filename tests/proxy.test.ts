import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { afterEach, describe, expect, it } from 'vitest';
import { proxy } from '@/proxy';
import { SESSION_COOKIE } from '@/lib/auth/session';

const PASSWORD = 'obra-2026';
const SECRET = 'una-clave-de-sesion-suficientemente-larga-1234';

function request(
  options: { path?: string; authorization?: string; sessionToken?: string } = {},
) {
  const headers: Record<string, string> = {};
  if (options.authorization !== undefined) headers.authorization = options.authorization;
  if (options.sessionToken) headers.cookie = `${SESSION_COOKIE}=${options.sessionToken}`;

  return new NextRequest(`https://presupuestos.gruposuma.eu${options.path ?? '/'}`, {
    headers,
  });
}

function basic(user: string, password: string) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}

/** Token de sesión válido, firmado igual que lo haría la aplicación. */
async function validSession(overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    sub: 'facu',
    nombre: 'Facu',
    via: 'contrasena',
    tipo: 'sesion',
    ver: '1',
    ...overrides,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer('suma-presupuestos')
    .setAudience('suma-app')
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));
}

afterEach(() => {
  delete process.env.SUMA_ACCESS_PASSWORD;
  delete process.env.SESSION_SECRET;
  delete process.env.SUMA_FORZAR_ACCESO;
  delete process.env.SUMA_USUARIOS;
  delete process.env.VERCEL;
});

describe('cabeceras de seguridad', () => {
  it('toda respuesta lleva una política de contenido con nonce', async () => {
    const csp = (await proxy(request())).headers.get('Content-Security-Policy') ?? '';

    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it('el nonce cambia en cada petición', async () => {
    const a = (await proxy(request())).headers.get('Content-Security-Policy');
    const b = (await proxy(request())).headers.get('Content-Security-Policy');
    expect(a).not.toBe(b);
  });

  it('no permite scripts en línea sin nonce', async () => {
    const csp = (await proxy(request())).headers.get('Content-Security-Policy') ?? '';
    // 'unsafe-inline' en script-src anularía toda la protección.
    const scriptSrc = csp.split(';').find((part) => part.includes('script-src')) ?? '';
    expect(scriptSrc).not.toContain('unsafe-inline');
  });
});

describe('con el sistema de cuentas configurado', () => {
  it('manda a la pantalla de acceso cuando no hay sesión', async () => {
    process.env.SESSION_SECRET = SECRET;
    const response = await proxy(request());

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/acceso');
  });

  it('deja pasar con una sesión válida', async () => {
    process.env.SESSION_SECRET = SECRET;
    const response = await proxy(request({ sessionToken: await validSession() }));
    expect(response.status).toBe(200);
  });

  it('rechaza un token firmado con otra clave', async () => {
    process.env.SESSION_SECRET = SECRET;
    const forged = await new SignJWT({
      sub: 'intruso',
      nombre: 'X',
      via: 'contrasena',
      tipo: 'sesion',
      ver: '1',
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setIssuer('suma-presupuestos')
      .setAudience('suma-app')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('otra-clave-distinta-pero-igual-de-larga'));

    expect((await proxy(request({ sessionToken: forged }))).status).toBe(307);
  });

  it('rechaza un token caducado', async () => {
    process.env.SESSION_SECRET = SECRET;
    const expired = await new SignJWT({
      sub: 'facu',
      nombre: 'F',
      via: 'contrasena',
      tipo: 'sesion',
      ver: '1',
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setIssuer('suma-presupuestos')
      .setAudience('suma-app')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(SECRET));

    expect((await proxy(request({ sessionToken: expired }))).status).toBe(307);
  });

  it('no acepta la marca de «a medio entrar» como sesión buena', async () => {
    process.env.SESSION_SECRET = SECRET;
    const pending = await validSession({ tipo: 'pendiente' });
    expect((await proxy(request({ sessionToken: pending }))).status).toBe(307);
  });

  it('rechaza un token sin firma (alg none)', async () => {
    process.env.SESSION_SECRET = SECRET;
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: 'intruso', nombre: 'X', via: 'contrasena', tipo: 'sesion' }),
    ).toString('base64url');

    expect((await proxy(request({ sessionToken: `${header}.${payload}.` }))).status).toBe(307);
  });

  it('cambiar AUTH_TOKEN_VERSION invalida las sesiones abiertas', async () => {
    process.env.SESSION_SECRET = SECRET;
    const token = await validSession();
    expect((await proxy(request({ sessionToken: token }))).status).toBe(200);

    // Es el interruptor de emergencia: sin base de datos, la única forma de
    // echar a todo el mundo si se sospecha que han robado una sesión.
    process.env.AUTH_TOKEN_VERSION = '2';
    expect((await proxy(request({ sessionToken: token }))).status).toBe(307);
    delete process.env.AUTH_TOKEN_VERSION;
  });

  it('la pantalla de acceso es pública, o nadie podría entrar', async () => {
    process.env.SESSION_SECRET = SECRET;
    expect((await proxy(request({ path: '/acceso' }))).status).toBe(200);
    expect((await proxy(request({ path: '/api/auth/google' }))).status).toBe(200);
  });

  it('las rutas de API contestan 401 en JSON, no una página', async () => {
    process.env.SESSION_SECRET = SECRET;
    const response = await proxy(request({ path: '/api/chat' }));

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('json');
  });

  it('una clave de sesión demasiado corta no activa el sistema', async () => {
    process.env.SESSION_SECRET = 'corta';
    // Sin cuentas ni contraseña compartida, se deja pasar como en local.
    expect((await proxy(request())).status).toBe(200);
  });
});

describe('despliegue sin acceso configurado', () => {
  /**
   * El fallo más peligroso de todos: que olvidar una variable en el despliegue
   * deje la herramienta abierta a Internet con una clave de IA de pago detrás.
   * Desplegado y sin puerta, no se sirve nada.
   */
  it('un despliegue sin ninguna puerta se cierra, no se abre', async () => {
    process.env.VERCEL = '1';
    const response = await proxy(request());

    expect(response.status).toBe(503);
    expect(await response.text()).toContain('SESSION_SECRET');
  });

  /**
   * El tropiezo real de la primera puesta en marcha: se pegan las cuentas y
   * se olvida la clave que las firma. El mensaje tiene que decir ESO, no un
   * genérico que obligue a adivinar cuál de las dos variables falta.
   */
  it('si están las cuentas pero falta la clave, lo dice con nombre y apellidos', async () => {
    process.env.VERCEL = '1';
    process.env.SUMA_USUARIOS = 'W3sidXN1YXJpbyI6ImZhY3UifV0=';

    const response = await proxy(request());
    const texto = await response.text();

    expect(response.status).toBe(503);
    expect(texto).toContain('SESSION_SECRET');
    expect(texto).toContain('SUMA_USUARIOS');
    expect(texto).toContain('Environment Variables');
  });

  it('una clave corta se distingue de una clave ausente', async () => {
    process.env.VERCEL = '1';
    process.env.SESSION_SECRET = 'corta';

    const texto = await (await proxy(request())).text();
    expect(texto).toContain('demasiado corta');
    expect(texto).toContain('32');
  });

  it('con la contraseña compartida puesta, el despliegue sí funciona', async () => {
    process.env.VERCEL = '1';
    process.env.SUMA_ACCESS_PASSWORD = PASSWORD;
    expect((await proxy(request())).status).toBe(401);
    expect((await proxy(request({ authorization: basic('x', PASSWORD) }))).status).toBe(200);
  });

  it('con cuentas configuradas, el despliegue manda al acceso', async () => {
    process.env.VERCEL = '1';
    process.env.SESSION_SECRET = SECRET;
    expect((await proxy(request())).status).toBe(307);
  });

  it('sin desplegar (local y pruebas) se sigue trabajando sin credenciales', async () => {
    expect((await proxy(request())).status).toBe(200);
  });
});

describe('compatibilidad con la contraseña compartida', () => {
  it('no estorba cuando no hay nada configurado', async () => {
    expect((await proxy(request())).status).toBe(200);
  });

  it('exige credenciales cuando hay contraseña', async () => {
    process.env.SUMA_ACCESS_PASSWORD = PASSWORD;
    const response = await proxy(request());
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('Basic realm=');
  });

  it('deja pasar con la contraseña correcta, sea cual sea el usuario', async () => {
    process.env.SUMA_ACCESS_PASSWORD = PASSWORD;
    expect((await proxy(request({ authorization: basic('suma', PASSWORD) }))).status).toBe(200);
    expect((await proxy(request({ authorization: basic('quien.sea', PASSWORD) }))).status).toBe(200);
  });

  it('rechaza la contraseña equivocada', async () => {
    process.env.SUMA_ACCESS_PASSWORD = PASSWORD;
    expect((await proxy(request({ authorization: basic('suma', 'incorrecta') }))).status).toBe(401);
    expect((await proxy(request({ authorization: basic('suma', '') }))).status).toBe(401);
  });

  it('no acepta un prefijo de la contraseña', async () => {
    process.env.SUMA_ACCESS_PASSWORD = PASSWORD;
    expect((await proxy(request({ authorization: basic('suma', 'obra') }))).status).toBe(401);
    expect(
      (await proxy(request({ authorization: basic('suma', `${PASSWORD}-de-mas`) }))).status,
    ).toBe(401);
  });

  it('tolera cabeceras malformadas sin reventar', async () => {
    process.env.SUMA_ACCESS_PASSWORD = PASSWORD;
    for (const bad of ['Basic no-es-base64-válido!!', 'Bearer token', 'Basic', '']) {
      expect((await proxy(request({ authorization: bad }))).status).toBe(401);
    }
  });

  it('admite contraseñas con dos puntos', async () => {
    process.env.SUMA_ACCESS_PASSWORD = 'a:b:c';
    expect((await proxy(request({ authorization: basic('suma', 'a:b:c') }))).status).toBe(200);
  });

  it('el sistema de cuentas tiene prioridad sobre la contraseña compartida', async () => {
    process.env.SESSION_SECRET = SECRET;
    process.env.SUMA_ACCESS_PASSWORD = PASSWORD;
    // Con cuentas configuradas, la contraseña compartida ya no abre nada.
    const response = await proxy(request({ authorization: basic('suma', PASSWORD) }));
    expect(response.status).toBe(307);
  });
});
