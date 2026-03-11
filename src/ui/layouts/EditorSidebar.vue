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
            :class="{ 'has-children': subMenu.submenu && subMenu.submenu.length > 0 }"
            @mouseenter="handleSubMenuEnter(subMenu.key)"
            @mouseleave="handleSubMenuLeave(subMenu.key)"
            @click="handleMenuSelect(subMenu.key)"
            @pointerup="handleMenuSelect(subMenu.key)"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import { fileHandler } from '@/features/editor/services/FileHandler'
import { useProjectStore } from '@/stores/project'
import NewProjectDialog from '@/ui/dialogs/NewProjectDialog.vue'
import { getWebMenu, traverse_web_menu } from '@/features/editor/menus/web_menus'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t } = useI18n()
const message = useMessage()
const router = useRouter()
const showNewProjectDialog = ref(false)
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

// 获取菜单列表
const menuList = computed(() => {
  try {
    const web_menu = getWebMenu()
    const menus = traverse_web_menu(web_handlers, web_menu)
    return menus
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

// 监听删除事件
const handleEditorDelete = () => {
  handleDelete()
}

onMounted(() => {
  window.addEventListener('editor-show-new-project-dialog', handleShowNewProjectDialog)
  window.addEventListener('show-warning-message', handleShowWarningMessage)
  window.addEventListener('editor-delete', handleEditorDelete)
})

onUnmounted(() => {
  window.removeEventListener('editor-show-new-project-dialog', handleShowNewProjectDialog)
  window.removeEventListener('show-warning-message', handleShowWarningMessage)
  window.removeEventListener('editor-delete', handleEditorDelete)
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
    await fileHandler.saveFile()
  } catch (error) {
    console.error('Failed to save file:', error)
  }
}

function handleClearCache() {
  console.log('Clear cache')
}

function handleSyncData() {
  console.log('Sync data')
}

function handleSaveAsJson() {
  console.log('Save as JSON')
}

// 编辑操作
function handleUndo() {
  console.log('Undo')
}

function handleRedo() {
  console.log('Redo')
}

function handleCut() {
  console.log('Cut')
}

function handleCopy() {
  console.log('Copy')
}

function handlePaste() {
  console.log('Paste')
}

function handleDelete() {
  console.log('Delete')
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
  console.log('Import SVG')
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
  console.log('Export JPEG')
}

function handleExportPng() {
  console.log('Export PNG')
}

function handleExportSvg() {
  console.log('Export SVG')
}

// 字符操作
function handleAddCharacter() {
  console.log('Add character')
}

function handleAddIcon() {
  console.log('Add icon')
}

// 设置操作
function handleFontSettings() {
  console.log('Font settings')
}

function handlePreferenceSettings() {
  console.log('Preference settings')
}

function handleLanguageSettings() {
  console.log('Language settings')
}

// 模板操作
function handleTemplate(templateKey: string) {
  console.log('Import template:', templateKey)
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
  z-index: 99;
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
</style>
