import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_USER_EMAIL || 'test@loomlance.local'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123'

test('admin can search the roster and open a user detail (read-only)', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#email').fill(EMAIL)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/admin/users')
  await expect(page.getByLabel('Search users')).toBeVisible()
  await page.getByLabel('Search users').fill('demo@loomlance.com')
  const demoLink = page.getByRole('link', { name: 'demo@loomlance.com' })
  await expect(demoLink).toBeVisible()

  await demoLink.click()
  await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]+/)
  await expect(page.getByText('demo@loomlance.com').first()).toBeVisible()
  await expect(page.getByRole('main').getByText('Clients')).toBeVisible()
  // Demo user must NOT offer a ban control (server-guarded, UI-hidden)
  await expect(page.getByRole('button', { name: /^ban/i })).toHaveCount(0)
})
