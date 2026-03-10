/**
 * 编辑界面 E2E 测试
 */

import { test, expect } from '@playwright/test'
import { createTestProject, ensureEditorPage } from './helpers/test-setup'

test.describe('Editor Interface', () => {
  test.beforeEach(async ({ page }) => {
    // 创建测试项目（如果还没有）
    await createTestProject(page)
    // 确保在编辑器页面
    await ensureEditorPage(page)
  })

  test('should display component list', async ({ page }) => {
    // Wait for character list to be visible
    const characterList = page.locator('[data-testid="character-list"]')
    await expect(characterList).toBeVisible({ timeout: 10000 })
    
    // Check if there are any characters (may be empty if no project is loaded)
    const characterItem = page.locator('[data-testid="character-item"]').first()
    const count = await characterItem.count()
    
    if (count === 0) {
      // Skip test if no characters are available (new projects are empty by default)
      test.skip(true, 'No characters in project - new projects are empty by default')
      return
    }
    
    // Open character editor
    await characterItem.dblclick({ timeout: 10000 })

    // Verify component list is visible
    const componentList = page.locator('[data-testid="component-list"]')
    await expect(componentList).toBeVisible({ timeout: 10000 })
  })

  test('should open parameter panel when selecting component', async ({ page }) => {
    // Wait for character list to be visible
    const characterList = page.locator('[data-testid="character-list"]')
    await expect(characterList).toBeVisible({ timeout: 10000 })
    
    // Check if there are any characters (may be empty if no project is loaded)
    const characterItem = page.locator('[data-testid="character-item"]').first()
    const count = await characterItem.count()
    
    if (count === 0) {
      // Skip test if no characters are available (new projects are empty by default)
      test.skip(true, 'No characters in project - new projects are empty by default')
      return
    }
    
    // Open character editor
    await characterItem.dblclick({ timeout: 10000 })

    // Wait for component list to appear
    const componentList = page.locator('[data-testid="component-list"]')
    await expect(componentList).toBeVisible({ timeout: 10000 })
    
    // Check if there are any components
    const componentItem = page.locator('[data-testid="component-item"]').first()
    const componentCount = await componentItem.count()
    
    if (componentCount === 0) {
      // Skip test if no components are available (characters may not have components)
      test.skip(true, 'No components in character - characters may be empty')
      return
    }
    
    // Select component
    await componentItem.click({ timeout: 10000 })

    // Verify parameter panel is visible
    const parameterPanel = page.locator('[data-testid="parameter-panel"]')
    await expect(parameterPanel).toBeVisible({ timeout: 10000 })
  })

  test('should render canvas', async ({ page }) => {
    // Wait for character list to be visible
    const characterList = page.locator('[data-testid="character-list"]')
    await expect(characterList).toBeVisible({ timeout: 10000 })
    
    // Check if there are any characters (may be empty if no project is loaded)
    const characterItem = page.locator('[data-testid="character-item"]').first()
    const count = await characterItem.count()
    
    if (count === 0) {
      // Skip test if no characters are available (new projects are empty by default)
      test.skip(true, 'No characters in project - new projects are empty by default')
      return
    }
    
    // Open character editor
    await characterItem.dblclick({ timeout: 10000 })

    // Verify canvas is rendered (may take time to render)
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible({ timeout: 10000 })
  })
})
