# E2E 测试说明

## 夹具校验

- `fixtures/minimal-project-file.json` 的结构校验在 **Vitest** 中执行：`tests/unit/e2e-fixtures/minimal-project-json.test.ts`（避免为本用例启动 dev server）。

## 测试状态

E2E 测试分为两类：

1. **基础功能测试**（4 个）- 这些测试不需要数据，可以正常运行
   - 项目创建测试
   - 项目打开测试
   - 项目保存测试
   - 字符列表显示测试（检查元素是否存在）

2. **数据依赖测试**（8 个）- 这些测试需要字符数据，新项目默认是空的，所以会被跳过
   - 字符搜索测试
   - 字符选择测试
   - 虚拟滚动测试
   - 组件列表显示测试
   - 参数面板测试
   - 画布渲染测试
   - 拖拽功能测试（2 个）

## 为什么测试会被跳过？

新创建的项目默认是空的（`characterList: []`），所以以下测试会被跳过：

- **需要字符的测试**：字符列表为空时，无法测试字符相关的功能
- **需要组件的测试**：字符没有组件时，无法测试组件相关的功能
- **需要字形组件的测试**：字符没有字形组件时，无法测试拖拽功能

这是**预期的行为**，不是错误。

## 如何让这些测试运行？

### 方案 1：加载包含测试数据的项目文件（推荐）

1. 创建一个包含测试数据的项目文件（`.fontplayer` 格式）
2. 在测试中使用 `fileHandler.openFile()` 加载这个项目文件
3. 然后运行需要数据的测试

### 方案 2：在测试中通过 UI 添加字符

1. 找到添加字符的按钮/菜单
2. 在测试中点击按钮，打开添加字符对话框
3. 输入测试字符（如 "测试"）
4. 确认添加
5. 然后运行需要数据的测试

### 方案 3：使用模板项目

如果项目创建器支持使用模板，可以在创建项目时选择模板，模板可能包含示例字符。

## 测试跳过原因

所有跳过的测试都会显示明确的跳过原因：

- `'No characters in project - new projects are empty by default'` - 新项目默认是空的
- `'No components in character - characters may be empty'` - 字符可能没有组件
- `'No glyph components in character - characters may not have glyph components'` - 字符可能没有字形组件

## 运行测试

```bash
# 运行所有 E2E 测试
npm run test:e2e

# 运行特定测试文件
npx playwright test tests/e2e/character-list.spec.ts

# 以 UI 模式运行（推荐调试）
npx playwright test --ui

# 查看测试报告
npx playwright show-report
```

## 注意事项

1. **测试环境**：确保开发服务器正在运行（`npm run dev`）
2. **测试数据**：如果需要测试数据相关的功能，请先加载包含数据的项目文件
3. **测试隔离**：每个测试都会创建新的项目，确保测试之间不会相互影响
4. **跳过测试**：跳过的测试不是失败，是预期的行为，表示测试需要特定的数据条件
