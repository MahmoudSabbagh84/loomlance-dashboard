// send-invoice — emails the invoice (PDF attachment + hosted link) via AWS SES,
// then flips the invoice to `sent`. Authenticated (the caller's JWT must own the invoice).
//
// Sends from a platform-verified domain with reply-to = the freelancer's email and a
// "{Business Name}" display name. Uses the SES v2 raw-email API (so we can attach the PDF),
// signed with SigV4 via aws4fetch.
//
// Secrets required: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SES_FROM_EMAIL,
//   PUBLIC_SITE_URL.
// Deploy: supabase functions deploy send-invoice
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'
import { corsHeaders, json } from '../_shared/cors.ts'

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)))
// RFC 2045: base64 bodies must be wrapped at <=76 chars per line. Gmail silently
// quarantines messages with one giant unwrapped base64 line (esp. large attachments).
const wrap76 = (s: string) => s.replace(/(.{76})/g, '$1\r\n')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { invoiceId, to, subject, body, pdfBase64 } = await req.json()
    if (!invoiceId || !to) return json({ error: 'invoiceId and to are required' }, 400)

    // User-scoped client → RLS guarantees the caller can only act on their own data.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } },
    )

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, public_token')
      .eq('id', invoiceId)
      .single()
    if (error || !invoice) return json({ error: 'Invoice not found' }, 404)

    // Caller's profile → from display name + reply-to (RLS-scoped to the caller).
    const { data: profile } = await supabase.from('profiles').select('business_name, email').single()
    const businessName = (profile?.business_name || 'LoomLance').replace(/["\r\n]/g, '')
    const replyTo = profile?.email || undefined

    const siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? ''
    const fromEmail = Deno.env.get('SES_FROM_EMAIL') ?? 'invoices@send.loomlance.com'
    const region = Deno.env.get('AWS_REGION') ?? 'us-east-1'
    const link = `${siteUrl}/i/${invoice.public_token}`
    const safeBody = String(body ?? '').replace(/</g, '&lt;').replace(/\n/g, '<br>')
    const html = `<div style="font-family:sans-serif">${safeBody}<p><a href="${link}">View &amp; pay invoice ${invoice.invoice_number}</a></p></div>`
    const subj = subject ?? `Invoice ${invoice.invoice_number}`

    // Build a raw MIME message so we can attach the PDF.
    const boundary = `b_${crypto.randomUUID()}`
    const lines = [
      `From: "${businessName}" <${fromEmail}>`,
      `To: ${to}`,
      replyTo ? `Reply-To: ${replyTo}` : null,
      `Subject: ${subj}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@send.loomlance.com>`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      wrap76(b64(html)),
    ]
    if (pdfBase64) {
      lines.push(
        `--${boundary}`,
        'Content-Type: application/pdf',
        `Content-Disposition: attachment; filename="${invoice.invoice_number}.pdf"`,
        'Content-Transfer-Encoding: base64',
        '',
        wrap76(pdfBase64),
      )
    }
    lines.push(`--${boundary}--`, '')
    const rawMime = lines.filter((l) => l !== null).join('\r\n')

    const aws = new AwsClient({
      accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
      secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
      region,
      service: 'ses',
    })
    const sesRes = await aws.fetch(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Content: { Raw: { Data: b64(rawMime) } } }),
    })
    if (!sesRes.ok) {
      return json({ error: 'Email send failed', detail: await sesRes.text() }, 502)
    }

    await supabase.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoiceId)
    return json({ ok: true })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
