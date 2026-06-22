import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { SaveStatus } from '@/components/ui/SaveStatus'
import { UpgradeCard } from '@/components/gates/UpgradeCard'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { useAutosaveForm } from '@/hooks/useAutosave'
import { hasFeature, FEATURES } from '@/lib/tier'
import { uploadLogo, removeLogo, LOGO_TYPES } from '@/api/branding'
import { INVOICE_DEFAULT_ACCENT } from '@/lib/colors'

const DEFAULT_ACCENT = INVOICE_DEFAULT_ACCENT
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

export function BrandingTab() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const [uploading, setUploading] = useState(false)

  const { register, watch, setValue, getValues } = useForm({
    values: {
      invoice_accent_color: profile?.invoice_accent_color || DEFAULT_ACCENT,
      invoice_footer: profile?.invoice_footer || '',
    },
    resetOptions: { keepDirtyValues: true },
  })

  // Called unconditionally (before the tier gate) to respect the rules of hooks.
  const { status, retry } = useAutosaveForm({
    watch,
    commit: async () => {
      const values = getValues()
      // Hold (don't persist) an invalid accent — the inline error explains why.
      if (!HEX_COLOR.test(values.invoice_accent_color)) return false
      await update.mutateAsync(values)
    },
  })

  if (!hasFeature(tier, FEATURES.CUSTOM_BRANDING)) {
    return <UpgradeCard feature={FEATURES.CUSTOM_BRANDING} currentTier={tier} target="tier_1" />
  }

  const accent = watch('invoice_accent_color')
  const footer = watch('invoice_footer')
  const accentValid = HEX_COLOR.test(accent)

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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
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
                value={accent}
                onChange={(e) => setValue('invoice_accent_color', e.target.value, { shouldDirty: true })}
              />
              <Input
                id="accent"
                className="w-32"
                value={accent}
                aria-invalid={!accentValid}
                onChange={(e) => setValue('invoice_accent_color', e.target.value, { shouldDirty: true })}
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => setValue('invoice_accent_color', DEFAULT_ACCENT, { shouldDirty: true })}>
                Reset
              </Button>
            </div>
            {!accentValid ? (
              <p className="mt-1 text-xs text-danger">Enter a 6-digit hex color, e.g. #6D45F0.</p>
            ) : null}
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
          <div className="flex h-5 justify-end">
            <SaveStatus status={status} onRetry={retry} />
          </div>
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
