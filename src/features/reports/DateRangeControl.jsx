import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { DATE_PRESETS, rangeForPreset } from '@/lib/reports'

export function DateRangeControl({ value, onChange }) {
  const isCustom = value.preset === 'custom'
  const invalid = isCustom && value.from && value.to && value.from > value.to

  const onPreset = (preset) => {
    if (preset === 'custom') {
      onChange({ ...value, preset })
      return
    }
    onChange({ preset, ...rangeForPreset(preset, new Date()) })
  }

  const onCustom = (field, v) => {
    onChange({ ...value, preset: 'custom', [field]: v })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="report-preset">Period</Label>
        <Select id="report-preset" value={value.preset} onChange={(e) => onPreset(e.target.value)} className="w-44">
          {DATE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Select>
      </div>
      {isCustom ? (
        <>
          <div>
            <Label htmlFor="report-from">From</Label>
            <Input id="report-from" type="date" value={value.from || ''} onChange={(e) => onCustom('from', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="report-to">To</Label>
            <Input id="report-to" type="date" value={value.to || ''} onChange={(e) => onCustom('to', e.target.value)} />
          </div>
        </>
      ) : null}
      {invalid ? <p className="pb-2 text-xs text-danger">From date must be on or before To date.</p> : null}
    </div>
  )
}
