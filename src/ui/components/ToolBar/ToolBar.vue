<template>
  <div class="tool-bar">
    <div class="tool-bar-row">
      <!-- 工具图标区域（暂时留空，后续添加） -->
      <div class="tool-icons"></div>
      
      <!-- 返回字符列表按钮 -->
      <div class="to-list" @pointerdown="handleToList">
        <n-icon class="to-list-icon" :component="GridOutline" />
        <span class="to-list-label">字符列表</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { GridOutline } from '@vicons/ionicons5'
import { useEditorStore } from '@/stores/editor'
import { EditStatus } from '@/core/types'

const editorStore = useEditorStore()

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
