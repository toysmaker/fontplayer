# E2E测试详细指南

## 一、E2E测试概念

### 1.1 什么是E2E测试？

**E2E（End-to-End）测试**，也称为端到端测试，是一种从用户角度出发的测试方法。它模拟真实用户的操作流程，测试整个应用程序的完整功能链路，从用户界面到后端服务，再到数据库等所有层次。

### 1.2 E2E测试的特点

#### ✅ 优点：
1. **真实场景模拟**：测试真实的用户操作流程
2. **系统级验证**：验证整个系统的集成是否正确
3. **用户视角**：从用户角度发现问题
4. **高置信度**：通过E2E测试的功能，用户使用基本没问题

#### ⚠️ 缺点：
1. **执行速度慢**：需要启动完整应用，执行时间较长
2. **维护成本高**：UI变化需要更新测试代码
3. **调试困难**：失败时难以定位具体问题
4. **环境依赖**：需要完整的测试环境

### 1.3 测试金字塔中的位置

```
        /\
       /  \      E2E测试（少量，关键流程）
      /____\
     /      \    集成测试（中等，模块间交互）
    /________\
   /          \  单元测试（大量，单个功能）
  /____________\
```

**测试金字塔原则**：
- **单元测试**：数量最多，执行最快，覆盖单个函数/组件
- **集成测试**：数量中等，测试模块间的交互
- **E2E测试**：数量最少，但覆盖关键用户流程

## 二、E2E测试与其它测试的区别

### 2.1 单元测试 vs E2E测试

| 特性 | 单元测试 | E2E测试 |
|------|---------|---------|
| **测试范围** | 单个函数/组件 | 整个应用流程 |
| **执行速度** | 毫秒级 | 秒到分钟级 |
| **环境要求** | 无需真实环境 | 需要完整应用环境 |
| **Mock使用** | 大量使用Mock | 尽量少用Mock |
| **定位问题** | 精确到函数 | 只能定位到流程 |
| **维护成本** | 低 | 高 |

**示例对比**：

```typescript
// 单元测试：测试单个函数
describe('getBound', () => {
  it('should calculate bounds', () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 100 }]
    const bound = getBound(points)
    expect(bound).toEqual({ x: 0, y: 0, w: 100, h: 100 })
  })
})

// E2E测试：测试完整用户流程
test('should create and save project', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.click('button:has-text("新建工程")')
  await page.fill('input[name="name"]', 'Test Project')
  await page.click('button:has-text("创建")')
  await expect(page.locator('text=Test Project')).toBeVisible()
})
```

### 2.2 集成测试 vs E2E测试

| 特性 | 集成测试 | E2E测试 |
|------|---------|---------|
| **测试范围** | 多个模块/服务 | 完整应用 |
| **用户界面** | 通常不涉及UI | 必须涉及UI |
| **浏览器** | 不需要 | 需要真实浏览器 |
| **测试重点** | 模块间数据流 | 用户操作流程 |

## 三、E2E测试流程

### 3.1 测试生命周期

```
┌─────────────────┐
│  测试准备阶段    │
│  (Setup)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  执行测试操作    │
│  (Actions)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  验证结果       │
│  (Assertions)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  清理资源       │
│  (Teardown)     │
└─────────────────┘
```

### 3.2 详细流程步骤

#### 步骤1：环境准备（Setup）

```typescript
test.beforeEach(async ({ page }) => {
  // 1. 导航到应用首页
  await page.goto('http://localhost:5173')
  
  // 2. 等待应用加载完成
  await page.waitForLoadState('networkidle')
  
  // 3. 可选：登录或设置初始状态
  // await page.click('button:has-text("登录")')
})
```

**关键点**：
- 确保测试环境已启动（开发服务器运行）
- 等待页面完全加载
- 设置测试所需的初始状态

#### 步骤2：执行操作（Actions）

