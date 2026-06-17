import { z } from 'zod'

export const lineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().nonnegative(),
  unit_price: z.number(),
  tax_rate: z.number().min(0).max(100).default(0),
  discount_rate: z.number().min(0).max(100).default(0),
  position: z.number().int().nonnegative(),
})
