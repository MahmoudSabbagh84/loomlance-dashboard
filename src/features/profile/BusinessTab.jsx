import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { Card } from '@/components/ui/Card'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'

const schema = z.object({
  business_name: z.string().max(200).optional().or(z.literal('')),
  tax_id: z.string().max(60).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  default_currency: z.string().length(3),
})

export function BusinessTab() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    values: {
      business_name: profile?.business_name ?? '',
      tax_id: profile?.tax_id ?? '',
      address: profile?.address ?? '',
      default_currency: profile?.default_currency ?? 'USD',
    },
  })

  const onSubmit = async (values) => {
    try {
      await update.mutateAsync(values)
      toast.success('Business details saved')
    } catch (e) {
      toast.error(e.userMessage ?? 'Could not save business details')
    }
  }

  return (
    <Card as="form" onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-4">
      <div>
        <Label htmlFor="business_name">Business name</Label>
        <Input id="business_name" {...register('business_name')} />
        <FieldError>{errors.business_name?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="tax_id">Tax ID</Label>
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
      <Button type="submit" loading={isSubmitting}>
        Save
      </Button>
    </Card>
  )
}
