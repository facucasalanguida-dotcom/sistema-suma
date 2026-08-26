import { Type, type Schema } from '@google/genai';
import { MEASURE_UNITS, SALE_UNITS } from '../units';

/**
 * Esquemas de respuesta estructurada para Gemini.
 *
 * Se evitan a propósito los campos anulables y los objetos anidados opcionales:
 * el subconjunto de OpenAPI que acepta la API es más estrecho que JSON Schema y
 * los modelos son mucho más fiables con formas planas. Los campos "vacíos" se
 * expresan como cadena vacía o cero y se normalizan después con Zod.
 */

const keyValueSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    key: { type: Type.STRING, description: 'Nombre de la característica, en español.' },
    value: { type: Type.STRING, description: 'Valor de la característica, con unidades.' },
  },
  required: ['key', 'value'],
  propertyOrdering: ['key', 'value'],
};

/** Paso 2: qué material quiere el usuario. */
export const materialRequestResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    material: {
      type: Type.STRING,
      description:
        'Denominación técnica del material en español de construcción, lista para buscar en un almacén. Ej.: "Pavimento porcelánico rectificado 60x60 cm".',
    },
    category: {
      type: Type.STRING,
      description:
        'Familia del material: cerámica y pavimentos, cemento y áridos, ladrillo y bloque, yeso laminado, aislamiento, fontanería, electricidad, pintura, madera, cubiertas, ferretería, prefabricados, impermeabilización.',
    },
    attributes: {
      type: Type.ARRAY,
      description: 'Características detectadas: formato, acabado, color, espesor, resistencia, uso.',
      items: keyValueSchema,
    },
    quantityValue: {
      type: Type.NUMBER,
      description: 'Cantidad mencionada por el usuario. 0 si no ha indicado ninguna.',
    },
    quantityUnit: {
      type: Type.STRING,
      description: 'Unidad de la cantidad mencionada. Cadena vacía si no ha indicado ninguna.',
      enum: ['', ...MEASURE_UNITS],
    },
    typicalMeasureUnit: {
      type: Type.STRING,
      description: 'Unidad en la que se mide habitualmente este material en obra.',
      enum: [...MEASURE_UNITS],
    },
    searchQueries: {
      type: Type.ARRAY,
      description:
        'Entre 2 y 4 consultas de búsqueda en español para localizar este material en proveedores de la provincia de Málaga, con precio.',
      items: { type: Type.STRING },
    },
    confidence: {
      type: Type.NUMBER,
      description: 'Seguridad de la interpretación, de 0 a 1.',
    },
    clarifyingQuestion: {
      type: Type.STRING,
      description:
        'Si la petición es ambigua, una única pregunta breve para concretarla. Cadena vacía si está clara.',
    },
    imageDescription: {
      type: Type.STRING,
      description:
        'Si se ha adjuntado una imagen, qué material se aprecia y con qué detalle. Cadena vacía si no había imagen.',
    },
  },
  required: [
    'material',
    'category',
    'attributes',
    'quantityValue',
    'quantityUnit',
    'typicalMeasureUnit',
    'searchQueries',
    'confidence',
    'clarifyingQuestion',
    'imageDescription',
  ],
  propertyOrdering: [
    'imageDescription',
    'material',
    'category',
    'attributes',
    'quantityValue',
    'quantityUnit',
    'typicalMeasureUnit',
    'searchQueries',
    'confidence',
    'clarifyingQuestion',
  ],
};

