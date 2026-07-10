import { expect, test } from '@playwright/test'

test('planner loads and recipe search works', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'DSP Calculator' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Production Chain' })).toBeVisible()
  await page.getByRole('button', { name: 'Tree' }).click()
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

test('graph flows from raw inputs to outputs and supports zoom and drag', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Graph' }).click()

  const graphView = page.getByLabel('Production graph')
  const outputNode = page.locator('.graph-node[data-depth="0"][title="Processor"]').first()
  const rawNode = page.locator('.graph-node[title="Iron Ore"]').first()
  await expect(outputNode).toBeVisible()
  await expect(rawNode).toBeVisible()

  const outputBox = await outputNode.boundingBox()
  const rawBox = await rawNode.boundingBox()
  expect(outputBox).not.toBeNull()
  expect(rawBox).not.toBeNull()
  expect(outputBox!.x).toBeGreaterThan(rawBox!.x)
  await expect(outputNode).toHaveCSS('cursor', 'grab')

  const zoomBefore = Number(await graphView.getAttribute('data-zoom'))
  await page.mouse.move(rawBox!.x + rawBox!.width / 2, rawBox!.y + rawBox!.height / 2)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -240)
  await page.keyboard.up('Control')
  await expect.poll(async () => Number(await graphView.getAttribute('data-zoom'))).toBeGreaterThan(zoomBefore)
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

  const dragStartBox = await rawNode.boundingBox()
  const nodeId = await rawNode.getAttribute('data-node-id')
  const startX = Number(await rawNode.getAttribute('data-x'))
  const startY = Number(await rawNode.getAttribute('data-y'))
  expect(dragStartBox).not.toBeNull()
  expect(nodeId).not.toBeNull()
  await page.mouse.move(dragStartBox!.x + dragStartBox!.width / 2, dragStartBox!.y + dragStartBox!.height / 2)
  await page.mouse.down()
  await expect(graphView).toHaveAttribute('data-dragging', nodeId!)
  await page.mouse.move(dragStartBox!.x + dragStartBox!.width / 2 + 80, dragStartBox!.y + dragStartBox!.height / 2 + 42)
  await expect.poll(async () => Number(await rawNode.getAttribute('data-x'))).toBeGreaterThan(startX + 20)
  await expect.poll(async () => Number(await rawNode.getAttribute('data-y'))).toBeGreaterThan(startY + 10)
  await page.mouse.up()

  await expect(page.getByRole('dialog', { name: 'Select a Recipe' })).toHaveCount(0)
  const dragEndBox = await rawNode.boundingBox()
  expect(dragEndBox).not.toBeNull()
  expect(dragEndBox!.x).toBeGreaterThan(dragStartBox!.x + 20)
  expect(dragEndBox!.y).toBeGreaterThan(dragStartBox!.y + 12)
})

test('allows removing the final output goal and showing empty state', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Remove Processor' })).toBeVisible()
  await page.getByRole('button', { name: 'Remove Processor' }).click()
  
  await expect(page.getByLabel('Empty chain view')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No production goals active' })).toBeVisible()
  await expect(page.locator('.rate-input input')).toBeDisabled()
})
