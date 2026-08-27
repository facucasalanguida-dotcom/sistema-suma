'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { audit } from '@/lib/auth/audit';
import {
  checkRate,
  consumeOnce,
  consumeRecovery,
  registerFailure,
  registerSuccess,
} from '@/lib/auth/rate-limit';
import {
  createPendingSession,
  createSession,
  destroyPendingSession,
  destroySession,
  readPendingSession,
} from '@/lib/auth/session';
import { checkCredentials, checkRecoveryCode, checkTotp, findUser } from '@/lib/auth/users';

/**
 * Acciones de servidor de la pantalla de acceso.
 *
 * Se usan acciones de servidor —y no rutas de API— porque es lo que recomienda
 * Next.js 16 para los formularios: el código nunca llega al navegador, y el
 * propio marco protege la invocación contra peticiones de otros orígenes.
 *
 * Regla que se aplica en todo el fichero: los mensajes de error son siempre
 * genéricos. Decir «ese usuario no existe» le regala a quien lo intenta la
 * mitad del trabajo.
 */

export interface FormState {
  error?: string;
  /** Segundos de espera cuando hay bloqueo por intentos. */
  espera?: number;
}

const GENERIC_ERROR = 'Usuario o contraseña incorrectos.';

async function clientIp(): Promise<string> {
  const store = await headers();
  return (
    store.get('x-real-ip') ??
    store.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'desconocida'
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Paso 1: usuario y contraseña                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export async function iniciarSesion(_prev: FormState, formData: FormData): Promise<FormState> {
  const usuario = String(formData.get('usuario') ?? '').trim();
  const contrasena = String(formData.get('contrasena') ?? '');

  if (!usuario || !contrasena) {
    return { error: 'Escribe tu usuario y tu contraseña.' };
  }

  const ip = await clientIp();
  // Se frena por IP y por usuario: lo primero corta a quien prueba muchos
  // usuarios desde un sitio; lo segundo, a quien ataca una cuenta concreta
  // desde muchos sitios.
  const keys = [`ip:${ip}`, `usuario:${usuario.toLowerCase()}`];

  for (const key of keys) {
    const verdict = checkRate(key);
    if (!verdict.permitido) {
      audit('bloqueo-por-intentos', { usuario, ip });
      return {
        error: `Demasiados intentos. Espera ${verdict.esperaSegundos} segundos y vuelve a probar.`,
        espera: verdict.esperaSegundos,
      };
    }
  }

  const result = await checkCredentials(usuario, contrasena);

  if (!result.ok) {
    let espera = 0;
    for (const key of keys) {
      const verdict = registerFailure(key);
      espera = Math.max(espera, verdict.esperaSegundos);
    }
    audit('acceso-fallido', { usuario, ip });
    return espera > 0
      ? { error: `Demasiados intentos. Espera ${espera} segundos y vuelve a probar.`, espera }
      : { error: GENERIC_ERROR };
  }

  for (const key of keys) registerSuccess(key);

  if (result.necesitaSegundoFactor) {
    // Todavía NO se crea la sesión buena: sólo una marca de «a medio entrar».
    await createPendingSession({ sub: result.user.usuario, nombre: result.user.nombre });
    audit('acceso-correcto', { usuario, ip, motivo: 'falta-segundo-factor' });
    redirect('/acceso/codigo');
  }

  // Las cuentas creadas desde /acceso/alta SIEMPRE llevan segundo factor. Una
  // sin él sólo puede venir de editar la configuración a mano, así que se
  // avisa; y con SUMA_EXIGIR_2FA puesto, directamente no se deja entrar.
  if (process.env.SUMA_EXIGIR_2FA) {
    audit('acceso-fallido', { usuario, ip, motivo: 'cuenta-sin-segundo-factor' });
    return {
      error:
        'Esta cuenta no tiene segundo factor y el sistema lo exige. ' +
        'Pide que la vuelvan a dar de alta.',
    };
  }

  console.warn(
    `[suma:auditoria] AVISO: la cuenta «${result.user.usuario}» no tiene segundo factor.`,
  );
  await createSession({
    sub: result.user.usuario,
    nombre: result.user.nombre,
    via: 'contrasena',
  });
  audit('acceso-correcto', { usuario, ip, motivo: 'sin-segundo-factor' });
  redirect('/');
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Paso 2: código del segundo factor                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export async function verificarCodigo(_prev: FormState, formData: FormData): Promise<FormState> {
  const codigo = String(formData.get('codigo') ?? '').trim();
  const pending = await readPendingSession();

  if (!pending) {
    redirect('/acceso');
  }

  const ip = await clientIp();
  const key = `2fa:${pending.sub}`;

  const verdict = checkRate(key);
  if (!verdict.permitido) {
    audit('bloqueo-por-intentos', { usuario: pending.sub, ip, motivo: 'segundo-factor' });
    return {
      error: `Demasiados intentos. Espera ${verdict.esperaSegundos} segundos.`,
      espera: verdict.esperaSegundos,
    };
  }

  const user = findUser(pending.sub);
  if (!user) {
    await destroySession();
    redirect('/acceso');
  }

  // Primero el código del teléfono; si no cuadra, se prueba como código de
  // recuperación, que es el plan B de quien ha perdido el móvil.
  const counter = checkTotp(user, codigo);
  if (counter !== null) {
    // Un código sólo vale una vez: si alguien lo ha visto de reojo, ya no le
    // sirve aunque esté dentro de sus 30 segundos.
    if (!consumeOnce(user.usuario, counter)) {
      registerFailure(key);
      audit('segundo-factor-fallido', { usuario: user.usuario, ip, motivo: 'codigo-repetido' });
      return { error: 'Ese código ya se ha usado. Espera al siguiente.' };
    }

    registerSuccess(key);
    await createSession({ sub: user.usuario, nombre: user.nombre, via: 'contrasena' });
    audit('segundo-factor-correcto', { usuario: user.usuario, ip });
    redirect('/');
  }

  const usedRecovery = checkRecoveryCode(user, codigo);
  if (usedRecovery) {
    // Un código de recuperación es de un solo uso. Sin base de datos esto sólo
    // se puede garantizar dentro de la misma instancia, así que además se
    // avisa por el registro de que hay que retirarlo de la configuración.
    if (!consumeRecovery(user.usuario, usedRecovery)) {
      registerFailure(key);
      audit('segundo-factor-fallido', { usuario: user.usuario, ip, motivo: 'recuperacion-gastada' });
      return { error: 'Ese código de recuperación ya se ha usado. Prueba con otro.' };
    }

    registerSuccess(key);
    await createSession({ sub: user.usuario, nombre: user.nombre, via: 'contrasena' });
    audit('codigo-recuperacion-usado', { usuario: user.usuario, ip });
    console.warn(
      `[suma:auditoria] AVISO: código de recuperación consumido por ${user.usuario}. ` +
        'Retíralo de SUMA_USUARIOS y genera uno nuevo cuanto antes.',
    );
    redirect('/');
  }

  const failure = registerFailure(key);
  audit('segundo-factor-fallido', { usuario: user.usuario, ip });

  if (failure.esperaSegundos > 0) {
    // Al bloquearse, se tira también la marca de «a medio entrar»: para
    // reintentar hay que volver a poner la contraseña, y ese paso está
    // limitado por su cuenta y cuesta medio segundo de CPU cada vez. Así,
    // probar los seis dígitos a lo bruto deja de ser barato.
    await destroyPendingSession();
    return {
      error: `Demasiados intentos. Espera ${failure.esperaSegundos} segundos y vuelve a entrar.`,
      espera: failure.esperaSegundos,
    };
  }

  return { error: 'El código no es correcto. Comprueba la aplicación de tu teléfono.' };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Salir                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export async function cerrarSesion(): Promise<void> {
  audit('salida', { ip: await clientIp() });
  await destroySession();
  redirect('/acceso');
}
