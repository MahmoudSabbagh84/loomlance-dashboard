import { useFieldArray } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

export function LineItemsTable({ control, register }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-bg-elevated text-xs uppercase text-fg-muted">
          <tr>
            <th className="w-[40%] px-3 py-2 text-left">Description</th>
            <th className="w-[10%] px-3 py-2 text-right">Qty</th>
            <th className="w-[15%] px-3 py-2 text-right">Unit price</th>
            <th className="w-[10%] px-3 py-2 text-right">Tax %</th>
            <th className="w-[10%] px-3 py-2 text-right">Disc %</th>
            <th className="w-[5%] px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {fields.map((field, i) => (
            <tr key={field.id} className="border-t border-border">
              <td className="px-2 py-2">
                <Textarea rows={1} {...register(`line_items.${i}.description`)} />
              </td>
              <td className="px-2 py-2">
                <Input type="number" step="0.01" className="text-right tabular-nums" {...register(`line_items.${i}.quantity`, { valueAsNumber: true })} />
              </td>
              <td className="px-2 py-2">
                <Input type="number" step="0.01" className="text-right tabular-nums" {...register(`line_items.${i}.unit_price`, { valueAsNumber: true })} />
              </td>
              <td className="px-2 py-2">
                <Input type="number" step="0.1" className="text-right tabular-nums" {...register(`line_items.${i}.tax_rate`, { valueAsNumber: true })} />
              </td>
              <td className="px-2 py-2">
                <Input type="number" step="0.1" className="text-right tabular-nums" {...register(`line_items.${i}.discount_rate`, { valueAsNumber: true })} />
              </td>
              <td className="px-2 py-2 text-right">
                <Button variant="ghost" size="sm" type="button" onClick={() => remove(i)} aria-label="Remove">
                  <Trash2 className="size-4 text-danger" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="bg-bg-elevated p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => append({ description: '', quantity: 1, unit_price: 0, tax_rate: 0, discount_rate: 0, position: fields.length })}
        >
          <Plus className="size-4" /> Add line
        </Button>
      </div>
    </div>
  )
}
