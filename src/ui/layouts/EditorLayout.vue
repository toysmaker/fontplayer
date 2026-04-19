<template>
  <n-layout class="editor-layout">
    <n-layout has-sider class="editor-content">
      <!-- 左侧菜单栏（Web和Tauri都显示） -->
      <n-layout-sider
        v-if="showSidebar"
        :width="80"
        collapse-mode="width"
        :collapsed="true"
        :collapsed-width="80"
        bordered
      >
        <EditorSidebar />
      </n-layout-sider>
      <!-- 主内容区 -->
      <n-layout-content class="editor-main">
        <EditorMain />
      </n-layout-content>
    </n-layout>
    
    <!-- 加载进度条（全局遮罩，放在最后以确保在最上层） -->
    <LoadingProgress />
  </n-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NLayout, NLayoutSider, NLayoutContent } from 'naive-ui'
import EditorSidebar from './EditorSidebar.vue'
import EditorMain from './EditorMain.vue'
import LoadingProgress from '@/ui/components/LoadingProgress.vue'
import { isTauri, getEnv } from '@/utils/env'
import { initTauriMenu } from '@/utils/tauri-menu'
import { useGlyphStore } from '@/stores/glyph'
import { useCharacterStore } from '@/stores/character'

const { locale } = useI18n()
const glyphStore = useGlyphStore()
const characterStore = useCharacterStore()

const showSidebar = ref(true)
const sidebarCollapsed = ref(true)
const sidebarWidth = ref(64)

// 路由离开前提示
onBeforeRouteLeave((to, from, next) => {
  let msg = '你确定要离开吗？未保存的更改将丢失。'
  if (locale.value === 'zh') {
    msg = '你确定要离开吗？未保存的更改将丢失。'
  } else if (locale.value === 'en') {
    msg = 'Exit without saving? Your changes will be lost.'
  }
  const answer = window.confirm(msg)
  if (answer) {
    next() // 允许离开
  } else {
    next(false) // 阻止离开
  }
})

// 浏览器关闭/刷新前提示
const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (getEnv() === 'web') {
    // 取消默认事件
    e.preventDefault()
    let msg = '你确定要离开吗？未保存的更改将丢失。'
    if (locale.value === 'zh') {
      msg = '你确定要离开吗？未保存的更改将丢失。'
    } else if (locale.value === 'en') {
      msg = 'Exit without saving? Your changes will be lost.'
    }
    // 设置 returnValue 属性，提示用户
    e.returnValue = msg // 现代浏览器会使用默认提示
    return '' // 在某些老旧浏览器中可能需要返回值
  }
}

/** 与旧版 Editor.vue 一致：按住 Shift 时组件列表可多选，setSelection 会切换 selectedComponentsUUIDs */
const setMultiSelectFromShift = (enabled: boolean) => {
  glyphStore.enableMultiSelect = enabled
  characterStore.enableMultiSelect = enabled
}

const onKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'Shift') {
    e.preventDefault()
    setMultiSelectFromShift(false)
  }
}

// 键盘事件处理：Shift 多选、阻止 Backspace/Delete 触发浏览器后退
const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Shift') {
    e.preventDefault()
    setMultiSelectFromShift(true)
  }

  // 处理删除键和退格键，防止触发浏览器后退
  if (e.key === 'Backspace' || e.key === 'Delete') {
    // 检查当前焦点是否在输入框、文本域或其他可编辑元素中
    const target = e.target as HTMLElement
    const isInputElement = target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.isContentEditable ||
      target.closest('input, textarea, [contenteditable="true"]')
    
    // 如果不在输入框中，阻止默认行为并执行删除操作
    if (!isInputElement) {
      e.preventDefault()
      e.stopPropagation()
      // 执行删除操作（调用菜单中的删除处理函数）
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // 触发删除事件，由 EditorSidebar 处理
        window.dispatchEvent(new CustomEvent('editor-delete'))
      }
    }
  }
}

// 在 Tauri 环境中初始化原生菜单
const handleShowNewProjectDialog = () => {
  // 通过事件通知 EditorSidebar 显示对话框
  window.dispatchEvent(new CustomEvent('editor-show-new-project-dialog'))
}

onMounted(() => {
  // 监听浏览器关闭/刷新事件
  window.addEventListener('beforeunload', handleBeforeUnload)
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  
  if (isTauri()) {
    initTauriMenu()
    window.addEventListener('show-new-project-dialog', handleShowNewProjectDialog)
  }
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)
  setMultiSelectFromShift(false)
  
  if (isTauri()) {
    window.removeEventListener('show-new-project-dialog', handleShowNewProjectDialog)
  }
})
</script>

<style scoped>
.editor-layout {
  width: 100%;
  height: 100vh;
}

.editor-content {
  height: 100vh;
}

.editor-main {
  padding: 0;
  overflow: hidden;
}

/* 确保 sider 不裁剪子菜单，并且整体层级高于 FilesBar */
:deep(.n-layout-sider) {
  overflow: visible !important;
  position: relative;  /* 创建 stacking context */
  z-index: 2000;       /* 高于 .files-bar 的 99 */
}

:deep(.n-layout-sider .n-layout-sider-scroll-container) {
  overflow: visible !important;
}
</style>
