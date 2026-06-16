import { z } from 'zod'

export const clientContactCreateSchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  role: z.string().max(100).optional().or(z.literal('')),
  is_primary: z.boolean().default(false),
})

export const clientContactUpdateSchema = clientContactCreateSchema.partial()
