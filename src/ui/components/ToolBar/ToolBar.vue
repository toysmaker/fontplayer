<template>
  <div class="tool-bar">
    <div class="tool-bar-row">
      <!-- 工具图标区域 -->
      <div class="tool-icons">
        <!-- 选择工具 -->
        <n-icon
          :class="{
            'tool-icon': true,
            'selected': tool === 'select',
          }"
          @pointerdown="switchTool('select')"
          :component="ArrowBackOutline"
        />
        
        <!-- 钢笔工具 -->
        <n-icon
          :class="{
            'tool-icon': true,
            'selected': tool === 'pen',
          }"
          @pointerdown="switchTool('pen')"
          :component="CreateOutline"
        />
        
        <!-- 椭圆工具 -->
        <n-icon
          :class="{
            'tool-icon': true,
            'selected': tool === 'ellipse',
          }"
          @pointerdown="switchTool('ellipse')"
          :component="EllipseOutline"
        />
        
        <!-- 矩形工具 -->
        <n-icon
          :class="{
            'tool-icon': true,
            'selected': tool === 'rectangle',
          }"
          @pointerdown="switchTool('rectangle')"
          :component="SquareOutline"
        />
        
        <!-- 多边形工具 -->
        <n-icon
          :class="{
            'tool-icon': true,
            'selected': tool === 'polygon',
          }"
          @pointerdown="switchTool('polygon')"
          :component="ShapesOutline"
        />
        
        <!-- 图片工具 - 仅在字符编辑模式显示 -->
        <n-icon
          v-show="editStatus === EditStatus.Edit"
          :class="{
            'tool-icon': true,
            'selected': tool === 'picture',
          }"
          @pointerdown="switchTool('picture')"
          :component="ImageOutline"
        />
        
        <!-- 字形组件工具 - 在字符和字形编辑模式显示 -->
        <n-icon
          v-show="editStatus === EditStatus.Edit || editStatus === EditStatus.Glyph"
          :class="{
            'tool-icon': true,
            'selected': tool === 'glyph',
          }"
          @pointerdown="switchTool('glyph')"
          :component="TextOutline"
        />
        
        <!-- 代码编辑器 - 在字符和字形编辑模式显示 -->
        <n-icon
          v-show="editStatus === EditStatus.Edit || editStatus === EditStatus.Glyph"
          class="code-icon"
          @pointerdown="switchTool('code')"
          :component="CodeSlashOutline"
        />
        
        <!-- 参数工具 - 仅在字形编辑模式显示 -->
        <n-icon
          v-show="editStatus === EditStatus.Glyph"
          :class="{
            'tool-icon': true,
            'selected': tool === 'params',
          }"
          @pointerdown="switchTool('params')"
          :component="OptionsOutline"
        />
        
        <!-- 网格工具 - 仅在字符编辑模式显示 -->
        <n-icon
          v-show="editStatus === EditStatus.Edit"
          :class="{
            'tool-icon': true,
            'selected': tool === 'grid',
          }"
          @pointerdown="switchTool('grid')"
          :component="GridOutline"
        />
        
        <!-- 度量工具 - 仅在字符编辑模式显示 -->
        <n-icon
          v-show="editStatus === EditStatus.Edit"
          :class="{
            'tool-icon': true,
            'selected': tool === 'metrics',
          }"
          @pointerdown="switchTool('metrics')"
          :component="ResizeOutline"
        />
      </div>
      
      <!-- 返回字符列表按钮 -->
      <div class="to-list" @pointerdown="handleToList">
        <n-icon class="to-list-icon" :component="GridOutline" />
        <span class="to-list-label">字符列表</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import {
  ArrowBackOutline,
  CreateOutline,
  EllipseOutline,
  SquareOutline,
  ShapesOutline,
  ImageOutline,
  TextOutline,
  CodeSlashOutline,
  OptionsOutline,
  GridOutline,
  ResizeOutline,
} from '@vicons/ionicons5'
import { useEditorStore } from '@/stores/editor'
import { useToolStore } from '@/stores/tool'
import { EditStatus } from '@/core/types'

const editorStore = useEditorStore()
const toolStore = useToolStore()

const editStatus = computed(() => editorStore.editStatus)
const tool = computed(() => toolStore.tool)

// 切换工具（事件处理先留空）
const switchTool = (toolName: string) => {
  // TODO: 实现工具切换逻辑
  console.log('[ToolBar] switchTool:', toolName)
  toolStore.setTool(toolName)
}

// 返回列表
const handleToList = () => {
  // 返回到之前保存的列表状态，如果没有则返回到字符列表
  const targetStatus = editorStore.prevStatus || EditStatus.CharacterList
  
  if (import.meta.env.DEV) {
    console.log(`[ToolBar] handleToList: current=${editorStore.editStatus}, prevStatus=${targetStatus}`)
  }
  
  // 确保返回到的是列表状态
  if (
    targetStatus === EditStatus.CharacterList ||
    targetStatus === EditStatus.StrokeGlyphList ||
    targetStatus === EditStatus.RadicalGlyphList ||
    targetStatus === EditStatus.CompGlyphList ||
    targetStatus === EditStatus.GlyphList
  ) {
    editorStore.setEditStatus(targetStatus)
  } else {
    // 如果 prevStatus 不是列表状态，默认返回到字符列表
    if (import.meta.env.DEV) {
      console.warn(`[ToolBar] prevStatus is not a list status: ${targetStatus}, defaulting to CharacterList`)
    }
    editorStore.setEditStatus(EditStatus.CharacterList)
  }
}
</script>

<style scoped>
.tool-bar {
  width: 100%;
  height: 100%;
}

.tool-bar-row {
  width: 100%;
  height: 100%;
  background-color: white;
  border-bottom: 1px solid #dcdfe6;
  display: flex;
  align-items: center;
  flex-direction: row;
}

.tool-icons {
  flex: 1;
  display: flex;
  align-items: center;
}

.tool-icon {
  width: 40px;
  height: 40px;
  cursor: pointer;
  margin: 5px 0 5px 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.tool-icon:hover {
  background-color: var(--primary-5);
}

.tool-icon.selected {
  background-color: var(--primary-5);
}

.code-icon {
  width: 40px;
  height: 40px;
  cursor: pointer;
  margin: 5px 0 5px 5px;
  background-color: var(--dark-2);
  color: var(--light-0);
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.to-list {
  margin: 5px;
  margin-left: auto;
  line-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 100px;
  cursor: pointer;
  background-color: var(--primary-5);
  transition: background-color 0.2s ease;
}

.to-list:hover {
  background-color: var(--primary-4);
}

.to-list-icon {
  flex: 0 0 32px;
  font-size: 18px;
}

.to-list-label {
  flex: 1;
  text-align: center;
  font-size: 14px;
  color: white;
}
</style>
