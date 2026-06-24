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
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)))
// RFC 2045: base64 bodies must be wrapped at <=76 chars per line. Gmail silently
// quarantines messages with one giant unwrapped base64 line (esp. large attachments).
const wrap76 = (s: string) => s.replace(/(.{76})/g, '$1\r\n')

Deno.serve(async (req) => {
  const json = (obj: unknown, status = 200) => jsonBase(obj, status, req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })
  try {
    const { invoiceId, to, cc, subject, body, pdfBase64 } = await req.json()
    // Normalize + validate recipients (also strips CR/LF/commas → no header injection).
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const clean = (v: unknown) =>
      (Array.isArray(v) ? v : v ? [v] : [])
        .map((e) => String(e).replace(/[\r\n,]/g, '').trim())
        .filter((e) => EMAIL_RE.test(e) && e.length <= 254)
    const toList = clean(to)
    const ccList = clean(cc).filter((e) => !toList.some((t) => t.toLowerCase() === e.toLowerCase()))
    if (!invoiceId || toList.length === 0) {
      return json({ error: 'invoiceId and at least one valid recipient are required' }, 400)
    }

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
    const num = invoice.invoice_number
    const subj = subject ?? `Invoice ${num} from ${businessName}`
    const note = String(body ?? '').trim()
    const noteEsc = note.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const noteHtml = note
      ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#14181f;white-space:pre-wrap">${noteEsc}</p>`
      : ''

    // Full HTML document (avoids SpamAssassin HTML_MIME_NO_HTML_TAG); inline styles, no externals.
    const html =
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Invoice ${num} from ${businessName}</title></head>` +
      `<body style="margin:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#14181f">` +
      `<div style="max-width:560px;margin:0 auto;padding:24px">` +
      `<div style="background:#ffffff;border:1px solid #e4e7ec;border-radius:12px;padding:28px">` +
      `<p style="margin:0 0 2px;font-size:13px;color:#5a6472">${businessName}</p>` +
      `<h1 style="margin:0 0 16px;font-size:20px;color:#14181f">Invoice ${num}</h1>` +
      noteHtml +
      `<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#5a6472">View and pay this invoice securely online using the button below.</p>` +
      `<a href="${link}" style="display:inline-block;background:#6d45f0;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;font-size:14px">View &amp; pay invoice ${num}</a>` +
      `<p style="margin:24px 0 0;font-size:12px;color:#8a95a5;word-break:break-all">Or paste this link into your browser:<br>${link}</p>` +
      `</div>` +
      `<p style="text-align:center;margin:16px 0 0;font-size:11px;color:#8a95a5">Sent with LoomLance on behalf of ${businessName}.</p>` +
      `</div></body></html>`

    // Plain-text alternative (avoids MIME_HTML_ONLY; also looks far less like phishing).
    const text =
      `Invoice ${num} from ${businessName}\n\n` +
      (note ? `${note}\n\n` : '') +
      `View and pay this invoice securely online:\n${link}\n\n` +
      `Sent with LoomLance on behalf of ${businessName}.`

    // multipart/mixed [ multipart/alternative (text + html), optional PDF attachment ]
    const alt = `alt_${crypto.randomUUID()}`
    const mixed = `mix_${crypto.randomUUID()}`
    const lines = [
      `From: "${businessName}" <${fromEmail}>`,
      `To: ${toList.join(', ')}`,
      ccList.length ? `Cc: ${ccList.join(', ')}` : null,
      replyTo ? `Reply-To: ${replyTo}` : null,
      `Subject: ${subj}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@send.loomlance.com>`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${mixed}"`,
      '',
      `--${mixed}`,
      `Content-Type: multipart/alternative; boundary="${alt}"`,
      '',
      `--${alt}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      wrap76(b64(text)),
      `--${alt}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      wrap76(b64(html)),
      `--${alt}--`,
    ]
    if (pdfBase64) {
      lines.push(
        `--${mixed}`,
        'Content-Type: application/pdf',
        `Content-Disposition: attachment; filename="${num}.pdf"`,
        'Content-Transfer-Encoding: base64',
        '',
        wrap76(pdfBase64),
      )
    }
    lines.push(`--${mixed}--`, '')
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
