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
    <FontSettingsDialog
      v-model:show="showFontSettingsDialog"
      @open-more="handleFontSettingsOpenMore"
    />
    <FontSettingsMoreDialog v-model:show="showFontSettingsMoreDialog" />
    <PreferenceSettingsDialog v-model:show="showPreferenceSettingsDialog" />
    <LanguageSettingsDialog v-model:show="showLanguageSettingsDialog" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import { fileHandler } from '@/features/editor/services/FileHandler'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import { EditStatus } from '@/core/types'
import { ImportExportSvgService } from '@/features/editor/services/ImportExportSvgService'
import { isTauri } from '@/utils/env'
import NewProjectDialog from '@/ui/dialogs/NewProjectDialog.vue'
import AddCharacterDialog from '@/ui/dialogs/AddCharacterDialog.vue'
import AddIconDialog from '@/ui/dialogs/AddIconDialog.vue'
import AddGlyphDialog from '@/ui/dialogs/AddGlyphDialog.vue'
import FontSettingsDialog from '@/ui/dialogs/FontSettingsDialog.vue'
import FontSettingsMoreDialog from '@/ui/dialogs/FontSettingsMoreDialog.vue'
import PreferenceSettingsDialog from '@/ui/dialogs/PreferenceSettingsDialog.vue'
import LanguageSettingsDialog from '@/ui/dialogs/LanguageSettingsDialog.vue'
import { getWebMenu, traverse_web_menu } from '@/features/editor/menus/web_menus'
import { templateHandlers } from '@/features/editor/menus/templatesHandlers'
import { doCut, doCopy, doPaste, doDelete } from '@/features/editor/actions/editActions'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t } = useI18n()
const message = useMessage()
const router = useRouter()
const projectStore = useProjectStore()
const editorStore = useEditorStore()
const showNewProjectDialog = ref(false)
const showAddCharacterDialog = ref(false)
const showAddIconDialog = ref(false)
const showAddGlyphDialog = ref(false)
const addGlyphCategory = ref<'glyphs' | 'stroke_glyphs' | 'radical_glyphs' | 'comp_glyphs'>('glyphs')
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

// 菜单处理器
const web_handlers: Record<string, Function> = {
  'create-file': handleNewFile,
  'open-file': handleOpenFile,
  'save-file': handleSaveFile,
  'clear-cache': handleClearCache,
  'sync-data': handleSyncData,
  'save-as-json': handleSaveAsJson,
  'undo': handleUndo,
  'redo': handleRedo,
  'cut': handleCut,
  'copy': handleCopy,
  'paste': handlePaste,
  'delete': handleDelete,
  'import-font-file': handleImportFont,
  'import-glyphs': handleImportGlyphs,
  'import-pic': handleImportPic,
  'import-svg': handleImportSvg,
  'export-font-file': handleExportFont,
  'export-var-font-file': handleExportVarFont,
  'export-color-font': handleExportColorFont,
  'export-glyphs': handleExportGlyphs,
  'export-jpeg': handleExportJpeg,
  'export-png': handleExportPng,
  'export-svg': handleExportSvg,
  'add-character': handleAddCharacter,
  'add-icon': handleAddIcon,
  'font-settings': handleFontSettings,
  'preference-settings': handlePreferenceSettings,
  'language-settings': handleLanguageSettings,
  'template-2': () => handleTemplate('template-2'),
  'template-3': () => handleTemplate('template-3'),
  'template-5': () => handleTemplate('template-5'),
  'template-6': () => handleTemplate('template-6'),
  'template-7': () => handleTemplate('template-7'),
  'template-8': () => handleTemplate('template-8'),
  'template-digits': () => handleTemplate('template-digits'),
  'template-letters': () => handleTemplate('template-letters'),
  'template-symbols': () => handleTemplate('template-symbols'),
  'template-test': () => handleTemplate('template-test'),
  'remove_overlap': handleRemoveOverlap,
  'format-all-characters': handleFormatAllCharacters,
  'format-current-character': handleFormatCurrentCharacter,
}

// 菜单启用/禁用逻辑函数
const enable = () => true

const enableAtEdit = () => {
  return editorStore.editStatus === EditStatus.Edit || editorStore.editStatus === EditStatus.Glyph
}

const enableAtCharacterEdit = () => {
  return editorStore.editStatus === EditStatus.Edit
}

