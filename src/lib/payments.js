// Ordered list of online payment methods a client can use on the public invoice page,
// derived from the public-invoice payload (which already encodes connection state on the
// server). 'card' = issuer has Stripe connected (the RPC's can_pay); 'paypal' = issuer set a
// PayPal link. Pure — the page passes the get_public_invoice result in. Card before PayPal.
export function paymentMethods(issuer) {
  const i = issuer ?? {}
  const methods = []
  if (i.can_pay) methods.push('card')
  if (typeof i.paypal_link === 'string' && i.paypal_link.trim() !== '') methods.push('paypal')
  return methods
}
