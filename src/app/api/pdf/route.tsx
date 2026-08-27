import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BudgetDocument } from '@/pdf/BudgetDocument';
import { DEFAULT_VAT_PCT, buildReference, computeTotals, validUntil } from '@/lib/pricing';
import { supplierOfferSchema, type BudgetDocumentData, type BudgetLine } from '@/lib/types';
import { requireApiSession } from '@/lib/auth/guard';

export const runtime = 'nodejs';
export const maxDuration = 60;

const breakdownSchema = z.object({
  requested: z.object({ value: z.number(), unit: z.string() }),
  wastePct: z.number(),
  quantityWithWaste: z.number(),
  workingUnit: z.string(),
  coveragePerSaleUnit: z.number(),
  saleUnitsExact: z.number(),
  saleUnits: z.number(),
  roundedUp: z.boolean(),
  unitPrice: z.number(),
  lineTotal: z.number(),
  explanation: z.string(),
});

const bodySchema = z.object({
  lines: z
    .array(
      z.object({
        id: z.string(),
        offer: supplierOfferSchema,
        breakdown: breakdownSchema,
        note: z.string().optional(),
        addedAt: z.string(),
      }),
    )
    .min(1, 'El presupuesto no tiene ninguna partida.'),
  laborLines: z
    .array(
      z.object({
        id: z.string(),
        description: z.string(),
        detail: z.string().nullable().default(null),
        amount: z.number().nonnegative(),
      }),
    )
    .default([]),
  client: z.object({
    name: z.string().default(''),
    taxId: z.string().default(''),
    address: z.string().default(''),
    contact: z.string().default(''),
    email: z.string().default(''),
    projectName: z.string().default(''),
    siteAddress: z.string().default(''),
  }),
  marginPct: z.number().min(0).max(300).default(0),
  discountPct: z.number().min(0).max(100).default(0),
  vatPct: z.number().min(0).max(100).default(DEFAULT_VAT_PCT),
  notes: z.string().max(2000).default(''),
  reference: z.string().optional(),
});

/**
 * Paso 7 del proceso: genera el PDF del presupuesto.
 *
 * Los totales se recalculan aquí a partir de las partidas en lugar de aceptar
 * los que envía el navegador: el documento que se firma no debe depender de un
 * número que se pueda manipular desde el cliente.
 */
export async function POST(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;

  let body;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? 'Datos del presupuesto no válidos.')
        : 'Datos del presupuesto no válidos.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const issuedAt = new Date();
  const lines = body.lines as BudgetLine[];

  const data: BudgetDocumentData = {
    reference: body.reference?.trim() || buildReference(issuedAt),
    issuedAt: issuedAt.toISOString(),
    validUntil: validUntil(issuedAt).toISOString(),
    client: body.client,
    lines,
    laborLines: body.laborLines,
    totals: computeTotals(lines, {
      discountPct: body.discountPct,
      vatPct: body.vatPct,
      laborLines: body.laborLines,
      marginPct: body.marginPct,
    }),
    notes: body.notes.trim(),
    containsEstimates: lines.some((line) => line.offer.confidence === 'estimada'),
  };

  // El elemento se construye fuera del `try`: `renderToBuffer` es quien puede
  // fallar, no la creación del elemento, y así queda claro qué se está
  // vigilando.
  const document = <BudgetDocument data={data} />;

  try {
    const buffer = await renderToBuffer(document);
    const fileName = `Presupuesto-SUMA-${data.reference}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[suma] error generando el PDF:', error);
    return NextResponse.json(
      { error: 'No se ha podido generar el PDF del presupuesto.' },
      { status: 500 },
    );
  }
}
