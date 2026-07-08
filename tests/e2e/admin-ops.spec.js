import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_USER_EMAIL || 'test@loomlance.local'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123'

test('admin ops page renders live cron health (read-only)', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#email').fill(EMAIL)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/admin/ops')
  await expect(page.getByRole('heading', { name: 'Cron jobs' })).toBeVisible()
  // The three pg_cron jobs are real, seeded data.
  await expect(page.getByText('mark-overdue-invoices')).toBeVisible()
  await expect(page.getByText('generate-recurring-invoices')).toBeVisible()
  await expect(page.getByText('notify-due-soon-invoices')).toBeVisible()

  await page.getByRole('link', { name: 'Pulse' }).click()
  await expect(page).toHaveURL('/admin')
})
