import { z } from 'zod'

export const contractCreateSchema = z.object({
  client_id: z.string().uuid(),
  project_id: z.string().uuid().or(z.literal('')).nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional().or(z.literal('')),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).nullable().optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).nullable().optional(),
  value: z.number().nonnegative().nullable().optional(),
  hourly_rate: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).default('USD'),
  status: z.enum(['draft', 'active', 'completed', 'expired', 'canceled']).default('active'),
}).refine(
  (d) => !d.start_date || !d.end_date || d.start_date <= d.end_date,
  { message: 'End date must be after start date', path: ['end_date'] }
)

export const contractUpdateSchema = contractCreateSchema._def.schema.partial()
