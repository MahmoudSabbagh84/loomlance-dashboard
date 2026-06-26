import { z } from 'zod'
import { lineItemSchema } from './invoice-line-items'

export const invoiceCreateSchema = z.object({
  client_id: z.string().uuid(),
  project_id: z.string().uuid().or(z.literal('')).nullable().optional(),
  invoice_number: z.string().min(1).max(50),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.string().length(3),
  notes: z.string().max(5000).optional().or(z.literal('')),
  terms: z.string().max(5000).optional().or(z.literal('')),
  payment_instructions: z.string().max(5000).optional().or(z.literal('')),
  line_items: z.array(lineItemSchema).min(1, 'Add at least one line item'),
})

export const invoiceUpdateSchema = invoiceCreateSchema.partial().extend({
  status: z.enum(['draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'void']).optional(),
})
