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
  </div>
</template>

<script setup lang="ts">
import { ref, h } from 'vue'
import { NMenu } from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import { useRouter } from 'vue-router'
import { fileHandler } from '@/features/editor/services/FileHandler'

const router = useRouter()
const activeMenu = ref('file')
const collapsed = ref(false)

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

const handleNewFile = () => {
  // TODO: 实现新建工程
  console.log('New file')
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
</script>

<style scoped>
.editor-sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
