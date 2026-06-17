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

  // Create a project
  await page.getByRole('link', { name: 'Projects' }).click()
  await page.getByRole('button', { name: /new project/i }).first().click()
  await page.getByLabel('Client').selectOption({ index: 1 })
  await page.getByLabel('Name').fill(`ZZ E2E Project ${stamp}`)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByText(`ZZ E2E Project ${stamp}`).first()).toBeVisible()

  // Draft an invoice (wait for the clients query to resolve so the draft can be seeded)
  await page.getByRole('link', { name: 'Invoices' }).click()
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /new invoice/i }).first().click()
  await expect(page.getByRole('heading', { name: /INV-/ })).toBeVisible({ timeout: 10000 })
})
