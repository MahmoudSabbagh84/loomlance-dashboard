// PARITY: supabase/functions/_shared/money.ts mirrors this — keep in sync (LOO-33).
function round2(n) {
  return Math.round(n * 100) / 100
}

export function lineTotal({ quantity = 0, unit_price = 0, tax_rate = 0, discount_rate = 0 }) {
  const gross = quantity * unit_price
  const discount = round2(gross * (discount_rate / 100))
  const net = gross - discount
  const tax = round2(net * (tax_rate / 100))
  return {
    subtotal: round2(gross),
    discount,
    tax,
    total: round2(net + tax),
  }
}

export function invoiceTotals(lines) {
  let subtotal = 0
  let discount = 0
  const taxByRate = {}

  for (const line of lines) {
    const r = lineTotal(line)
    subtotal += r.subtotal
    discount += r.discount
    const rate = line.tax_rate ?? 0
    if (rate > 0) taxByRate[rate] = round2((taxByRate[rate] ?? 0) + r.tax)
  }

  const totalTax = round2(Object.values(taxByRate).reduce((a, b) => a + b, 0))
  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    taxByRate,
    totalTax,
    total: round2(subtotal - discount + totalTax),
  }
}
