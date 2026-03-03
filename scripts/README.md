# 工程文件迁移工具

## 使用方法

### 方法1：使用Node.js脚本（推荐）

1. 安装依赖：
```bash
npm install
```

2. 运行迁移脚本：
```bash
npm run migrate-project [原文件路径] [输出文件路径(可选)]
```

示例：
```bash
npm run migrate-project /Users/xuepei/Documents/projects/fontplayer/public/data/字玩标准黑体_12_28.json
```

### 方法2：在浏览器中运行

在应用运行时，可以通过开发者工具调用迁移函数：

```javascript
import { projectFileGenerator } from '@/fontEditor/services/ProjectFileGenerator'

// 加载原版工程文件
const response = await fetch('/path/to/old-project.json')
const oldData = await response.json()

// 生成新格式
const newData = await projectFileGenerator.generateJSON(oldData)

// 下载新文件
await projectFileGenerator.downloadProjectFile(JSON.parse(newData), 'project_new.json')
```

## 迁移说明

迁移工具会将原版工程文件转换为重构版格式：

1. **数据结构优化**：
   - 字符文件使用轻量版格式（`ICharacterFileLite`）
   - 大型数据（轮廓、预览）标记为需要存储到IndexedDB

2. **版本标记**：
   - 新文件包含 `version: '2.0'` 字段

3. **数据分离**：
   - 轮廓数据：标记为 `_hasContour` 或存储在 `_contourData`
   - 预览数据：标记为 `_hasPreview` 或存储在 `_previewData`
   - 运行时这些数据会被存储到IndexedDB，并生成引用键

## 注意事项

- 原版工程文件可能非常大（>200MB），处理时请确保有足够内存
- 迁移后的文件在首次加载时，大型数据会被自动存储到IndexedDB
- 建议在迁移后验证文件完整性
