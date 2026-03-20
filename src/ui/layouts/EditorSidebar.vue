<template>
  <div class="side-bar">
    <div class="side-bar-menu">
      <div
        v-for="menu in menuList"
        :key="menu.key"
        class="menu-item-wrapper"
        @mouseenter="handleMenuEnter(menu.key)"
        @mouseleave="handleMenuLeave(menu.key)"
      >
        <div 
          class="menu-icon-item"
          :class="{ 'is-hovered': hoveredMenu === menu.key }"
        >
          <div class="menu-icon-item-icon">
            <font-awesome-icon :icon="web_menu_icons[menu.key]" />
          </div>
          <div class="menu-icon-item-label">{{ menu.label }}</div>
        </div>
        
        <!-- 弹出菜单 -->
        <div
          v-if="hoveredMenu === menu.key && menu.submenu && menu.submenu.length > 0"
          class="menu-dropdown"
          @mouseenter="handleMenuEnter(menu.key)"
          @mouseleave="handleMenuLeave(menu.key)"
        >
          <div
            v-for="subMenu in menu.submenu"
            :key="subMenu.key"
            class="menu-dropdown-item"
            :class="{ 
              'has-children': subMenu.submenu && subMenu.submenu.length > 0,
              'menu-item-disabled': subMenu.disabled 
            }"
            @mouseenter="handleSubMenuEnter(subMenu.key)"
            @mouseleave="handleSubMenuLeave(subMenu.key)"
            @click="!subMenu.disabled && handleMenuSelect(subMenu.key)"
            @pointerup="!subMenu.disabled && handleMenuSelect(subMenu.key)"
          >
            <span>{{ subMenu.label }}</span>
            <!-- 嵌套子菜单 -->
            <div
              v-if="hoveredSubMenu === subMenu.key && subMenu.submenu && subMenu.submenu.length > 0"
              class="menu-dropdown-nested"
              @mouseenter="handleSubMenuEnter(subMenu.key)"
              @mouseleave="handleSubMenuLeave(subMenu.key)"
            >
              <div
                v-for="subSubMenu in subMenu.submenu"
                :key="subSubMenu.key"
                class="menu-dropdown-item"
                @click.stop="handleMenuSelect(subSubMenu.key)"
                @pointerup.stop="handleMenuSelect(subSubMenu.key)"
              >
                {{ subSubMenu.label }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <NewProjectDialog
      v-model:show="showNewProjectDialog"
      @confirm="handleProjectCreated"
    />
    <AddCharacterDialog v-model:show="showAddCharacterDialog" />
    <AddIconDialog v-model:show="showAddIconDialog" />
    <AddGlyphDialog
      v-model:show="showAddGlyphDialog"
      :category="addGlyphCategory"
    />
    <GlyphComponentsDialog v-model:show="showGlyphComponentsDialog" />
    <FontSettingsDialog
      v-model:show="showFontSettingsDialog"
      @open-more="handleFontSettingsOpenMore"
    />
    <FontSettingsMoreDialog v-model:show="showFontSettingsMoreDialog" />
    <PreferenceSettingsDialog v-model:show="showPreferenceSettingsDialog" />
    <LanguageSettingsDialog v-model:show="showLanguageSettingsDialog" />
    <ExportFontDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMessage, useDialog } from 'naive-ui'
import { fileHandler } from '@/features/editor/menus/FileHandler'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { EditStatus } from '@/core/types'
import { ImportExportSvgService } from '@/features/editor/services/ImportExportSvgService'
import { formatContainerGlyphComponents } from '@/features/editor/services/FormatGlyphService'
import type { IComponent } from '@/core/types'
import { isTauri } from '@/utils/env'
import NewProjectDialog from '@/ui/dialogs/NewProjectDialog.vue'
import AddCharacterDialog from '@/ui/dialogs/AddCharacterDialog.vue'
import AddIconDialog from '@/ui/dialogs/AddIconDialog.vue'
import AddGlyphDialog from '@/ui/dialogs/AddGlyphDialog.vue'
import GlyphComponentsDialog from '@/ui/dialogs/GlyphComponentsDialog.vue'
import FontSettingsDialog from '@/ui/dialogs/FontSettingsDialog.vue'
import FontSettingsMoreDialog from '@/ui/dialogs/FontSettingsMoreDialog.vue'
import PreferenceSettingsDialog from '@/ui/dialogs/PreferenceSettingsDialog.vue'
import LanguageSettingsDialog from '@/ui/dialogs/LanguageSettingsDialog.vue'
import ExportFontDialog from '@/ui/dialogs/ExportFontDialog.vue'
import { exportFontLibraryNativeDefaults } from '@/features/editor/services/ExportFontService'
import { getWebMenu, traverse_web_menu } from '@/features/editor/menus/web_menus'
import { templateHandlers } from '@/features/editor/menus/templatesHandlers'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { createMenuHandlers, createDisabledRules } from '@/features/editor/menus/menuHandlers'
import type { MenuHandlerContext } from '@/features/editor/menus/menuHandlerTypes'
import { useDialogsStore } from '@/stores/dialogs'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()
const router = useRouter()
const projectStore = useProjectStore()
const editorStore = useEditorStore()
const showNewProjectDialog = ref(false)
const showAddCharacterDialog = ref(false)
const showAddIconDialog = ref(false)
const showAddGlyphDialog = ref(false)
const addGlyphCategory = ref<'glyphs' | 'stroke_glyphs' | 'radical_glyphs' | 'comp_glyphs'>('glyphs')
const dialogsStore = useDialogsStore()
const showGlyphComponentsDialog = computed({
  get: () => dialogsStore.glyphComponentsDialogVisible,
  set: (v: boolean) => {
    if (v) dialogsStore.openGlyphComponentsDialog()
    else dialogsStore.closeGlyphComponentsDialog()
  },
})
const showFontSettingsDialog = ref(false)
const showFontSettingsMoreDialog = ref(false)
const showPreferenceSettingsDialog = ref(false)
const showLanguageSettingsDialog = ref(false)
const hoveredMenu = ref<string | null>(null)
const hoveredSubMenu = ref<string | null>(null)
let menuLeaveTimer: number | null = null
let subMenuLeaveTimer: number | null = null

