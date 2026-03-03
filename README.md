# fontplayer-refractor

字玩参数化字体设计工具 - 重构版

## 技术栈

- Vue 3 + TypeScript
- Vite
- NaiveUI (替代 Element Plus)
- Pinia (状态管理)
- Tauri 2 (桌面应用框架)

## 重构目标

1. **性能优化**
   - 虚拟滚动实现真正的按需渲染
   - 数据结构优化，分离核心数据和大型数据
   - Canvas对象池管理
   - IndexedDB存储层

2. **UI框架迁移**
   - 从 Element Plus 迁移到 NaiveUI
   - 保持现有样式风格

3. **架构优化**
   - 清晰的分层架构
   - 统一的工具管理机制
   - 改进的字形拖拽功能

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```
