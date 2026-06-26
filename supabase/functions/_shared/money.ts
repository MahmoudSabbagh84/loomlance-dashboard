// PARITY: exact port of src/lib/money.js — keep the algorithm identical.
const round2 = (n: number) => Math.round(n * 100) / 100

export function lineTotal(line: { quantity?: number|string; unit_price?: number|string; tax_rate?: number|string; discount_rate?: number|string }) {
  const quantity = Number(line.quantity) || 0
  const unit_price = Number(line.unit_price) || 0
  const tax_rate = Number(line.tax_rate) || 0
  const discount_rate = Number(line.discount_rate) || 0
  const gross = quantity * unit_price
  const discount = round2(gross * (discount_rate / 100))
  const net = gross - discount
  const tax = round2(net * (tax_rate / 100))
  return { subtotal: round2(gross), discount, tax, total: round2(net + tax) }
}

export function invoiceTotals(lines: Array<Record<string, unknown>>) {
  let subtotal = 0, discount = 0
  const taxByRate: Record<string, number> = {}
  for (const line of lines ?? []) {
    const r = lineTotal(line as any)
    subtotal += r.subtotal
    discount += r.discount
    const rate = Number((line as any).tax_rate) || 0
    if (rate > 0) taxByRate[rate] = round2((taxByRate[rate] ?? 0) + r.tax)
  }
  const totalTax = round2(Object.values(taxByRate).reduce((a, b) => a + b, 0))
  return { subtotal: round2(subtotal), discount: round2(discount), taxByRate, totalTax, total: round2(subtotal - discount + totalTax) }
}
