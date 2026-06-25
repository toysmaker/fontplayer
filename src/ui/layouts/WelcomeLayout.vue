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
        <div
          class="item import-font-item"
          @click="handleImportFont"
          @pointerup="handleImportFont"
        >
          <div class="item-icon">
            <font-awesome-icon :icon="['fas', 'archive']" />
          </div>
          <div class="item-name">{{ t('welcome.import.name') }}</div>
          <div class="description">{{ t('welcome.import.description') }}</div>
        </div>
        <div
          class="item template-item"
          data-testid="import-template-button"
          @click="handleImportTemplate"
          @pointerup="handleImportTemplate"
        >
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
import { useMessage, useDialog } from 'naive-ui'
import { fileHandler } from '@/features/editor/menus/FileHandler'
import NewProjectDialog from '@/ui/dialogs/NewProjectDialog.vue'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import { useCharacterStore } from '@/stores/character'
import { runFontLibraryImportPicker } from '@/features/editor/services/FontLibraryImportService'
import { isTauri } from '@/utils/env'
import { importBundledDefaultTemplate } from '@/features/editor/services/DefaultTemplateImportService'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()
const projectStore = useProjectStore()
const editorStore = useEditorStore()
const characterStore = useCharacterStore()

const router = useRouter()
const showNewProjectDialog = ref(false)

const _handleNewProject = () => {
  showNewProjectDialog.value = true
}

/**
 * 打开工程：在同步上下文中触发文件对话框（保留浏览器 user activation），
 * 文件读取完成后再跳转到编辑器页面加载工程。
 *
 * 修复：此前先 router.push + await 再 openFile，导致 input.click() 不在
 * 用户手势的直接同步调用链中，浏览器静默阻止文件对话框正常工作。
 */
const _handleOpenProject = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.fp,.json'
  input.style.display = 'none'

  let handled = false

  input.addEventListener('change', async (e: Event) => {
    if (handled) return
    handled = true

    const target = e.target as HTMLInputElement
    const files = target.files
    if (!files || files.length === 0) {
      document.body.removeChild(input)
      return
    }

    const file = files[0]

    // 读取文件为 ArrayBuffer
    let buf: ArrayBuffer
    try {
      buf = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsArrayBuffer(file)
      })
    } catch (err) {
      console.error('Failed to read file:', err)
      document.body.removeChild(input)
      return
    }

    document.body.removeChild(input)

    // 跳转到编辑器页面（进度条在 EditorLayout 中显示）
    router.push('/editor')
    await nextTick()
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        setTimeout(() => resolve(undefined), 100)
      })
    })

    // 加载工程
    try {
      await fileHandler.loadFromArrayBuffer(buf)
    } catch (error: any) {
      console.error('Failed to open project:', error)
    }
  })

  // 用户取消文件选择（cancel 事件兼容性不佳，这里兜底清理 DOM）
  input.addEventListener('cancel', () => {
    if (!handled) {
      handled = true
      document.body.removeChild(input)
    }
  })

  document.body.appendChild(input)
  // 关键：在用户手势的同步调用链中触发文件对话框
  input.click()
}

// 使用防重复调用包装
const handleNewProject = createDebouncedHandler(_handleNewProject, 'WelcomeLayout.newProject')
const handleOpenProject = createDebouncedHandler(_handleOpenProject, 'WelcomeLayout.openProject')

const _handleImportFont = async () => {
  try {
    router.push('/editor')
    await nextTick()
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        setTimeout(() => resolve(), 100)
      })
    })
    await runFontLibraryImportPicker(
      { projectStore, editorStore, characterStore },
      { t, message, dialog, router },
    )
  } catch (e) {
    console.error('Welcome import font failed', e)
  }
}

const handleImportFont = createDebouncedHandler(_handleImportFont, 'WelcomeLayout.importFont')

const _handleImportTemplate = async () => {
  if (!isTauri()) {
    message.warning(t('welcome.template.webOnlyHint'))
    return
  }
  try {
    router.push('/editor')
    await nextTick()
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        setTimeout(() => resolve(), 100)
      })
    })
    await importBundledDefaultTemplate()
  } catch (e) {
    console.error('Welcome import template failed', e)
    message.error(String((e as Error)?.message || e))
  }
}

const handleImportTemplate = createDebouncedHandler(_handleImportTemplate, 'WelcomeLayout.importTemplate')

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