// 图标映射（FontAwesome）
const web_menu_icons: Record<string, any> = {
  'file': ['fas', 'file'],
  'edit': ['fas', 'pencil'],
  'import': ['fas', 'upload'],
  'export': ['fas', 'download'],
  'character': ['fas', 'ticket'],
  'settings': ['fas', 'gear'],
  'templates': ['fas', 'list'],
  'tools': ['fas', 'wrench'],
}

// 菜单处理器与禁用规则（由统一的 handlers 模块提供）
const characterStore = useCharacterStore()
const glyphStore = useGlyphStore()

const handlerContext: MenuHandlerContext = {
  projectStore,
  editorStore,
  characterStore,
  glyphStore,
  message,
  dialog,
  t,
  router,
  fileHandler,
  ImportExportSvgService,
  formatContainerGlyphComponents,
  templateHandlers,
}

const web_handlers = createMenuHandlers(handlerContext)
const web_disabled = createDisabledRules({ editorStore })

// 获取菜单列表（带禁用状态）
const menuList = computed(() => {
  try {
    const web_menu = getWebMenu()
    const menus = traverse_web_menu(web_handlers, web_menu)
    // 为每个菜单项添加禁用状态
    return menus.map(menu => ({
      ...menu,
      submenu: menu.submenu?.map(subMenu => ({
        ...subMenu,
        disabled: web_disabled[subMenu.key] ? !web_disabled[subMenu.key]() : false,
      })),
    }))
  } catch (error) {
    console.error('Error loading menu:', error)
    return []
  }
})
const handleMenuEnter = (key: string) => {
  if (menuLeaveTimer) {
    clearTimeout(menuLeaveTimer)
    menuLeaveTimer = null
  }
  hoveredMenu.value = key
}

const handleMenuLeave = (key: string) => {
  menuLeaveTimer = window.setTimeout(() => {
    if (hoveredMenu.value === key) {
      hoveredMenu.value = null
      hoveredSubMenu.value = null
    }
  }, 200)
}

const handleSubMenuEnter = (key: string) => {
  if (subMenuLeaveTimer) {
    clearTimeout(subMenuLeaveTimer)
    subMenuLeaveTimer = null
  }
  hoveredSubMenu.value = key
}

const handleSubMenuLeave = (key: string) => {
  subMenuLeaveTimer = window.setTimeout(() => {
    if (hoveredSubMenu.value === key) {
      hoveredSubMenu.value = null
    }
  }, 200)
}

const _handleMenuSelect = async (key: string) => {
  if (web_handlers[key]) {
    await web_handlers[key]()
  }
  hoveredMenu.value = null
  hoveredSubMenu.value = null
}

// 使用防重复调用包装，避免 click 和 pointerup 同时触发时重复调用
const handleMenuSelect = createDebouncedHandler(_handleMenuSelect, 'EditorSidebar.menuSelect', (args) => args[0])

// 监听 Tauri / 全局事件（新建工程、添加字符、添加图标）
const handleShowNewProjectDialog = () => {
  showNewProjectDialog.value = true
}

const handleShowAddCharacterDialog = () => {
  showAddCharacterDialog.value = true
}

const handleShowAddIconDialog = () => {
  showAddIconDialog.value = true
}

