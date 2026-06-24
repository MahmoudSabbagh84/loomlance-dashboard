import { describe, it, expect, vi } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Lightweight mocks so the editor renders without network/hooks.
vi.mock('@/hooks/useClients', () => ({
  useClients: () => ({
    data: {
      rows: [
        { id: '11111111-1111-1111-1111-111111111111', name: 'ACME', email: 'acme@x.com' },
        { id: '22222222-2222-2222-2222-222222222222', name: 'Globex', email: 'globex@x.com' },
      ],
    },
  }),
}))
vi.mock('@/hooks/useProjects', () => ({ useProjects: () => ({ data: [] }) }))
vi.mock('@/api/invoices', () => ({ updateInvoice: vi.fn().mockResolvedValue(undefined) }))
const replaceLineItems = vi.fn().mockResolvedValue([])
vi.mock('@/api/invoice-line-items', () => ({ replaceLineItems: (...a) => replaceLineItems(...a) }))
vi.mock('@/features/invoices/InvoicePreview', () => ({ InvoicePreview: () => null }))
vi.mock('@/features/invoices/TotalsPanel', () => ({ TotalsPanel: () => null }))

import { InvoiceEditor } from '@/features/invoices/InvoiceEditor'

const baseInvoice = {
  id: 'inv-1', status: 'draft',
  client_id: '11111111-1111-1111-1111-111111111111', project_id: null,
  invoice_number: 'INV-1', issue_date: '2026-06-22', due_date: '2026-07-22',
  currency: 'USD', notes: '', terms: '', payment_instructions: '',
  invoice_line_items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 0, discount_rate: 0, position: 0 }],
}

describe('InvoiceEditor — detail cache stays fresh after autosave (regression: invoice sent blank)', () => {
  it('updates the detail cache invoice_line_items after editing a line', async () => {
    const qc = new QueryClient()
    qc.setQueryData(['invoices', 'detail', 'inv-1'], baseInvoice)

    const { container } = render(
      <QueryClientProvider client={qc}>
        <InvoiceEditor invoice={baseInvoice} />
      </QueryClientProvider>
    )

    // First textarea in the form is the line-item description.
    const desc = container.querySelector('textarea')
    fireEvent.input(desc, { target: { value: 'Web design' } })

    // Autosave should persist AND refresh the detail cache the Send/PDF path reads.
    await waitFor(() => expect(replaceLineItems).toHaveBeenCalled(), { timeout: 2000 })
    await waitFor(() => {
      const cached = qc.getQueryData(['invoices', 'detail', 'inv-1'])
      expect(cached.invoice_line_items[0].description).toBe('Web design')
    }, { timeout: 2000 })
  })

  it('keeps the joined client in sync in the detail cache when the client changes (LOO-6)', async () => {
    const qc = new QueryClient()
    qc.setQueryData(['invoices', 'detail', 'inv-1'], {
      ...baseInvoice,
      clients: { id: '11111111-1111-1111-1111-111111111111', name: 'ACME', email: 'acme@x.com' },
    })

    const { container } = render(
      <QueryClientProvider client={qc}>
        <InvoiceEditor invoice={baseInvoice} />
      </QueryClientProvider>
    )

    fireEvent.change(container.querySelector('#client_id'), {
      target: { value: '22222222-2222-2222-2222-222222222222' },
    })

    await waitFor(() => {
      const cached = qc.getQueryData(['invoices', 'detail', 'inv-1'])
      expect(cached.client_id).toBe('22222222-2222-2222-2222-222222222222')
      expect(cached.clients.name).toBe('Globex')
      expect(cached.clients.email).toBe('globex@x.com')
    }, { timeout: 2000 })
  })
})