const enableAtList = () => {
  return editorStore.editStatus === EditStatus.CharacterList ||
         editorStore.editStatus === EditStatus.GlyphList ||
         editorStore.editStatus === EditStatus.StrokeGlyphList ||
         editorStore.editStatus === EditStatus.RadicalGlyphList ||
         editorStore.editStatus === EditStatus.CompGlyphList
}

const templateEnable = () => {
  return editorStore.editStatus !== EditStatus.Edit &&
         editorStore.editStatus !== EditStatus.Glyph &&
         editorStore.editStatus !== EditStatus.Pic
}

// 菜单启用/禁用映射（参考原工程）
const web_disabled: Record<string, () => boolean> = {
  'create-file': enableAtList,
  'open-file': enableAtList,
  'save-file': enable,
  'clear-cache': enable,
  'sync-data': enableAtList,
  'save-as-json': enable,
  'undo': enableAtEdit,
  'redo': enableAtEdit,
  'cut': enableAtEdit,
  'copy': enableAtEdit,
  'paste': enableAtEdit,
  'delete': enableAtEdit,
  'import-font-file': enableAtList,
  'import-glyphs': enableAtList,
  'import-pic': enableAtEdit,
  'import-svg': enableAtEdit,
  'export-font-file': enable,
  'export-var-font-file': enable,
  'export-color-font': enable,
  'export-glyphs': enableAtList,
  'export-jpeg': enableAtEdit,
  'export-png': enableAtEdit,
  'export-svg': enableAtEdit,
  'add-character': enableAtList,
  'add-icon': enableAtList,
  'font-settings': enable,
  'preference-settings': enable,
  'language-settings': enable,
  'template-2': templateEnable,
  'template-3': templateEnable,
  'template-5': templateEnable,
  'template-6': templateEnable,
  'template-7': templateEnable,
  'template-8': templateEnable,
  'template-digits': templateEnable,
  'template-letters': templateEnable,
  'template-symbols': templateEnable,
  'template-test': templateEnable,
  'remove_overlap': enableAtCharacterEdit,
  'format-all-characters': enableAtList,
  'format-current-character': enableAtCharacterEdit,
}

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

// 监听删除事件
const handleEditorDelete = () => {
  handleDelete()
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
  window.addEventListener('editor-cut', handleCut)
  window.addEventListener('editor-copy', handleCopy)
  window.addEventListener('editor-paste', handlePaste)
  window.addEventListener('editor-font-settings', handleFontSettings)
  window.addEventListener('editor-preference-settings', handlePreferenceSettings)
  window.addEventListener('editor-language-settings', handleLanguageSettings)
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
  window.removeEventListener('editor-cut', handleCut)
  window.removeEventListener('editor-copy', handleCopy)
  window.removeEventListener('editor-paste', handlePaste)
  window.removeEventListener('editor-font-settings', handleFontSettings)
  window.removeEventListener('editor-preference-settings', handlePreferenceSettings)
  window.removeEventListener('editor-language-settings', handleLanguageSettings)
  window.removeEventListener('editor-template', handleEditorTemplate)
  window.removeEventListener('save-file', () => {})
  window.removeEventListener('save-as', () => {})
})

// 文件操作
async function handleNewFile() {
  try {
    const projectStore = useProjectStore()
    if (projectStore.hasFiles) {
      message.warning(t('panels.editorSidebar.onlyOneProjectWarning'))
      return
    }
    showNewProjectDialog.value = true
  } catch (error) {
    console.error('Failed to create new project:', error)
  }
}

async function handleOpenFile() {
  try {
    await fileHandler.openFile()
  } catch (error) {
    console.error('Failed to open file:', error)
  }
}

async function handleSaveFile() {
  try {
    // 左侧栏“缓存工程”按钮：无论是否在 Tauri，都使用缓存逻辑
    await fileHandler.cacheProjectToWeb()
    message.success(t('panels.editorSidebar.cacheSuccess'))
  } catch (error) {
    console.error('Failed to cache project:', error)
    message.error((error as Error).message || '缓存工程失败')
  }
}

async function handleClearCache() {
  try {
    await fileHandler.clearProjectCache()
    message.success(t('panels.editorSidebar.clearCacheSuccess'))
  } catch (error) {
    console.error('Failed to clear cache:', error)
    message.error((error as Error).message || '清空缓存失败')
  }
}

async function handleSyncData() {
  try {
    await fileHandler.syncProjectFromCache()
    message.success(t('panels.editorSidebar.syncCacheSuccess'))
  } catch (error) {
    console.error('Failed to sync cache:', error)
    message.error((error as Error).message || '同步缓存失败')
  }
}

