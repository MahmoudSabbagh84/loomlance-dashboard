import { useRef, useState } from 'react'
import { Upload, FileText, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useUploadContractPdf } from '@/hooks/useContracts'
import { getSignedPdfUrl } from '@/api/contracts'

export function ContractPdfUploader({ contract }) {
  const fileRef = useRef(null)
  const upload = useUploadContractPdf()
  const [opening, setOpening] = useState(false)

  const handleFile = async (file) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('PDF must be under 10MB')
      return
    }
    try {
      await upload.mutateAsync({ id: contract.id, file })
      toast.success('PDF uploaded')
    } catch (e) {
      toast.error(e.userMessage || 'Upload failed')
    }
  }

  const handleOpen = async () => {
    try {
      setOpening(true)
      const url = await getSignedPdfUrl(contract.pdf_storage_path)
      window.open(url, '_blank')
    } catch (e) {
      toast.error(e.userMessage)
    } finally {
      setOpening(false)
    }
  }

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold">Signed PDF</h3>
      {contract.pdf_storage_path ? (
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-2 text-sm">
            <FileText className="size-4 shrink-0" /> <span className="truncate">{contract.pdf_storage_path.split('/').pop()}</span>
          </span>
          <Button size="sm" variant="secondary" onClick={handleOpen} loading={opening}>
            <ExternalLink className="size-4" /> Open
          </Button>
        </div>
      ) : (
        <p className="text-sm text-fg-muted">No PDF uploaded.</p>
      )}
      <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <div className="mt-3">
        <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} loading={upload.isPending}>
          <Upload className="size-4" /> {contract.pdf_storage_path ? 'Replace PDF' : 'Upload PDF'}
        </Button>
      </div>
    </Card>
  )
}
