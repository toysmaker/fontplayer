<template>
  <div class="welcome-container">
    <n-empty description="欢迎使用字玩">
      <template #extra>
        <div class="action-buttons">
          <n-button type="primary" @click="handleNewProject" @pointerdown="handleNewProject">
            新建工程
          </n-button>
          <n-button @click="handleOpenProject" @pointerdown="handleOpenProject">
            打开工程
          </n-button>
        </div>
      </template>
    </n-empty>
    
    <NewProjectDialog
      v-model:show="showNewProjectDialog"
      @confirm="handleProjectCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { NEmpty, NButton } from 'naive-ui'
import { fileHandler } from '@/features/editor/services/FileHandler'
import NewProjectDialog from '@/ui/dialogs/NewProjectDialog.vue'
import { createDebouncedHandler } from '@/utils/debounce-click'

const router = useRouter()
const showNewProjectDialog = ref(false)

const _handleNewProject = () => {
  showNewProjectDialog.value = true
}

const _handleOpenProject = async () => {
  try {
    // 先跳转到编辑器页面，这样进度条才能显示
    router.push('/editor')
    
    // 等待路由跳转和页面渲染完成
    await nextTick()
    // 再等待一个渲染周期确保 EditorLayout 和 LoadingProgress 组件已挂载
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        setTimeout(() => resolve(undefined), 100)
      })
    })
    
    // 在编辑器页面中触发文件打开
    await fileHandler.openFile()
  } catch (error: any) {
    // 用户取消选择文件时不显示错误
    if (error.message !== 'File selection cancelled') {
      console.error('Failed to open project:', error)
    }
  }
}

// 使用防重复调用包装
const handleNewProject = createDebouncedHandler(_handleNewProject, 'WelcomeLayout.newProject')
const handleOpenProject = createDebouncedHandler(_handleOpenProject, 'WelcomeLayout.openProject')

const handleProjectCreated = () => {
  // 工程创建成功后跳转到编辑器
  router.push('/editor')
}
</script>

<style scoped>
.welcome-container {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