async function handleSaveAsJson() {
  try {
    await fileHandler.exportProject()
  } catch (error) {
    console.error('Failed to export project:', error)
    message.error((error as Error).message || '导出工程失败')
  }
}

// 编辑操作
function handleUndo() {
  console.log('Undo')
}

function handleRedo() {
  console.log('Redo')
}

function handleCut() {
  if (!enableAtEdit()) return
  doCut()
}

function handleCopy() {
  if (!enableAtEdit()) return
  doCopy()
}

function handlePaste() {
  if (!enableAtEdit()) return
  doPaste()
}

function handleDelete() {
  if (!enableAtEdit()) return
  doDelete()
}

// 导入操作
function handleImportFont() {
  console.log('Import font')
}

function handleImportGlyphs() {
  console.log('Import glyphs')
}

function handleImportPic() {
  console.log('Import picture')
}

function handleImportSvg() {
  if (!projectStore.selectedFile) {
    message.warning('请先打开工程')
    return
  }
  ImportExportSvgService.importSvg()
    .then(() => {
      message.success('SVG 导入成功')
    })
    .catch((err) => {
      console.error('Import SVG failed:', err)
      message.error('SVG 导入失败')
    })
}

// 导出操作
function handleExportFont() {
  console.log('Export font')
}

function handleExportVarFont() {
  console.log('Export variable font')
}

function handleExportColorFont() {
  console.log('Export color font')
}

function handleExportGlyphs() {
  console.log('Export glyphs')
}

function handleExportJpeg() {
  if (!projectStore.selectedFile) {
    message.warning('请先打开工程')
    return
  }
  ImportExportSvgService.exportCurrentToJpeg()
    .then(() => {
      message.success('导出 JPEG 成功')
    })
    .catch((err) => {
      console.error('Export JPEG failed:', err)
      message.error('导出 JPEG 失败')
    })
}

function handleExportPng() {
  if (!projectStore.selectedFile) {
    message.warning('请先打开工程')
    return
  }
  ImportExportSvgService.exportCurrentToPng()
    .then(() => {
      message.success('导出 PNG 成功')
    })
    .catch((err) => {
      console.error('Export PNG failed:', err)
      message.error('导出 PNG 失败')
    })
}

function handleExportSvg() {
  if (!projectStore.selectedFile) {
    message.warning('请先打开工程')
    return
  }
  ImportExportSvgService.exportCurrentToSvg()
    .then(() => {
      message.success('导出 SVG 成功')
    })
    .catch((err) => {
      console.error('Export SVG failed:', err)
      message.error('导出 SVG 失败')
    })
}

// 字符操作
function handleAddCharacter() {
  window.dispatchEvent(new CustomEvent('editor-add-character'))
}

function handleAddIcon() {
  window.dispatchEvent(new CustomEvent('editor-add-icon'))
}

// 设置操作
function handleFontSettings() {
  if (!projectStore.selectedFile) {
    message.warning('请先打开工程')
    return
  }
  showFontSettingsDialog.value = true
}

function handleFontSettingsOpenMore() {
  showFontSettingsDialog.value = false
  showFontSettingsMoreDialog.value = true
}

function handlePreferenceSettings() {
  showPreferenceSettingsDialog.value = true
}

function handleLanguageSettings() {
  showLanguageSettingsDialog.value = true
}

// 模板操作（Tauri 菜单通过 editor-template 事件触发）
function handleEditorTemplate(event: Event) {
  const key = (event as CustomEvent<{ templateKey: string }>).detail?.templateKey
  if (key) handleTemplate(key)
}

async function handleTemplate(templateKey: string) {
  const handler = templateHandlers[templateKey]
  if (!handler) {
    message.warning(t('panels.editorSidebar.templateNotFound') || `未知模板: ${templateKey}`)
    return
  }
  if (!projectStore.selectedFile) {
    message.warning(t('panels.editorSidebar.openProjectFirst') || '请先新建或打开工程')
    return
  }
  try {
    await handler()
    message.success(t('panels.editorSidebar.templateImportSuccess') || '模板导入成功')
  } catch (err) {
    console.error('Template import failed:', err)
    message.error((err as Error).message || '模板导入失败')
  }
}

// 工具操作
function handleRemoveOverlap() {
  console.log('Remove overlap')
}

function handleFormatAllCharacters() {
  console.log('Format all characters')
}

function handleFormatCurrentCharacter() {
  console.log('Format current character')
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
