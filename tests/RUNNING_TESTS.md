# 运行测试指南

## 运行指定文件夹的测试

### 方法1：使用文件路径（推荐）

```bash
# 运行 glyphDragger 文件夹中的所有测试
npm run test tests/unit/glyphDragger

# 或者使用完整路径
npm run test tests/unit/glyphDragger/

# 使用 vitest 命令
npx vitest tests/unit/glyphDragger
```

### 方法2：使用 glob 模式

```bash
# 运行所有 glyphDragger 相关测试
npm run test -- tests/unit/glyphDragger/**/*.test.ts

# 运行所有单元测试
npm run test -- tests/unit/**/*.test.ts

# 运行所有集成测试
npm run test -- tests/integration/**/*.test.ts
```

### 方法3：使用测试名称模式

```bash
# 运行包含 "glyphDragger" 的测试
npm run test -- -t "glyphDragger"

# 运行包含 "DraggerManager" 的测试
npm run test -- -t "DraggerManager"
```

### 方法4：运行单个测试文件

```bash
# 运行单个测试文件
npm run test tests/unit/glyphDragger/DraggerManager.test.ts

# 或者
npx vitest tests/unit/glyphDragger/DraggerManager.test.ts
```

### 方法5：使用 watch 模式运行指定文件夹

```bash
# watch 模式运行指定文件夹（文件变化时自动重新运行）
npm run test tests/unit/glyphDragger --watch

# 或者
npx vitest tests/unit/glyphDragger --watch
```

## 常用命令示例

### 运行特定模块的测试

```bash
# Store 测试
npm run test tests/unit/stores

# 工具函数测试
npm run test tests/unit/utils

# 服务层测试
npm run test tests/unit/services

# 转换器测试
npm run test tests/unit/converter

# 渲染器测试
npm run test tests/unit/renderer

# 脚本功能测试
npm run test tests/unit/script

# glyphDragger 测试
npm run test tests/unit/glyphDragger
```

### 运行特定测试用例

```bash
# 运行包含 "should create project" 的测试
npm run test -- -t "should create project"

# 运行包含 "getBound" 的测试
npm run test -- -t "getBound"
```

### 其他有用的选项

```bash
# 运行测试并生成覆盖率报告（仅指定文件夹）
npm run test:coverage tests/unit/glyphDragger

# 运行测试（单次运行，不watch）
npm run test:run tests/unit/glyphDragger

# 运行测试（UI模式）
npm run test:ui tests/unit/glyphDragger

# 运行测试（详细输出）
npm run test tests/unit/glyphDragger -- --reporter=verbose

# 运行测试（只显示失败的）
npm run test tests/unit/glyphDragger -- --reporter=dot
```

## 在 package.json 中添加便捷脚本（可选）

如果你想添加一些便捷的脚本命令，可以在 `package.json` 的 `scripts` 中添加：

```json
{
  "scripts": {
    "test:glyphDragger": "vitest tests/unit/glyphDragger",
    "test:stores": "vitest tests/unit/stores",
    "test:utils": "vitest tests/unit/utils",
    "test:services": "vitest tests/unit/services",
    "test:converter": "vitest tests/unit/converter",
    "test:renderer": "vitest tests/unit/renderer",
    "test:script": "vitest tests/unit/script",
    "test:integration": "vitest tests/integration"
  }
}
```

然后就可以直接运行：
```bash
npm run test:glyphDragger
npm run test:stores
# 等等...
```

## 调试测试

```bash
# 运行测试并进入调试模式
npm run test tests/unit/glyphDragger -- --inspect-brk

# 或者使用 Node.js 调试器
node --inspect-brk node_modules/.bin/vitest tests/unit/glyphDragger
```

## 过滤和组合

```bash
# 运行多个文件夹的测试
npm run test tests/unit/glyphDragger tests/unit/stores

# 排除某些测试
npm run test -- --exclude "**/node_modules/**" tests/unit/glyphDragger

# 只运行失败的测试
npm run test tests/unit/glyphDragger -- --onlyFailures
```
