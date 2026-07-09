import { expect, test } from '@playwright/test'

test('planner loads and recipe search works', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'DSP Calculator' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Production Chain' })).toBeVisible()
  await page.getByRole('button', { name: /Processor/i }).first().click()
  await expect(page.getByRole('dialog', { name: 'Select a Recipe' })).toBeVisible()
  await page.getByPlaceholder('Search item or building').fill('processor')
  await expect(page.locator('.icon-tile[title="Processor"]').first()).toBeVisible()
})

test('graph tab renders graph nodes', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Graph' }).click()
  await expect(page.getByLabel('Production graph')).toBeVisible()
  await expect(page.locator('.graph-node').first()).toBeVisible()
})
