import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_USER_EMAIL || 'test@loomlance.local'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123'

test('admin pulse renders live metrics and tabs navigate', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#email').fill(EMAIL)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/admin')
  await expect(page.getByText('Total users')).toBeVisible()
  // The tile value is a live number — assert it is a digit string, not a specific count.
  await expect(page.getByText('Total users').locator('xpath=following-sibling::p[1]')).toHaveText(/^\d+$/)
  await expect(page.getByText('Signups per week')).toBeVisible()

  await page.getByRole('link', { name: 'Posts' }).click()
  await expect(page).toHaveURL('/admin/posts')
})
