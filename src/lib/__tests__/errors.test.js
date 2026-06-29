// src/lib/__tests__/errors.test.js
import { describe, it, expect } from 'vitest'
import { mapPostgresError, AppError } from '@/lib/errors'

describe('mapPostgresError', () => {
  it('maps PROJECT_LIMIT_EXCEEDED raised by trigger to friendly message', () => {
    const supabaseError = { code: 'P0001', message: 'PROJECT_LIMIT_EXCEEDED' }
    const e = mapPostgresError(supabaseError)
    expect(e).toBeInstanceOf(AppError)
    expect(e.code).toBe('PROJECT_LIMIT_EXCEEDED')
    expect(e.userMessage).toMatch(/limit/i)
  })

  it('maps unique violation (23505) on invoices.invoice_number to INVOICE_NUMBER_TAKEN', () => {
    const supabaseError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "invoices_user_id_invoice_number_key"',
    }
    const e = mapPostgresError(supabaseError)
    expect(e.code).toBe('INVOICE_NUMBER_TAKEN')
  })

  it('maps the task_key unique violation to TASK_KEY_TAKEN', () => {
    const err = mapPostgresError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "projects_user_id_task_key_key"',
    })
    expect(err.code).toBe('TASK_KEY_TAKEN')
    expect(err.userMessage.toLowerCase()).toContain('task key')
  })

  it('falls back to UNKNOWN for unhandled errors', () => {
    const e = mapPostgresError({ code: '99999', message: 'weird' })
    expect(e.code).toBe('UNKNOWN')
    expect(e.userMessage).toMatch(/something went wrong/i)
  })

  it('passes through AppError instances unchanged', () => {
    const original = new AppError('STRIPE_NOT_CONNECTED', 'Connect Stripe first')
    expect(mapPostgresError(original)).toBe(original)
  })
})
