<template>
  <n-layout class="editor-layout">
    <n-layout has-sider class="editor-content">
      <!-- 左侧菜单栏（Web和Tauri都显示） -->
      <n-layout-sider
        v-if="showSidebar"
        :width="sidebarWidth"
        collapse-mode="width"
        :collapsed="sidebarCollapsed"
        :collapsed-width="64"
        show-trigger
        bordered
        @collapse="sidebarCollapsed = true"
        @expand="sidebarCollapsed = false"
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
import { NLayout, NLayoutSider, NLayoutContent } from 'naive-ui'
import EditorSidebar from './EditorSidebar.vue'
import EditorMain from './EditorMain.vue'
import LoadingProgress from '@/ui/components/LoadingProgress.vue'
import { isTauri } from '@/utils/env'
import { initTauriMenu } from '@/utils/tauri-menu'

const showSidebar = ref(true)
const sidebarCollapsed = ref(false)
const sidebarWidth = ref(280)

// 在 Tauri 环境中初始化原生菜单
const handleShowNewProjectDialog = () => {
  // 通过事件通知 EditorSidebar 显示对话框
  window.dispatchEvent(new CustomEvent('editor-show-new-project-dialog'))
}

onMounted(() => {
  if (isTauri()) {
    initTauriMenu()
    window.addEventListener('show-new-project-dialog', handleShowNewProjectDialog)
  }
})

onUnmounted(() => {
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
</style>
