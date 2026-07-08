import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_USER_EMAIL || 'test@loomlance.local'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123'

test('user can sign in, add a client, create a project, draft an invoice', async ({ page }) => {
  const stamp = Date.now()

  await page.goto('/login')
  await page.locator('#email').fill(EMAIL)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL('/')

  // Add a client
  await page.getByRole('link', { name: 'Clients' }).click()
  await page.getByRole('button', { name: /new client/i }).first().click()
  await page.getByLabel('Name').fill(`ZZ E2E Client ${stamp}`)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible()

  // Create a project. The Task key auto-derives to "ZEP1" from the ZZ name and collides with
  // any leftover run's project (unique per user) — set a stamp-unique key explicitly.
  await page.getByRole('link', { name: 'Projects' }).click()
  await page.getByRole('button', { name: /new project/i }).first().click()
  await page.getByLabel('Client').selectOption({ label: `ZZ E2E Client ${stamp}` })
  await page.getByLabel('Name').fill(`ZZ E2E Project ${stamp}`)
  await page.getByLabel('Task key').fill(`Z${String(stamp).slice(-4)}`)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByText(`ZZ E2E Project ${stamp}`).first()).toBeVisible()

  // Draft an invoice: "New invoice" opens a dialog (client select + Create draft) since the
  // LOO-91 pay-flow rework — drive it with the ZZ client created above.
  await page.getByRole('link', { name: 'Invoices' }).click()
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /new invoice/i }).first().click()
  await page.getByLabel('Client').selectOption({ label: `ZZ E2E Client ${stamp}` })
  await page.getByRole('button', { name: 'Create draft' }).click()
  await expect(page.getByRole('heading', { name: /INV-/ })).toBeVisible({ timeout: 10000 })
})
