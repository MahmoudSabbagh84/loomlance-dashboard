import { z } from 'zod'

const labelSchema = z.object({ name: z.string().min(1).max(40), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/) })

export const taskCreateSchema = z.object({
  project_id: z.string().uuid(),
  column_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().or(z.literal('')),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  labels: z.array(labelSchema).default([]),
})

export const taskUpdateSchema = taskCreateSchema.partial()
