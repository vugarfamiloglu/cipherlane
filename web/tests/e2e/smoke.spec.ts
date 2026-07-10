import { expect, test } from '@playwright/test'

test('sign in, dashboard, topology layout switch, and tunnel wizard', async ({ page }) => {
  await page.goto('/')

  // Sign in if the session cookie is not already set.
  const passcode = page.getByPlaceholder('••••••••••')
  if (await passcode.isVisible().catch(() => false)) {
    await passcode.fill('cipherlane')
    await page.getByRole('button', { name: 'Sign in' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Control Overview' })).toBeVisible()

  // Topology: reachable and layout switch works.
  await page.getByRole('link', { name: 'Topology' }).click()
  await expect(page.getByRole('heading', { name: 'Network Topology' })).toBeVisible()
  await page.getByRole('tab', { name: 'Grid' }).click()
  await expect(page.getByRole('img', { name: 'Network topology map' })).toBeVisible()

  // Tunnels: the create wizard opens.
  await page.getByRole('link', { name: 'Tunnels' }).click()
  await expect(page.getByRole('heading', { name: 'Tunnels' })).toBeVisible()
  await page.getByRole('button', { name: 'New tunnel' }).click()
  await expect(page.getByRole('button', { name: 'Create tunnel' })).toBeVisible()
})
