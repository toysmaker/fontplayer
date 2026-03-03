<template>
  <div class="editor-sidebar">
    <!-- 左侧竖向菜单 -->
    <n-menu
      :mode="collapsed ? 'vertical' : 'vertical'"
      :collapsed="collapsed"
      :collapsed-width="64"
      :options="menuOptions"
      :default-value="activeMenu"
      @update:value="handleMenuSelect"
    />
    
    <NewProjectDialog
      v-model:show="showNewProjectDialog"
      @confirm="handleProjectCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, h, onMounted, onUnmounted } from 'vue'
import { NMenu, useMessage } from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import { useRouter } from 'vue-router'
import { fileHandler } from '@/features/editor/services/FileHandler'
import { useProjectStore } from '@/stores/project'
import NewProjectDialog from '@/ui/dialogs/NewProjectDialog.vue'

const message = useMessage()

const router = useRouter()
const activeMenu = ref('file')
const collapsed = ref(false)
const showNewProjectDialog = ref(false)

// 监听 Tauri 菜单事件（新建工程）
const handleShowNewProjectDialog = () => {
  showNewProjectDialog.value = true
}

// 监听警告消息事件
const handleShowWarningMessage = (event: Event) => {
  const customEvent = event as CustomEvent<{ message: string }>
  if (customEvent.detail?.message) {
    message.warning(customEvent.detail.message)
  }
}

onMounted(() => {
  window.addEventListener('editor-show-new-project-dialog', handleShowNewProjectDialog)
  window.addEventListener('show-warning-message', handleShowWarningMessage)
})

onUnmounted(() => {
  window.removeEventListener('editor-show-new-project-dialog', handleShowNewProjectDialog)
  window.removeEventListener('show-warning-message', handleShowWarningMessage)
})

const menuOptions: MenuOption[] = [
  {
    label: '文件',
    key: 'file',
    icon: () => h('span', '📁'),
    children: [
      {
        label: '新建工程',
        key: 'file-new',
      },
      {
        label: '打开工程',
        key: 'file-open',
      },
      {
        label: '保存工程',
        key: 'file-save',
      },
      {
        label: '导出',
        key: 'file-export',
        children: [
          {
            label: '导出 OTF',
            key: 'file-export-otf',
          },
          {
            label: '导出 SVG',
            key: 'file-export-svg',
          },
        ],
      },
    ],
  },
  {
    label: '编辑',
    key: 'edit',
    icon: () => h('span', '✏️'),
    children: [
      {
        label: '撤销',
        key: 'edit-undo',
      },
      {
        label: '重做',
        key: 'edit-redo',
      },
    ],
  },
  {
    label: '视图',
    key: 'view',
    icon: () => h('span', '👁️'),
  },
  {
    label: '工具',
    key: 'tools',
    icon: () => h('span', '🔧'),
  },
  {
    label: '帮助',
    key: 'help',
    icon: () => h('span', '❓'),
  },
]

const handleMenuSelect = async (key: string) => {
  activeMenu.value = key
  
  // 实现菜单项点击处理逻辑
  switch (key) {
    case 'file-open':
      await handleOpenFile()
      break
    case 'file-save':
      await handleSaveFile()
      break
    case 'file-new':
      handleNewFile()
      break
    case 'file-export-otf':
      handleExportOTF()
      break
    case 'file-export-svg':
      handleExportSVG()
      break
    case 'edit-undo':
      handleUndo()
      break
    case 'edit-redo':
      handleRedo()
      break
    default:
      console.log('Menu selected:', key)
  }
}

const handleOpenFile = async () => {
  try {
    await fileHandler.openFile()
  } catch (error) {
    console.error('Failed to open file:', error)
  }
}

const handleSaveFile = async () => {
  try {
    await fileHandler.saveFile()
  } catch (error) {
    console.error('Failed to save file:', error)
  }
}

const handleNewFile = async () => {
  try {
    // 检查是否已有工程打开
    const projectStore = useProjectStore()
    if (projectStore.hasFiles) {
      message.warning('目前字玩仅支持同时编辑一个工程，请关闭当前工程再新建。注意，关闭工程前请保存工程以避免数据丢失。')
      return
    }
    
    // 显示新建工程对话框
    showNewProjectDialog.value = true
  } catch (error) {
    console.error('Failed to create new project:', error)
  }
}

const handleExportOTF = () => {
  // TODO: 实现导出OTF
  console.log('Export OTF')
}

const handleExportSVG = () => {
  // TODO: 实现导出SVG
  console.log('Export SVG')
}

const handleUndo = () => {
  // TODO: 实现撤销
  console.log('Undo')
}

const handleRedo = () => {
  // TODO: 实现重做
  console.log('Redo')
}

const handleProjectCreated = () => {
  // 工程创建成功后的处理（如果需要）
  // 由于工程已经通过 projectCreator 添加到 store 并选中，这里不需要额外操作
}
</script>

<style scoped>
.editor-sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
