import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword, generateTotpSecret, totpCode } from '@/lib/auth/crypto';
import {
  allowedGoogleEmails,
  checkCredentials,
  checkRecoveryCode,
  checkTotp,
  encodeUsers,
  findUser,
  googleEmailAllowed,
  googleIsConfigured,
  hashRecoveryCode,
  loadUsers,
  type StoredUser,
} from '@/lib/auth/users';

const SECRET = generateTotpSecret();
let usuarios: StoredUser[];

beforeEach(async () => {
  usuarios = [
    {
      usuario: 'facu',
      nombre: 'Facu Casalanguida',
      correo: 'facu@gruposuma.eu',
      hash: await hashPassword('una frase larga de obra'),
      totp: SECRET,
      recuperacion: [hashRecoveryCode('aaaa-bbbb-cccc-dddd')],
    },
    {
      usuario: 'peon',
      nombre: 'Peón sin segundo factor',
      hash: await hashPassword('otra frase igual de larga'),
    },
  ];
  process.env.SUMA_USUARIOS = encodeUsers(usuarios);
});

afterEach(() => {
  delete process.env.SUMA_USUARIOS;
  delete process.env.SUMA_CORREOS_PERMITIDOS;
  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
});

describe('lectura de la configuración', () => {
  it('lee los usuarios codificados en base64', () => {
    expect(loadUsers().map((u) => u.usuario)).toEqual(['facu', 'peon']);
  });

  it('también admite JSON en claro, por si se edita a mano', () => {
    process.env.SUMA_USUARIOS = JSON.stringify(usuarios);
    expect(loadUsers()).toHaveLength(2);
  });

  it('una configuración rota no tumba el sistema: simplemente no hay usuarios', () => {
    process.env.SUMA_USUARIOS = 'esto-no-es-nada-válido';
    expect(loadUsers()).toEqual([]);

    process.env.SUMA_USUARIOS = Buffer.from('{"no":"es un array"}').toString('base64');
    expect(loadUsers()).toEqual([]);
  });

  it('descarta entradas sin usuario o sin hash', () => {
    process.env.SUMA_USUARIOS = encodeUsers([
      { usuario: '', nombre: 'X', hash: 'algo' } as StoredUser,
      { usuario: 'y', nombre: 'Y', hash: '' } as StoredUser,
      usuarios[0],
    ]);
    expect(loadUsers().map((u) => u.usuario)).toEqual(['facu']);
  });

  it('sin configuración no hay ningún usuario', () => {
    delete process.env.SUMA_USUARIOS;
    expect(loadUsers()).toEqual([]);
  });
});

describe('búsqueda de usuario', () => {
  it('encuentra por nombre de acceso y por correo, sin distinguir mayúsculas', () => {
    expect(findUser('facu')?.usuario).toBe('facu');
    expect(findUser('FACU')?.usuario).toBe('facu');
    expect(findUser('  Facu@GrupoSuma.eu ')?.usuario).toBe('facu');
  });

  it('devuelve null para quien no existe', () => {
    expect(findUser('intruso')).toBeNull();
    expect(findUser('')).toBeNull();
  });
});

describe('credenciales', () => {
  it('acepta la contraseña correcta', async () => {
    const result = await checkCredentials('facu', 'una frase larga de obra');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.necesitaSegundoFactor).toBe(true);
  });

  it('rechaza la contraseña incorrecta', async () => {
    expect((await checkCredentials('facu', 'mala')).ok).toBe(false);
  });

  it('un usuario sin segundo factor lo indica', async () => {
    const result = await checkCredentials('peon', 'otra frase igual de larga');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.necesitaSegundoFactor).toBe(false);
  });

  it('no se puede entrar con la contraseña de otro', async () => {
    expect((await checkCredentials('peon', 'una frase larga de obra')).ok).toBe(false);
  });

  /**
   * Si responder «no existe» fuera más rápido que «contraseña mala», medir el
   * tiempo bastaría para saber qué usuarios hay. El señuelo lo iguala.
   */
  it('tarda lo mismo con un usuario inexistente que con uno real', async () => {
    const t0 = Date.now();
    await checkCredentials('facu', 'contraseña incorrecta');
    const conocido = Date.now() - t0;

    const t1 = Date.now();
    await checkCredentials('no-existe-este-usuario', 'contraseña incorrecta');
    const desconocido = Date.now() - t1;

    // Basta con que sean del mismo orden: lo que se evita es la diferencia
    // evidente entre «medio segundo» y «respuesta inmediata».
    expect(desconocido).toBeGreaterThan(conocido * 0.4);
  });
});

describe('segundo factor y recuperación', () => {
  it('acepta el código del momento y rechaza otro', () => {
    const user = findUser('facu')!;
    expect(checkTotp(user, totpCode(SECRET))).not.toBeNull();
    expect(checkTotp(user, '000000')).toBeNull();
  });

  it('un usuario sin segundo factor nunca lo supera', () => {
    expect(checkTotp(findUser('peon')!, '123456')).toBeNull();
  });

  it('acepta un código de recuperación válido y sólo ese', () => {
    const user = findUser('facu')!;
    expect(checkRecoveryCode(user, 'aaaa-bbbb-cccc-dddd')).not.toBeNull();
    expect(checkRecoveryCode(user, 'AAAA-BBBB-CCCC-DDDD')).not.toBeNull();
    expect(checkRecoveryCode(user, 'zzzz-zzzz-zzzz-zzzz')).toBeNull();
  });

  it('los códigos de recuperación se guardan hasheados, no en claro', () => {
    const stored = loadUsers()[0].recuperacion ?? [];
    expect(stored[0]).not.toContain('aaaa');
    expect(stored[0]).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('acceso con Google', () => {
  it('no está disponible sin credenciales ni lista de correos', () => {
    expect(googleIsConfigured()).toBe(false);
  });

  it('se activa con las tres variables puestas', () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'secreto';
    process.env.SUMA_CORREOS_PERMITIDOS = 'jefe@gruposuma.eu';
    expect(googleIsConfigured()).toBe(true);
  });

  it('la lista de correos se limpia de espacios y mayúsculas', () => {
    process.env.SUMA_CORREOS_PERMITIDOS = ' Jefe@GrupoSuma.eu , otro@x.com ,basura, ';
    expect(allowedGoogleEmails()).toEqual(['jefe@gruposuma.eu', 'otro@x.com']);
  });

  it('sólo entran los correos autorizados', () => {
    process.env.SUMA_CORREOS_PERMITIDOS = 'jefe@gruposuma.eu';

    expect(googleEmailAllowed('jefe@gruposuma.eu')).toBe(true);
    expect(googleEmailAllowed('JEFE@gruposuma.eu')).toBe(true);
    // El correo de un usuario dado de alta también vale.
    expect(googleEmailAllowed('facu@gruposuma.eu')).toBe(true);

    expect(googleEmailAllowed('intruso@gmail.com')).toBe(false);
    expect(googleEmailAllowed('')).toBe(false);
    expect(googleEmailAllowed('jefe@gruposuma.eu.malicioso.com')).toBe(false);
  });

  it('sin lista configurada no entra nadie por Google que no sea usuario', () => {
    expect(googleEmailAllowed('cualquiera@gmail.com')).toBe(false);
  });
});
