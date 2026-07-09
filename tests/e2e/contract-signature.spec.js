import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_USER_EMAIL || 'test@loomlance.local'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123'

// Read-only for the signing feature: creates a ZZ client + contract (owner actions, like
// happy-path) to reach a contract detail page, then asserts the "Send for signature" control.
// No public signing against live data (covered by the guard unit + component tests).
test('contract detail shows the send-for-signature control', async ({ page }) => {
  const stamp = Date.now()

  await page.goto('/login')
  await page.locator('#email').fill(EMAIL)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL('/')

  await page.getByRole('link', { name: 'Clients' }).click()
  await page.getByRole('button', { name: /new client/i }).first().click()
  await page.getByLabel('Name').fill(`ZZ Sig Client ${stamp}`)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByText(`ZZ Sig Client ${stamp}`).first()).toBeVisible()

  await page.getByRole('link', { name: 'Contracts' }).click()
  await page.getByRole('button', { name: /new contract/i }).first().click()
  await page.getByLabel('Client').selectOption({ label: `ZZ Sig Client ${stamp}` })
  await page.getByLabel('Title').fill(`ZZ Sig Contract ${stamp}`)
  await page.getByRole('button', { name: 'Create' }).click()

  await page.getByRole('link', { name: new RegExp(`ZZ Sig Contract ${stamp}`) }).click()
  await expect(page.getByRole('button', { name: /send for signature/i })).toBeVisible()
})
