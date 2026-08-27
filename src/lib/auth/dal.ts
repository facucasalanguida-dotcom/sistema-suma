import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { authIsConfigured, isDeployed, readSession, type SessionData } from './session';

/**
 * Capa de acceso: el único sitio donde se decide si alguien puede pasar.
 *
 * La documentación de Next.js insiste en que la comprobación del proxy es
 * «optimista» y no debe ser la única defensa: quien sirve los datos tiene que
 * volver a comprobar la sesión. Por eso todas las rutas y páginas que tocan
 * datos pasan por aquí.
 *
 * `cache` de React memoriza el resultado dentro de un mismo renderizado, así
 * que verificar la sesión en varios sitios de la misma página no cuesta más.
 */

/** La sesión actual, o `null`. No redirige: sirve para decidir qué pintar. */
export const getSession = cache(async (): Promise<SessionData | null> => {
  if (!authIsConfigured()) return null;
  return readSession();
});

/**
 * Exige sesión. Si no la hay, manda a la pantalla de acceso.
 *
 * El atajo del usuario ficticio existe SÓLO fuera de un despliegue real, para
 * poder trabajar en local y pasar las pruebas sin montar credenciales. En un
 * despliegue, si no hay sistema de cuentas configurado no se inventa ninguna
 * sesión: se manda al acceso, y el proxy ya habrá contestado antes que el
 * sistema está sin configurar.
 */
export const requireSession = cache(async (): Promise<SessionData> => {
  if (!authIsConfigured()) {
    if (isDeployed() || !localAllowed()) redirect('/acceso');
    return { sub: 'local', nombre: 'Equipo SUMA', via: 'contrasena' };
  }

  const session = await readSession();
  if (!session) redirect('/acceso');
  return session;
});

/**
 * Versión para las rutas de API: en lugar de redirigir devuelve `null`, para
 * poder responder con un 401 en JSON en vez de con una página HTML.
 */
export async function sessionForApi(): Promise<SessionData | null> {
  if (!authIsConfigured()) {
    // Mismo criterio: en un despliegue sin cuentas configuradas, ninguna ruta
    // de API sirve datos ni gasta la clave de la IA.
    return isDeployed() || !localAllowed()
      ? null
      : { sub: 'local', nombre: 'Equipo SUMA', via: 'contrasena' };
  }
  return readSession();
}

/**
 * Segunda condición, deliberadamente independiente de `isDeployed()`.
 *
 * La documentación de Next.js insiste en que esta capa es la que de verdad
 * protege los datos, así que no debe depender de la misma única función que
 * el proxy: si aquélla se equivoca, ésta todavía cierra. Sólo se admite la
 * sesión ficticia fuera de una compilación de producción, o cuando se ha
 * pedido explícitamente trabajar en abierto.
 */
function localAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.SUMA_ABIERTO_EN_LOCAL === '1';
}
