// send-invoice — emails the invoice (PDF attachment + hosted link) via Resend,
// then flips the invoice to `sent`. Authenticated (the caller's JWT must own the invoice).
//
// Secrets required: RESEND_API_KEY, PUBLIC_SITE_URL, (optional) INVOICE_FROM_EMAIL.
// Deploy: supabase functions deploy send-invoice
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { invoiceId, to, subject, body, pdfBase64 } = await req.json()
    if (!invoiceId || !to) return json({ error: 'invoiceId and to are required' }, 400)

    // User-scoped client → RLS guarantees the caller can only act on their own invoice.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } }
    )

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, public_token')
      .eq('id', invoiceId)
      .single()
    if (error || !invoice) return json({ error: 'Invoice not found' }, 404)

    const siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? ''
    const link = `${siteUrl}/i/${invoice.public_token}`
    const safeBody = String(body ?? '').replace(/</g, '&lt;').replace(/\n/g, '<br>')
    const html = `<div style="font-family:sans-serif">${safeBody}<p><a href="${link}">View &amp; pay invoice ${invoice.invoice_number}</a></p></div>`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('INVOICE_FROM_EMAIL') ?? 'invoices@send.loomlance.com',
        to: [to],
        subject: subject ?? `Invoice ${invoice.invoice_number}`,
        html,
        attachments: pdfBase64 ? [{ filename: `${invoice.invoice_number}.pdf`, content: pdfBase64 }] : undefined,
      }),
    })
    if (!resendRes.ok) {
      return json({ error: 'Email send failed', detail: await resendRes.text() }, 502)
    }

    await supabase.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoiceId)
    return json({ ok: true })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