const handleShowAddGlyphDialog = (event?: Event) => {
  const customEvent = event as CustomEvent<{ glyphType?: string }> | undefined
  const glyphType = customEvent?.detail?.glyphType || 'glyphs'
  addGlyphCategory.value = glyphType as typeof addGlyphCategory.value
  showAddGlyphDialog.value = true
}

// 监听警告消息事件
const handleShowWarningMessage = (event: Event) => {
  const customEvent = event as CustomEvent<{ message: string }>
  if (customEvent.detail?.message) {
    message.warning(customEvent.detail.message)
  }
}

// 监听删除事件（仍沿用 tools handler，通过菜单 handlers 触发）
const handleEditorDelete = () => {
  web_handlers['delete'] && web_handlers['delete']()
}

const handleEditorRemoveOverlap = () => {
  web_handlers['remove_overlap']?.()
}

const handleExportFontNative = async () => {
  const file = projectStore.selectedFile
  if (!file) {
    message.warning(t('dialogs.exportFontDialog.needProject'))
    return
  }
  await exportFontLibraryNativeDefaults({
    file,
    editingCharacterUUID: characterStore.editingCharacterUUID,
    editingCharacter: characterStore.editingCharacter,
    message,
    t,
    projectStore,
  })
}

const handleImportFontNative = async () => {
  await web_handlers['import-font-file']?.()
}

// 将 EditStatus 转换为 Rust 端能理解的字符串格式
const editStatusToRustString = (status: EditStatus): string => {
  switch (status) {
    case EditStatus.Edit:
      return 'edit'
    case EditStatus.Glyph:
      return 'glyph'
    case EditStatus.Pic:
      return 'pic'
    case EditStatus.CharacterList:
      return 'characterlist'
    case EditStatus.GlyphList:
      return 'glyphlist'
    case EditStatus.StrokeGlyphList:
      return 'strokeglyphlist'
    case EditStatus.RadicalGlyphList:
      return 'radicalglyphlist'
    case EditStatus.CompGlyphList:
      return 'compglyphlist'
    default:
      return 'characterlist'
  }
}

// 更新 Tauri 菜单的启用/禁用状态
const updateTauriMenuDisabled = async () => {
  if (!isTauri()) return
  
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const statusString = editStatusToRustString(editorStore.editStatus)
    await invoke('toggle_menu_disabled', { editStatus: statusString })
  } catch (error) {
    console.error('Failed to update Tauri menu disabled state:', error)
  }
}

// 监听编辑状态变化，更新菜单禁用状态
watch(() => editorStore.editStatus, () => {
  updateTauriMenuDisabled()
}, { immediate: true })

onMounted(() => {
  window.addEventListener('editor-show-new-project-dialog', handleShowNewProjectDialog)
  window.addEventListener('editor-add-character', handleShowAddCharacterDialog)
  window.addEventListener('editor-add-icon', handleShowAddIconDialog)
  window.addEventListener('editor-add-glyph', handleShowAddGlyphDialog)
  window.addEventListener('show-warning-message', handleShowWarningMessage)
  window.addEventListener('editor-delete', handleEditorDelete)
  window.addEventListener('editor-cut', () => web_handlers['cut'] && web_handlers['cut']())
  window.addEventListener('editor-copy', () => web_handlers['copy'] && web_handlers['copy']())
  window.addEventListener('editor-paste', () => web_handlers['paste'] && web_handlers['paste']())
  window.addEventListener('editor-import-glyphs', () => web_handlers['import-glyphs']?.())
  window.addEventListener('editor-export-glyphs', () => web_handlers['export-glyphs']?.())
  window.addEventListener('editor-export-font-native', handleExportFontNative)
  window.addEventListener('editor-import-font-native', handleImportFontNative)
  window.addEventListener('editor-remove-overlap', handleEditorRemoveOverlap)
  window.addEventListener('editor-font-settings', () => { showFontSettingsDialog.value = true })
  window.addEventListener('editor-preference-settings', () => { showPreferenceSettingsDialog.value = true })
  window.addEventListener('editor-language-settings', () => { showLanguageSettingsDialog.value = true })
  window.addEventListener('editor-template', handleEditorTemplate)
  // 监听 Tauri 菜单触发的保存事件
  window.addEventListener('save-file', async () => {
    try {
      await fileHandler.saveProjectTauriRememberPath()
    } catch (error) {
      console.error('Failed to save project from Tauri menu:', error)
    }
  })
  window.addEventListener('save-as', async () => {
    try {
      await fileHandler.saveProjectTauriAs()
    } catch (error) {
      console.error('Failed to save-as project from Tauri menu:', error)
    }
  })
  
  // 初始化 Tauri 菜单状态
  updateTauriMenuDisabled()
})

