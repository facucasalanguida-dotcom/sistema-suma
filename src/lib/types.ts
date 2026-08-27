import { z } from 'zod';
import { MEASURE_UNITS, SALE_UNITS } from './units';

export const measureUnitSchema = z.enum(MEASURE_UNITS);
export const saleUnitSchema = z.enum(SALE_UNITS);

/** Nivel de fiabilidad de un precio localizado por la IA. */
export const priceConfidenceSchema = z.enum(['alta', 'media', 'estimada']);
export type PriceConfidence = z.infer<typeof priceConfidenceSchema>;

/* ────────────────────────────────────────────────────────────────────────── */
/* Paso 2 · Interpretación del material pedido                                */
/* ────────────────────────────────────────────────────────────────────────── */

export const materialRequestSchema = z.object({
  /** Nombre normalizado del material, en español técnico de construcción. */
  material: z.string(),
  /** Familia: cerámica, cemento y áridos, aislamiento, fontanería… */
  category: z.string(),
  /** Características detectadas (formato, acabado, resistencia, color…). */
  attributes: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
  /** Cantidad si el usuario ya la mencionó en el mensaje. */
  quantityHint: z
    .object({ value: z.number().positive(), unit: measureUnitSchema })
    .nullable()
    .default(null),
  /** Unidad en la que normalmente se mide este material en obra. */
  typicalMeasureUnit: measureUnitSchema,
  /** Consultas de búsqueda a lanzar contra proveedores de Málaga. */
  searchQueries: z.array(z.string()).default([]),
  /** 0–1. Por debajo de 0,45 conviene preguntar antes de buscar. */
  confidence: z.number().min(0).max(1),
  /** Pregunta de desambiguación si el material no está claro. */
  clarifyingQuestion: z.string().nullable().default(null),
  /** Descripción de lo que se ve en la imagen, si se envió una. */
  imageDescription: z.string().nullable().default(null),
});

export type MaterialRequest = z.infer<typeof materialRequestSchema>;

/* ────────────────────────────────────────────────────────────────────────── */
/* Paso 3 · Ofertas de proveedores                                            */
/* ────────────────────────────────────────────────────────────────────────── */

export const supplierSchema = z.object({
  name: z.string(),
  /** Municipio o zona de Málaga. */
  location: z.string(),
  website: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
});

export type Supplier = z.infer<typeof supplierSchema>;

export const supplierOfferSchema = z.object({
  id: z.string(),
  /** Denominación comercial del producto. */
  productName: z.string(),
  brand: z.string().nullable().default(null),
  supplier: supplierSchema,
  /** Precio por una unidad de venta, en euros. */
  price: z.number().nonnegative(),
  /** Unidad a la que se refiere `price`. */
  saleUnit: saleUnitSchema,
  /** `true` si `price` ya incluye el IVA. */
  priceIncludesVat: z.boolean().default(false),
  /**
   * Rendimiento: cuánta magnitud medible aporta UNA unidad de venta.
   * Ej.: caja de porcelánico → { value: 1.44, unit: 'm2' }
   *      saco de cemento cola → { value: 5, unit: 'm2' } (a 5 kg/m²)
   *      barra de 6 m         → { value: 6, unit: 'm' }
   */
  coverage: z.object({
    value: z.number().positive(),
    unit: measureUnitSchema,
    /** Explicación del rendimiento ("caja de 6 piezas 60×60 = 2,16 m²"). */
    note: z.string().nullable().default(null),
  }),
  /** Merma recomendada en % para cortes y roturas (0 si no aplica). */
  recommendedWastePct: z.number().min(0).max(30).default(0),
  /** Ficha técnica resumida. */
  specs: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
  availability: z.string().nullable().default(null),
  /** Notas de entrega en la provincia de Málaga. */
  delivery: z.string().nullable().default(null),
  sourceUrl: z.string().nullable().default(null),
  /**
   * `true` si el servidor comprobó, en el momento de la búsqueda, que la
   * ficha de `sourceUrl` respondía (o que Google la tenía indexada). No es
   * una garantía perpetua —los catálogos cambian—, pero sí la evidencia de
   * que el producto existía al buscarlo.
   */
  linkVerified: z.boolean().default(false),
  confidence: priceConfidenceSchema,
  /** Motivo por el que esta opción puede interesar (calidad/precio/plazo). */
  highlight: z.string().nullable().default(null),
  /**
   * Familia de producto a la que pertenece la oferta. Sirve para no comparar
   * el precio por m² de un porcelánico con el de una lámina asfáltica: la
   * etiqueta «más económica» sólo se calcula dentro de una misma familia.
   * `null` cuando todas las ofertas del mensaje son del mismo material.
   */
  group: z.string().nullable().default(null),
});

