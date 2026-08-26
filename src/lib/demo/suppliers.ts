import type { Supplier } from '../types';

/**
 * Directorio de distribuidores de material de construcción con presencia
 * contrastada en la provincia de Málaga.
 *
 * Cumple dos funciones:
 *
 *  1. **Anclar la búsqueda de la IA.** Se inyecta en el prompt para que Gemini
 *     priorice almacenes que realmente sirven en Málaga en lugar de inventar
 *     nombres verosímiles, que es el error más caro que puede cometer un
 *     sistema de presupuestos.
 *  2. **Modo demostración.** Cuando no hay `GEMINI_API_KEY`, el catálogo local
 *     usa estos proveedores para que el sistema sea navegable de principio a fin.
 *
 * Los teléfonos y las direcciones exactas de cada delegación se dejan fuera a
 * propósito: cambian con frecuencia y es preferible que el usuario los confirme
 * en la web del proveedor antes que mostrar un dato caducado en un presupuesto.
 */

export interface DirectorySupplier extends Supplier {
  /** Familias de material que distribuye. */
  specialties: string[];
  /** Cadena nacional con delegación, o almacén de la provincia. */
  scope: 'nacional' | 'provincial';
}

export const SUPPLIER_DIRECTORY: DirectorySupplier[] = [
  /* Almacenes generalistas ------------------------------------------------ */
  {
    name: 'Obramat Málaga',
    location: 'Málaga capital',
    website: 'obramat.es',
    phone: null,
    specialties: [
      'almacén generalista para profesionales',
      'cerámica',
      'fontanería',
      'electricidad',
      'madera',
      'ferretería',
    ],
    scope: 'nacional',
  },
  {
    name: 'BigMat Macosol',
    location: 'Málaga capital',
    website: 'bigmat.es',
    phone: null,
    specialties: ['almacén generalista', 'cemento y áridos', 'ladrillo y bloque', 'cerámica'],
    scope: 'nacional',
  },
  {
    name: 'BigMat La Juanita',
    location: 'Marbella',
    website: 'lajuanita.com',
    phone: null,
    specialties: ['almacén generalista', 'cerámica y decoración', 'baño'],
    scope: 'nacional',
  },
  {
    name: 'BigMat Guerrero',
    location: 'Coín',
    website: 'bigmat.es',
    phone: null,
    specialties: ['almacén generalista', 'cemento y áridos', 'prefabricados'],
    scope: 'nacional',
  },
  {
    name: 'BigMat Cano',
    location: 'Rincón de la Victoria',
    website: 'canomateriales.com',
    phone: null,
    specialties: ['almacén generalista', 'cerámica', 'ferretería'],
    scope: 'nacional',
  },
  {
    name: 'BigMat GO Estepona',
    location: 'Estepona',
    website: 'bigmat.es',
    phone: null,
    specialties: ['almacén generalista', 'cemento y áridos'],
    scope: 'nacional',
  },
  {
    name: 'BigMat La Toma',
    location: 'Ronda',
    website: 'bigmat.es',
    phone: null,
    specialties: ['almacén generalista', 'ferretería', 'pintura', 'azulejos', 'baño'],
    scope: 'nacional',
  },
  {
    name: 'Leroy Merlin',
    location: 'Málaga capital, Marbella y Fuengirola',
    website: 'leroymerlin.es',
    phone: null,
    specialties: ['bricolaje y reforma', 'pintura', 'cerámica', 'fontanería', 'ferretería'],
    scope: 'nacional',
  },
  {
    name: 'Guadalmansa',
    location: 'Estepona',
    website: 'guadalmansa.es',
    phone: null,
    specialties: ['áridos', 'almacén generalista', 'cerámica', 'baño y cocina'],
    scope: 'provincial',
  },
  {
    name: 'Matcon',
    location: 'Málaga capital',
    website: 'materialesdeconstruccionmatcon.es',
    phone: null,
    specialties: ['almacén generalista', 'prefabricados de hormigón', 'bordillos y adoquines'],
    scope: 'provincial',
  },
  {
    name: 'Almacenes Quero',
    location: 'Mijas, con servicio a Fuengirola, Marbella y Benalmádena',
    website: 'almacenesquero.es',
    phone: null,
    specialties: ['almacén generalista'],
    scope: 'provincial',
  },
  {
    name: 'Materiales de Construcción El Filete',
    location: 'Vélez-Málaga',
    website: null,
    phone: null,
    specialties: ['almacén generalista'],
    scope: 'provincial',
  },

  /* Yeso laminado, aislamiento y sistemas interiores ---------------------- */
  {
    name: 'Distriplac Málaga',
    location: 'Málaga capital',
    website: 'distriplac.com',
    phone: null,
    specialties: [
      'yeso laminado',
      'techos registrables',
      'aislamiento',
      'protección pasiva contra el fuego',
    ],
    scope: 'nacional',
  },
  {
    name: 'Isolana Málaga',
    location: 'Málaga capital',
    website: 'isolana.es',
    phone: null,
    specialties: ['aislamiento térmico y acústico', 'yeso laminado', 'SATE', 'impermeabilización'],
    scope: 'nacional',
  },
  {
    name: 'La Especialista Málaga',
    location: 'Málaga capital',
    website: 'laespecialista.es',
    phone: null,
    specialties: ['sistemas constructivos Knauf', 'acondicionamiento interior', 'yeso laminado'],
    scope: 'provincial',
  },

  /* Cemento, morteros, hormigón y áridos ---------------------------------- */
  {
    name: 'Grupo Puma',
    location: 'Planta en Campillos y delegación en Málaga capital',
    website: 'grupopuma.com',
    phone: null,
    specialties: ['morteros', 'sistemas SATE', 'adhesivos cerámicos', 'pavimentos', 'pinturas'],
    scope: 'nacional',
  },
  {
    name: 'Votorantim Cimentos España',
    location: 'Fábrica de La Araña, Málaga capital',
    website: 'votorantimcimentos.es',
    phone: null,
    specialties: ['cemento', 'clínker', 'morteros industriales'],
    scope: 'nacional',
  },
  {
    name: 'Cemex España',
    location: 'Plantas de hormigón con servicio en la provincia de Málaga',
    website: 'cemex.es',
    phone: null,
    specialties: ['hormigón preparado', 'cemento', 'áridos', 'morteros'],
    scope: 'nacional',
  },

  /* Cerámica y pavimentos -------------------------------------------------- */
  {
    name: 'Molina Caballero',
    location: 'Málaga capital',
    website: 'molinacaballero.com',
    phone: null,
    specialties: ['cerámica y azulejos', 'pavimentos', 'gran formato'],
    scope: 'provincial',
  },
  {
    name: 'Aparici Málaga',
    location: 'Málaga capital',
    website: 'aparicimalaga.com',
    phone: null,
    specialties: ['porcelánico', 'cerámica', 'mosaico'],
    scope: 'provincial',
  },
  {
    name: 'Lara, Cerámica y Obras',
    location: 'Alhaurín de la Torre',
    website: 'laracer.es',
    phone: null,
    specialties: ['azulejos', 'pavimentos'],
    scope: 'provincial',
  },
  {
    name: 'Anazul',
    location: 'Antequera',
    website: 'anazul.com',
    phone: null,
    specialties: ['azulejos', 'sanitarios', 'grifería', 'materiales'],
    scope: 'provincial',
  },
  {
    name: 'Porcelanosa',
    location: 'Málaga capital y Marbella',
    website: 'porcelanosa.com',
    phone: null,
    specialties: ['cerámica y porcelánico de gama alta', 'baño y cocina', 'pavimentos técnicos'],
    scope: 'nacional',
  },

  /* Cubiertas y prefabricados --------------------------------------------- */
  {
    name: 'Cerámica Crespillo y Gómez',
    location: 'Vélez-Málaga',
    website: 'ceramicacrespilloygomez.com',
    phone: null,
    specialties: ['fábrica de tejas', 'losas y ladrillos rústicos', 'cubiertas'],
    scope: 'provincial',
  },
  {
    name: 'DecoPrefabricados',
    location: 'Provincia de Málaga',
    website: 'decoprefabricados.es',
    phone: null,
    specialties: ['bloques', 'bordillos', 'arquetas', 'forjados', 'prefabricados de hormigón'],
    scope: 'provincial',
  },

  /* Fontanería y saneamiento ---------------------------------------------- */
  {
    name: 'Saneamientos Dimasa',
    location: 'Málaga capital y Marbella',
    website: 'saneamientosdimasa.es',
    phone: null,
    specialties: ['fontanería', 'sanitarios', 'PVC de evacuación', 'baño'],
    scope: 'provincial',
  },
  {
    name: 'Fontia Damaplast',
    location: 'Málaga capital',
    website: 'fontia.es',
    phone: null,
    specialties: ['fontanería', 'climatización', 'obra civil', 'energías renovables'],
    scope: 'provincial',
  },
  {
    name: 'Sanaxa',
    location: 'Vélez-Málaga y Torre del Mar',
    website: 'sanaxa.es',
    phone: null,
    specialties: ['fontanería', 'riego', 'piscinas', 'climatización', 'mobiliario de baño'],
    scope: 'provincial',
  },

  /* Material eléctrico ----------------------------------------------------- */
  {
    name: 'Onulec',
    location: 'Málaga capital, con reparto diario a toda la provincia',
    website: 'onulec.com',
    phone: null,
    specialties: ['material eléctrico', 'iluminación', 'cableado'],
    scope: 'provincial',
  },
  {
    name: 'SEM Málaga',
    location: 'Málaga capital',
    website: 'semmalaga.com',
    phone: null,
    specialties: ['material eléctrico', 'iluminación'],
    scope: 'provincial',
  },
  {
    name: 'Herma',
    location: 'Málaga capital',
    website: 'hermasl.es',
    phone: null,
    specialties: ['material eléctrico', 'iluminación', 'suministro industrial'],
    scope: 'provincial',
  },

  /* Madera ----------------------------------------------------------------- */
  {
    name: 'Maderas Atlantis',
    location: 'Málaga capital',
    website: 'maderasimportacion.es',
    phone: null,
    specialties: ['madera de importación', 'vigas y postes tratados', 'machihembrado'],
    scope: 'provincial',
  },
  {
    name: 'Maderas Santaella',
    location: 'Málaga capital',
    website: 'maderassantaella.com',
    phone: null,
    specialties: ['madera', 'tableros', 'melaminas', 'suelos'],
    scope: 'provincial',
  },
  {
    name: 'Comercial Andrade',
    location: 'Marbella',
    website: 'comercialandrade.com',
    phone: null,
    specialties: ['madera a medida', 'listones y vigas', 'madera tratada para exterior'],
    scope: 'provincial',
  },

  /* Ferretería ------------------------------------------------------------- */
  {
    name: 'Optimus',
    location: 'Marbella, Cártama y Torrox',
    website: 'optimusferreteria.com',
    phone: null,
    specialties: ['ferretería', 'herramienta', 'fijaciones'],
    scope: 'nacional',
  },
];

/** Resumen compacto del directorio para inyectar en el prompt de búsqueda. */
export function directoryForPrompt(): string {
  return SUPPLIER_DIRECTORY.map(
    (supplier) =>
      `- ${supplier.name} (${supplier.location}${supplier.website ? `, ${supplier.website}` : ''}): ` +
      supplier.specialties.join(', '),
  ).join('\n');
}
