import type { MeasureUnit, SaleUnit } from '../units';
import type { PriceConfidence, SupplierOffer } from '../types';
import { SUPPLIER_DIRECTORY } from './suppliers';

/**
 * Catálogo local de materiales para el **modo demostración**.
 *
 * Se usa cuando no hay `GEMINI_API_KEY` configurada, y también como red de
 * seguridad si la búsqueda con IA falla. Los precios son rangos de mercado
 * orientativos para la provincia de Málaga, sin IVA: la interfaz los etiqueta
 * siempre como estimados para que nadie los confunda con una tarifa en firme.
 */

interface DemoVariant {
  supplier: string;
  productName: string;
  brand: string;
  price: number;
  saleUnit: SaleUnit;
  coverage: { value: number; unit: MeasureUnit; note: string };
  specs: Array<{ key: string; value: string }>;
  availability: string;
  delivery: string;
  highlight: string;
  confidence: PriceConfidence;
  /**
   * Ficha del producto en la tienda, para comprarlo directamente. Los enlaces
   * proceden de una investigación con verificación cruzada; los catálogos
   * cambian, así que si uno se rompe basta con actualizarlo aquí.
   */
  sourceUrl?: string;
}

interface DemoProduct {
  id: string;
  /** Términos que disparan esta coincidencia, en minúsculas y sin tildes. */
  keywords: string[];
  category: string;
  typicalMeasureUnit: MeasureUnit;
  recommendedWastePct: number;
  variants: DemoVariant[];
}

/**
 * Los productos y precios proceden de una investigación de agosto de 2026 con
 * verificación cruzada: cada ficha se localizó por búsqueda web y se
 * re-verificó de forma independiente. Los precios de tienda son PVP con IVA;
 * aquí se guardan SIN IVA (PVP ÷ 1,21, anotando el PVP en la ficha técnica)
 * porque el motor del presupuesto añade el IVA al final. Los catálogos de las
 * tiendas cambian: si una ficha muere o un precio baila, se actualiza aquí.
 */
