export function OverviewTab({ client }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h3 className="text-sm font-semibold mb-2">Contact</h3>
        <dl className="text-sm space-y-1">
          <div><dt className="inline text-fg-muted">Email: </dt><dd className="inline">{client.email || '—'}</dd></div>
          <div><dt className="inline text-fg-muted">Phone: </dt><dd className="inline">{client.phone || '—'}</dd></div>
          <div><dt className="inline text-fg-muted">Address: </dt><dd className="inline whitespace-pre-line">{client.address || '—'}</dd></div>
        </dl>
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">Notes</h3>
        <p className="text-sm whitespace-pre-line">{client.notes || '—'}</p>
      </div>
    </div>
  )
}
