import { z } from 'zod'

export const columnCreateSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1).max(60),
  position: z.number().int().min(0),
  wip_limit: z.number().int().positive().nullable().optional(),
})

export const columnUpdateSchema = columnCreateSchema.partial()
