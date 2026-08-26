/**
 * Identidad de marca de GRUPO SUMA.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PUNTO ÚNICO DE CONFIGURACIÓN DE MARCA
 * ────────────────────────────────────────────────────────────────────────────
 * Toda la aplicación y el PDF leen los colores desde aquí. Los valores de
 * `brandColors` se replican como variables CSS en `globals.css` (`--color-suma-*`),
 * de modo que la web y el documento se mantienen sincronizados.
 *
 * La identidad es la de gruposuma.eu: fondo casi negro, rojo corporativo y
 * tipografía blanca. El logotipo es el wordmark «GRUPO SUMA +», con «GRUPO»
 * girado en vertical y el signo «+» en rojo.
 */

export const brandColors = {
  /** Rojo corporativo: el «+» del logotipo, acciones principales y acentos. */
  red: '#E1252C',
  /** Rojo aclarado, para estados de foco y sobre fondo oscuro. */
  redBright: '#FF4B52',
  /** Rojo profundo, para estados pulsados y para lo que se imprime. */
  redDeep: '#A4161C',
  /** Superficie tintada de rojo sobre fondo oscuro. */
  redTint: '#2B1216',

  /** Fondo general de la aplicación. */
  canvas: '#0B0B0F',
  /** Paneles y barras. */
  surface: '#131419',
  /** Tarjetas sobre los paneles. */
  raised: '#1B1C22',
  /** Campos de formulario y elementos interactivos. */
  high: '#24252C',

  /** Bordes visibles. */
  border: '#2F3037',
  /** Separadores discretos. */
  borderSoft: '#212228',

  /** Texto principal. */
  ink: '#F4F4F6',
  /** Texto secundario. */
  muted: '#A3A5AE',
  /** Texto terciario y marcadores de posición. */
  faint: '#6C6E77',

  /** Verde de confirmación, calibrado para leerse sobre fondo oscuro. */
  success: '#3CC98D',
  /** Ámbar de advertencia (precio estimado, modo demostración). */
  warning: '#F2A93B',
  /** Rojo de error, distinguible del rojo de marca. */
  danger: '#FF5C61',
} as const;

/**
 * Paleta del PDF.
 *
 * Un presupuesto se imprime y se archiva, así que el cuerpo va en blanco: un
 * documento con fondo negro gasta tóner, se lee peor en papel y no es lo que
 * espera recibir un cliente. La marca entra por las bandas —cabecera, cabecera
 * de tabla, bloque de total y filetes—, que sí van en el negro y el rojo de
 * SUMA.
 */
export const printColors = {
  paper: '#FFFFFF',
  /** Negro de marca para las bandas del documento. */
  band: '#101116',
  bandSoft: '#1B1C22',
  red: '#D2202A',
  redDeep: '#A4161C',
  redTint: '#FCEFF0',
  ink: '#16171C',
  muted: '#5C5E68',
  border: '#DCDDE2',
  tint: '#F5F6F8',
  success: '#15794F',
  warning: '#A2560B',
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
  /** Los tres servicios que encabezan la web. */
  tagline: 'Diseño interior · Reformas · Construcción',
  slogan: 'Transformamos espacios',
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
