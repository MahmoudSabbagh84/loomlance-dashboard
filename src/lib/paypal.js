// Build a payable PayPal URL from a freelancer's saved handle/link. Accepts a full
// paypal.me URL, a "paypal.me/handle" string, or a bare username; for paypal.me links it
// appends the amount + currency so the payer lands on the right total. Other URLs are
// passed through (just ensuring a protocol).
export function paypalHref(link, amount, currency) {
  if (!link) return null
  let url = String(link).trim()
  if (!url) return null
  if (!/^https?:\/\//i.test(url)) {
    url = /paypal\.me/i.test(url) ? `https://${url}` : `https://paypal.me/${url.replace(/^@/, '')}`
  }
  if (/paypal\.me\//i.test(url) && amount > 0) {
    const after = url.split(/paypal\.me\//i)[1].replace(/\/+$/, '')
    if (!after.includes('/')) url = `${url.replace(/\/+$/, '')}/${amount.toFixed(2)}${currency}`
  }
  return url
}
