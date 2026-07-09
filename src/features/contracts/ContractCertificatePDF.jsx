/* eslint-disable react-refresh/only-export-components --
   This module intentionally exports both a component and the blob builder, mirroring InvoicePDF. */
import { Document, Page, View, Text, Image, StyleSheet, pdf } from '@react-pdf/renderer'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 11, color: '#0f172a', fontFamily: 'Helvetica' },
  h1: { fontSize: 18, marginBottom: 4 },
  muted: { color: '#64748b' },
  section: { marginTop: 18 },
  terms: { marginTop: 8, lineHeight: 1.5 },
  block: { marginTop: 24, borderTop: '1 solid #e2e8f0', paddingTop: 14 },
  sig: { height: 70, width: 220, objectFit: 'contain', marginVertical: 6 },
  row: { marginTop: 2 },
  label: { color: '#64748b' },
})

function CertificateDocument({ contract, client, profile }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{contract.title}</Text>
        <Text style={s.muted}>
          {profile.business_name} &middot; {client?.name}
        </Text>
        <View style={s.section}>
          <Text style={s.label}>Value</Text>
          <Text>{contract.value != null ? formatCurrency(contract.value, contract.currency) : '—'}</Text>
        </View>
        {contract.description ? (
          <View style={s.section}>
            <Text style={s.label}>Terms</Text>
            <Text style={s.terms}>{contract.description}</Text>
          </View>
        ) : null}
        <View style={s.block}>
          <Text style={{ fontSize: 13, marginBottom: 6 }}>Electronic signature</Text>
          <Text style={s.row}>Signed by: {contract.signer_name}</Text>
          {contract.signature_image ? <Image style={s.sig} src={contract.signature_image} /> : null}
          <Text style={s.row}>
            <Text style={s.label}>Date: </Text>
            {contract.signed_at ? formatDate(contract.signed_at) : ''}
          </Text>
          <Text style={s.row}>
            <Text style={s.label}>IP: </Text>
            {contract.signer_ip || '—'}
          </Text>
          <Text style={s.row}>
            <Text style={s.label}>Verification hash: </Text>
            {contract.content_hash || '—'}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export function buildContractCertificateBlob({ contract, client, profile }) {
  return pdf(<CertificateDocument contract={contract} client={client} profile={profile} />).toBlob()
}
