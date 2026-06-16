import { z } from 'zod'

export const clientCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  company: z.string().max(200).optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
})

export const clientUpdateSchema = clientCreateSchema.partial()