```typescript
test('should create project', async ({ page }) => {
  // 1. 定位元素
  const newProjectButton = page.locator('button:has-text("新建工程")')
  
  // 2. 执行用户操作
  await newProjectButton.click()
  
  // 3. 填写表单
  await page.fill('input[name="name"]', 'Test Project')
  await page.fill('input[name="unitsPerEm"]', '1000')
  
  // 4. 提交表单
  await page.click('button:has-text("创建")')
})
```

**操作类型**：
- **点击**：`click()`, `dblclick()`
- **输入**：`fill()`, `type()`
- **选择**：`selectOption()`
- **拖拽**：`dragTo()`, `dragAndDrop()`
- **键盘**：`press()`, `keyboard.type()`
- **鼠标**：`hover()`, `mouse.move()`

#### 步骤3：验证结果（Assertions）

```typescript
// 1. 验证元素可见性
await expect(page.locator('text=Test Project')).toBeVisible()

// 2. 验证元素文本
await expect(page.locator('h1')).toHaveText('Test Project')

// 3. 验证元素属性
await expect(page.locator('input[name="name"]')).toHaveValue('Test Project')

// 4. 验证元素数量
await expect(page.locator('.character-item')).toHaveCount(5)

// 5. 验证URL变化
await expect(page).toHaveURL(/.*\/project\/.*/)

// 6. 验证截图（视觉回归）
await expect(page).toHaveScreenshot('project-created.png')
```

**验证类型**：
- **可见性**：`toBeVisible()`, `toBeHidden()`
- **文本内容**：`toHaveText()`, `toContainText()`
- **属性值**：`toHaveAttribute()`, `toHaveValue()`
- **样式**：`toHaveCSS()`
- **状态**：`toBeEnabled()`, `toBeChecked()`

#### 步骤4：清理资源（Teardown）

```typescript
test.afterEach(async ({ page }) => {
  // 1. 清理测试数据
  // await page.evaluate(() => localStorage.clear())
  
  // 2. 关闭弹窗
  // await page.keyboard.press('Escape')
  
  // 3. 返回首页
  // await page.goto('http://localhost:5173')
})
```

## 四、项目中的E2E测试实现

### 4.1 测试结构

```
tests/e2e/
├── project.spec.ts          # 工程操作测试
├── character-list.spec.ts   # 字符列表测试
├── editor.spec.ts           # 编辑界面测试
└── glyphDragger.spec.ts     # 拖拽功能测试
```

### 4.2 配置说明（playwright.config.ts）

```typescript
export default defineConfig({
  testDir: './tests/e2e',        // 测试文件目录
  fullyParallel: true,            // 并行执行
  retries: process.env.CI ? 2 : 0, // CI环境重试2次
  workers: process.env.CI ? 1 : undefined, // 工作进程数
  
  use: {
    baseURL: 'http://localhost:5173', // 基础URL
    trace: 'on-first-retry',          // 失败时记录trace
  },
  
  webServer: {
    command: 'npm run dev',           // 自动启动开发服务器
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI, // 重用已有服务器
  },
})
```

### 4.3 实际测试示例解析

#### 示例1：工程创建流程

```typescript
test('should create new project', async ({ page }) => {
  // 【步骤1：导航】打开应用
  await page.goto('http://localhost:5173')
  
  // 【步骤2：定位】找到新建工程按钮
  const newProjectButton = page.locator('button:has-text("新建工程")')
  
  // 【步骤3：操作】点击按钮
  await newProjectButton.click()
  
  // 【步骤4：操作】填写表单
  await page.fill('input[name="name"]', 'Test Project')
  await page.fill('input[name="unitsPerEm"]', '1000')
  await page.fill('input[name="ascender"]', '800')
  await page.fill('input[name="descender"]', '-200')
  
  // 【步骤5：操作】提交表单
  await page.click('button:has-text("创建")')
  
  // 【步骤6：验证】检查工程是否创建成功
  await expect(page.locator('text=Test Project')).toBeVisible()
})
```