const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: 'porcelanico',
    keywords: [
      'porcelanico', 'porcelanica', 'ceramica', 'ceramico', 'azulejo', 'baldosa',
      'pavimento', 'suelo', 'gres', 'plaqueta', 'solado', 'alicatado', 'losa',
    ],
    category: 'Cerámica y pavimentos',
    typicalMeasureUnit: 'm2',
    recommendedWastePct: 10,
    variants: [
      {
        supplier: 'Obramat Málaga',
        productName: 'Suelo porcelánico Altea gris 60×60 cm',
        brand: 'Obramat',
        price: 8.21,
        saleUnit: 'm2',
        coverage: { value: 1, unit: 'm2', note: 'precio por metro cuadrado, venta por cajas' },
        specs: [
          { key: 'Formato', value: '60 × 60 cm' },
          { key: 'PVP web', value: '9,94 €/m² IVA incluido' },
          { key: 'Uso', value: 'Interior residencial' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde el almacén de Málaga',
        highlight: 'La más económica con ficha verificada',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/suelo-porcelanico-60x60cm-altea-gris-25073517.html',
      },
      {
        supplier: 'Leroy Merlin',
        productName: 'Suelo porcelánico Arcano efecto cemento beige 60×60 cm C1',
        brand: 'Artens',
        price: 9.08,
        saleUnit: 'm2',
        coverage: { value: 1, unit: 'm2', note: 'precio por metro cuadrado; caja de ≈ 1,08 m²' },
        specs: [
          { key: 'Formato', value: '60 × 60 cm' },
          { key: 'Clase', value: 'C1 (interior)' },
          { key: 'PVP web', value: '10,99 €/m² IVA incluido' },
          { key: 'Fabricación', value: 'España' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en tienda o envío a domicilio',
        highlight: 'Efecto cemento actual a buen precio',
        confidence: 'media',
        sourceUrl: 'https://www.leroymerlin.es/productos/suelo-porcelanico-arcano-efecto-cemento-beige-60x60-cm-c1-87542742.html',
      },
      {
        supplier: 'Leroy Merlin',
        productName: 'Suelo porcelánico Martins efecto cemento gris 60×60 cm C3',
        brand: 'Artens',
        price: 16.45,
        saleUnit: 'm2',
        coverage: { value: 1, unit: 'm2', note: 'precio por m²; caja de 4 piezas = 1,44 m²' },
        specs: [
          { key: 'Formato', value: '60 × 60 cm' },
          { key: 'Clase', value: 'C3 (apto exterior y zonas de paso)' },
          { key: 'PVP web', value: '19,90 €/m² IVA incluido (28,66 €/caja)' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en tienda o envío a domicilio',
        highlight: 'Clase 3: vale también para terraza',
        confidence: 'media',
        sourceUrl: 'https://www.leroymerlin.es/productos/suelo-porcelanico-martins-efecto-cemento-gris-60x60-cm-c3-artens-87551971.html',
      },
    ],
  },
  {
    id: 'cemento',
    keywords: ['cemento', 'cem ii', 'cem i', 'saco de cemento', 'portland', 'cemento gris'],
    category: 'Cemento y áridos',
    typicalMeasureUnit: 'kg',
    recommendedWastePct: 0,
    variants: [
      {
        supplier: 'Obramat Málaga',
        productName: 'Cemento gris 32,5 N, saco de 25 kg',
        brand: 'Obramat',
        price: 3.14,
        saleUnit: 'saco',
        coverage: { value: 25, unit: 'kg', note: 'saco de 25 kg' },
        specs: [
          { key: 'Tipo', value: '32,5 N, uso general' },
          { key: 'PVP web', value: '3,80 €/saco IVA incluido' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde Málaga',
        highlight: 'El saco más barato con ficha verificada',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/cemento-gris-32-5n-25-kg-10677982.html',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Cemento gris Cemex ECO+ SR 32,5 N sulforresistente, saco de 25 kg',
        brand: 'Cemex',
        price: 3.54,
        saleUnit: 'saco',
        coverage: { value: 25, unit: 'kg', note: 'saco de 25 kg' },
        specs: [
          { key: 'Tipo', value: '32,5 N sulforresistente (SR)' },
          { key: 'PVP web', value: '4,28 €/saco IVA incluido' },
          { key: 'Uso', value: 'Ambientes con sulfatos: saneamiento, costa' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde Málaga',
        highlight: 'Sulforresistente, indicado en obra costera',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/cemento-gris-cemex-eco-sr-32-5n-25-kg-10799432.html',
      },
      {
        supplier: 'Leroy Merlin',
        productName: 'Cemento gris 32,5 N CEM II/B-L Valderrivas, saco de 25 kg',
        brand: 'Valderrivas',
        price: 3.96,
        saleUnit: 'saco',
        coverage: { value: 25, unit: 'kg', note: 'saco de 25 kg' },
        specs: [
          { key: 'Tipo', value: 'CEM II/B-L 32,5 N' },
          { key: 'PVP web', value: '4,79 €/saco IVA incluido' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en tienda o envío a domicilio',
        highlight: 'Marca de cementera, disponible en tienda',
        confidence: 'media',
        sourceUrl: 'https://www.leroymerlin.es/productos/saco-cemento-gris-32-5-n-cem-ii-b-l-valderrivas-25-kg-18693780.html',
      },
    ],
  },
  {
    id: 'cemento-cola',
    keywords: [
      'cemento cola', 'adhesivo', 'mortero cola', 'c2te', 'c1', 'pegamento',
      'adhesivo ceramico', 'cola de baldosa',
    ],
    category: 'Morteros y adhesivos',
    typicalMeasureUnit: 'm2',
    recommendedWastePct: 5,
    variants: [
      {
        supplier: 'Obramat Málaga',
        productName: 'Cemento cola Capaland Plus C1TE gris, saco de 25 kg',
        brand: 'Capaland',
        price: 2.07,
        saleUnit: 'saco',
        coverage: {
          value: 6,
          unit: 'm2',
          note: 'rendimiento ≈ 4 kg/m² en cerámica absorbente; saco de 25 kg',
        },
        specs: [
          { key: 'Clasificación', value: 'C1 TE' },
          { key: 'PVP web', value: '2,50 €/saco IVA incluido' },
          { key: 'Uso', value: 'Cerámica convencional en interior' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde Málaga',
        highlight: 'Imbatible para alicatado convencional',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/cemento-cola-capaland-plus-25kg-gris-10586373.html',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Cemento cola Aplicacer Super Porcelánico C2TE blanco, saco de 25 kg',
        brand: 'Aplicacer',
        price: 6.57,
        saleUnit: 'saco',
        coverage: {
          value: 5,
          unit: 'm2',
          note: 'rendimiento ≈ 5 kg/m² con llana de 8 mm; saco de 25 kg',
        },
        specs: [
          { key: 'Clasificación', value: 'C2 TE' },
          { key: 'PVP web', value: '7,95 €/saco IVA incluido' },
          { key: 'Uso', value: 'Gres porcelánico, interior y exterior' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde Málaga',
        highlight: 'C2TE para porcelánico a precio de almacén',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/cemento-cola-aplicacer-super-porcelanico-c2te-25kg-blanco-10818850.html',
      },
      {
        supplier: 'Leroy Merlin',
        productName: 'Mortero cola porcelánico gel Axton blanco, saco de 25 kg',
        brand: 'Axton',
        price: 8.37,
        saleUnit: 'saco',
        coverage: {
          value: 5,
          unit: 'm2',
          note: 'rendimiento ≈ 5 kg/m²; saco de 25 kg',
        },
        specs: [
          { key: 'Tipo', value: 'Gel para porcelánico y gran formato' },
          { key: 'PVP web', value: '10,13 €/saco IVA incluido' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en tienda o envío a domicilio',
        highlight: 'Tecnología gel: agarre en gran formato',
        confidence: 'media',
        sourceUrl: 'https://www.leroymerlin.es/productos/mortero-cola-porcelanico-gel-axton-blanco-25-kg-81928410.html',
      },
    ],
  },
  {
    id: 'pladur',
    keywords: [
      'pladur', 'yeso laminado', 'placa de yeso', 'cartón yeso', 'carton yeso',
      'tabique', 'falso techo', 'pyl',
    ],
    category: 'Yeso laminado y tabiquería seca',
    typicalMeasureUnit: 'm2',
    recommendedWastePct: 10,
    variants: [
      {
        supplier: 'Leroy Merlin',
        productName: 'Placa de yeso laminado hidrófuga PPM 13 mm, 2.500 × 1.200 mm',
        brand: 'Genérica',
        price: 10.59,
        saleUnit: 'placa',
        coverage: { value: 3, unit: 'm2', note: 'placa de 2,50 × 1,20 m = 3,00 m²' },
        specs: [
          { key: 'Espesor', value: '13 mm' },
          { key: 'Tipo', value: 'Hidrófuga (PPM), para zonas húmedas' },
          { key: 'PVP web', value: '12,81 €/placa IVA incluido' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en tienda o envío a domicilio',
        highlight: 'Hidrófuga al mejor precio verificado',
        confidence: 'media',
        sourceUrl: 'https://www.leroymerlin.es/productos/placa-de-carton-yeso-ppm-2500x1200x13-mm-15433152.html',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Placa de yeso laminado hidrófuga PPM 13 mm, 2.500 × 1.200 mm',
        brand: 'Genérica',
        price: 12.96,
        saleUnit: 'placa',
        coverage: { value: 3, unit: 'm2', note: 'placa de 2,50 × 1,20 m = 3,00 m²' },
        specs: [
          { key: 'Espesor', value: '13 mm' },
          { key: 'Tipo', value: 'Hidrófuga (PPM)' },
          { key: 'PVP web', value: '15,68 €/placa IVA incluido' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde Málaga',
        highlight: 'Recogida inmediata en el almacén de Málaga',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/placa-de-yeso-laminado-ppm-2500x1200x13mm-10977540.html',
      },
      {
        supplier: 'Leroy Merlin',
        productName: 'Placa de yeso laminado FK hidrófuga PPM 13 mm, 2.600 × 1.200 mm',
        brand: 'FK',
        price: 13.01,
        saleUnit: 'placa',
        coverage: { value: 3.12, unit: 'm2', note: 'placa de 2,60 × 1,20 m = 3,12 m²' },
        specs: [
          { key: 'Espesor', value: '13 mm' },
          { key: 'Tipo', value: 'Hidrófuga (PPM)' },
          { key: 'PVP web', value: '15,74 €/placa IVA incluido' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en tienda o envío a domicilio',
        highlight: 'Formato 2,60 m: menos juntas en techos altos',
        confidence: 'media',
        sourceUrl: 'https://www.leroymerlin.es/productos/placa-de-carton-yeso-laminado-fk-ppm-2600x1200x13-mm-19723186.html',
      },
    ],
  },
  {
    id: 'aislamiento',
    keywords: [
      'aislamiento', 'aislante', 'xps', 'eps', 'poliestireno', 'lana de roca',
      'lana mineral', 'termico', 'térmico', 'sate',
    ],
    category: 'Aislamiento',
    typicalMeasureUnit: 'm2',
    recommendedWastePct: 5,
    variants: [
      {
        supplier: 'Obramat Málaga',
        productName: 'Panel XPS Thermogreen 300 kPa 50 mm, 1.250 × 600 mm',
        brand: 'Thermogreen',
        price: 3.42,
        saleUnit: 'panel',
        coverage: { value: 0.75, unit: 'm2', note: 'panel de 1,25 × 0,60 m = 0,75 m²' },
        specs: [
          { key: 'Espesor', value: '50 mm' },
          { key: 'Resistencia a compresión', value: '300 kPa' },
          { key: 'PVP web', value: '4,14 €/panel IVA incluido' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde Málaga',
        highlight: 'XPS de 5 cm al precio más bajo verificado',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/poliestireno-extruido-sl-xps-300kpa-thermogreen-125x60x5cm-25047142.html',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Panel XPS Soprema 300 kPa 50 mm, 1.250 × 600 mm',
        brand: 'Soprema',
        price: 6.65,
        saleUnit: 'panel',
        coverage: { value: 0.75, unit: 'm2', note: 'panel de 1,25 × 0,60 m = 0,75 m²' },
        specs: [
          { key: 'Espesor', value: '50 mm' },
          { key: 'Resistencia a compresión', value: '300 kPa' },
          { key: 'PVP web', value: '8,05 €/panel IVA incluido' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde Málaga',
        highlight: 'Marca de referencia en impermeabilización y aislamiento',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/poliestireno-extruido-sl-xps-300kpa-125x60x5-cm-soprema-10989930.html',
      },
      {
        supplier: 'Leroy Merlin',
        productName: 'Paquete de 8 paneles XPS Thermogreen 50 mm, 1,25 × 0,60 m (R = 1,55)',
        brand: 'Thermogreen',
        price: 32.45,
        saleUnit: 'caja',
        coverage: { value: 6, unit: 'm2', note: 'paquete de 8 paneles de 0,75 m² = 6,00 m²' },
        specs: [
          { key: 'Espesor', value: '50 mm' },
          { key: 'Resistencia térmica', value: 'R = 1,55 m²K/W' },
          { key: 'PVP web', value: '39,27 €/paquete IVA incluido' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en tienda o envío a domicilio',
        highlight: 'Formato paquete: 6 m² por bulto',
        confidence: 'media',
        sourceUrl: 'https://www.leroymerlin.es/productos/8-uds-de-paneles-poliestireno-extruido-xps-thermogreen-xps-espesor-50mm-1-25x0-6m-r-1-55-88493228.html',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Paquete de 16 paneles de lana de roca Sonorock Eco 40 mm, 1.350 × 600 mm',
        brand: 'Sonorock',
        price: 37.17,
        saleUnit: 'caja',
        coverage: { value: 12.96, unit: 'm2', note: 'paquete de 16 paneles de 0,81 m² = 12,96 m²' },
        specs: [
          { key: 'Espesor', value: '40 mm' },
          { key: 'Material', value: 'Lana de roca (incombustible, A1)' },
          { key: 'PVP web', value: '44,98 €/paquete IVA incluido' },
          { key: 'Uso', value: 'Trasdosados y tabiques de yeso laminado' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde Málaga',
        highlight: 'Aísla del calor y del ruido; casi 13 m² por paquete',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/panel-lana-de-roca-sonorock-eco-135x60x4cm-25046668.html',
      },
    ],
  },
  {
    id: 'ladrillo',
    keywords: [
      'ladrillo', 'perforado', 'hueco doble', 'termoarcilla', 'fabrica de ladrillo',
      'panal', 'tocho',
    ],
    category: 'Ladrillo y bloque',
    typicalMeasureUnit: 'ud',
    recommendedWastePct: 5,
    variants: [
      {
        supplier: 'Obramat Málaga',
        productName: 'Ladrillo cerámico perforado 24 × 11,5 × 7 cm',
        brand: 'Cerámica local',
        price: 0.17,
        saleUnit: 'ud',
        coverage: { value: 1, unit: 'ud', note: 'precio por unidad; descuento por palet' },
        specs: [
          { key: 'Dimensiones', value: '24 × 11,5 × 7 cm' },
          { key: 'Piezas por m² de fábrica', value: '≈ 45-50 ud en tabicón' },
          { key: 'PVP web', value: '0,21 €/ud IVA incluido' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Palet con descarga en obra',
        highlight: 'Formato estándar de obra',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/ladrillo-perforado-24x11-5x7-cm-25115497.html',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Ladrillo hueco doble 24 × 11,5 × 8 cm',
        brand: 'Cerámica local',
        price: 0.15,
        saleUnit: 'ud',
        coverage: { value: 1, unit: 'ud', note: 'precio por unidad; descuento por palet' },
        specs: [
          { key: 'Dimensiones', value: '24 × 11,5 × 8 cm' },
          { key: 'Piezas por m²', value: '≈ 45 ud' },
          { key: 'PVP web', value: '0,18 €/ud IVA incluido' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Palet con descarga en obra',
        highlight: 'El más económico para tabiquería',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/ladrillo-hueco-doble-24x11-5x8-cm-10741416.html',
      },
      {
        supplier: 'Leroy Merlin',
        productName: 'Ladrillo hueco doble 24 × 11,5 × 8 cm',
        brand: 'Cerámica local',
        price: 0.24,
        saleUnit: 'ud',
        coverage: { value: 1, unit: 'ud', note: 'precio por unidad' },
        specs: [
          { key: 'Dimensiones', value: '24 × 11,5 × 8 cm' },
          { key: 'Piezas por m²', value: '≈ 45 ud' },
          { key: 'PVP web', value: '0,29 €/ud IVA incluido' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en tienda',
        highlight: 'Para remates y cantidades pequeñas',
        confidence: 'media',
        sourceUrl: 'https://www.leroymerlin.es/productos/ladrillo-hueco-doble-24x11-5x8-cm-17555111.html',
      },
    ],
  },
  {
    id: 'bloque-hormigon',
    keywords: ['bloque', 'bloque de hormigon', 'bloque hormigón', 'vibrado', 'termoarcilla'],
    category: 'Ladrillo y bloque',
    typicalMeasureUnit: 'ud',
    recommendedWastePct: 5,
    variants: [
      {
        supplier: 'Obramat Málaga',
        productName: 'Bloque de hormigón gris 40 × 20 × 20 cm',
        brand: 'Prefabricados locales',
        price: 0.64,
        saleUnit: 'ud',
        coverage: { value: 1, unit: 'ud', note: 'precio por unidad; palet de 70 ud' },
        specs: [
          { key: 'Dimensiones', value: '40 × 20 × 20 cm' },
          { key: 'Piezas por m²', value: '12,5 ud' },
          { key: 'PVP web', value: '0,78 €/ud IVA incluido' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Palet con descarga en obra',
        highlight: 'Formato más habitual en cerramientos',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/bloque-de-hormigon-gris-40x20x20-cm-10756123.html',
      },
      {
        supplier: 'Leroy Merlin',
        productName: 'Bloque de hormigón liso gris 40 × 20 × 20 cm',
        brand: 'Prefabricados locales',
        price: 0.99,
        saleUnit: 'ud',
        coverage: { value: 1, unit: 'ud', note: 'precio por unidad' },
        specs: [
          { key: 'Dimensiones', value: '40 × 20 × 20 cm' },
          { key: 'Piezas por m²', value: '12,5 ud' },
          { key: 'PVP web', value: '1,20 €/ud IVA incluido' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en tienda',
        highlight: 'Disponible también en cantidades pequeñas',
        confidence: 'media',
        sourceUrl: 'https://www.leroymerlin.es/productos/bloque-de-hormigon-liso-gris-40x20x20-cm-17457622.html',
      },
    ],
  },
  {
    id: 'hormigon',
    keywords: ['hormigon', 'hormigón', 'ha-25', 'hm-20', 'hormigonera', 'losa de hormigon'],
    category: 'Hormigón preparado',
    typicalMeasureUnit: 'm3',
    recommendedWastePct: 5,
    variants: [
      {
        supplier: 'Cemex España',
        productName: 'Hormigón HA-25/B/20/IIa preparado en central',
        brand: 'Cemex',
        price: 96,
        saleUnit: 'm3',
        coverage: { value: 1, unit: 'm3', note: 'precio por metro cúbico puesto en obra' },
        specs: [
          { key: 'Tipificación', value: 'HA-25/B/20/IIa' },
          { key: 'Consistencia', value: 'Blanda' },
          { key: 'Tamaño máximo de árido', value: '20 mm' },
          { key: 'Uso', value: 'Estructura armada, losas y cimentación' },
          { key: 'Pedido mínimo', value: 'Habitualmente 6 m³ por camión' },
        ],
        availability: 'Bajo pedido con 48 h de antelación',
        delivery: 'Camión hormigonera; bomba a presupuestar aparte',
        highlight: 'El hormigón preparado no se vende online: se encarga a la planta',
        confidence: 'estimada',
      },
    ],
  },
  {
    id: 'arido',
    keywords: ['arena', 'grava', 'gravilla', 'arido', 'árido', 'zahorra', 'albero'],
    category: 'Áridos',
    typicalMeasureUnit: 'kg',
    recommendedWastePct: 0,
    variants: [
      {
        supplier: 'Obramat Málaga',
        productName: 'Arena Roiz para mortero, saco de 25 kg',
        brand: 'Roiz',
        price: 1.23,
        saleUnit: 'saco',
        coverage: { value: 25, unit: 'kg', note: 'saco de 25 kg' },
        specs: [
          { key: 'Uso', value: 'Morteros y remates' },
          { key: 'PVP web', value: '1,49 €/saco IVA incluido' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde Málaga',
        highlight: 'Práctica para cantidades pequeñas',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/arena-roiz-25-kg-10643990.html',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Big bag de arena natural lavada 0/2, 1.000 kg',
        brand: 'Genérica',
        price: 23.14,
        saleUnit: 'saco',
        coverage: { value: 1000, unit: 'kg', note: 'big bag de 1.000 kg (≈ 0,65 m³)' },
        specs: [
          { key: 'Granulometría', value: '0/2 mm, lavada' },
          { key: 'PVP web', value: '28,00 €/big bag IVA incluido' },
        ],
        availability: 'Recogida en almacén',
        delivery: 'Camión grúa a obra',
        highlight: 'La forma barata de comprar arena en volumen',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/big-bag-arena-natural-lavada-1000-kg-10823134.html',
      },
      {
        supplier: 'Leroy Merlin',
        productName: 'Big bag de arena de río 0/2 fina, ≈ 1.000 kg',
        brand: 'Genérica',
        price: 41.31,
        saleUnit: 'saco',
        coverage: { value: 1000, unit: 'kg', note: 'big bag de ≈ 1.000 kg' },
        specs: [
          { key: 'Granulometría', value: '0/2 mm, fina' },
          { key: 'PVP web', value: '49,99 €/big bag IVA incluido' },
        ],
        availability: 'En stock',
        delivery: 'Envío a domicilio con camión grúa',
        highlight: 'Entrega a domicilio incluida en el servicio de LM',
        confidence: 'media',
        sourceUrl: 'https://www.leroymerlin.es/productos/arena-de-rio-0-2-fino-1000kg-aprox-81878526.html',
      },
    ],
  },
  {
    id: 'acero',
    keywords: ['acero', 'corrugado', 'b500s', 'ferralla', 'redondo', 'armadura', 'mallazo'],
    category: 'Acero y ferralla',
    typicalMeasureUnit: 'm',
    recommendedWastePct: 5,
    variants: [
      {
        supplier: 'Obramat Málaga',
        productName: 'Barra de acero corrugado B500SD Ø12 mm, barra de 3 m',
        brand: 'Siderúrgica nacional',
        price: 3.89,
        saleUnit: 'barra',
        coverage: { value: 3, unit: 'm', note: 'barra de 3 m' },
        specs: [
          { key: 'Diámetro', value: '12 mm' },
          { key: 'Calidad', value: 'B500SD' },
          { key: 'PVP web', value: '4,71 €/barra IVA incluido' },
          { key: 'Peso lineal', value: '0,888 kg/m' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde Málaga',
        highlight: 'Diámetro más usado en vigas y zunchos',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/barra-de-acero-corrugado-b500sd-12-mm-3-m-10975825.html',
      },
      {
        supplier: 'Leroy Merlin',
        productName: 'Varilla de acero corrugado Ø12 mm, barra de 3 m',
        brand: 'Siderúrgica nacional',
        price: 3.96,
        saleUnit: 'barra',
        coverage: { value: 3, unit: 'm', note: 'barra de 3 m' },
        specs: [
          { key: 'Diámetro', value: '12 mm' },
          { key: 'PVP web', value: '4,79 €/barra IVA incluido' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en tienda',
        highlight: 'Fácil de recoger en tienda para pequeñas cantidades',
        confidence: 'media',
        sourceUrl: 'https://www.leroymerlin.es/productos/varilla-de-acero-corrugada-12-mm-3-m-19910296.html',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Mallazo electrosoldado Ø6 mm, panel de 3 × 2,20 m',
        brand: 'Siderúrgica nacional',
        price: 10.3,
        saleUnit: 'panel',
        coverage: { value: 6.6, unit: 'm2', note: 'panel de 3,00 × 2,20 m = 6,60 m²' },
        specs: [
          { key: 'Diámetro', value: '6 mm' },
          { key: 'PVP web', value: '12,46 €/panel IVA incluido' },
          { key: 'Uso', value: 'Soleras y losas de reparto' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde Málaga',
        highlight: 'Formato manejable de 6,6 m² por panel',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/mallazo-acero-construccion-6mm-3x2-20m-10925376.html',
      },
    ],
  },
  {
    id: 'pintura',
    keywords: ['pintura', 'plastica', 'plástica', 'esmalte', 'imprimacion', 'pintar', 'lisa'],
    category: 'Pintura y revestimientos',
    typicalMeasureUnit: 'm2',
    recommendedWastePct: 5,
    variants: [
      {
        supplier: 'Leroy Merlin',
        productName: 'Pintura plástica interior Luxens Basic blanco mate, bote de 15 l',
        brand: 'Luxens',
        price: 20.07,
        saleUnit: 'bote',
        coverage: {
          value: 105,
          unit: 'm2',
          note: 'rendimiento ≈ 7 m²/l a una mano; 15 l cubren unos 105 m² por mano. Para dos manos, indica el doble de superficie',
        },
        specs: [
          { key: 'Formato', value: 'Bote de 15 l' },
          { key: 'Acabado', value: 'Mate' },
          { key: 'PVP web', value: '24,29 €/bote IVA incluido' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en tienda o envío a domicilio',
        highlight: 'La opción económica para obra nueva',
        confidence: 'media',
        sourceUrl: 'https://www.leroymerlin.es/productos/pintura-de-interior-basic-blanco-luxens-color-blanco-mate-15l-para-paredes-y-techos-81989566.html',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Pintura plástica blanca mate máxima cubrición, bote de 15 l',
        brand: 'Obramat',
        price: 23.97,
        saleUnit: 'bote',
        coverage: {
          value: 120,
          unit: 'm2',
          note: 'rendimiento ≈ 8 m²/l a una mano; 15 l cubren unos 120 m² por mano. Para dos manos, indica el doble de superficie',
        },
        specs: [
          { key: 'Formato', value: 'Bote de 15 l' },
          { key: 'Acabado', value: 'Mate' },
          { key: 'PVP web', value: '29,00 €/bote IVA incluido' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde Málaga',
        highlight: 'Buen cubrimiento a precio de almacén',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/pintura-plastica-blanca-mate-15l-maxima-cubricion-10772391.html',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Pintura plástica blanca mate Coloso, bote de 15 l',
        brand: 'Coloso',
        price: 52.89,
        saleUnit: 'bote',
        coverage: {
          value: 165,
          unit: 'm2',
          note: 'rendimiento ≈ 11 m²/l a una mano; 15 l cubren unos 165 m² por mano. Para dos manos, indica el doble de superficie',
        },
        specs: [
          { key: 'Formato', value: 'Bote de 15 l' },
          { key: 'Acabado', value: 'Mate' },
          { key: 'PVP web', value: '64,00 €/bote IVA incluido' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde Málaga',
        highlight: 'Gama alta: más rendimiento y mejor acabado',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/pintura-plastica-blanca-mate-15l-coloso-10779090.html',
      },
    ],
  },
  {
    id: 'tubo-pvc',
    keywords: [
      'tubo', 'pvc', 'evacuacion', 'evacuación', 'saneamiento', 'bajante', 'desague', 'desagüe',
    ],
    category: 'Fontanería y saneamiento',
    typicalMeasureUnit: 'm',
    recommendedWastePct: 5,
    variants: [
      {
        supplier: 'Obramat Málaga',
        productName: 'Tubo PVC evacuación Ø110 mm, barra de 3 m',
        brand: 'Genérica',
        price: 5.25,
        saleUnit: 'barra',
        coverage: { value: 3, unit: 'm', note: 'barra de 3 m' },
        specs: [
          { key: 'Diámetro', value: '110 mm' },
          { key: 'Longitud', value: '3 m' },
          { key: 'PVP web', value: '6,35 €/barra IVA incluido' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde Málaga',
        highlight: 'El precio más ajustado por barra',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/tubo-110mm-3m-pvc-10106803.html',
      },
      {
        supplier: 'Leroy Merlin',
        productName: 'Tubo de evacuación PVC Ø110 mm, barra de 3 m',
        brand: 'Genérica',
        price: 6.43,
        saleUnit: 'barra',
        coverage: { value: 3, unit: 'm', note: 'barra de 3 m' },
        specs: [
          { key: 'Diámetro', value: '110 mm' },
          { key: 'PVP web', value: '7,78 €/barra IVA incluido' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en tienda',
        highlight: 'Disponible en todas las tiendas de la provincia',
        confidence: 'media',
        sourceUrl: 'https://www.leroymerlin.es/productos/tubo-de-evacuacion-de-agua-en-pvc-de-3m-x-110mm-87003281.html',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Tubo PVC compacto evacuación Ø110 mm, barra de 3 m',
        brand: 'Genérica',
        price: 6.69,
        saleUnit: 'barra',
        coverage: { value: 3, unit: 'm', note: 'barra de 3 m' },
        specs: [
          { key: 'Diámetro', value: '110 mm' },
          { key: 'Tipo', value: 'Compacto (pared maciza)' },
          { key: 'PVP web', value: '8,10 €/barra IVA incluido' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde Málaga',
        highlight: 'Pared compacta para colectores enterrados',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/tubo-110mm-3m-pvc-compacto-25073296.html',
      },
    ],
  },
  {
    id: 'cable',
    keywords: [
      'cable', 'electrico', 'eléctrico', 'manguera', 'h07v-k', 'hilo', 'conductor', 'instalacion electrica',
    ],
    category: 'Material eléctrico',
    typicalMeasureUnit: 'm',
    recommendedWastePct: 10,
    variants: [
      {
        supplier: 'Obramat Málaga',
        productName: 'Hilo H07V-K 2,5 mm² azul, rollo de 100 m',
        brand: 'Genérica',
        price: 23.64,
        saleUnit: 'rollo',
        coverage: { value: 100, unit: 'm', note: 'rollo de 100 m' },
        specs: [
          { key: 'Sección', value: '2,5 mm²' },
          { key: 'Tipo', value: 'H07V-K flexible, 450/750 V' },
          { key: 'PVP web', value: '28,60 €/rollo IVA incluido' },
          { key: 'Uso', value: 'Circuitos de tomas de corriente' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde Málaga',
        highlight: 'Sección estándar para enchufes al mejor precio',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/hilo-pvc-h07v-k-2-5mm2-azul-100m-10979213.html',
      },
      {
        supplier: 'Leroy Merlin',
        productName: 'Cable Lexman H07V-K 2,5 mm² azul, rollo de 100 m',
        brand: 'Lexman',
        price: 35.47,
        saleUnit: 'rollo',
        coverage: { value: 100, unit: 'm', note: 'rollo de 100 m' },
        specs: [
          { key: 'Sección', value: '2,5 mm²' },
          { key: 'Tipo', value: 'H07V-K flexible, 450/750 V' },
          { key: 'PVP web', value: '42,92 €/rollo IVA incluido' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en tienda o envío a domicilio',
        highlight: 'Disponible en tienda el mismo día',
        confidence: 'media',
        sourceUrl: 'https://www.leroymerlin.es/productos/cable-lexman-h07v-k-100-metros-2-5-mm2-color-azul-19303284.html',
      },
    ],
  },
  {
    id: 'madera',
    keywords: ['madera', 'tablero', 'pino', 'listón', 'liston', 'viga de madera', 'tarima', 'osb'],
    category: 'Madera',
    typicalMeasureUnit: 'm2',
    recommendedWastePct: 10,
    variants: [
      {
        supplier: 'Obramat Málaga',
        productName: 'Tablero OSB3 15 mm, 2.500 × 1.250 mm',
        brand: 'Genérica',
        price: 19.74,
        saleUnit: 'plancha',
        coverage: { value: 3.125, unit: 'm2', note: 'tablero de 2,50 × 1,25 m = 3,125 m²' },
        specs: [
          { key: 'Espesor', value: '15 mm' },
          { key: 'Clase', value: 'OSB3 (ambiente húmedo)' },
          { key: 'PVP web', value: '23,89 €/tablero IVA incluido' },
          { key: 'Uso', value: 'Encofrado, forjados y cerramientos' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Envío a obra en 24 h desde Málaga',
        highlight: 'Buen comportamiento en ambiente húmedo',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/tablero-osb3-250x125x1-5cm-10590825.html',
      },
    ],
  },
  {
    id: 'teja',
    keywords: ['teja', 'cubierta', 'tejado', 'curva', 'mixta', 'arabe', 'árabe'],
    category: 'Cubiertas',
    typicalMeasureUnit: 'm2',
    recommendedWastePct: 8,
    variants: [
      {
        supplier: 'Obramat Málaga',
        productName: 'Teja cerámica curva roja 46 × 20 cm',
        brand: 'Cerámica local',
        price: 0.24,
        saleUnit: 'ud',
        coverage: { value: 0.071, unit: 'm2', note: 'formato grande: ≈ 14 tejas por m² de cubierta' },
        specs: [
          { key: 'Dimensiones', value: '46 × 20 cm' },
          { key: 'Piezas por m²', value: '≈ 14 ud' },
          { key: 'PVP web', value: '0,29 €/ud IVA incluido' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Palet con descarga en obra',
        highlight: 'Formato grande: menos piezas y menos mano de obra',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/teja-ceramica-curva-rojo-46x20-cm-10414005.html',
      },
      {
        supplier: 'Leroy Merlin',
        productName: 'Teja cerámica curva roja 40 × 17 × 13 cm',
        brand: 'Cerámica local',
        price: 0.49,
        saleUnit: 'ud',
        coverage: { value: 0.037, unit: 'm2', note: '≈ 27 tejas por m² de cubierta' },
        specs: [
          { key: 'Dimensiones', value: '40 × 17 × 13 cm' },
          { key: 'Piezas por m²', value: '≈ 27 ud' },
          { key: 'PVP web', value: '0,59 €/ud IVA incluido' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en tienda',
        highlight: 'Formato tradicional andaluz',
        confidence: 'media',
        sourceUrl: 'https://www.leroymerlin.es/productos/teja-curva-de-ceramica-rojo-de-40x17x13cm-10853731.html',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Teja cerámica curva Collado roja 40 × 17 cm',
        brand: 'Collado',
        price: 0.59,
        saleUnit: 'ud',
        coverage: { value: 0.037, unit: 'm2', note: '≈ 27 tejas por m² de cubierta' },
        specs: [
          { key: 'Dimensiones', value: '40 × 17 cm' },
          { key: 'Piezas por m²', value: '≈ 27 ud' },
          { key: 'PVP web', value: '0,71 €/ud IVA incluido' },
        ],
        availability: 'Recogida en almacén en 2 h',
        delivery: 'Palet con descarga en obra',
        highlight: 'Marca cerámica de referencia',
        confidence: 'media',
        sourceUrl: 'https://www.obramat.es/productos/teja-ceramica-curva-collado-rojo-40x17-cm-10414271.html',
      },
    ],
  },
  {
    id: 'impermeabilizacion',
    keywords: [
      'impermeabilizacion', 'impermeabilización', 'tela asfaltica', 'asfáltica',
      'lamina asfaltica', 'lámina asfáltica', 'poliuretano', 'caucho',
    ],
    category: 'Impermeabilización',
    typicalMeasureUnit: 'm2',
    recommendedWastePct: 15,
    variants: [
      {
        supplier: 'Isolana Málaga',
        productName: 'Lámina asfáltica LBM-40-FP con armadura de fieltro, rollo de 10 m²',
        brand: 'Danosa',
        price: 58,
        saleUnit: 'rollo',
        coverage: { value: 10, unit: 'm2', note: 'rollo de 1 × 10 m = 10 m² antes de solapes' },
        specs: [
          { key: 'Tipo', value: 'LBM-40-FP' },
          { key: 'Dimensiones', value: '1 × 10 m' },
          { key: 'Colocación', value: 'Soplete, con solape de 8-10 cm' },
          { key: 'Uso', value: 'Cubiertas y terrazas' },
        ],
        availability: 'En stock',
        delivery: 'Entrega en 48 h',
        highlight: 'La ficha online no pudo verificarse: se pide en la delegación de Málaga',
        confidence: 'estimada',
      },
    ],
  },
];

/** Normaliza para comparar: minúsculas, sin tildes y sin puntuación. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function supplierByName(name: string) {
  return (
    SUPPLIER_DIRECTORY.find((entry) => entry.name === name) ?? {
      name,
      location: 'Provincia de Málaga',
      website: null,
      phone: null,
    }
  );
}

/**
 * Busca en el catálogo local los productos que mejor encajan con la consulta.
 * Devuelve ofertas ya normalizadas, listas para pintar en la interfaz.
 */
export function searchDemoCatalog(query: string, limit = 6): SupplierOffer[] {
  const haystack = normalize(query);
  if (!haystack) return [];

  const scored = DEMO_PRODUCTS.map((product) => {
    let score = 0;
    for (const keyword of product.keywords) {
      const term = normalize(keyword);
      if (!term) continue;
      if (haystack.includes(term)) score += term.length;
    }
    return { product, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];

  const offers: SupplierOffer[] = [];
  for (const { product } of scored) {
    for (const variant of product.variants) {
      offers.push({
        id: `demo-${product.id}-${offers.length}`,
        productName: variant.productName,
        brand: variant.brand,
        supplier: supplierByName(variant.supplier),
        price: variant.price,
        saleUnit: variant.saleUnit,
        priceIncludesVat: false,
        coverage: variant.coverage,
        recommendedWastePct: product.recommendedWastePct,
        specs: variant.specs,
        availability: variant.availability,
        delivery: variant.delivery,
        sourceUrl: variant.sourceUrl ?? null,
        confidence: variant.confidence,
        highlight: variant.highlight,
        group: product.id,
      });
      if (offers.length >= limit) return offers;
    }
  }

  return offers;
}

/** Familias cubiertas por el catálogo local, para orientar al usuario. */
export function demoCategories(): string[] {
  return [...new Set(DEMO_PRODUCTS.map((product) => product.category))];
}

/** Unidad de medida habitual del primer producto que encaje con la consulta. */
export function demoTypicalUnit(query: string): MeasureUnit | null {
  const haystack = normalize(query);
  for (const product of DEMO_PRODUCTS) {
    if (product.keywords.some((keyword) => haystack.includes(normalize(keyword)))) {
      return product.typicalMeasureUnit;
    }
  }
  return null;
}
