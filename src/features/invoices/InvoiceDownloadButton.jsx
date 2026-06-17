import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { useProfile } from '@/hooks/useProfile'

export function InvoiceDownloadButton({ invoice }) {
  const { data: profile } = useProfile()
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      // Dynamic import keeps @react-pdf/renderer (a large dependency) out of the
      // main bundle — it is only fetched the first time someone downloads a PDF.
      const { buildInvoiceBlob } = await import('./InvoicePDF')
      const blob = await buildInvoiceBlob({ invoice, client: invoice.clients, profile })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoice.invoice_number}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e?.userMessage || 'Could not generate PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleDownload} loading={loading}>
      <Download className="size-4" /> PDF
    </Button>
  )
}
