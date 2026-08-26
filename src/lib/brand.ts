/**
 * Identidad de marca de SUMA.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PUNTO ÚNICO DE CONFIGURACIÓN DE MARCA
 * ────────────────────────────────────────────────────────────────────────────
 * Todo el sistema (interfaz web y PDF) lee los colores, la tipografía y los
 * datos fiscales desde este archivo. Para adaptar el sistema a la identidad
 * corporativa oficial de https://www.gruposuma.eu basta con editar aquí.
 *
 * Los valores `colors` se exponen además como variables CSS en `globals.css`
 * (ver `--color-suma-*`), de modo que cambiarlos aquí y allí mantiene la web y
 * el PDF perfectamente sincronizados.
 */

/**
 * NOTA SOBRE LOS COLORES
 *
 * No ha sido posible acceder a https://www.gruposuma.eu desde el entorno de
 * desarrollo (la política de red del contenedor bloquea el dominio), de modo
 * que la paleta de abajo es una interpretación corporativa, no una captura del
 * manual de marca. El isotipo sí responde al significado del nombre: SUMA
 * suma, y la marca se construye sobre un signo «+».
 *
 * Para dejarlo exacto basta con sustituir aquí los seis primeros valores y los
 * `--color-suma-*` de `src/app/globals.css`. Nada más depende de ellos.
 */
export const brandColors = {
  /** Azul corporativo principal: cabeceras, botones primarios, marca. */
  primary: '#0E2A47',
  /** Variante clara del principal, para fondos y estados hover. */
  primarySoft: '#1B4571',
  /** Variante muy clara, para superficies tintadas. */
  primaryTint: '#E8EFF7',
  /** Naranja de acento: llamadas a la acción, resaltados, datos clave. */
  accent: '#F07C00',
  /** Variante clara del acento. */
  accentSoft: '#FFB25C',
  /** Variante muy clara del acento, para superficies tintadas. */
  accentTint: '#FFF2E2',
  /** Verde de confirmación (material añadido, disponibilidad). */
  success: '#137A4D',
  /** Ámbar de advertencia (precio estimado, baja confianza). */
  warning: '#B45309',
  /** Rojo de error. */
  danger: '#B42318',
  /** Texto principal. */
  ink: '#101828',
  /** Texto secundario. */
  inkMuted: '#5A6478',
  /** Bordes y separadores. */
  border: '#DCE3EC',
  /** Fondo de la aplicación. */
  surface: '#F6F8FB',
  /** Fondo de tarjetas. */
  surfaceRaised: '#FFFFFF',
} as const;

export type BrandColor = keyof typeof brandColors;

/**
 * Datos del emisor que aparecen en la cabecera del presupuesto y en el PDF.
 * Se pueden sobreescribir por entorno sin tocar código.
 */
export const company = {
  legalName: process.env.NEXT_PUBLIC_SUMA_LEGAL_NAME ?? 'Grupo SUMA',
  tradeName: 'SUMA',
  taxId: process.env.NEXT_PUBLIC_SUMA_TAX_ID ?? 'B00000000',
  address: process.env.NEXT_PUBLIC_SUMA_ADDRESS ?? 'Málaga, España',
  email: process.env.NEXT_PUBLIC_SUMA_EMAIL ?? 'info@gruposuma.eu',
  phone: process.env.NEXT_PUBLIC_SUMA_PHONE ?? '+34 000 000 000',
  website: process.env.NEXT_PUBLIC_SUMA_WEBSITE ?? 'www.gruposuma.eu',
  tagline: 'Presupuestos de construcción',
  slogan: 'En Grupo SUMA estamos para SUMAr',
  /**
   * Datos registrales. El artículo 24 del Código de Comercio obliga a las
   * sociedades mercantiles a hacerlos constar en su documentación, y un
   * presupuesto lo es. Si se deja vacío, no se imprimen.
   */
  registryDetails: process.env.NEXT_PUBLIC_SUMA_REGISTRY ?? '',
} as const;

/** Ámbito geográfico de la búsqueda de proveedores. */
export const searchScope = {
  province: 'Málaga',
  region: 'Andalucía',
  country: 'España',
  /** Municipios de la provincia usados para orientar la búsqueda. */
  towns: [
    'Málaga capital',
    'Marbella',
    'Estepona',
    'Fuengirola',
    'Mijas',
    'Torremolinos',
    'Benalmádena',
    'Vélez-Málaga',
    'Antequera',
    'Ronda',
    'Rincón de la Victoria',
    'Alhaurín de la Torre',
    'Coín',
    'Nerja',
  ],
} as const;