export type SupplierOffer = z.infer<typeof supplierOfferSchema>;

/* ────────────────────────────────────────────────────────────────────────── */
/* Pasos 5–6 · Cantidad y cálculo                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export const quantityInputSchema = z.object({
  value: z.number().positive(),
  unit: measureUnitSchema,
});

export type QuantityInput = z.infer<typeof quantityInputSchema>;

/** Resultado del cálculo determinista realizado en `pricing.ts`. */
export interface PriceBreakdown {
  /** Lo que pidió el usuario, tal cual. */
  requested: QuantityInput;
  /** Merma aplicada, en %. */
  wastePct: number;
  /** Cantidad con merma incluida, en la unidad del rendimiento. */
  quantityWithWaste: number;
  /** Unidad en la que se ha hecho el cálculo. */
  workingUnit: string;
  /** Rendimiento por unidad de venta usado en el cálculo. */
  coveragePerSaleUnit: number;
  /** Unidades de venta exactas (con decimales). */
  saleUnitsExact: number;
  /** Unidades de venta a facturar (redondeadas si son indivisibles). */
  saleUnits: number;
  /** `true` si se redondeó hacia arriba por indivisibilidad. */
  roundedUp: boolean;
  /** Precio unitario sin IVA. */
  unitPrice: number;
  /** Importe de la línea sin IVA. */
  lineTotal: number;
  /** Explicación en lenguaje natural del cálculo. */
  explanation: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Paso 4 · Presupuesto                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export interface BudgetLine {
  id: string;
  offer: SupplierOffer;
  breakdown: PriceBreakdown;
  /** Nota libre del usuario para esta partida. */
  note?: string;
  addedAt: string;
}

export interface ClientDetails {
  name: string;
  taxId: string;
  /** Domicilio fiscal del cliente. */
  address: string;
  contact: string;
  email: string;
  projectName: string;
  /** Emplazamiento de la obra o dirección de entrega, si difiere del fiscal. */
  siteAddress: string;
}

export interface BudgetTotals {
  /** Importe de los materiales, sin IVA. */
  materialsSubtotal: number;
  /** Importe de la mano de obra, sin IVA. */
  laborTotal: number;
  /** Coste de la obra: materiales + mano de obra, sin margen. */
  costSubtotal: number;
  /** Margen de ganancia aplicado sobre el coste, en %. */
  marginPct: number;
  /** Ganancia en euros que aporta ese margen. */
  marginAmount: number;
  /** Lo que se cobra antes de descuento e IVA: coste + margen. */
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  /** Base imponible tras descuento. */
  taxableBase: number;
  vatPct: number;
  vatAmount: number;
  total: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Mano de obra                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

/** Partida de mano de obra, interpretada por la IA a partir de texto libre. */
export interface LaborLine {
  id: string;
  /** Concepto («Alicatado del baño», «Instalación eléctrica»). */
  description: string;
  /** Detalle del cálculo («2 oficiales × 5 días × 120 €/día»). */
  detail: string | null;
  /** Importe sin IVA, en euros. */
  amount: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Proyectos: presupuestos guardados, pagos, cobros y salarios               */
/* ────────────────────────────────────────────────────────────────────────── */

/** Fotografía de un presupuesto terminado, guardada dentro de un proyecto. */
export interface SavedBudget {
  id: string;
  reference: string;
  savedAt: string;
  clientName: string;
  lines: BudgetLine[];
  laborLines: LaborLine[];
  marginPct: number;
  discountPct: number;
  vatPct: number;
  notes: string;
  totals: BudgetTotals;
}

/** Pago manual a un proveedor o gasto de material fuera del presupuesto. */
export interface SupplierPayment {
  id: string;
  concept: string;
  supplier: string | null;
  amount: number;
  date: string;
}

/** Cobro recibido del cliente del proyecto. */
export interface CollectionEntry {
  id: string;
  amount: number;
  date: string;
  note: string | null;
}

/** Una obra: la carpeta donde viven sus presupuestos, pagos y cobros. */
export interface Project {
  id: string;
  name: string;
  createdAt: string;
  budgets: SavedBudget[];
  /** Ids de partidas de material ya pagadas (tachadas en «Pagos»). */
  paidLineIds: string[];
  extraPayments: SupplierPayment[];
  collections: CollectionEntry[];
}

export interface Employee {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  employees: Employee[];
}

/** Pago de salario registrado a un empleado. */
export interface SalaryPayment {
  id: string;
  employeeId: string;
  /** Nombre en el momento del pago, por si el empleado se renombra o borra. */
  employeeName: string;
  teamId: string;
  /** Proyecto al que se imputa el pago, si se indica. */
  projectId: string | null;
  amount: number;
  date: string;
  note: string | null;
}

export interface BudgetDocumentData {
  reference: string;
  issuedAt: string;
  validUntil: string;
  client: ClientDetails;
  lines: BudgetLine[];
  laborLines: LaborLine[];
  totals: BudgetTotals;
  notes: string;
  /** `true` si alguna línea usó precios del catálogo de demostración. */
  containsEstimates: boolean;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Mensajes del chat                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export type ChatMessage =
  | { id: string; role: 'user'; kind: 'text'; text: string; imageDataUrl?: string; at: string }
  | { id: string; role: 'assistant'; kind: 'text'; text: string; at: string }
  | { id: string; role: 'assistant'; kind: 'error'; text: string; at: string }
  | {
      id: string;
      role: 'assistant';
      kind: 'results';
      text: string;
      request: MaterialRequest;
      offers: SupplierOffer[];
      sources: GroundingSource[];
      demoMode: boolean;
      at: string;
    }
  | {
      id: string;
      role: 'assistant';
      kind: 'quantity-request';
      text: string;
      offer: SupplierOffer;
      /** `true` cuando el usuario ya respondió y la partida se añadió. */
      resolved: boolean;
      at: string;
    }
  | {
      id: string;
      role: 'assistant';
      kind: 'line-added';
      text: string;
      line: BudgetLine;
      at: string;
    };

export interface GroundingSource {
  title: string;
  url: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Contratos de las rutas API                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export const chatRequestSchema = z.object({
  text: z.string().max(4000).default(''),
  image: z
    .object({ mimeType: z.string(), data: z.string() })
    .nullable()
    .default(null),
  /** Últimos turnos, para resolver referencias como "el mismo pero en blanco". */
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string() }))
    .max(20)
    .default([]),
});

export type ChatRequestPayload = z.infer<typeof chatRequestSchema>;

export interface ChatResponsePayload {
  reply: string;
  request: MaterialRequest | null;
  offers: SupplierOffer[];
  sources: GroundingSource[];
  needsClarification: boolean;
  demoMode: boolean;
}

export const quantityRequestSchema = z.object({
  offer: supplierOfferSchema,
  /** Lo que el usuario escribió: "24 m2", "necesito 350 cm", "12 metros". */
  phrase: z.string().min(1).max(200),
  /** Merma en % elegida en la interfaz; si falta se usa la recomendada. */
  wastePct: z.number().min(0).max(30).nullable().default(null),
});

export interface QuantityResponsePayload {
  /** `null` cuando no se pudo interpretar la cantidad y hay que preguntar. */
  breakdown: PriceBreakdown | null;
  reply: string;
  /** Pregunta de aclaración si no se entendió la cantidad. */
  clarification: string | null;
}
