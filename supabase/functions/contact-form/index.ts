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
import { corsHeaders, json } from '../_shared/cors.ts'

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)))
const wrap76 = (s: string) => s.replace(/(.{76})/g, '$1\r\n')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
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

    const region = Deno.env.get('AWS_REGION') ?? 'us-east-1'
    const fromEmail = Deno.env.get('CONTACT_FROM_EMAIL') ?? Deno.env.get('SES_FROM_EMAIL') ?? 'contact@send.loomlance.com'
    const toEmail = Deno.env.get('CONTACT_TO_EMAIL') ?? 'info@loomlance.com'

    // Header-injection guard: strip CR/LF from anything that lands in a header.
    const safeSubjectHeader = subject.replace(/[\r\n]/g, ' ').slice(0, 200)
    const safeReplyTo = email.replace(/[\r\n]/g, '')

    const html =
      `<div style="font-family:sans-serif;line-height:1.5">` +
      `<h2 style="margin:0 0 12px">New contact form message</h2>` +
      `<p><strong>Name:</strong> ${esc(name)}<br>` +
      `<strong>Email:</strong> ${esc(email)}<br>` +
      `<strong>Subject:</strong> ${esc(subject)}</p>` +
      `<p style="white-space:pre-wrap;border-top:1px solid #eee;padding-top:12px">${esc(message)}</p>` +
      `<p style="color:#888;font-size:12px">Sent from the LoomLance contact form. Reply directly to reach ${esc(email)}.</p>` +
      `</div>`

    const boundary = `b_${crypto.randomUUID()}`
    const rawMime = [
      `From: "LoomLance Contact" <${fromEmail}>`,
      `To: ${toEmail}`,
      `Reply-To: ${safeReplyTo}`,
      `Subject: [LoomLance Contact] ${safeSubjectHeader}`,
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
      `--${boundary}--`,
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