/** Paso 3: ofertas de proveedores de Málaga. */
export const offersResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description:
        'Uno o dos párrafos cortos, en español, resumiendo qué se ha encontrado y en qué se diferencian las opciones.',
    },
    offers: {
      type: Type.ARRAY,
      description: 'Opciones encontradas, ordenadas de mejor relación calidad-precio a peor.',
      items: {
        type: Type.OBJECT,
        properties: {
          productName: { type: Type.STRING, description: 'Denominación comercial del producto.' },
          brand: { type: Type.STRING, description: 'Marca o fabricante. Vacío si se desconoce.' },
          supplierName: { type: Type.STRING, description: 'Nombre del proveedor o almacén.' },
          supplierLocation: {
            type: Type.STRING,
            description: 'Municipio o zona de la provincia de Málaga.',
          },
          supplierWebsite: { type: Type.STRING, description: 'Dominio web. Vacío si se desconoce.' },
          supplierPhone: { type: Type.STRING, description: 'Teléfono. Vacío si se desconoce.' },
          price: {
            type: Type.NUMBER,
            description: 'Precio en euros de UNA unidad de venta, sin IVA salvo que se indique.',
          },
          saleUnit: {
            type: Type.STRING,
            description: 'Unidad comercial a la que se refiere el precio.',
            enum: [...SALE_UNITS],
          },
          priceIncludesVat: {
            type: Type.BOOLEAN,
            description: 'true sólo si el precio indicado ya lleva el IVA incluido.',
          },
          coverageValue: {
            type: Type.NUMBER,
            description:
              'Cuánta magnitud medible rinde UNA unidad de venta. Caja de porcelánico 60x60 de 4 piezas -> 1.44. Saco de cemento cola de 25 kg a 5 kg/m2 -> 5. Barra de 6 m -> 6. Si el precio ya es por m2, m, kg o ud -> 1.',
          },
          coverageUnit: {
            type: Type.STRING,
            description: 'Unidad del rendimiento anterior.',
            enum: [...MEASURE_UNITS],
          },
          coverageNote: {
            type: Type.STRING,
            description:
              'Cómo se obtiene ese rendimiento. Ej.: "caja de 4 piezas de 60x60 cm = 1,44 m2".',
          },
          recommendedWastePct: {
            type: Type.NUMBER,
            description:
              'Merma recomendada en % para cortes, roturas y solapes. 0 si no procede. Cerámica 5-10, pintura 5, tubería 5, áridos 0.',
          },
          specs: {
            type: Type.ARRAY,
            description:
              'Ficha técnica: formato, espesor, acabado, resistencia, clase, peso, uso recomendado.',
            items: keyValueSchema,
          },
          availability: {
            type: Type.STRING,
            description: 'Disponibilidad o plazo. Vacío si se desconoce.',
          },
          delivery: {
            type: Type.STRING,
            description: 'Condiciones de entrega en la provincia de Málaga. Vacío si se desconoce.',
          },
          sourceUrl: {
            type: Type.STRING,
            description: 'URL de la ficha o tarifa consultada. Vacío si no procede de una fuente.',
          },
          confidence: {
            type: Type.STRING,
            description:
              'alta = precio publicado y verificado; media = precio de catálogo o rango del sector; estimada = precio de mercado orientativo.',
            enum: ['alta', 'media', 'estimada'],
          },
          highlight: {
            type: Type.STRING,
            description:
              'Por qué elegir esta opción en una frase: "la más económica", "mejor calidad", "entrega en 24 h".',
          },
        },
        required: [
          'productName',
          'brand',
          'supplierName',
          'supplierLocation',
          'supplierWebsite',
          'supplierPhone',
          'price',
          'saleUnit',
          'priceIncludesVat',
          'coverageValue',
          'coverageUnit',
          'coverageNote',
          'recommendedWastePct',
          'specs',
          'availability',
          'delivery',
          'sourceUrl',
          'confidence',
          'highlight',
        ],
        propertyOrdering: [
          'productName',
          'brand',
          'supplierName',
          'supplierLocation',
          'supplierWebsite',
          'supplierPhone',
          'price',
          'saleUnit',
          'priceIncludesVat',
          'coverageValue',
          'coverageUnit',
          'coverageNote',
          'recommendedWastePct',
          'specs',
          'availability',
          'delivery',
          'sourceUrl',
          'confidence',
          'highlight',
        ],
      },
    },
  },
  required: ['summary', 'offers'],
  propertyOrdering: ['summary', 'offers'],
};

/** Pasos 5-6: interpretación de la cantidad escrita por el usuario. */
export const quantityResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    understood: {
      type: Type.BOOLEAN,
      description: 'false si no se puede deducir una cantidad concreta del mensaje.',
    },
    value: { type: Type.NUMBER, description: 'Cantidad numérica. 0 si understood es false.' },
    unit: {
      type: Type.STRING,
      description: 'Unidad de la cantidad.',
      enum: ['', ...MEASURE_UNITS],
    },
    wastePct: {
      type: Type.NUMBER,
      description:
        'Merma recomendada en % para este material y esta cantidad. 0 si no procede o si el usuario ya la incluyó.',
    },
    clarification: {
      type: Type.STRING,
      description:
        'Si understood es false, la pregunta exacta que hay que hacerle al usuario. Vacío en caso contrario.',
    },
    reasoning: {
      type: Type.STRING,
      description: 'Una frase explicando la conversión aplicada, para mostrarla al usuario.',
    },
  },
  required: ['understood', 'value', 'unit', 'wastePct', 'clarification', 'reasoning'],
  propertyOrdering: ['understood', 'value', 'unit', 'wastePct', 'clarification', 'reasoning'],
};
