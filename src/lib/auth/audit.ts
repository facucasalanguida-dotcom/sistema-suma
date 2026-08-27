import 'server-only';

/**
 * Registro de auditoría de los accesos.
 *
 * Se escribe en la consola del servidor, que en Vercel queda en el registro
 * del proyecto y se puede consultar y filtrar. No se guarda ningún dato
 * sensible: ni contraseñas, ni códigos, ni tokens; sólo qué ha pasado, con
 * quién y desde dónde, que es lo que hace falta para detectar un ataque.
 */

export type AuditEvent =
  | 'acceso-correcto'
  | 'acceso-fallido'
  | 'segundo-factor-correcto'
  | 'segundo-factor-fallido'
  | 'codigo-recuperacion-usado'
  | 'bloqueo-por-intentos'
  | 'salida'
  | 'google-correcto'
  | 'google-rechazado'
  | 'google-error';

export function audit(
  event: AuditEvent,
  details: { usuario?: string; ip?: string; motivo?: string } = {},
): void {
  const parts = [
    `[suma:auditoria] ${event}`,
    details.usuario ? `usuario=${redact(details.usuario)}` : null,
    details.ip ? `ip=${details.ip}` : null,
    details.motivo ? `motivo=${details.motivo}` : null,
  ].filter(Boolean);

  console.info(parts.join(' '));
}

/**
 * En el registro no hace falta el identificador entero: con el principio basta
 * para seguir un incidente sin dejar correos completos escritos en los logs.
 */
function redact(value: string): string {
  const clean = value.trim();
  if (clean.length <= 3) return '***';
  return `${clean.slice(0, 3)}***`;
}
