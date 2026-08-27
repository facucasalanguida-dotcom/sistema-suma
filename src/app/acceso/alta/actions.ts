'use server';

import { renderSVG } from 'uqr';
import { audit } from '@/lib/auth/audit';
import {
  formatSecretForHumans,
  generateRecoveryCodes,
  generateTotpSecret,
  hashPassword,
  safeEquals,
  totpUri,
} from '@/lib/auth/crypto';
import { getSession } from '@/lib/auth/dal';
import {
  encodeUsers,
  hashRecoveryCode,
  isAdmin,
  loadUsers,
  type StoredUser,
} from '@/lib/auth/users';

/**
 * Alta de usuarios.
 *
 * Sin base de datos, las cuentas viven en una variable de entorno. Para que
 * eso no obligue a nadie a pelearse con una terminal, esta pantalla hace todo
 * el trabajo: genera el hash de la contraseña, el secreto del segundo factor
 * con su código QR, los códigos de recuperación, y devuelve el valor completo
 * y listo para pegar en Vercel.
 *
 * Quién puede usarla:
 *  - quien ADMINISTRA las cuentas, o
 *  - quien sepa la contraseña de instalación (`SUMA_ACCESS_PASSWORD`), que es
 *    la única forma de crear la PRIMERA cuenta cuando aún no hay ninguna.
 *
 * El permiso de administración no es un adorno: el resultado incluye el valor
 * completo de `SUMA_USUARIOS`, con los hashes de contraseña y los secretos del
 * segundo factor de todo el equipo. Cualquiera con sesión NO puede verlo.
 */

export interface AltaState {
  error?: string;
  resultado?: {
    usuario: string;
    nombre: string;
    /** Valor completo de `SUMA_USUARIOS` para pegar en el entorno. */
    variable: string;
    /** Secreto del segundo factor, en grupos de cuatro. */
    secreto: string;
    /** Código QR ya dibujado como SVG. */
    qrSvg: string;
    codigosRecuperacion: string[];
    /** `true` si es la primera cuenta del sistema. */
    primera: boolean;
  };
}

export async function crearUsuario(_prev: AltaState, formData: FormData): Promise<AltaState> {
  const existentes = loadUsers();

  /* ── Permiso ────────────────────────────────────────────────────────── */
  const sesion = await getSession();

  if (sesion && !isAdmin(sesion.sub)) {
    audit('acceso-fallido', { usuario: sesion.sub, motivo: 'alta-sin-permiso-admin' });
    return {
      error:
        'Tu cuenta no puede dar de alta a otras personas. Pídeselo a quien administre el sistema.',
    };
  }

  if (!sesion) {
    const instalacion = process.env.SUMA_ACCESS_PASSWORD;
    const aportada = String(formData.get('instalacion') ?? '');

    if (!instalacion || !safeEquals(aportada, instalacion)) {
      audit('acceso-fallido', { motivo: 'alta-sin-permiso' });
      return { error: 'La contraseña de instalación no es correcta.' };
    }
    // Con la contraseña de instalación sólo se permite arrancar el sistema,
    // no añadir gente a un sistema que ya tiene cuentas: quien ya está dentro
    // tiene que hacerlo con su sesión.
    if (existentes.length > 0) {
      return {
        error:
          'Ya hay cuentas creadas. Entra con la tuya para poder dar de alta a otra persona.',
      };
    }
  }

  /* ── Datos ──────────────────────────────────────────────────────────── */
  const nombre = String(formData.get('nombre') ?? '').trim();
  const usuario = String(formData.get('usuario') ?? '').trim().toLowerCase();
  const correo = String(formData.get('correo') ?? '').trim().toLowerCase();
  const contrasena = String(formData.get('contrasena') ?? '');
  const repetir = String(formData.get('repetir') ?? '');

  if (!nombre || !usuario || !contrasena) {
    return { error: 'Rellena el nombre, el usuario y la contraseña.' };
  }
  if (!/^[a-z0-9._-]{3,32}$/.test(usuario)) {
    return {
      error: 'El usuario sólo admite letras, números, punto, guion y guion bajo (3 a 32).',
    };
  }
  if (contrasena !== repetir) {
    return { error: 'Las dos contraseñas no coinciden.' };
  }

  const fallo = validarContrasena(contrasena);
  if (fallo) return { error: fallo };

  if (correo && !correo.includes('@')) {
    return { error: 'El correo no parece válido.' };
  }
  if (existentes.some((entry) => entry.usuario === usuario)) {
    return { error: `Ya existe un usuario «${usuario}».` };
  }

  /* ── Generación ─────────────────────────────────────────────────────── */
  const secreto = generateTotpSecret();
  const codigos = generateRecoveryCodes();

  const nuevo: StoredUser = {
    usuario,
    nombre,
    correo: correo || undefined,
    hash: await hashPassword(contrasena),
    totp: secreto,
    recuperacion: codigos.map(hashRecoveryCode),
    // La primera cuenta administra; las demás, no, salvo que se marque a mano
    // en la configuración. Es el principio de dar el mínimo permiso posible.
    admin: existentes.length === 0,
  };

  const variable = encodeUsers([...existentes, nuevo]);
  const qrSvg = renderSVG(totpUri(secreto, correo || usuario), { border: 1 });

  audit('acceso-correcto', { usuario, motivo: 'alta-de-usuario' });

  return {
    resultado: {
      usuario,
      nombre,
      variable,
      secreto: formatSecretForHumans(secreto),
      qrSvg,
      codigosRecuperacion: codigos,
      primera: existentes.length === 0,
    },
  };
}

/**
 * Reglas de contraseña alineadas con lo que recomienda el NIST: lo que manda
 * es la longitud, no obligar a poner símbolos raros que la gente acaba
 * apuntando en un papel.
 */
function validarContrasena(password: string): string | null {
  if (password.length < 12) {
    return 'La contraseña debe tener al menos 12 caracteres. Una frase fácil de recordar vale.';
  }
  if (password.length > 200) {
    return 'La contraseña es demasiado larga.';
  }

  const comunes = [
    'contrasena', 'password', '123456', 'qwerty', 'suma', 'gruposuma',
    'admin', 'obra', 'presupuesto',
  ];
  const plana = password.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (comunes.some((mala) => plana === mala || plana === `${mala}1234`)) {
    return 'Esa contraseña es demasiado fácil de adivinar. Elige otra.';
  }

  return null;
}
