# 测试文档

## 测试结构

```
tests/
├── unit/                          # 单元测试
│   ├── stores/                    # Store测试
│   ├── services/                  # 服务测试
│   ├── utils/                     # 工具函数测试
│   ├── converter/                 # 转换器测试
│   ├── renderer/                  # 渲染器测试
│   ├── script/                    # 脚本功能测试
│   ├── tools/                     # 工具测试
│   └── glyphDragger/              # glyphDragger测试
├── integration/                   # 集成测试
│   ├── project-flow.test.ts
│   ├── converter-integration.test.ts
│   ├── renderer-integration.test.ts
│   └── script-integration.test.ts
├── e2e/                           # E2E测试
│   ├── project.spec.ts
│   ├── character-list.spec.ts
│   ├── editor.spec.ts
│   └── glyphDragger.spec.ts
├── setup/                         # 测试配置
│   ├── vitest.setup.ts
│   └── mocks/                     # Mock数据
└── helpers/                       # 测试辅助函数
    ├── test-utils.ts
    └── mock-helpers.ts
```

## 运行测试

### 单元测试和集成测试

```bash
# 运行所有测试
npm run test

# 运行测试（watch模式）
npm run test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 运行测试（UI模式）
npm run test:ui

# 运行测试（单次运行，不watch）
npm run test:run
```

### E2E测试

```bash
# 运行E2E测试
npm run test:e2e

# 运行E2E测试（UI模式）
npx playwright test --ui
```

## 覆盖率目标

- **单元测试**: 100% 覆盖率
- **集成测试**: 核心流程 100%
- **E2E测试**: 用户操作流程 100%

## 测试覆盖范围

### 核心功能
- ✅ 新建工程功能
- ✅ 打开工程功能
- ✅ glyphDragger功能
- ✅ 渲染列表（虚拟滚动）
- ✅ 编辑界面（组件列表、参数面板）
- ✅ UI布局与样式

### 工具函数
- ✅ 数学工具函数（math.ts）
- ✅ 组件工具函数（component.ts）
- ✅ 轮廓生成工具函数（contour.ts）
- ✅ UUID生成（uuid.ts）
- ✅ 性能工具（performance.ts）
- ✅ 防抖点击（debounce-click.ts）

### Store
- ✅ project.ts
- ✅ character.ts
- ✅ glyph.ts
- ✅ editor.ts
- ✅ tool.ts

### 服务层
- ✅ ProjectCreator
- ✅ ProjectLoader
- ✅ ProjectFileGenerator
- ✅ ProjectMigrator

### 核心转换器
- ✅ converter.ts（组件与轮廓转换）

### 渲染器
- ✅ CharacterRenderer
- ✅ GlyphRenderer
- ✅ EditorCanvasRenderer

### 脚本功能
- ✅ ScriptExecutor
- ✅ 脚本组件类（PenComponent, PolygonComponent等）
- ✅ 脚本环境（ConstantsMap, ParametersMap, CustomGlyph, Joint）

### 工具模块
- ✅ PenTool（钢笔工具）
- ✅ PolygonTool（多边形工具）
- ✅ RectangleTool（矩形工具）
- ✅ EllipseTool（椭圆工具）
- ✅ SelectTool（选择工具）
- ✅ PenSelectTool（钢笔编辑工具）

### glyphDragger
- ✅ BaseGlyphDragger
- ✅ DraggerManager
- ✅ JointManager
- ✅ ScriptExecutor（拖拽脚本执行器）
- ✅ CharacterGlyphDragger
- ✅ GlyphGlyphDragger

## 注意事项

1. **fontManager目录**: 按用户要求，暂不测试（直接从原工程复制，未做修改）
2. **Mock策略**: 使用vitest的vi.mock进行依赖mock
3. **测试环境**: 使用jsdom模拟DOM环境
4. **覆盖率**: 使用v8 provider生成覆盖率报告

## 故障排除

### 测试失败
1. 检查依赖是否已安装：`npm install`
2. 检查Mock是否正确设置
3. 检查测试环境配置（vitest.config.ts）

### E2E测试失败
1. 确保开发服务器正在运行（`npm run dev`）
2. 检查Playwright配置（playwright.config.ts）
3. 运行 `npx playwright install` 安装浏览器
