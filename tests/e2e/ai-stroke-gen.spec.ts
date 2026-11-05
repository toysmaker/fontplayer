/**
 * AI 随机生成笔画 端到端测试 (web/dev 模式)
 * 新建工程 → 工具菜单 → 随机生成笔画 → 生成 → 断言 32 个笔画字形出现在笔画列表
 */
import { test, expect } from '@playwright/test'

test('AI 随机生成笔画端到端', async ({ page }) => {
  test.setTimeout(240000)
  // 模型文件在 public/models/ai (gitignored, 由导出脚本生成); 缺失时跳过
  const hasModel = await fetch('http://localhost:5173/models/ai/stroke_generator_fp16.onnx')
    .then((r) => r.ok)
    .catch(() => false)
  test.skip(!hasModel, 'AI 模型文件不存在 (public/models/ai 未生成), 跳过')

  await page.goto('http://localhost:5173')
  await page.waitForLoadState('networkidle')

  // 新建工程
  await page.locator('[data-testid="new-project-button"]').click()
  await page.locator('.n-input input').first().fill('AI生成测试')
  await page.locator('.n-button--primary-type').filter({ hasText: /确认|Confirm/ }).first().click()
  await page.waitForURL('**/editor**', { timeout: 15000 })

  // 工具菜单 → 随机生成笔画 (hover 顶级菜单, 点击子项)
  const toolsMenu = page.locator('.menu-item-wrapper').filter({ hasText: '工具' })
  await toolsMenu.hover()
  const strokeItem = page.locator('.menu-dropdown-item').filter({ hasText: '随机生成笔画' }).first()
  await expect(strokeItem).toBeVisible({ timeout: 5000 })
  await strokeItem.hover()
  await strokeItem.click()

  // 对话框出现
  const dialog = page.locator('.random-stroke-dialog')
  await expect(dialog).toBeVisible({ timeout: 5000 })

  // 默认随机模式关闭: 五权重圆点可见; 点击"随机"按钮高亮并隐藏圆点
  const canvas = dialog.locator('.pentagon-canvas')
  await expect(canvas).toBeVisible()
  // 画布实际绘制了五边形内容 (非空白)
  await page.waitForTimeout(300)
  const inkPixels = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')!
    const data = ctx.getImageData(0, 0, el.width, el.height).data
    let ink = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) ink++
    return ink
  })
  expect(inkPixels).toBeGreaterThan(1000)

  // 点击生成
  const genButton = dialog.locator('.n-button--primary-type').filter({ hasText: /生成/ }).first()
  await genButton.click()

  // 推理阶段: 旋转 loading + 提示文案
  await expect(dialog.locator('.n-spin')).toBeVisible({ timeout: 5000 })
  await expect(dialog.getByText(/正在运行模型/)).toBeVisible({ timeout: 5000 })

  // 等待生成完成 (模型加载+推理+轮廓识别+骨架绑定, 放宽超时)
  await expect(dialog).toBeHidden({ timeout: 180000 })

  // 成功提示
  await expect(page.getByText(/已生成 32 个笔画字形/)).toBeVisible({ timeout: 10000 })

  // 笔画列表可见且含 32 项 + 添加按钮
  const strokeList = page.locator('.virtual-glyph-list').filter({ visible: true }).first()
  await expect(strokeList).toBeVisible({ timeout: 10000 })
  const itemCount = await strokeList.locator('.glyph-item').count()
  expect(itemCount).toBeGreaterThanOrEqual(32)

  // 进入字形编辑验证骨架绑定数据可用 (不崩溃, 编辑器渲染正常)
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  await strokeList.locator('.glyph-item').first().click()
  await expect(page.locator('.glyph-editor')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1500)
  expect(pageErrors).toEqual([])
})
