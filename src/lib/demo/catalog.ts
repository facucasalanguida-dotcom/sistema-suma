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
        supplier: 'BigMat',
        productName: 'Pavimento porcelánico rectificado 60×60 cm, acabado mate gris cemento',
        brand: 'Fabresa',
        price: 14.9,
        saleUnit: 'm2',
        coverage: { value: 1, unit: 'm2', note: 'precio por metro cuadrado' },
        specs: [
          { key: 'Formato', value: '60 × 60 cm' },
          { key: 'Espesor', value: '9 mm' },
          { key: 'Acabado', value: 'Mate rectificado' },
          { key: 'Resistencia al deslizamiento', value: 'C3 / R10' },
          { key: 'Uso', value: 'Interior residencial y comercial ligero' },
          { key: 'Piezas por caja', value: '4 ud (1,44 m²)' },
        ],
        availability: 'En stock',
        delivery: 'Entrega en obra en 48-72 h en la provincia de Málaga',
        highlight: 'Equilibrio entre precio y prestaciones',
        confidence: 'estimada',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Porcelánico 45×45 cm imitación cemento, uso residencial',
        brand: 'Marca propia',
        price: 8.9,
        saleUnit: 'm2',
        coverage: { value: 1, unit: 'm2', note: 'precio por metro cuadrado' },
        specs: [
          { key: 'Formato', value: '45 × 45 cm' },
          { key: 'Espesor', value: '8 mm' },
          { key: 'Acabado', value: 'Mate' },
          { key: 'Resistencia al deslizamiento', value: 'C2 / R9' },
          { key: 'Uso', value: 'Interior residencial' },
          { key: 'Piezas por caja', value: '7 ud (1,42 m²)' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en almacén o entrega en 24-48 h',
        highlight: 'La opción más económica',
        confidence: 'estimada',
      },
      {
        supplier: 'Porcelanosa',
        productName: 'Porcelánico técnico 80×80 cm rectificado, colección contemporánea',
        brand: 'Porcelanosa',
        price: 38.5,
        saleUnit: 'm2',
        coverage: { value: 1, unit: 'm2', note: 'precio por metro cuadrado' },
        specs: [
          { key: 'Formato', value: '80 × 80 cm' },
          { key: 'Espesor', value: '10,5 mm' },
          { key: 'Acabado', value: 'Rectificado natural' },
          { key: 'Absorción', value: '< 0,5 % (BIa)' },
          { key: 'Uso', value: 'Interior de alta exigencia' },
        ],
        availability: 'Consultar plazo en showroom',
        delivery: 'Servicio a obra en Málaga y Marbella',
        highlight: 'Máxima calidad y formato grande',
        confidence: 'estimada',
      },
      {
        supplier: 'BigMat Macosol',
        productName: 'Porcelánico antideslizante 60×60 cm para exterior, clase 3',
        brand: 'Argenta',
        price: 18.2,
        saleUnit: 'caja',
        coverage: { value: 1.44, unit: 'm2', note: 'caja de 4 piezas de 60×60 cm = 1,44 m²' },
        specs: [
          { key: 'Formato', value: '60 × 60 cm' },
          { key: 'Espesor', value: '20 mm' },
          { key: 'Resistencia al deslizamiento', value: 'Clase 3 / R11' },
          { key: 'Uso', value: 'Exterior, terrazas y porches' },
          { key: 'Contenido', value: '4 piezas por caja' },
        ],
        availability: 'En stock',
        delivery: 'Entrega en obra en 48 h',
        highlight: 'Apto para exterior y zonas húmedas',
        confidence: 'estimada',
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
        supplier: 'BigMat',
        productName: 'Cemento gris CEM II/B-L 32,5 N, saco de 25 kg',
        brand: 'Cemex',
        price: 4.85,
        saleUnit: 'saco',
        coverage: { value: 25, unit: 'kg', note: 'saco de 25 kg' },
        specs: [
          { key: 'Tipo', value: 'CEM II/B-L 32,5 N' },
          { key: 'Formato', value: 'Saco de 25 kg' },
          { key: 'Uso', value: 'Morteros, hormigones no estructurales, solados' },
          { key: 'Palet', value: '56 sacos (1.400 kg)' },
        ],
        availability: 'En stock',
        delivery: 'Palet completo con descarga en obra',
        highlight: 'Referencia habitual de obra',
        confidence: 'estimada',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Cemento gris CEM II/B-L 32,5 N, saco de 25 kg',
        brand: 'Marca propia',
        price: 4.35,
        saleUnit: 'saco',
        coverage: { value: 25, unit: 'kg', note: 'saco de 25 kg' },
        specs: [
          { key: 'Tipo', value: 'CEM II/B-L 32,5 N' },
          { key: 'Formato', value: 'Saco de 25 kg' },
          { key: 'Uso', value: 'Uso general en obra' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en almacén',
        highlight: 'El precio más ajustado por saco',
        confidence: 'estimada',
      },
      {
        supplier: 'Cemex España',
        productName: 'Cemento CEM I 42,5 R a granel',
        brand: 'Cemex',
        price: 132,
        saleUnit: 't',
        coverage: { value: 1000, unit: 'kg', note: 'precio por tonelada a granel' },
        specs: [
          { key: 'Tipo', value: 'CEM I 42,5 R' },
          { key: 'Suministro', value: 'Cisterna a granel' },
          { key: 'Uso', value: 'Hormigón estructural y prefabricados' },
          { key: 'Pedido mínimo', value: 'Consultar' },
        ],
        availability: 'Bajo pedido',
        delivery: 'Cisterna con descarga neumática en obra',
        highlight: 'Óptimo para grandes volúmenes',
        confidence: 'estimada',
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
        supplier: 'Grupo Puma',
        productName: 'Adhesivo cementoso mejorado C2 TE, saco de 25 kg',
        brand: 'Morcemcol',
        price: 11.4,
        saleUnit: 'saco',
        coverage: {
          value: 5,
          unit: 'm2',
          note: 'rendimiento aproximado de 5 kg/m² con llana dentada de 8 mm; saco de 25 kg',
        },
        specs: [
          { key: 'Clasificación', value: 'C2 TE según UNE-EN 12004' },
          { key: 'Formato', value: 'Saco de 25 kg' },
          { key: 'Rendimiento', value: '4-6 kg/m² según dentado' },
          { key: 'Uso', value: 'Gres porcelánico, interior y exterior' },
        ],
        availability: 'En stock',
        delivery: 'Entrega en obra en 48 h',
        highlight: 'Deslizamiento nulo y tiempo abierto ampliado',
        confidence: 'estimada',
      },
      {
        supplier: 'BigMat Macosol',
        productName: 'Adhesivo cementoso C1 T gris, saco de 25 kg',
        brand: 'Weber',
        price: 8.2,
        saleUnit: 'saco',
        coverage: {
          value: 6,
          unit: 'm2',
          note: 'rendimiento aproximado de 4 kg/m²; saco de 25 kg',
        },
        specs: [
          { key: 'Clasificación', value: 'C1 T' },
          { key: 'Formato', value: 'Saco de 25 kg' },
          { key: 'Uso', value: 'Cerámica absorbente en interior' },
        ],
        availability: 'En stock',
        delivery: 'Entrega en 24-48 h',
        highlight: 'Suficiente para cerámica convencional en interior',
        confidence: 'estimada',
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
        supplier: 'Isolana Málaga',
        productName: 'Placa de yeso laminado estándar 13 mm, 2.500 × 1.200 mm',
        brand: 'Pladur',
        price: 8.9,
        saleUnit: 'placa',
        coverage: { value: 3, unit: 'm2', note: 'placa de 2,50 × 1,20 m = 3,00 m²' },
        specs: [
          { key: 'Espesor', value: '13 mm' },
          { key: 'Dimensiones', value: '2.500 × 1.200 mm' },
          { key: 'Tipo', value: 'Estándar (A)' },
          { key: 'Peso', value: '≈ 8,5 kg/m²' },
        ],
        availability: 'En stock',
        delivery: 'Entrega en obra con camión grúa',
        highlight: 'Referencia estándar para tabique y trasdosado',
        confidence: 'estimada',
      },
      {
        supplier: 'BigMat Macosol',
        productName: 'Placa de yeso laminado hidrófuga 13 mm, 2.600 × 1.200 mm',
        brand: 'Knauf',
        price: 13.4,
        saleUnit: 'placa',
        coverage: { value: 3.12, unit: 'm2', note: 'placa de 2,60 × 1,20 m = 3,12 m²' },
        specs: [
          { key: 'Espesor', value: '13 mm' },
          { key: 'Dimensiones', value: '2.600 × 1.200 mm' },
          { key: 'Tipo', value: 'Hidrófuga (H1)' },
          { key: 'Uso', value: 'Baños, cocinas y zonas húmedas' },
        ],
        availability: 'En stock',
        delivery: 'Entrega en 48 h',
        highlight: 'Imprescindible en zonas húmedas',
        confidence: 'estimada',
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
        supplier: 'Isolana Málaga',
        productName: 'Panel de poliestireno extruido XPS 50 mm, 1.250 × 600 mm',
        brand: 'Ursa',
        price: 6.3,
        saleUnit: 'panel',
        coverage: { value: 0.75, unit: 'm2', note: 'panel de 1,25 × 0,60 m = 0,75 m²' },
        specs: [
          { key: 'Espesor', value: '50 mm' },
          { key: 'Conductividad', value: 'λ = 0,034 W/mK' },
          { key: 'Resistencia térmica', value: 'R = 1,45 m²K/W' },
          { key: 'Uso', value: 'Cubierta invertida, suelo y muro' },
        ],
        availability: 'En stock',
        delivery: 'Entrega en 48 h',
        highlight: 'Alta resistencia a la compresión y a la humedad',
        confidence: 'estimada',
      },
      {
        supplier: 'BigMat Macosol',
        productName: 'Panel de lana de roca 60 mm para trasdosado, 1.350 × 600 mm',
        brand: 'Rockwool',
        price: 7.2,
        saleUnit: 'panel',
        coverage: { value: 0.81, unit: 'm2', note: 'panel de 1,35 × 0,60 m = 0,81 m²' },
        specs: [
          { key: 'Espesor', value: '60 mm' },
          { key: 'Conductividad', value: 'λ = 0,035 W/mK' },
          { key: 'Reacción al fuego', value: 'Euroclase A1' },
          { key: 'Uso', value: 'Trasdosados y tabiques de yeso laminado' },
        ],
        availability: 'En stock',
        delivery: 'Entrega en 48 h',
        highlight: 'Aísla térmica y acústicamente, incombustible',
        confidence: 'estimada',
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
        supplier: 'BigMat',
        productName: 'Ladrillo cerámico perforado 24 × 11,5 × 7 cm',
        brand: 'Cerámica local',
        price: 0.24,
        saleUnit: 'ud',
        coverage: { value: 1, unit: 'ud', note: 'precio por unidad' },
        specs: [
          { key: 'Dimensiones', value: '24 × 11,5 × 7 cm' },
          { key: 'Piezas por m² de fábrica', value: '≈ 45-50 ud en tabicón' },
          { key: 'Palet', value: '300-450 ud' },
          { key: 'Uso', value: 'Fábrica portante y cerramiento' },
        ],
        availability: 'En stock',
        delivery: 'Palet con descarga en obra',
        highlight: 'Formato estándar de obra',
        confidence: 'estimada',
      },
      {
        supplier: 'BigMat Macosol',
        productName: 'Ladrillo hueco doble 24 × 11,5 × 9 cm',
        brand: 'Cerámica local',
        price: 0.21,
        saleUnit: 'ud',
        coverage: { value: 1, unit: 'ud', note: 'precio por unidad' },
        specs: [
          { key: 'Dimensiones', value: '24 × 11,5 × 9 cm' },
          { key: 'Piezas por m²', value: '≈ 45 ud' },
          { key: 'Uso', value: 'Tabiquería interior y trasdosado' },
        ],
        availability: 'En stock',
        delivery: 'Palet con descarga en obra',
        highlight: 'El más económico para tabiquería',
        confidence: 'estimada',
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
        supplier: 'BigMat',
        productName: 'Bloque de hormigón vibrado gris 40 × 20 × 20 cm',
        brand: 'Prefabricados locales',
        price: 0.72,
        saleUnit: 'ud',
        coverage: { value: 1, unit: 'ud', note: 'precio por unidad' },
        specs: [
          { key: 'Dimensiones', value: '40 × 20 × 20 cm' },
          { key: 'Piezas por m²', value: '12,5 ud' },
          { key: 'Palet', value: '60-90 ud' },
          { key: 'Uso', value: 'Muros de carga y cerramientos' },
        ],
        availability: 'En stock',
        delivery: 'Palet con descarga en obra',
        highlight: 'Formato más habitual en cerramientos',
        confidence: 'estimada',
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
        highlight: 'Hormigón estructural certificado',
        confidence: 'estimada',
      },
    ],
  },
  {
    id: 'arido',
    keywords: ['arena', 'grava', 'gravilla', 'arido', 'árido', 'zahorra', 'albero'],
    category: 'Áridos',
    typicalMeasureUnit: 't',
    recommendedWastePct: 0,
    variants: [
      {
        supplier: 'BigMat',
        productName: 'Arena de río lavada 0/4 mm, a granel',
        brand: 'Cantera local',
        price: 21,
        saleUnit: 't',
        coverage: { value: 1000, unit: 'kg', note: 'precio por tonelada a granel' },
        specs: [
          { key: 'Granulometría', value: '0/4 mm' },
          { key: 'Densidad aparente', value: '≈ 1,5 t/m³' },
          { key: 'Uso', value: 'Morteros y soleras' },
        ],
        availability: 'En stock',
        delivery: 'Camión bañera con descarga en obra',
        highlight: 'Suministro a granel para grandes volúmenes',
        confidence: 'estimada',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Arena de río lavada, saco de 25 kg',
        brand: 'Marca propia',
        price: 2.6,
        saleUnit: 'saco',
        coverage: { value: 25, unit: 'kg', note: 'saco de 25 kg' },
        specs: [
          { key: 'Formato', value: 'Saco de 25 kg' },
          { key: 'Uso', value: 'Pequeñas reparaciones y remates' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en almacén',
        highlight: 'Práctico para cantidades pequeñas',
        confidence: 'estimada',
      },
    ],
  },
  {
    id: 'acero',
    keywords: ['acero', 'corrugado', 'b500s', 'ferralla', 'redondo', 'armadura', 'mallazo'],
    category: 'Acero y ferralla',
    typicalMeasureUnit: 'kg',
    recommendedWastePct: 5,
    variants: [
      {
        supplier: 'BigMat',
        productName: 'Barra de acero corrugado B500S Ø12 mm, barra de 6 m',
        brand: 'Siderúrgica nacional',
        price: 5.2,
        saleUnit: 'barra',
        coverage: { value: 6, unit: 'm', note: 'barra de 6 m de longitud' },
        specs: [
          { key: 'Diámetro', value: '12 mm' },
          { key: 'Calidad', value: 'B500S' },
          { key: 'Longitud', value: '6 m' },
          { key: 'Peso lineal', value: '0,888 kg/m' },
        ],
        availability: 'En stock',
        delivery: 'Entrega en obra con camión grúa',
        highlight: 'Diámetro más usado en vigas y zunchos',
        confidence: 'estimada',
      },
      {
        supplier: 'BigMat Macosol',
        productName: 'Mallazo electrosoldado ME 15×15 Ø6-6 B500T, panel 6 × 2,2 m',
        brand: 'Siderúrgica nacional',
        price: 33.5,
        saleUnit: 'panel',
        coverage: { value: 13.2, unit: 'm2', note: 'panel de 6,00 × 2,20 m = 13,20 m²' },
        specs: [
          { key: 'Retícula', value: '15 × 15 cm' },
          { key: 'Diámetro', value: '6 mm' },
          { key: 'Calidad', value: 'B500T' },
          { key: 'Uso', value: 'Soleras y losas de reparto' },
        ],
        availability: 'En stock',
        delivery: 'Entrega en obra',
        highlight: 'Cubre 13,2 m² por panel',
        confidence: 'estimada',
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
        productName: 'Pintura plástica mate interior blanca, bote de 15 L',
        brand: 'Bruguer',
        price: 56,
        saleUnit: 'bote',
        coverage: {
          value: 165,
          unit: 'm2',
          note:
            'rendimiento ≈ 11 m²/L a una mano; 15 L cubren unos 165 m² por mano. Para dos manos, indica el doble de superficie',
        },
        specs: [
          { key: 'Formato', value: 'Bote de 15 L' },
          { key: 'Acabado', value: 'Mate' },
          { key: 'Rendimiento', value: '10-12 m²/L y mano' },
          { key: 'Manos recomendadas', value: '2' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en tienda o envío a obra',
        highlight: 'Buen cubrimiento en interior',
        confidence: 'estimada',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Pintura plástica interior blanca uso profesional, bote de 15 L',
        brand: 'Marca propia',
        price: 34.9,
        saleUnit: 'bote',
        coverage: {
          value: 105,
          unit: 'm2',
          note:
            'rendimiento ≈ 7 m²/L a una mano; 15 L cubren unos 105 m² por mano. Para dos manos, indica el doble de superficie',
        },
        specs: [
          { key: 'Formato', value: 'Bote de 15 L' },
          { key: 'Acabado', value: 'Mate' },
          { key: 'Uso', value: 'Grandes superficies, obra nueva' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en almacén',
        highlight: 'La más económica por metro cuadrado',
        confidence: 'estimada',
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
        supplier: 'Saneamientos Dimasa',
        productName: 'Tubo PVC evacuación Ø110 mm serie B, barra de 3 m',
        brand: 'Adequa',
        price: 9.6,
        saleUnit: 'barra',
        coverage: { value: 3, unit: 'm', note: 'barra de 3 m' },
        specs: [
          { key: 'Diámetro', value: '110 mm' },
          { key: 'Serie', value: 'B (UNE-EN 1329)' },
          { key: 'Longitud', value: '3 m' },
          { key: 'Uso', value: 'Bajantes y colectores de evacuación' },
        ],
        availability: 'En stock',
        delivery: 'Entrega en 24-48 h',
        highlight: 'Marca de referencia en saneamiento',
        confidence: 'estimada',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Tubo PVC evacuación Ø110 mm, barra de 3 m',
        brand: 'Marca propia',
        price: 7.6,
        saleUnit: 'barra',
        coverage: { value: 3, unit: 'm', note: 'barra de 3 m' },
        specs: [
          { key: 'Diámetro', value: '110 mm' },
          { key: 'Longitud', value: '3 m' },
          { key: 'Uso', value: 'Evacuación de aguas residuales' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en almacén',
        highlight: 'Opción económica',
        confidence: 'estimada',
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
        supplier: 'Onulec',
        productName: 'Cable unipolar H07Z1-K 2,5 mm² libre de halógenos, rollo de 100 m',
        brand: 'Top Cable',
        price: 44,
        saleUnit: 'rollo',
        coverage: { value: 100, unit: 'm', note: 'rollo de 100 m' },
        specs: [
          { key: 'Sección', value: '2,5 mm²' },
          { key: 'Tipo', value: 'H07V-K flexible' },
          { key: 'Tensión', value: '450/750 V' },
          { key: 'Uso', value: 'Circuitos de tomas de corriente' },
        ],
        availability: 'En stock',
        delivery: 'Entrega en 24 h en Málaga',
        highlight: 'Sección estándar para enchufes',
        confidence: 'estimada',
      },
      {
        supplier: 'Obramat Málaga',
        productName: 'Cable H07V-K 2,5 mm², rollo de 100 m',
        brand: 'Marca propia',
        price: 32,
        saleUnit: 'rollo',
        coverage: { value: 100, unit: 'm', note: 'rollo de 100 m' },
        specs: [
          { key: 'Sección', value: '2,5 mm²' },
          { key: 'Tensión', value: '450/750 V' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en almacén',
        highlight: 'Opción económica',
        confidence: 'estimada',
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
        brand: 'Marca propia',
        price: 26.9,
        saleUnit: 'plancha',
        coverage: { value: 3.125, unit: 'm2', note: 'tablero de 2,50 × 1,25 m = 3,125 m²' },
        specs: [
          { key: 'Espesor', value: '15 mm' },
          { key: 'Dimensiones', value: '2.500 × 1.250 mm' },
          { key: 'Clase', value: 'OSB3 (ambiente húmedo)' },
          { key: 'Uso', value: 'Encofrado, forjados y cerramientos' },
        ],
        availability: 'En stock',
        delivery: 'Recogida en almacén o entrega en obra',
        highlight: 'Buen comportamiento en ambiente húmedo',
        confidence: 'estimada',
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
        supplier: 'BigMat',
        productName: 'Teja cerámica curva roja 40 × 19 cm',
        brand: 'Cerámica local',
        price: 0.58,
        saleUnit: 'ud',
        coverage: { value: 0.037, unit: 'm2', note: 'se necesitan unas 27 tejas por m² de cubierta' },
        specs: [
          { key: 'Dimensiones', value: '40 × 19 cm' },
          { key: 'Piezas por m²', value: '≈ 27 ud' },
          { key: 'Color', value: 'Rojo natural' },
          { key: 'Uso', value: 'Cubierta inclinada tradicional' },
        ],
        availability: 'En stock',
        delivery: 'Palet con descarga en obra',
        highlight: 'Estética tradicional andaluza',
        confidence: 'estimada',
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
        highlight: 'Solución probada en cubierta plana',
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
        sourceUrl: null,
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