**流程分析**：
1. ✅ 用户打开应用
2. ✅ 用户点击"新建工程"
3. ✅ 用户填写工程信息
4. ✅ 用户点击"创建"
5. ✅ 系统显示新创建的工程

#### 示例2：编辑界面交互

```typescript
test('should open parameter panel when selecting component', async ({ page }) => {
  // 【准备】打开字符编辑器
  const characterItem = page.locator('[data-testid="character-item"]').first()
  await characterItem.dblclick()
  
  // 【操作】选择组件
  const componentItem = page.locator('[data-testid="component-item"]').first()
  await componentItem.click()
  
  // 【验证】参数面板应该显示
  const parameterPanel = page.locator('[data-testid="parameter-panel"]')
  await expect(parameterPanel).toBeVisible()
})
```

**流程分析**：
1. ✅ 用户双击字符项打开编辑器
2. ✅ 用户点击组件项
3. ✅ 系统显示参数面板

#### 示例3：拖拽操作

```typescript
test('should drag joint', async ({ page }) => {
  // 【准备】打开编辑器
  const characterItem = page.locator('[data-testid="character-item"]').first()
  await characterItem.dblclick()
  
  // 【准备】选择字形组件
  const glyphComponent = page.locator('[data-testid="component-item"][data-type="glyph"]').first()
  await glyphComponent.click()
  
  // 【操作】获取画布并执行拖拽
  const canvas = page.locator('canvas')
  const boundingBox = await canvas.boundingBox()
  
  if (boundingBox) {
    // 鼠标移动到起始位置
    await page.mouse.move(boundingBox.x + 50, boundingBox.y + 50)
    // 按下鼠标
    await page.mouse.down()
    // 拖拽到目标位置
    await page.mouse.move(boundingBox.x + 100, boundingBox.y + 100)
    // 释放鼠标
    await page.mouse.up()
  }
  
  // 【验证】组件位置应该更新
  // 可以通过检查组件属性或视觉反馈验证
})
```

**流程分析**：
1. ✅ 用户打开编辑器
2. ✅ 用户选择字形组件
3. ✅ 用户在画布上拖拽关键点
4. ✅ 系统更新组件位置

## 五、E2E测试最佳实践

### 5.1 测试选择器策略

#### ✅ 推荐：使用data-testid

```typescript
// ✅ 好：稳定，不依赖样式
await page.locator('[data-testid="character-item"]').click()

// ❌ 差：依赖CSS类名，容易变化
await page.locator('.character-list-item').click()

// ❌ 差：依赖文本，国际化时有问题
await page.locator('text=字符列表').click()
```

#### ✅ 推荐：使用语义化选择器

```typescript
// ✅ 好：语义清晰
await page.locator('button:has-text("创建")').click()
await page.locator('input[name="name"]').fill('Test')

// ❌ 差：依赖DOM结构
await page.locator('div > div > button').click()
```

### 5.2 等待策略

```typescript
// ✅ 显式等待元素可见
await page.waitForSelector('[data-testid="component-list"]', { state: 'visible' })

// ✅ 等待网络请求完成
await page.waitForLoadState('networkidle')

// ✅ 等待特定条件
await page.waitForFunction(() => {
  return document.querySelector('[data-testid="loading"]') === null
})

// ❌ 避免：硬编码等待
await page.waitForTimeout(1000) // 不推荐
```

### 5.3 测试数据管理

```typescript
// ✅ 使用fixture管理测试数据
import { test as base } from '@playwright/test'

const test = base.extend({
  testProject: async ({ page }, use) => {
    // 创建测试工程
    await page.goto('http://localhost:5173')
    await page.click('button:has-text("新建工程")')
    await page.fill('input[name="name"]', 'Test Project')
    await page.click('button:has-text("创建")')
    
    await use('Test Project')
    
    // 清理
    // await page.click('button:has-text("删除")')
  },
})

test('should edit project', async ({ page, testProject }) => {
  // 使用fixture中的测试数据
  await expect(page.locator(`text=${testProject}`)).toBeVisible()
})
```

