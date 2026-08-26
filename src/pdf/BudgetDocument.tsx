import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { SumaPdfLogo } from './logo';
import { pdfText } from './text';
import { company, issuerIsPlaceholder, printColors } from '@/lib/brand';
import { formatCurrency, formatLongDate, formatPrecise } from '@/lib/format';
import type { BudgetDocumentData } from '@/lib/types';
import { agreeWithSaleUnit, measureLabel, saleUnitLabel } from '@/lib/units';

/**
 * Paso 7 del proceso: el presupuesto en PDF con la identidad de SUMA.
 *
 * Sigue la estructura habitual de un presupuesto de obra español: datos del
 * emisor y del cliente, número y validez de la oferta, partidas con medición y
 * precio unitario, base imponible, IVA y total, condiciones y aceptación.
 *
 * La marca entra por las bandas —cabecera, cabecera de tabla, bloque de total
 * y filetes—, en el negro y el rojo corporativos; el cuerpo va sobre papel
 * blanco porque un presupuesto se imprime, se firma y se archiva.
 *
 * Se usan las tipografías estándar del formato PDF: Helvetica para el texto y
 * Times para los titulares, que hace eco de la tipografía con remate de los
 * títulos de gruposuma.eu. Así el documento no depende de ningún archivo
 * externo. Para usar la tipografía corporativa, registrar el TTF con
 * `Font.register` y sustituir `fontFamily`.
 */

