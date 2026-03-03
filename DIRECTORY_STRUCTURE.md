# 目录结构说明

## 当前目录结构（按照重构方案）

```
src/
├── core/                    # 核心功能
│   ├── font/               # 字体相关核心功能
│   │   ├── converter.ts   # 轮廓转换
│   │   ├── renderer.ts    # 渲染引擎（从RenderEngine.ts重命名）
│   │   ├── CharacterRenderer.ts  # 字符渲染器
│   │   └── types.ts       # 类型定义
│   ├── canvas/             # 画布相关
│   │   ├── CanvasManager.ts
│   │   └── VirtualScroll.ts (待创建)
│   ├── script/             # 脚本执行（待创建）
│   │   ├── ScriptExecutor.ts
│   │   ├── ScriptSandbox.ts
│   │   └── APIProvider.ts
│   └── storage/            # 存储层
│       ├── IndexedDBManager.ts
│       ├── CanvasPool.ts
│       ├── FileSystemManager.ts (待创建)
│       └── CacheManager.ts (待创建)
├── features/                # 功能模块
│   ├── editor/             # 编辑器功能
│   │   ├── CharacterEditor.vue
│   │   ├── GlyphEditor.vue
│   │   ├── components/ (待创建)
│   │   └── services/       # 服务（从fontEditor/services移动）
│   │       ├── FileHandler.ts
│   │       ├── ProjectFileGenerator.ts
│   │       ├── ProjectLoader.ts
│   │       └── ProjectMigrator.ts
│   ├── tools/               # 工具（从fontEditor/tools移动）
│   │   └── glyphDragger/
│   ├── export/              # 导出功能（待创建）
│   └── import/              # 导入功能（待创建）
├── ui/                      # UI组件
│   ├── components/          # 通用组件
│   │   ├── VirtualList/    # 虚拟列表（从CharacterList移动）
│   │   │   └── CharacterList/
│   │   ├── CanvasPreview/  (待创建)
│   │   └── ParameterEditor.vue
│   ├── layouts/             # 布局组件（待创建）
│   └── dialogs/             # 对话框（待创建）
├── stores/                  # Pinia stores（从fontEditor/stores移动）
│   ├── project.ts
│   ├── character.ts
│   ├── glyph.ts
│   ├── editor.ts
│   └── ui.ts (待创建)
└── utils/                    # 工具函数
    ├── math.ts (待创建)
    ├── string.ts (待创建)
    ├── validation.ts (待创建)
    ├── env.ts
    └── performance.ts
```

## 主要变更

1. **core/font/renderer.ts**: 渲染引擎（原RenderEngine.ts，按照方案重命名）
2. **core/storage/**: 存储层（从src/storage移动）
3. **features/editor/services/**: 编辑器服务（从fontEditor/services移动）
4. **features/tools/**: 工具（从fontEditor/tools移动）
5. **ui/components/VirtualList/**: 虚拟列表组件（从fontEditor/components/CharacterList移动）
6. **stores/**: Pinia stores（从fontEditor/stores移动）

## 待完成的工作

1. 创建缺失的目录和文件
2. 修复所有导入路径
3. 移动剩余的文件到正确位置
4. 更新所有引用
