import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { invoiceCreateSchema } from '@/api/schemas/invoices'
import { useAutosave } from '@/hooks/useAutosave'

const AUTOSAVE_FIELDS = [
  'client_id', 'project_id', 'invoice_number', 'issue_date', 'due_date',
  'currency', 'notes', 'terms', 'payment_instructions', 'line_items',
]

function TestForm({ save }) {
  const defaults = {
    client_id: '11111111-1111-1111-1111-111111111111',
    project_id: '',
    invoice_number: 'INV-1',
    issue_date: '2026-06-22',
    due_date: '2026-07-22',
    currency: 'USD',
    notes: '', terms: '', payment_instructions: '',
    line_items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 0, discount_rate: 0, position: 0 }],
  }
  const { register, control, watch, trigger } = useForm({
    resolver: zodResolver(invoiceCreateSchema),
    defaultValues: defaults,
  })
  const { fields } = useFieldArray({ control, name: 'line_items' })
  useAutosave({ watch, trigger, save, fields: AUTOSAVE_FIELDS, enabled: true, initial: defaults, debounceMs: 50 })
  return (
    <form>
      {fields.map((f, i) => (
        <div key={f.id}>
          <textarea aria-label="desc" {...register(`line_items.${i}.description`)} />
          <input aria-label="price" type="number" {...register(`line_items.${i}.unit_price`, { valueAsNumber: true })} />
        </div>
      ))}
    </form>
  )
}

describe('invoice autosave (repro)', () => {
  it('persists line items after the user types a description + price', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    render(<TestForm save={save} />)

    fireEvent.input(screen.getByLabelText('desc'), { target: { value: 'Web design' } })
    fireEvent.input(screen.getByLabelText('price'), { target: { value: '500' } })

    await waitFor(() => expect(save).toHaveBeenCalled(), { timeout: 2000 })
    const last = save.mock.calls.at(-1)[0]
    expect(last.line_items).toBeDefined()
    expect(last.line_items[0].description).toBe('Web design')
    expect(last.line_items[0].unit_price).toBe(500)
  })
})
