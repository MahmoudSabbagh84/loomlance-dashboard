import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_USER_EMAIL || 'test@loomlance.local'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123'

test('admin can create, edit, and delete a draft post', async ({ page }) => {
  const title = `ZZ E2E Post ${Date.now()}` // ZZ marker per cleanup convention

  await page.goto('/login')
  await page.locator('#email').fill(EMAIL)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/admin/posts')
  await page.getByRole('button', { name: 'New post' }).first().click()

  await page.getByLabel('Title').fill(title)
  await page.getByLabel(/Excerpt/).fill('E2E excerpt for meta description purposes.')
  await page.getByLabel('Body (Markdown)').fill('# Hello\n\nSome **markdown**.')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByText('Draft saved')).toBeVisible()

  await page.goto('/admin/posts')
  await expect(page.getByRole('link', { name: title })).toBeVisible()

  await page.getByRole('row', { name: new RegExp(title) }).getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('link', { name: title })).not.toBeVisible()
})
