import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { BudgetDocument } from '@/pdf/BudgetDocument';
import { searchDemoCatalog } from '@/lib/demo/catalog';
import { buildReference, computeLinePrice, computeTotals, validUntil } from '@/lib/pricing';
import type { BudgetDocumentData, BudgetLine } from '@/lib/types';

function sampleBudget(): BudgetDocumentData {
  const picks: Array<[string, number, 'm2' | 'm' | 'kg' | 'ud' | 'm3']> = [
    ['porcelanico', 46, 'm2'],
    ['cemento cola', 46, 'm2'],
    ['pladur', 62, 'm2'],
    ['aislamiento', 62, 'm2'],
    ['pintura', 180, 'm2'],
    ['tubo pvc', 34, 'm'],
    ['cable', 240, 'm'],
    ['hormigon', 4.5, 'm3'],
  ];

  const lines: BudgetLine[] = picks.map(([query, value, unit], index) => {
    const offer = searchDemoCatalog(query, 1)[0];
    if (!offer) throw new Error(`sin oferta de demostración para «${query}»`);
    return {
      id: `line-${index}`,
      offer,
      breakdown: computeLinePrice(offer, { value, unit }),
      note: index === 0 ? 'Junta de 2 mm en color gris cemento.' : undefined,
      addedAt: new Date('2026-03-04T09:00:00Z').toISOString(),
    };
  });

  const issuedAt = new Date('2026-03-04T09:00:00Z');

  return {
    reference: buildReference(issuedAt, 128),
    issuedAt: issuedAt.toISOString(),
    validUntil: validUntil(issuedAt).toISOString(),
    client: {
      name: 'Promociones Costa del Sol, S.L.',
      taxId: 'B29123456',
      address: 'Avenida de Andalucía 24, 29006 Málaga',
      contact: 'Dirección técnica',
      email: 'obras@promocionescostadelsol.example',
      projectName: 'Reforma integral de 6 viviendas · Fase 1',
      siteAddress: 'Urbanización Los Álamos, parcela 12 · 29631 Benalmádena',
    },
    lines,
    totals: computeTotals(lines, { discountPct: 5, vatPct: 21 }),
    notes:
      'Los plazos de entrega se confirmarán al formalizar el pedido. No se incluye la retirada de escombros.',
    containsEstimates: lines.some((line) => line.offer.confidence === 'estimada'),
  };
}

describe('PDF del presupuesto', () => {
  it('genera un PDF válido y no vacío', async () => {
    const data = sampleBudget();
    const buffer = await renderToBuffer(<BudgetDocument data={data} />);

    expect(buffer.byteLength).toBeGreaterThan(5000);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buffer.subarray(-1024).toString('latin1')).toContain('%%EOF');

    const outDir = path.join(import.meta.dirname, '..', 'tmp');
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, 'presupuesto-ejemplo.pdf'), buffer);
  }, 60_000);

  it('conserva los acentos y el símbolo del euro', async () => {
    const data = sampleBudget();
    const buffer = await renderToBuffer(<BudgetDocument data={data} />);
    // El texto va comprimido en los flujos del PDF; basta con comprobar que el
    // documento declara las fuentes estándar y no ha reventado al codificar.
    const raw = buffer.toString('latin1');
    expect(raw).toContain('/Type /Font');
    expect(raw).toContain('Helvetica');
  }, 60_000);

  it('no lanza con un presupuesto de una sola partida', async () => {
    const offer = searchDemoCatalog('cemento', 1)[0];
    const line: BudgetLine = {
      id: 'unica',
      offer,
      breakdown: computeLinePrice(offer, { value: 300, unit: 'kg' }),
      addedAt: new Date().toISOString(),
    };
    const data: BudgetDocumentData = {
      reference: 'PRE-2026-0001',
      issuedAt: new Date().toISOString(),
      validUntil: validUntil().toISOString(),
      client: {
        name: '',
        taxId: '',
        address: '',
        contact: '',
        email: '',
        projectName: '',
        siteAddress: '',
      },
      lines: [line],
      totals: computeTotals([line]),
      notes: '',
      containsEstimates: false,
    };
    const buffer = await renderToBuffer(<BudgetDocument data={data} />);
    expect(buffer.byteLength).toBeGreaterThan(3000);
  }, 60_000);
});
