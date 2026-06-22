/* eslint-disable react-refresh/only-export-components --
   The PDF document here is rendered via pdf().toBlob(), never mounted into the
   React tree, so this is a utility module (not a fast-refresh boundary). */
import { Document, Page, View, Text, Image, StyleSheet, pdf } from '@react-pdf/renderer'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'
import { invoiceTotals } from '@/lib/money'
import { INVOICE_DEFAULT_ACCENT } from '@/lib/colors'

const ACCENT_FALLBACK = INVOICE_DEFAULT_ACCENT
const LOGO_URL = typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : '/logo.png'

const styles = StyleSheet.create({
  page: { backgroundColor: '#FFFFFF', color: '#111111', padding: 36, fontSize: 9, lineHeight: 1.4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  logo: { height: 44, marginBottom: 6, objectFit: 'contain' },
  bizName: { fontSize: 16, fontWeight: 700 },
  muted: { color: '#666666' },
  xs: { fontSize: 8 },
  right: { textAlign: 'right' },
  invoiceTitle: { fontSize: 20, fontWeight: 600, letterSpacing: 0.5, lineHeight: 1 },
  section: { marginBottom: 18 },
  labelCaps: { fontSize: 7, color: '#888888', textTransform: 'uppercase', marginBottom: 3, letterSpacing: 0.5 },
  bold: { fontWeight: 600 },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#CCCCCC', paddingBottom: 4, marginBottom: 2 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEEEEE', paddingVertical: 4 },
  colDesc: { flexGrow: 1, flexShrink: 1, paddingRight: 6 },
  colQty: { width: 46, textAlign: 'right' },
  colUnit: { width: 80, textAlign: 'right' },
  colTotal: { width: 84, textAlign: 'right' },
  totals: { marginTop: 12, marginLeft: 'auto', width: 220 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1 },
  grandTotal: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#999999', paddingTop: 4, marginTop: 2 },
  notesBlock: { marginTop: 18 },
  footer: { marginTop: 32, textAlign: 'center', fontSize: 8, color: '#666666' },
  brandFooter: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  brandLogo: { width: 16, height: 16, marginRight: 5 },
  brandText: { fontSize: 8, color: '#999999' },
})

function normalizeLines(invoice) {
  return (invoice.invoice_line_items || [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((li) => ({
      description: li.description || '',
      quantity: Number(li.quantity) || 0,
      unit_price: Number(li.unit_price) || 0,
      tax_rate: Number(li.tax_rate) || 0,
      discount_rate: Number(li.discount_rate) || 0,
    }))
}

function InvoiceDocument({ invoice, client, profile }) {
  const currency = invoice.currency || profile?.default_currency || 'USD'
  const lines = normalizeLines(invoice)
  const totals = invoiceTotals(lines)
  const branded = (profile?.subscription_tier ?? 'free') !== 'free'
  const accent = branded ? profile?.invoice_accent_color || ACCENT_FALLBACK : ACCENT_FALLBACK

  return (
    <Document title={invoice.invoice_number} author={profile?.business_name || 'LoomLance'}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ maxWidth: 280 }}>
            {branded && profile?.logo_url ? (
              <Image src={profile.logo_url} style={styles.logo} />
            ) : (
              <Text style={[styles.bizName, { color: accent }]}>{profile?.business_name || 'Your Business'}</Text>
            )}
            {profile?.address ? <Text style={styles.xs}>{profile.address}</Text> : null}
            {profile?.tax_id ? <Text style={styles.xs}>Tax ID: {profile.tax_id}</Text> : null}
          </View>
          <View style={styles.right}>
            <Text style={[styles.invoiceTitle, { color: accent }]}>INVOICE</Text>
            <Text style={{ marginTop: 6 }}>{invoice.invoice_number}</Text>
            <Text style={styles.xs}>Issued: {invoice.issue_date ? formatDate(invoice.issue_date) : '—'}</Text>
            <Text style={styles.xs}>Due: {invoice.due_date ? formatDate(invoice.due_date) : '—'}</Text>
          </View>
        </View>

        {/* Bill to */}
        <View style={styles.section}>
          <Text style={styles.labelCaps}>Bill to</Text>
          <Text style={styles.bold}>{client?.name || '—'}</Text>
          {client?.company ? <Text>{client.company}</Text> : null}
          {client?.address ? <Text style={styles.xs}>{client.address}</Text> : null}
        </View>

        {/* Line items */}
        <View>
          <View style={styles.tableHead}>
            <Text style={[styles.colDesc, styles.bold]}>Description</Text>
            <Text style={[styles.colQty, styles.bold]}>Qty</Text>
            <Text style={[styles.colUnit, styles.bold]}>Unit</Text>
            <Text style={[styles.colTotal, styles.bold]}>Total</Text>
          </View>
          {lines.length === 0 ? (
            <View style={styles.row}>
              <Text style={[styles.colDesc, styles.muted]}>No line items</Text>
            </View>
          ) : (
            lines.map((li, i) => (
              <View style={styles.row} key={i} wrap={false}>
                <Text style={styles.colDesc}>{li.description || '—'}</Text>
                <Text style={styles.colQty}>{li.quantity}</Text>
                <Text style={styles.colUnit}>{formatCurrency(li.unit_price, currency)}</Text>
                <Text style={styles.colTotal}>{formatCurrency(li.quantity * li.unit_price, currency)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{formatCurrency(totals.subtotal, currency)}</Text>
          </View>
          {totals.discount > 0 ? (
            <View style={styles.totalRow}>
              <Text>Discount</Text>
              <Text>−{formatCurrency(totals.discount, currency)}</Text>
            </View>
          ) : null}
          {Object.entries(totals.taxByRate).map(([rate, amt]) => (
            <View style={styles.totalRow} key={rate}>
              <Text>Tax {rate}%</Text>
              <Text>{formatCurrency(amt, currency)}</Text>
            </View>
          ))}
          <View style={styles.grandTotal}>
            <Text style={styles.bold}>Total</Text>
            <Text style={styles.bold}>{formatCurrency(totals.total, currency)}</Text>
          </View>
        </View>

        {/* Notes / terms / payment */}
        {invoice.notes ? (
          <View style={styles.notesBlock}>
            <Text style={styles.bold}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}
        {invoice.terms ? (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.bold}>Terms</Text>
            <Text>{invoice.terms}</Text>
          </View>
        ) : null}
        {invoice.payment_instructions ? (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.bold}>Payment</Text>
            <Text>{invoice.payment_instructions}</Text>
          </View>
        ) : null}

        {branded && profile?.invoice_footer ? <Text style={styles.footer} fixed>{profile.invoice_footer}</Text> : null}

        <View style={styles.brandFooter} fixed>
          <Image src={LOGO_URL} style={styles.brandLogo} />
          <Text style={styles.brandText}>Created with LoomLance</Text>
        </View>
      </Page>
    </Document>
  )
}

export function buildInvoiceBlob({ invoice, client, profile }) {
  return pdf(<InvoiceDocument invoice={invoice} client={client} profile={profile} />).toBlob()
}
