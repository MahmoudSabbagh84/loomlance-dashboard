import { z } from 'zod'

export const paymentCreateSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  paid_at: z.string(),
  method: z.enum(['stripe', 'bank', 'cash', 'other', 'manual']).default('manual'),
  notes: z.string().max(1000).optional().or(z.literal('')),
})