onUnmounted(() => {
  window.removeEventListener('editor-show-new-project-dialog', handleShowNewProjectDialog)
  window.removeEventListener('editor-add-character', handleShowAddCharacterDialog)
  window.removeEventListener('editor-add-icon', handleShowAddIconDialog)
  window.removeEventListener('editor-add-glyph', handleShowAddGlyphDialog)
  window.removeEventListener('show-warning-message', handleShowWarningMessage)
  window.removeEventListener('editor-delete', handleEditorDelete)
  window.removeEventListener('editor-cut', () => {})
  window.removeEventListener('editor-copy', () => {})
  window.removeEventListener('editor-paste', () => {})
  window.removeEventListener('editor-import-glyphs', () => {})
  window.removeEventListener('editor-export-glyphs', () => {})
  window.removeEventListener('editor-export-font-native', handleExportFontNative)
  window.removeEventListener('editor-import-font-native', handleImportFontNative)
  window.removeEventListener('editor-remove-overlap', handleEditorRemoveOverlap)
  window.removeEventListener('editor-font-settings', () => {})
  window.removeEventListener('editor-preference-settings', () => {})
  window.removeEventListener('editor-language-settings', () => {})
  window.removeEventListener('editor-template', handleEditorTemplate)
  window.removeEventListener('save-file', () => {})
  window.removeEventListener('save-as', () => {})
})

function handleFontSettingsOpenMore() {
  showFontSettingsDialog.value = false
  showFontSettingsMoreDialog.value = true
}

// 模板操作（Tauri 菜单通过 editor-template 事件触发）
function handleEditorTemplate(event: Event) {
  const key = (event as CustomEvent<{ templateKey: string }>).detail?.templateKey
  if (key && web_handlers[key]) {
    web_handlers[key]()
  }
}

const handleProjectCreated = () => {
  // 工程创建成功后的处理
}

</script>

<style scoped>
.side-bar {
  z-index: 10000;
  height: 100%;
  background-color: var(--dark-0);
  padding: 5px;
  width: 80px;
  box-sizing: border-box;
  position: relative;
  overflow: visible;
  padding-top: 10px;
  border-right: 1px solid var(--dark-4);
}

.side-bar-menu {
  height: 100%;
  background-color: var(--dark-0);
  width: 100%;
  overflow: visible;
}

.menu-item-wrapper {
  position: relative;
  margin: 0 5px;
  margin-bottom: 10px;
  width: 60px;
  height: 60px;
  overflow: visible;
}

.menu-icon-item {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  width: 60px;
  height: 60px;
  background-color: var(--dark-2);
  border-radius: 0 20px 0 20px;
  padding: 8px 4px;
  color: var(--light-0);
  cursor: pointer;
  transition: background-color 0.2s;
  box-sizing: border-box;
}

.menu-icon-item.is-hovered {
  background-color: var(--dark-3);
}

.menu-icon-item-icon {
  flex: 0 0 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 20px;
  color: var(--light-2);
  transition: color 0.2s;
}

.menu-icon-item-icon svg {
  width: 20px;
  height: 20px;
  margin-top: 6px;
}

.menu-icon-item.is-hovered .menu-icon-item-icon {
  color: var(--light-0);
}

.menu-icon-item-label {
  flex: auto;
  line-height: 18px;
  font-size: 12px;
  text-align: center;
  margin-top: 8px;
  color: var(--light-0);
}

/* 弹出菜单 */
.menu-dropdown {
  position: absolute;
  left: 80px;
  top: 0;
  background-color: var(--dark-0);
  border: 1px solid var(--dark-4);
  border-radius: 0;
  box-shadow: none;
  min-width: 200px;
  width: 200px;
  max-width: 200px;
  padding: 5px 0;
  z-index: 10000;
}

.menu-dropdown-item {
  padding: 0 20px;
  min-height: 36px;
  line-height: 36px;
  color: var(--light-0);
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
}

.menu-dropdown-item:hover {
  background-color: transparent;
  color: var(--primary-4);
}

.menu-dropdown-item.has-children::after {
  content: '▶';
  float: right;
  font-size: 10px;
  color: var(--light-2);
}

.menu-dropdown-item.has-children {
  position: relative;
}

/* 嵌套子菜单 */
.menu-dropdown-nested {
  position: absolute;
  left: 200px;
  top: 0;
  background-color: var(--dark-0);
  border: 1px solid var(--dark-4);
  border-radius: 0;
  box-shadow: none;
  min-width: 200px;
  width: 200px;
  max-width: 200px;
  padding: 5px 0;
  z-index: 10001;
}

.menu-dropdown-nested .menu-dropdown-item {
  padding: 0 20px;
  min-height: 36px;
  line-height: 36px;
  color: var(--light-0);
  cursor: pointer;
}

.menu-dropdown-nested .menu-dropdown-item:hover {
  background-color: transparent;
  color: var(--primary-4);
}

.menu-dropdown-item.menu-item-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.menu-dropdown-item.menu-item-disabled:hover {
  background-color: transparent;
  color: var(--light-0);
}
</style>
