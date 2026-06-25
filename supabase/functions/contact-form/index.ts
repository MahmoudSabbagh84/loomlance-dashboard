// contact-form — delivers a splash-site contact message via AWS SES.
//
// PUBLIC function (deploy with --no-verify-jwt): the splash visitor has no session.
// Sends from the platform-verified domain with Reply-To = the submitter, To = the
// contact inbox. Mirrors send-invoice's SES (SigV4 via aws4fetch) approach.
//
// Secrets required: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SES_FROM_EMAIL.
//   Optional: CONTACT_TO_EMAIL (default info@loomlance.com), CONTACT_FROM_EMAIL (default SES_FROM_EMAIL).
// Deploy: supabase functions deploy contact-form --no-verify-jwt
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)))
const wrap76 = (s: string) => s.replace(/(.{76})/g, '$1\r\n')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  const json = (obj: unknown, status = 200) => jsonBase(obj, status, req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const payload = await req.json().catch(() => null)
    if (!payload) return json({ error: 'Invalid request body.' }, 400)

    // Honeypot: bots fill hidden fields. Pretend success, send nothing.
    if (typeof payload.company === 'string' && payload.company.trim() !== '') {
      return json({ ok: true })
    }

    const name = String(payload.name ?? '').trim()
    const email = String(payload.email ?? '').trim()
    const subject = String(payload.subject ?? '').trim()
    const message = String(payload.message ?? '').trim()

    if (name.length < 2 || name.length > 100) return json({ error: 'Please enter your name.' }, 400)
    if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: 'Please enter a valid email address.' }, 400)
    if (subject.length < 2 || subject.length > 200) return json({ error: 'Please enter a subject.' }, 400)
    if (message.length < 10 || message.length > 2000) return json({ error: 'Message must be 10–2000 characters.' }, 400)

    // Per-IP rate limit (5 / 10 min). Checked AFTER validation so malformed spam can't even
    // record an attempt, and BEFORE the SES send so a flood can't burn quota or fill the inbox.
    // x-forwarded-for is platform-set; the leftmost hop is the client (spoofable, but raises the
    // bar). A null/empty IP is allowed through rather than hard-blocked (see the RPC).
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
      (req.headers.get('x-real-ip') ?? '').trim()
    const rl = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })
    const { data: allowed, error: rlErr } = await rl.rpc('check_contact_rate_limit', { p_ip: ip })
    // Fail-open on an RPC error (don't break a legit contact attempt on infra hiccups), but block
    // when the limiter explicitly says we're over the cap.
    if (!rlErr && allowed === false) {
      return json({ error: 'Too many messages. Please wait a few minutes and try again.' }, 429)
    }

    const region = Deno.env.get('AWS_REGION') ?? 'us-east-1'
    const fromEmail = Deno.env.get('CONTACT_FROM_EMAIL') ?? Deno.env.get('SES_FROM_EMAIL') ?? 'contact@send.loomlance.com'
    const toEmail = Deno.env.get('CONTACT_TO_EMAIL') ?? 'info@loomlance.com'

    // Header-injection guard: strip CR/LF from anything that lands in a header.
    const safeSubjectHeader = subject.replace(/[\r\n]/g, ' ').slice(0, 200)
    const safeReplyTo = email.replace(/[\r\n]/g, '')

    // Full HTML document (avoids SpamAssassin HTML_MIME_NO_HTML_TAG); inline styles, web-safe font.
    const html =
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>New contact form message</title></head>` +
      `<body style="margin:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#14181f">` +
      `<div style="max-width:560px;margin:0 auto;padding:24px">` +
      `<div style="background:#ffffff;border:1px solid #e4e7ec;border-radius:12px;padding:28px">` +
      `<h1 style="margin:0 0 16px;font-size:18px;color:#14181f">New contact form message</h1>` +
      `<p style="margin:0 0 4px;font-size:14px"><strong>Name:</strong> ${esc(name)}</p>` +
      `<p style="margin:0 0 4px;font-size:14px"><strong>Email:</strong> ${esc(email)}</p>` +
      `<p style="margin:0 0 16px;font-size:14px"><strong>Subject:</strong> ${esc(subject)}</p>` +
      `<p style="white-space:pre-wrap;border-top:1px solid #e4e7ec;padding-top:16px;font-size:14px;line-height:1.6;color:#14181f">${esc(message)}</p>` +
      `<p style="color:#8a95a5;font-size:12px;margin:20px 0 0">Sent from the LoomLance contact form. Reply directly to reach ${esc(email)}.</p>` +
      `</div></div></body></html>`

    // Plain-text alternative (avoids MIME_HTML_ONLY).
    const text =
      `New contact form message\n\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      `Subject: ${subject}\n\n` +
      `${message}\n\n` +
      `Sent from the LoomLance contact form. Reply directly to reach ${email}.`

    const alt = `alt_${crypto.randomUUID()}`
    const rawMime = [
      `From: "LoomLance Contact" <${fromEmail}>`,
      `To: ${toEmail}`,
      `Reply-To: ${safeReplyTo}`,
      `Subject: [LoomLance Contact] ${safeSubjectHeader}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@send.loomlance.com>`,
      'MIME-Version: 1.0',
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
      '',
    ].join('\r\n')

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
      return json({ error: 'Could not send your message. Please email us directly.', detail: await sesRes.text() }, 502)
    }

    return json({ ok: true })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
