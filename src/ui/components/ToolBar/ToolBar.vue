<template>
  <div class="tool-bar">
    <div class="tool-bar-row">
      <!-- 工具图标区域 -->
      <div class="tool-icons">
        <!-- 选择工具 -->
        <n-icon
          class="tool-icon" 
          :class="{
            'selected': tool === 'select',
          }"
          @click="switchTool('select')"
          @pointerup="switchTool('select')"
          size="40"
          v-show="editStatus === EditStatus.Edit || editStatus === EditStatus.Glyph">
          <font-awesome-icon
            icon="fa-solid fa-arrow-pointer"
          />
        </n-icon>
        
        <!-- 钢笔工具 -->
        <n-icon
          class="tool-icon"
          :class="{
            'selected': tool === 'pen',
          }"
          @click="switchTool('pen')"
          @pointerup="switchTool('pen')"
          size="40"
          v-show="editStatus === EditStatus.Edit || editStatus === EditStatus.Glyph">
          <font-awesome-icon
            icon="fa-solid fa-pen-nib"
          />
        </n-icon>
        
        <!-- 椭圆工具 -->
        <n-icon
          class="tool-icon"
          :class="{
            'selected': tool === 'ellipse',
          }"
          @click="switchTool('ellipse')"
          @pointerup="switchTool('ellipse')"
          size="40"
          v-show="editStatus === EditStatus.Edit || editStatus === EditStatus.Glyph">
          <font-awesome-icon
            icon="fa-regular fa-circle"
          />
        </n-icon>
        
        <!-- 矩形工具 -->
        <n-icon
          class="tool-icon"
          :class="{
            'selected': tool === 'rectangle',
          }"
          @click="switchTool('rectangle')"
          @pointerup="switchTool('rectangle')"
          size="40"
          v-show="editStatus === EditStatus.Edit || editStatus === EditStatus.Glyph">
          <font-awesome-icon
            icon="fa-regular fa-square"
          />
        </n-icon>
        
        <!-- 多边形工具 -->
        <n-icon
          class="tool-icon"
          :class="{
            'selected': tool === 'polygon',
          }"
          @click="switchTool('polygon')"
          @pointerup="switchTool('polygon')"
          size="40"
          v-show="editStatus === EditStatus.Edit || editStatus === EditStatus.Glyph">
          <font-awesome-icon
            icon="fa-solid fa-draw-polygon"
          />
        </n-icon>
        
        <!-- 图片工具 - 仅在字符编辑模式显示 -->
        <n-icon
          class="tool-icon"
          :class="{
            'selected': tool === 'picture',
          }"
          @click="switchTool('picture')"
          @pointerup="switchTool('picture')"
          size="40"
          v-show="editStatus === EditStatus.Edit || editStatus === EditStatus.Glyph">
          <font-awesome-icon
            icon="fa-solid fa-image"
          />
        </n-icon>
        
        <!-- 字形组件工具 - 在字符和字形编辑模式显示 -->
        <n-icon
          class="tool-icon"
          :class="{
            'selected': tool === 'glyph',
          }"
          @click="switchTool('glyph')"
          @pointerup="switchTool('glyph')"
          size="40"
          v-show="editStatus === EditStatus.Edit || editStatus === EditStatus.Glyph">
          <font-awesome-icon
            :icon="['fas', 'font']"
          />
        </n-icon>
        
        <!-- 代码编辑器 - 在字符和字形编辑模式显示 -->
        <n-icon class="tool-icon code-icon" size="40"
          @click="switchTool('code')"
          @pointerup="switchTool('code')"
          v-show="editStatus === EditStatus.Edit || editStatus === EditStatus.Glyph">
          <font-awesome-icon
          :icon="['fas', 'terminal']"
          />
        </n-icon>
        
        <!-- 参数工具 - 仅在字形编辑模式显示 -->
        <n-icon
          class="tool-icon"
          :class="{
            'selected': tool === 'params',
          }"
          @click="switchTool('params')"
          @pointerup="switchTool('params')"
          size="40"
          v-show="editStatus === EditStatus.Glyph">
          <font-awesome-icon
            :icon="['fas', 'sliders']"
          />
        </n-icon>
        
        <!-- 网格工具 - 仅在字符编辑模式显示 -->
        <n-icon
          class="tool-icon"
          :class="{
            'selected': tool === 'grid',
          }"
          size="40"
          @click="switchTool('grid')"
          @pointerup="switchTool('grid')"
          v-show="editStatus === EditStatus.Edit || editStatus === EditStatus.Glyph">
          <font-awesome-icon
            :class="{
              'selected': tool === 'grid',
            }"
            :icon="['fas', 'table-cells']"
          />
        </n-icon>
        
        <!-- 度量工具 - 仅在字符编辑模式显示 -->
        <n-icon
          class="tool-icon"
          :class="{
            'selected': tool === 'metrics',
          }"
          size="40"
          @click="switchTool('metrics')"
          @pointerup="switchTool('metrics')"
          v-show="editStatus === EditStatus.Edit || editStatus === EditStatus.Glyph">
          <font-awesome-icon
            :class="{
              'selected': tool === 'metrics',
            }"
            :icon="['fas', 'text-width']"
          />
        </n-icon>
      </div>
      
      <!-- 返回字符列表按钮 -->
      <div class="to-list" @click="handleToList" @pointerup="handleToList">
        <font-awesome-icon class="to-list-icon" :icon="['fas', 'table-cells']" />
        <span class="to-list-label">{{ t('panels.toolBar.characterList') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NIcon } from 'naive-ui'
import { useEditorStore } from '@/stores/editor'
import { useToolStore } from '@/stores/tool'
import { EditStatus } from '@/core/types'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t } = useI18n()

const editorStore = useEditorStore()
const toolStore = useToolStore()

const editStatus = computed(() => editorStore.editStatus)
const tool = computed(() => toolStore.tool)

// 切换工具
const _switchTool = (toolName: string) => {
  if (import.meta.env.DEV) {
    console.log('[ToolBar] switchTool:', toolName)
  }
  toolStore.setTool(toolName)
  // 工具切换逻辑在 Editor 中通过 watch toolStore.tool 实现
}
const switchTool = createDebouncedHandler(_switchTool, 'ToolBar.switchTool', (args) => args[0])

// 返回列表
const _handleToList = () => {
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
const handleToList = createDebouncedHandler(_handleToList, 'ToolBar.handleToList')
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
  color: var(--primary-0);
}

.tool-icon:not(.code-icon):hover, .tool-icon:not(.code-icon).selected {
  background-color: var(--primary-5);
}

.tool-icon.code-icon:hover {
  background-color: var(--dark-4);
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
  color: var(--primary-0);
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
  color: var(--primary-0);
}
</style>
