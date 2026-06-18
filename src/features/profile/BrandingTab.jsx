import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { UpgradeCard } from '@/components/gates/UpgradeCard'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { hasFeature, FEATURES } from '@/lib/tier'
import { uploadLogo, removeLogo, LOGO_TYPES } from '@/api/branding'

const DEFAULT_ACCENT = '#2D3E50'

export function BrandingTab() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const [uploading, setUploading] = useState(false)

  const { register, handleSubmit, watch, setValue } = useForm({
    values: {
      invoice_accent_color: profile?.invoice_accent_color || DEFAULT_ACCENT,
      invoice_footer: profile?.invoice_footer || '',
    },
  })

  if (!hasFeature(tier, FEATURES.CUSTOM_BRANDING)) {
    return <UpgradeCard feature={FEATURES.CUSTOM_BRANDING} currentTier={tier} target="tier_1" />
  }

  const accent = watch('invoice_accent_color')
  const footer = watch('invoice_footer')

  const onLogoChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadLogo(file)
      await update.mutateAsync({ logo_url: url })
      toast.success('Logo updated')
    } catch (err) {
      toast.error(err.userMessage || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onRemoveLogo = async () => {
    try {
      await removeLogo(profile.logo_url)
      await update.mutateAsync({ logo_url: null })
      toast.success('Logo removed')
    } catch (err) {
      toast.error(err.userMessage || 'Could not remove logo')
    }
  }

  const onSave = async (values) => {
    try {
      await update.mutateAsync(values)
      toast.success('Branding saved')
    } catch (err) {
      toast.error(err.userMessage || 'Could not save branding')
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={handleSubmit(onSave)} className="space-y-5">
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold">
            Logo <span className="font-normal text-fg-muted">(optional)</span>
          </h3>
          <div className="flex items-center gap-4">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-bg-muted">
              {profile?.logo_url ? (
                <img src={profile.logo_url} alt="" className="max-h-full max-w-full" />
              ) : (
                <span className="text-xs text-fg-subtle">None</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center rounded-md bg-bg-muted px-3.5 text-sm font-medium text-fg transition-colors hover:bg-bg-elevated">
                {uploading ? 'Uploading…' : 'Upload logo'}
                <input type="file" accept={LOGO_TYPES.join(',')} className="hidden" onChange={onLogoChange} disabled={uploading} />
              </label>
              {profile?.logo_url ? (
                <Button type="button" variant="ghost" onClick={onRemoveLogo}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-fg-muted">
            SVG, PNG, JPG, or WebP · up to 2 MB. No logo? Invoices show your business name instead.
          </p>
        </Card>

        <Card className="space-y-4">
          <div>
            <Label htmlFor="accent">Accent color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Accent color"
                className="h-9 w-12 cursor-pointer rounded-md border border-border bg-bg-muted"
                {...register('invoice_accent_color')}
              />
              <Input className="w-32" {...register('invoice_accent_color')} />
              <Button type="button" variant="ghost" size="sm" onClick={() => setValue('invoice_accent_color', DEFAULT_ACCENT)}>
                Reset
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="invoice_footer">Invoice footer</Label>
            <Textarea
              id="invoice_footer"
              rows={3}
              placeholder="e.g. Thank you for your business · Payment due within 30 days"
              {...register('invoice_footer')}
            />
          </div>
          <Button type="submit" loading={update.isPending}>
            Save branding
          </Button>
        </Card>
      </form>

      <div className="lg:sticky lg:top-20 lg:h-fit">
        <p className="mb-2 text-xs uppercase tracking-wide text-fg-muted">Preview</p>
        <div className="rounded-lg border border-border bg-white p-6 text-black">
          <div className="flex items-start justify-between">
            <div>
              {profile?.logo_url ? (
                <img src={profile.logo_url} alt="" className="mb-2 h-12" />
              ) : (
                <h2 className="text-xl font-bold" style={{ color: accent }}>
                  {profile?.business_name || 'Your Business'}
                </h2>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: accent }}>
              INVOICE
            </h1>
          </div>
          <div className="mt-6 border-t border-gray-200 pt-3 text-xs text-gray-500">Line items · totals · etc.</div>
          {footer ? <p className="mt-8 whitespace-pre-line text-center text-xs text-gray-600">{footer}</p> : null}
        </div>
      </div>
    </div>
  )
}
