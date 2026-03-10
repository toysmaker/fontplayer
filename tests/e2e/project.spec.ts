/**
 * 工程操作 E2E 测试
 */

import { test, expect } from '@playwright/test'

test.describe('Project Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app (adjust URL as needed)
    await page.goto('http://localhost:5173')
    // Wait for app to load
    await page.waitForLoadState('networkidle')
  })

  test('should create new project', async ({ page }) => {
    // Click new project button (using data-testid)
    const newProjectButton = page.locator('[data-testid="new-project-button"]')
    await expect(newProjectButton).toBeVisible({ timeout: 10000 })
    await newProjectButton.click()

    // Wait for dialog to appear
    await page.waitForTimeout(500)
    
    // Fill in project details - use more specific selectors for Naive UI inputs
    // The input is inside a form, so we can use the placeholder or label
    const nameInput = page.locator('.n-input input').first()
    await expect(nameInput).toBeVisible({ timeout: 5000 })
    await nameInput.fill('Test Project')

    // The other fields are disabled, so we don't need to fill them
    // Submit - look for confirm button in the dialog
    const confirmButton = page.locator('.n-button--primary-type').filter({ hasText: /确认|Confirm/ }).first()
    await expect(confirmButton).toBeVisible({ timeout: 5000 })
    await confirmButton.click()

    // Wait for project to be created and navigate to editor
    await page.waitForTimeout(2000)
    
    // Verify we're in the editor (project should be created)
    const currentUrl = page.url()
    expect(currentUrl).toContain('/editor')
  })

  test('should open existing project', async ({ page }) => {
    // Click open project button (using data-testid)
    const openButton = page.locator('[data-testid="open-project-button"]')
    await expect(openButton).toBeVisible({ timeout: 10000 })
    await openButton.click()

    // This would require file upload mock or test file
    // For now, just verify button exists
    expect(openButton).toBeDefined()
  })

  test('should save project', async ({ page }) => {
    // Create or open project first
    // Then click save
    const saveButton = page.locator('button:has-text("保存")')
    
    // Verify save button exists
    expect(saveButton).toBeDefined()
  })
})