const PAGE_PADDING_X = 40;

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 74,
    paddingHorizontal: PAGE_PADDING_X,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: printColors.ink,
    backgroundColor: printColors.paper,
  },

  /* Cabecera ------------------------------------------------------------- */
  // Banda a sangre: se sale de los márgenes de la página con margen negativo,
  // igual que la franja superior de gruposuma.eu.
  headerBand: {
    marginHorizontal: -PAGE_PADDING_X,
    paddingHorizontal: PAGE_PADDING_X,
    paddingTop: 26,
    paddingBottom: 20,
    backgroundColor: printColors.band,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerRight: { alignItems: 'flex-end' },
  documentKind: {
    fontFamily: 'Times-Bold',
    fontSize: 22,
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  documentReference: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    letterSpacing: 0.6,
    color: printColors.red,
    marginTop: 3,
  },
  headerMeta: { fontSize: 8, color: '#9EA0A8', marginTop: 2 },
  headerTagline: {
    fontSize: 7,
    letterSpacing: 1.4,
    color: printColors.red,
    marginTop: 7,
    textTransform: 'uppercase',
  },

  /* Aviso de datos del emisor sin configurar ----------------------------- */
  draftBanner: {
    marginTop: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: printColors.red,
    backgroundColor: printColors.redTint,
  },
  draftTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    letterSpacing: 1.4,
    color: printColors.redDeep,
    marginBottom: 3,
  },
  draftText: { fontSize: 8, color: printColors.ink, lineHeight: 1.45 },

  /* Bloques de datos ----------------------------------------------------- */
  panels: { flexDirection: 'row', gap: 12, marginTop: 16 },
  panel: {
    flex: 1,
    borderWidth: 1,
    borderColor: printColors.border,
    borderRadius: 4,
    padding: 10,
  },
  panelAccent: { backgroundColor: printColors.tint, borderColor: printColors.border },
  panelTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    letterSpacing: 1.2,
    color: printColors.red,
    marginBottom: 5,
  },
  panelName: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginBottom: 3 },
  panelLine: { fontSize: 8.5, color: printColors.muted, lineHeight: 1.45 },

  /* Tabla ---------------------------------------------------------------- */
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 1.3,
    color: printColors.red,
    marginTop: 18,
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: printColors.band,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderTopWidth: 2,
    borderTopColor: printColors.red,
  },
  tableHeaderCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: printColors.border,
  },
  rowAlt: { backgroundColor: printColors.tint },

  colIndex: { width: 22 },
  colDescription: { flex: 1, paddingRight: 8 },
  colQuantity: { width: 62, textAlign: 'right' },
  colUnit: { width: 46, textAlign: 'right' },
  colPrice: { width: 60, textAlign: 'right' },
  colAmount: { width: 66, textAlign: 'right' },

  productName: { fontFamily: 'Helvetica-Bold', fontSize: 9, lineHeight: 1.3 },
  productMeta: { fontSize: 7.5, color: printColors.muted, marginTop: 2, lineHeight: 1.35 },
  productCalc: { fontSize: 7, color: printColors.redDeep, marginTop: 3, lineHeight: 1.35 },
  cellNumber: { fontSize: 9 },
  cellAmount: { fontFamily: 'Helvetica-Bold', fontSize: 9 },

  /* Totales -------------------------------------------------------------- */
  totalsWrapper: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  totals: { width: 250 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  totalLabel: { fontSize: 9, color: printColors.muted },
  totalValue: { fontSize: 9 },
  totalDivider: { height: 1, backgroundColor: printColors.border, marginVertical: 3 },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: printColors.band,
    borderLeftWidth: 4,
    borderLeftColor: printColors.red,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginTop: 5,
  },
  grandTotalLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: '#FFFFFF',
  },
  grandTotalValue: { fontFamily: 'Helvetica-Bold', fontSize: 14, color: '#FFFFFF' },

  /* Avisos y condiciones ------------------------------------------------- */
  callout: {
    marginTop: 14,
    padding: 9,
    borderLeftWidth: 3,
    borderLeftColor: printColors.red,
    backgroundColor: printColors.redTint,
  },
  calloutNeutral: {
    borderLeftColor: printColors.band,
    backgroundColor: printColors.tint,
  },
  calloutTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 0.8,
    color: printColors.redDeep,
    marginBottom: 2,
  },
  calloutText: { fontSize: 7.5, color: printColors.ink, lineHeight: 1.45 },

  conditions: { marginTop: 16 },
  conditionItem: { flexDirection: 'row', marginBottom: 3 },
  conditionBullet: { width: 10, fontSize: 8, color: printColors.red },
  conditionText: { flex: 1, fontSize: 7.8, color: printColors.muted, lineHeight: 1.45 },

  signatures: { flexDirection: 'row', gap: 24, marginTop: 22 },
  signatureBox: { flex: 1 },
  signatureLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: printColors.red,
    marginBottom: 26,
  },
  signatureRule: { borderTopWidth: 1, borderTopColor: printColors.ink, paddingTop: 4 },
  signatureHint: { fontSize: 7, color: printColors.muted },

  acceptance: {
    marginTop: 18,
    padding: 10,
    backgroundColor: printColors.tint,
  },
  slogan: {
    marginTop: 8,
    fontFamily: 'Times-Bold',
    fontSize: 11,
    color: printColors.redDeep,
  },

  /* Cabecera reducida de las páginas siguientes -------------------------- */
  compactBand: {
    marginHorizontal: -PAGE_PADDING_X,
    paddingHorizontal: PAGE_PADDING_X,
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: printColors.band,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactHeaderText: { fontSize: 8, color: '#9EA0A8' },

  /* Pie ------------------------------------------------------------------ */
  footer: {
    position: 'absolute',
    bottom: 26,
    left: PAGE_PADDING_X,
    right: PAGE_PADDING_X,
  },
  footerRule: { height: 2, backgroundColor: printColors.red, width: 40, marginBottom: 6 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  footerText: { fontSize: 6.8, color: printColors.muted, lineHeight: 1.5 },
  footerPage: { fontSize: 7, color: printColors.muted },
});


export interface BudgetDocumentProps {
  data: BudgetDocumentData;
}

