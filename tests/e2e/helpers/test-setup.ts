/**
 * E2E 测试辅助函数
 * 用于设置测试环境，如创建测试项目等
 */

import { Page, expect } from '@playwright/test'

/**
 * 创建一个测试项目
 * 通过 UI 操作创建项目，确保测试有数据可用
 */
export async function createTestProject(page: Page, projectName: string = 'E2E Test Project'): Promise<void> {
  // 检查是否已经在编辑器页面且有项目
  const currentUrl = page.url()
  const characterList = page.locator('[data-testid="character-list"]')
  
  // 如果已经在编辑器页面，检查是否已有项目
  if (currentUrl.includes('/editor')) {
    try {
      // 等待一下，看看是否有字符列表
      await characterList.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {})
      const hasItems = await characterList.locator('[data-testid="character-item"]').count()
      if (hasItems > 0) {
        // 已经有项目了，不需要创建
        return
      }
    } catch {
      // 字符列表不存在或不可见，需要创建项目
    }
  }
  
  // 导航到欢迎页面
  await page.goto('http://localhost:5173')
  await page.waitForLoadState('networkidle')
  
  // 点击新建项目按钮
  const newProjectButton = page.locator('[data-testid="new-project-button"]')
  await expect(newProjectButton).toBeVisible({ timeout: 10000 })
  await newProjectButton.click()
  
  // 等待对话框出现
  await page.waitForTimeout(500)
  
  // 填写项目名称
  const nameInput = page.locator('.n-input input').first()
  await expect(nameInput).toBeVisible({ timeout: 5000 })
  await nameInput.fill(projectName)
  
  // 点击确认按钮
  const confirmButton = page.locator('.n-button--primary-type').filter({ hasText: /确认|Confirm/ }).first()
  await expect(confirmButton).toBeVisible({ timeout: 5000 })
  await confirmButton.click()
  
  // 等待项目创建完成并导航到编辑器
  await page.waitForTimeout(2000)
  
  // 验证已经导航到编辑器
  const finalUrl = page.url()
  expect(finalUrl).toContain('/editor')
  
  // 等待字符列表出现（即使可能是空的）
  await characterList.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
}

/**
 * 确保在编辑器页面
 */
export async function ensureEditorPage(page: Page): Promise<void> {
  const currentUrl = page.url()
  if (!currentUrl.includes('/editor')) {
    await page.goto('http://localhost:5173/#/editor')
    await page.waitForLoadState('networkidle')
  }
}
