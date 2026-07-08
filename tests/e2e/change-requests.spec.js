import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_USER_EMAIL || 'test@loomlance.local'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123'

// Read-only for the change-requests feature itself: creates a ZZ client + project (owner
// actions, same as happy-path) to land on a project detail page, then asserts the Change
// requests panel renders. No change request is created/sent/approved against live data.
test('project page shows the Change requests panel', async ({ page }) => {
  const stamp = Date.now()

  await page.goto('/login')
  await page.locator('#email').fill(EMAIL)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL('/')

  // Client
  await page.getByRole('link', { name: 'Clients' }).click()
  await page.getByRole('button', { name: /new client/i }).first().click()
  await page.getByLabel('Name').fill(`ZZ CR Client ${stamp}`)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByText(`ZZ CR Client ${stamp}`).first()).toBeVisible()

  // Project
  await page.getByRole('link', { name: 'Projects' }).click()
  await page.getByRole('button', { name: /new project/i }).first().click()
  await page.getByLabel('Client').selectOption({ label: `ZZ CR Client ${stamp}` })
  await page.getByLabel('Name').fill(`ZZ CR Project ${stamp}`)
  await page.getByLabel('Task key').fill(`Z${String(stamp).slice(-4)}`)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByText(`ZZ CR Project ${stamp}`).first()).toBeVisible()

  // Open the project → the Change requests panel is there
  await page.getByRole('link', { name: new RegExp(`ZZ CR Project ${stamp}`) }).click()
  await expect(page.getByRole('heading', { name: 'Change requests' })).toBeVisible()
  await expect(page.getByRole('button', { name: /new change request/i })).toBeVisible()
})