export function BudgetDocument({ data }: BudgetDocumentProps) {
  const { client, lines, totals } = data;

  return (
    <Document
      title={`Presupuesto ${data.reference} · ${company.tradeName}`}
      author={company.legalName}
      subject={client.projectName || 'Presupuesto de materiales de construcción'}
      creator={`${company.tradeName} · Sistema de presupuestos`}
      producer={company.legalName}
      language="es-ES"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand}>
          <View>
            <SumaPdfLogo size={20} />
            <Text style={styles.headerTagline}>{company.tagline}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.documentKind}>Presupuesto</Text>
            <Text style={styles.documentReference}>{data.reference}</Text>
            <Text style={styles.headerMeta}>Fecha de emisión: {formatLongDate(data.issuedAt)}</Text>
            <Text style={styles.headerMeta}>Válido hasta: {formatLongDate(data.validUntil)}</Text>
          </View>
        </View>

        {issuerIsPlaceholder ? (
          <View style={styles.draftBanner}>
            <Text style={styles.draftTitle}>DOCUMENTO DE PRUEBA</Text>
            <Text style={styles.draftText}>
              Los datos del emisor son todavía los de ejemplo: el NIF, el domicilio y el
              teléfono que figuran abajo no son los de SUMA. Este presupuesto sirve para
              probar el sistema; no debe enviarse a un cliente.
            </Text>
          </View>
        ) : null}

        <View style={styles.panels}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>EMISOR</Text>
            <Text style={styles.panelName}>{company.legalName}</Text>
            <Text style={styles.panelLine}>NIF/CIF: {company.taxId}</Text>
            <Text style={styles.panelLine}>{company.address}</Text>
            <Text style={styles.panelLine}>
              {company.phone} · {company.email}
            </Text>
            <Text style={styles.panelLine}>{company.website}</Text>
          </View>

          <View style={[styles.panel, styles.panelAccent]}>
            <Text style={styles.panelTitle}>CLIENTE</Text>
            <Text style={styles.panelName}>{pdfText(client.name) || 'Cliente por determinar'}</Text>
            {client.taxId ? <Text style={styles.panelLine}>CIF/NIF: {pdfText(client.taxId)}</Text> : null}
            {client.address ? <Text style={styles.panelLine}>{pdfText(client.address)}</Text> : null}
            {client.contact ? (
              <Text style={styles.panelLine}>Contacto: {pdfText(client.contact)}</Text>
            ) : null}
            {client.email ? <Text style={styles.panelLine}>{pdfText(client.email)}</Text> : null}
            {client.projectName ? (
              <Text style={styles.panelLine}>Obra: {pdfText(client.projectName)}</Text>
            ) : null}
            {client.siteAddress ? (
              <Text style={styles.panelLine}>
                Emplazamiento: {pdfText(client.siteAddress)}
              </Text>
            ) : null}
          </View>
        </View>

        <Text style={styles.sectionTitle}>DETALLE DE PARTIDAS</Text>

        <View style={styles.tableHeader} fixed>
          <Text style={[styles.tableHeaderCell, styles.colIndex]}>Nº</Text>
          <Text style={[styles.tableHeaderCell, styles.colDescription]}>DESCRIPCIÓN</Text>
          <Text style={[styles.tableHeaderCell, styles.colQuantity]}>MEDICIÓN</Text>
          <Text style={[styles.tableHeaderCell, styles.colUnit]}>UD.</Text>
          <Text style={[styles.tableHeaderCell, styles.colPrice]}>P. UNIT.</Text>
          <Text style={[styles.tableHeaderCell, styles.colAmount]}>IMPORTE</Text>
        </View>

        {lines.map((line, index) => {
          const { offer, breakdown } = line;
          const specs = offer.specs
            .slice(0, 4)
            .map((spec) => `${pdfText(spec.key)}: ${pdfText(spec.value)}`)
            .join(' · ');

          return (
            <View
              key={line.id}
              style={[styles.row, ...(index % 2 === 1 ? [styles.rowAlt] : [])]}
              wrap={false}
            >
              <Text style={[styles.cellNumber, styles.colIndex]}>{index + 1}</Text>

              <View style={styles.colDescription}>
                <Text style={styles.productName}>
                  {pdfText(offer.productName)}
                  {offer.brand ? ` · ${pdfText(offer.brand)}` : ''}
                </Text>
                <Text style={styles.productMeta}>
                  Proveedor: {pdfText(offer.supplier.name)} ({pdfText(offer.supplier.location)})
                  {offer.supplier.website ? ` · ${pdfText(offer.supplier.website)}` : ''}
                </Text>
                {specs ? <Text style={styles.productMeta}>{specs}</Text> : null}
                {offer.sourceUrl ? (
                  <Text style={styles.productMeta}>Ficha: {pdfText(offer.sourceUrl)}</Text>
                ) : null}
                <Text style={styles.productCalc}>
                  Medición solicitada: {formatPrecise(breakdown.requested.value)}{' '}
                  {measureLabel(breakdown.requested.unit)}
                  {breakdown.wastePct > 0
                    ? ` + ${formatPrecise(breakdown.wastePct)} % de merma`
                    : ''}
                  {offer.coverage.note ? ` · ${pdfText(offer.coverage.note)}` : ''}
                  {breakdown.roundedUp
                    ? ` · redondeado a ${saleUnitLabel(offer.saleUnit, breakdown.saleUnits)} ${agreeWithSaleUnit(offer.saleUnit, breakdown.saleUnits, 'completo')}`
                    : ''}
                </Text>
                {line.note ? <Text style={styles.productMeta}>Nota: {pdfText(line.note)}</Text> : null}
              </View>

              <Text style={[styles.cellNumber, styles.colQuantity]}>
                {formatPrecise(breakdown.saleUnits)}
              </Text>
              <Text style={[styles.cellNumber, styles.colUnit]}>
                {saleUnitLabel(offer.saleUnit, breakdown.saleUnits)}
              </Text>
              <Text style={[styles.cellNumber, styles.colPrice]}>
                {formatCurrency(breakdown.unitPrice)}
              </Text>
              <Text style={[styles.cellAmount, styles.colAmount]}>
                {formatCurrency(breakdown.lineTotal)}
              </Text>
            </View>
          );
        })}

        <View style={styles.totalsWrapper} wrap={false}>
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Suma de partidas</Text>
              <Text style={styles.totalValue}>{formatCurrency(totals.subtotal)}</Text>
            </View>

            {totals.discountPct > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Descuento comercial ({formatPrecise(totals.discountPct)} %)
                </Text>
                <Text style={styles.totalValue}>-{formatCurrency(totals.discountAmount)}</Text>
              </View>
            ) : null}

            <View style={styles.totalDivider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Base imponible</Text>
              <Text style={styles.totalValue}>{formatCurrency(totals.taxableBase)}</Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IVA ({formatPrecise(totals.vatPct)} %)</Text>
              <Text style={styles.totalValue}>{formatCurrency(totals.vatAmount)}</Text>
            </View>

            <View style={styles.grandTotal}>
              <Text style={styles.grandTotalLabel}>TOTAL PRESUPUESTO</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(totals.total)}</Text>
            </View>
          </View>
        </View>

        {data.containsEstimates ? (
          <View style={styles.callout} wrap={false}>
            <Text style={styles.calloutTitle}>PRECIOS ORIENTATIVOS</Text>
            <Text style={styles.calloutText}>
              Alguna de las partidas incorpora precios de mercado estimados y no una tarifa
              confirmada por el proveedor. Antes de contratar, SUMA solicitará oferta en firme y
              actualizará el presupuesto si hubiera variación.
            </Text>
          </View>
        ) : null}

        {data.notes ? (
          <View style={[styles.callout, styles.calloutNeutral]} wrap={false}>
            <Text style={[styles.calloutTitle, { color: printColors.ink }]}>OBSERVACIONES</Text>
            <Text style={styles.calloutText}>{pdfText(data.notes)}</Text>
          </View>
        ) : null}

        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.compactBand}>
          <SumaPdfLogo size={13} />
          <Text style={styles.compactHeaderText}>
            Presupuesto {data.reference}
            {client.name ? ` · ${pdfText(client.name)}` : ''}
          </Text>
        </View>

        <View style={styles.conditions}>
          <Text style={styles.sectionTitle}>CONDICIONES GENERALES</Text>
          {CONDITIONS.map((condition) => (
            <View key={condition} style={styles.conditionItem}>
              <Text style={styles.conditionBullet}>•</Text>
              <Text style={styles.conditionText}>{condition}</Text>
            </View>
          ))}
        </View>

        <View style={styles.signatures} wrap={false}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>POR {company.tradeName.toUpperCase()}</Text>
            <View style={styles.signatureRule}>
              <Text style={styles.signatureHint}>Firma y sello</Text>
            </View>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>CONFORME EL CLIENTE</Text>
            <View style={styles.signatureRule}>
              <Text style={styles.signatureHint}>Firma, nombre y fecha</Text>
            </View>
          </View>
        </View>

        <View style={styles.acceptance} wrap={false}>
          <Text style={styles.calloutText}>
            La firma de este documento supone la aceptación del presupuesto y de las condiciones
            generales recogidas en él. Devuelva una copia firmada a {company.email} para que SUMA
            pueda cursar los pedidos de material.
          </Text>
          <Text style={styles.slogan}>{company.slogan}</Text>
        </View>

        <PageFooter />
      </Page>
    </Document>
  );
}

