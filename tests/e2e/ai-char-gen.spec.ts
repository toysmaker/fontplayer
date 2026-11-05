/**
 * AI 随机生成字符 端到端 (web, 真实对话框流程)
 * 新建工程 → 工具菜单 → 随机生成字符 → textarea 输入 → 生成 → 打开字符检查组件
 */
import { test, expect } from '@playwright/test'

test('AI 随机生成字符端到端', async ({ page }) => {
  test.setTimeout(240000)
  const hasModel = await fetch('http://localhost:5173/models/ai/char_generator_fp16.onnx')
    .then((r) => r.ok)
    .catch(() => false)
  test.skip(!hasModel, 'AI 模型文件不存在 (public/models/ai 未生成), 跳过')

  await page.goto('http://localhost:5173')
  await page.waitForLoadState('networkidle')

  // 新建工程
  await page.locator('[data-testid="new-project-button"]').click()
  await page.locator('.n-input input').first().fill('AI字符测试')
  await page.locator('.n-button--primary-type').filter({ hasText: /确认|Confirm/ }).first().click()
  await page.waitForURL('**/editor**', { timeout: 15000 })

  // 工具菜单 → 随机生成字符
  const toolsMenu = page.locator('.menu-item-wrapper').filter({ hasText: '工具' })
  await toolsMenu.hover()
  const charItem = page.locator('.menu-dropdown-item').filter({ hasText: '随机生成字符' }).first()
  await expect(charItem).toBeVisible({ timeout: 5000 })
  await charItem.hover()
  await charItem.click()

  const dialog = page.locator('.random-char-dialog')
  await expect(dialog).toBeVisible({ timeout: 5000 })

  // 输入两个字符并生成
  await dialog.locator('textarea').fill('永一')
  await dialog.locator('.n-button--primary-type').filter({ hasText: /生成/ }).first().click()

  // 推理阶段 spinner
  await expect(dialog.locator('.ai-spinner')).toBeVisible({ timeout: 5000 })

  // 等待完成
  await expect(dialog).toBeHidden({ timeout: 180000 })
  await expect(page.getByText(/已生成 2 个字符/)).toBeVisible({ timeout: 10000 })

  // 字符列表出现 2 项
  const charList = page.locator('[data-testid="character-list"]')
  await expect(charList).toBeVisible({ timeout: 10000 })
  await expect(charList.locator('[data-testid="character-item"]')).toHaveCount(2, { timeout: 10000 })

  // 打开第一个字符 → 编辑器组件列表应有 pen 组件
  await charList.locator('[data-testid="character-item"]').first().click()
  const componentList = page.locator('[data-testid="component-list"]')
  await expect(componentList).toBeVisible({ timeout: 15000 })
  const penCount = await componentList.locator('[data-testid="component-item"][data-type="pen"]').count()
  expect(penCount).toBeGreaterThan(0)
})