### 5.4 错误处理和调试

```typescript
test('should handle errors gracefully', async ({ page }) => {
  // 监听控制台错误
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text())
    }
  })
  
  // 监听网络错误
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('Network error:', response.url(), response.status())
    }
  })
  
  // 失败时截图
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      await page.screenshot({ path: `screenshots/${testInfo.title}.png` })
    }
  })
})
```

### 5.5 测试组织

```typescript
// ✅ 使用describe组织相关测试
test.describe('Project Operations', () => {
  test.beforeEach(async ({ page }) => {
    // 共享的setup
    await page.goto('http://localhost:5173')
  })
  
  test('should create project', async ({ page }) => {
    // 测试1
  })
  
  test('should open project', async ({ page }) => {
    // 测试2
  })
  
  test('should save project', async ({ page }) => {
    // 测试3
  })
})
```

## 六、运行E2E测试

### 6.1 基本命令

```bash
# 运行所有E2E测试
npm run test:e2e

# 运行特定测试文件
npx playwright test tests/e2e/project.spec.ts

# 运行特定测试用例
npx playwright test -g "should create project"

# UI模式运行（推荐调试时使用）
npx playwright test --ui

# 调试模式
npx playwright test --debug
```

### 6.2 查看测试报告

```bash
# 生成HTML报告
npx playwright show-report

# 查看trace（失败时）
npx playwright show-trace trace.zip
```

### 6.3 CI/CD集成

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## 七、常见问题和解决方案

### 7.1 元素定位失败

**问题**：`Element not found`

**解决方案**：
```typescript
// 1. 增加等待时间
await page.waitForSelector('[data-testid="element"]', { timeout: 10000 })

// 2. 检查元素是否在iframe中
const frame = page.frameLocator('iframe')
await frame.locator('[data-testid="element"]').click()

// 3. 使用更稳定的选择器
// 避免使用动态生成的类名
```

### 7.2 异步操作未完成

**问题**：操作执行太快，页面未响应

**解决方案**：
```typescript
// 等待操作完成
await page.click('button')
await page.waitForLoadState('networkidle')

// 或者等待特定元素出现
await page.waitForSelector('[data-testid="result"]')
```

### 7.3 测试不稳定（Flaky Tests）

**问题**：有时通过，有时失败

**解决方案**：
```typescript
// 1. 增加重试机制
test('unstable test', async ({ page }) => {
  await test.step('retry logic', async () => {
    // 实现重试逻辑
  })
})

// 2. 使用更稳定的等待条件
await page.waitForFunction(() => {
  return document.readyState === 'complete'
})

// 3. 避免依赖时间
// ❌ await page.waitForTimeout(1000)
// ✅ await page.waitForSelector('[data-testid="element"]')
```

## 八、总结

### E2E测试的核心价值

1. **用户视角**：从真实用户角度验证功能
2. **系统集成**：验证整个系统的协作
3. **回归测试**：确保新功能不影响现有功能
4. **文档作用**：测试代码即文档，展示如何使用应用

### 测试策略建议

1. **关键路径优先**：优先测试核心用户流程
2. **保持简单**：每个测试只验证一个流程
3. **快速反馈**：测试应该快速执行
4. **易于维护**：使用稳定的选择器，减少维护成本

### 在fontplayer_refractor项目中的应用

- ✅ **工程操作**：创建、打开、保存工程
- ✅ **字符列表**：搜索、选择、虚拟滚动
- ✅ **编辑界面**：组件列表、参数面板、画布渲染
- ✅ **拖拽功能**：关键点拖拽、脚本回调

这些E2E测试覆盖了用户使用应用的核心流程，确保从用户角度验证功能的正确性。
