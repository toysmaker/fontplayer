# 覆盖率基线说明

1. 安装依赖（含 `@vitest/coverage-v8`，已写入 `package.json`）：
   ```bash
   npm install
   ```
2. 生成报告：
   ```bash
   npm run test:coverage
   ```
3. `fontManager` 已纳入 `coverage.include`，不再从 `coverage.exclude` 排除。
4. 最近一次本地全量统计（供对比）：**All files** 行覆盖率约 **51%**（随用例增加会上升）；`coverage.thresholds` 当前为渐进门禁（见 `vitest.config.ts`），后续可提高至 100%。
5. 本仓库包管理器为 **pnpm** 时：`pnpm install && pnpm run test:coverage`。