/** Pie corporativo, idéntico en todas las páginas del documento. */
function PageFooter() {
  return (
    <View style={styles.footer} fixed>
      <View style={styles.footerRule} />
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>
          {company.legalName} · NIF {company.taxId} · {company.address}
          {'\n'}
          {company.phone} · {company.email} · {company.website}
          {company.registryDetails ? `\n${company.registryDetails}` : ''}
        </Text>
        <Text
          style={styles.footerPage}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        />
      </View>
    </View>
  );
}

const CONDITIONS = [
  'Los precios se expresan en euros y no incluyen IVA, que se detalla por separado en el resumen económico.',
  'Esta oferta es válida durante 30 días naturales desde la fecha de emisión. Transcurrido ese plazo, los precios quedan sujetos a revisión.',
  'Las mediciones proceden de los datos facilitados por el cliente. Cualquier variación en obra se remedirá y se facturará según los precios unitarios de este presupuesto.',
  'Las cantidades incluyen, cuando procede, la merma técnica habitual del material por cortes, roturas y solapes.',
  'Los materiales se suministran en las unidades comerciales del proveedor: cuando la medición no completa una unidad de venta, se redondea a la unidad completa inmediatamente superior.',
  'El precio no incluye mano de obra, medios auxiliares, transporte especial, gestión de residuos ni licencias, salvo indicación expresa en las observaciones.',
  'Forma de pago: 50 % a la confirmación del pedido y 50 % a la entrega del material, salvo acuerdo distinto por escrito.',
  'Plazo de entrega: a confirmar con el proveedor al formalizar el pedido; los plazos indicados en cada partida son orientativos.',
  'La disponibilidad y el precio quedan sujetos a confirmación del proveedor en el momento de formalizar el pedido.',
  'La aceptación de este presupuesto, por escrito o por medios telemáticos, tiene valor contractual y autoriza a SUMA a iniciar los pedidos de material.',
  'Los datos personales facilitados se tratan con la finalidad de gestionar esta oferta y la relación comercial derivada. Puede ejercer sus derechos de acceso, rectificación, supresión y oposición escribiendo a la dirección de contacto del emisor.',
];
