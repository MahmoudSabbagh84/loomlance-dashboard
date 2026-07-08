import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_USER_EMAIL || 'test@loomlance.local'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123'

// Read-only: no secret create/reveal against live data (the encrypt/decrypt path is covered by
// the crypto unit tests + the owner's post-merge manual check). Just asserts the page loads.
test('vault page loads for an authenticated user', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#email').fill(EMAIL)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL('/')

  await page.getByRole('link', { name: 'Vault' }).click()
  await expect(page.getByRole('heading', { name: 'Vault' })).toBeVisible()
  await expect(page.getByRole('button', { name: /new credential/i })).toBeVisible()
})
