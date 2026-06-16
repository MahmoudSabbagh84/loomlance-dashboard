import { z } from 'zod'

export const projectCreateSchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional().or(z.literal('')),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#2D3E50'),
})

export const projectUpdateSchema = projectCreateSchema.partial().extend({
  status: z.enum(['active', 'paused', 'archived']).optional(),
})
