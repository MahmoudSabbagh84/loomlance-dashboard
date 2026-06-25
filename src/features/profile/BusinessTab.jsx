import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { Card } from '@/components/ui/Card'
import { SaveStatus } from '@/components/ui/SaveStatus'
import { cn } from '@/components/ui/cn'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { useAutosaveForm } from '@/hooks/useAutosave'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'

const schema = z.object({
  business_type: z.enum(['business', 'individual']),
  business_name: z.string().max(200).optional().or(z.literal('')),
  tax_id: z.string().max(60).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  default_currency: z.string().length(3),
})

const TYPE_OPTIONS = [
  { value: 'business', label: 'Registered business' },
  { value: 'individual', label: 'Under my own name' },
]

export function BusinessTab() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const {
    register,
    watch,
    trigger,
    getValues,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    values: {
      business_type: profile?.business_type ?? 'business',
      business_name: profile?.business_name ?? '',
      tax_id: profile?.tax_id ?? '',
      address: profile?.address ?? '',
      default_currency: profile?.default_currency ?? 'USD',
    },
    // A post-save refetch must not clobber fields the user is still editing.
    resetOptions: { keepDirtyValues: true },
  })

  const { status, retry } = useAutosaveForm({
    watch,
    commit: async () => {
      if (!(await trigger())) return false
      await update.mutateAsync(getValues())
    },
  })

  const businessType = watch('business_type')
  const isIndividual = businessType === 'individual'
  const buttonRefs = useRef([])

  function selectType(idx) {
    setValue('business_type', TYPE_OPTIONS[idx].value, { shouldDirty: true })
    // setValue re-renders the buttons (new tabIndex/aria-checked); move browser
    // focus onto the newly selected one so the roving tabindex stays coherent.
    buttonRefs.current[idx]?.focus()
  }

  function handleTypeKeyDown(e) {
    const idx = TYPE_OPTIONS.findIndex((o) => o.value === businessType)
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      selectType((idx + 1) % TYPE_OPTIONS.length)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      selectType((idx - 1 + TYPE_OPTIONS.length) % TYPE_OPTIONS.length)
    }
  }

  return (
    <Card as="form" onSubmit={(e) => e.preventDefault()} className="max-w-xl space-y-4">
      <div>
        <div id="business-type-label">
          <Label>How do you work?</Label>
        </div>
        <div
          role="radiogroup"
          aria-labelledby="business-type-label"
          className="mt-1 inline-flex rounded-lg border border-border bg-bg-muted p-0.5"
          onKeyDown={handleTypeKeyDown}
        >
          {TYPE_OPTIONS.map((opt, i) => {
            const active = businessType === opt.value
            return (
              <button
                key={opt.value}
                ref={(el) => (buttonRefs.current[i] = el)}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                onClick={() => setValue('business_type', opt.value, { shouldDirty: true })}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-bg text-fg shadow-sm'
                    : 'text-fg-muted hover:text-fg'
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <Label htmlFor="business_name">{isIndividual ? 'Your name' : 'Business name'}</Label>
        <Input
          id="business_name"
          placeholder={isIndividual ? 'Jane Smith' : 'Acme LLC'}
          {...register('business_name')}
        />
        <FieldError>{errors.business_name?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="tax_id" className={isIndividual ? 'text-fg-muted' : undefined}>
          {isIndividual ? 'Tax ID (optional)' : 'Tax ID'}
        </Label>
        <Input id="tax_id" {...register('tax_id')} />
        <FieldError>{errors.tax_id?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" rows={3} {...register('address')} />
        <FieldError>{errors.address?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="default_currency">Default currency</Label>
        <Select id="default_currency" {...register('default_currency')}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </Select>
        <FieldError>{errors.default_currency?.message}</FieldError>
      </div>
      <div className="flex h-5 justify-end">
        <SaveStatus status={status} onRetry={retry} />
      </div>
    </Card>
  )
}
