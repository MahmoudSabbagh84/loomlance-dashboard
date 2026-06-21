import { useState } from 'react'
import { useFieldArray } from 'react-hook-form'
import { Plus, Trash2, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/components/ui/cn'

function ColumnToggle({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border text-fg-muted hover:bg-bg-muted hover:text-fg',
      )}
    >
      <Check className={cn('size-3.5 text-success', active ? '' : 'invisible')} />
      {children}
    </button>
  )
}

export function LineItemsTable({ control, register, setValue, getValues, disabled = false, onItemsChanged }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })
  const addLine = () => {
    append({ description: '', quantity: 1, unit_price: 0, tax_rate: 0, discount_rate: 0, position: fields.length })
    onItemsChanged?.()
  }
  const removeLine = (i) => {
    remove(i)
    onItemsChanged?.()
  }

  // Tax/Discount columns are optional — default on only if existing data uses them.
  const initialLines = getValues?.('line_items') ?? []
  const [showTax, setShowTax] = useState(() => initialLines.some((l) => Number(l?.tax_rate) > 0))
  const [showDiscount, setShowDiscount] = useState(() => initialLines.some((l) => Number(l?.discount_rate) > 0))

  // Zero a column's values when it's hidden so totals stay correct.
  const zeroColumn = (key) => {
    const items = getValues?.('line_items') ?? []
    items.forEach((_, i) => setValue?.(`line_items.${i}.${key}`, 0, { shouldDirty: true }))
  }
  const toggleTax = () => {
    const next = !showTax
    setShowTax(next)
    if (!next) zeroColumn('tax_rate')
  }
  const toggleDiscount = () => {
    const next = !showDiscount
    setShowDiscount(next)
    if (!next) zeroColumn('discount_rate')
  }

  return (
    <div className="space-y-2">
      {!disabled ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-fg-muted">Columns:</span>
          <ColumnToggle active={showTax} onClick={toggleTax}>Tax %</ColumnToggle>
          <ColumnToggle active={showDiscount} onClick={toggleDiscount}>Discount %</ColumnToggle>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-bg-elevated text-xs uppercase text-fg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="w-[12%] px-3 py-2 text-right">Qty</th>
              <th className="w-[18%] px-3 py-2 text-right">Unit price</th>
              {showTax ? <th className="w-[12%] px-3 py-2 text-right">Tax %</th> : null}
              {showDiscount ? <th className="w-[12%] px-3 py-2 text-right">Disc %</th> : null}
              <th className="w-[5%] px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {fields.map((field, i) => (
              <tr key={field.id} className="border-t border-border">
                <td className="px-2 py-2">
                  <Textarea rows={1} disabled={disabled} {...register(`line_items.${i}.description`)} />
                </td>
                <td className="px-2 py-2">
                  <Input type="number" step="0.01" disabled={disabled} className="no-spinner text-right tabular-nums" {...register(`line_items.${i}.quantity`, { valueAsNumber: true })} />
                </td>
                <td className="px-2 py-2">
                  <Input type="number" step="0.01" disabled={disabled} className="no-spinner text-right tabular-nums" {...register(`line_items.${i}.unit_price`, { valueAsNumber: true })} />
                </td>
                {showTax ? (
                  <td className="px-2 py-2">
                    <Input type="number" step="0.1" disabled={disabled} className="no-spinner text-right tabular-nums" {...register(`line_items.${i}.tax_rate`, { valueAsNumber: true })} />
                  </td>
                ) : null}
                {showDiscount ? (
                  <td className="px-2 py-2">
                    <Input type="number" step="0.1" disabled={disabled} className="no-spinner text-right tabular-nums" {...register(`line_items.${i}.discount_rate`, { valueAsNumber: true })} />
                  </td>
                ) : null}
                <td className="px-2 py-2 text-right">
                  {!disabled ? (
                    <Button variant="ghost" size="sm" type="button" onClick={() => removeLine(i)} aria-label="Remove">
                      <Trash2 className="size-4 text-danger" />
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!disabled ? (
          <div className="bg-bg-elevated p-2">
            <Button type="button" variant="ghost" size="sm" onClick={addLine}>
              <Plus className="size-4" /> Add line
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
