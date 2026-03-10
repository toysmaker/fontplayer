<template>
  <div class="welcome">
    <div class="main-panel">
      <div class="items-wrapper">
        <div class="item new-project-item" data-testid="new-project-button" @click="handleNewProject" @pointerup="handleNewProject">
          <div class="item-icon">
            <font-awesome-icon :icon="['fas', 'plus']" />
          </div>
          <div class="item-name">{{ t('welcome.new.name') }}</div>
          <div class="description">{{ t('welcome.new.description') }}</div>
        </div>
        <div class="item open-project-item" data-testid="open-project-button" @click="handleOpenProject" @pointerup="handleOpenProject">
          <div class="item-icon">
            <font-awesome-icon :icon="['fas', 'folder-open']" />
          </div>
          <div class="item-name">{{ t('welcome.open.name') }}</div>
          <div class="description">{{ t('welcome.open.description') }}</div>
        </div>
        <div class="item import-font-item">
          <div class="item-icon">
            <font-awesome-icon :icon="['fas', 'archive']" />
          </div>
          <div class="item-name">{{ t('welcome.import.name') }}</div>
          <div class="description">{{ t('welcome.import.description') }}</div>
        </div>
        <div class="item template-item">
          <div class="item-icon">
            <font-awesome-icon :icon="['fas', 'fa-file-import']" />
          </div>
          <div class="item-name">{{ t('welcome.template.name') }}</div>
          <div class="description">{{ t('welcome.template.description') }}</div>
        </div>
      </div>
      <div class="playground-btn">
        <div class="item-icon playground-icon">
          <font-awesome-icon :icon="['fas', 'gamepad']" />
        </div>
        <div class="playground-main">
          <div class="playground-text">{{ t('welcome.playground.title') }}</div>
          <div class="playground-description">{{ t('welcome.playground.description') }}</div>
        </div>
      </div>
    </div>
    
    <NewProjectDialog
      v-model:show="showNewProjectDialog"
      @confirm="handleProjectCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { fileHandler } from '@/features/editor/services/FileHandler'
import NewProjectDialog from '@/ui/dialogs/NewProjectDialog.vue'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t } = useI18n()

const router = useRouter()
const showNewProjectDialog = ref(false)

const _handleNewProject = () => {
  console.log('handleNewProject')
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
.welcome {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--dark-0);
}

.welcome .main-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.welcome .main-panel .playground-btn {
  width: 360px;
  background-color: var(--primary-0);
  margin-top: 50px;
  border: 1px solid var(--light-5);
  color: var(--light-0);
  border-radius: 50px;
  display: flex;
  flex-direction: row;
  height: 68px;
  cursor: pointer;
}

.welcome .main-panel .playground-btn:hover {
  background-color: var(--primary-1);
}

.welcome .main-panel .playground-btn .playground-icon {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  flex: 0 0 80px;
  color: var(--light-0);
}

.welcome .main-panel .playground-btn .playground-icon svg {
  width: 48px;
  height: 48px;
}

.welcome .main-panel .playground-btn .playground-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 0 0 250px;
}

.welcome .main-panel .playground-btn .playground-text {
  font-size: 18px;
  text-align: center;
  font-weight: bold;
}

.welcome .main-panel .playground-btn .playground-description {
  color: var(--light-2);
  font-size: 14px;
  text-align: center;
}

.welcome .items-wrapper {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 30px;
  width: 360px;
  height: 360px;
}

.welcome .items-wrapper .item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--light-5);
  cursor: pointer;
  background-color: var(--primary-0);
}

.welcome .items-wrapper .item:hover {
  background-color: var(--primary-1);
}

.welcome .items-wrapper .item:hover .item-icon {
  color: var(--light-0);
}

.welcome .items-wrapper .item:hover .item-name {
  color: var(--light-0);
}

.welcome .items-wrapper .item:hover .description {
  color: var(--light-2);
}

.welcome .items-wrapper .item .item-icon {
  flex: 0 0 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--light-2);
}

.welcome .items-wrapper .item .item-icon svg {
  width: 32px;
  height: 32px;
}

.welcome .items-wrapper .item .item-name {
  font-weight: bold;
  font-size: 18px;
  color: var(--light-2);
}

.welcome .items-wrapper .item .description {
  font-size: 10px;
  padding: 8px;
  color: var(--light-3);
}
</style>
