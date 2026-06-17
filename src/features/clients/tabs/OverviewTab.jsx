import { Card } from '@/components/ui/Card'

export function OverviewTab({ client }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <h3 className="mb-2 text-sm font-semibold">Contact</h3>
        <dl className="space-y-1 text-sm">
          <div><dt className="inline text-fg-muted">Email: </dt><dd className="inline">{client.email || '—'}</dd></div>
          <div><dt className="inline text-fg-muted">Phone: </dt><dd className="inline">{client.phone || '—'}</dd></div>
          <div><dt className="inline text-fg-muted">Address: </dt><dd className="inline whitespace-pre-line">{client.address || '—'}</dd></div>
        </dl>
      </Card>
      <Card>
        <h3 className="mb-2 text-sm font-semibold">Notes</h3>
        <p className="whitespace-pre-line text-sm">{client.notes || '—'}</p>
      </Card>
    </div>
  )
}
