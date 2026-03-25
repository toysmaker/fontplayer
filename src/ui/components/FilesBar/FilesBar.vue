<template>
  <div 
    class="files-bar"
    :style="{
      'border-bottom': isListMode ? 'none' : '1px solid var(--dark-4)',
    }"
  >
    <div class="files-bar-row" v-if="isListMode">
      <span
        v-for="file in files"
        :key="file.uuid"
        :class="{
          'file-tag': true,
          'selected': file.uuid === selectedFileUUID
        }"
      >
        <span class="file-info-wrapper" @click="() => selectFile(file.uuid)" @pointerup="() => selectFile(file.uuid)">
          <span class="file-name">
            {{ file.name }}
          </span>
        </span>
        <span class="close-btn" @pointerup="() => closeFile(file.uuid)">
          <font-awesome-icon :icon="['fas', 'xmark']" />
        </span>
      </span>
      <span class="advanced-edit-btn" v-show="files.length > 0">
        <n-button type="primary" size="small" @click="openAdvancedEdit">
          <template #icon>
            <font-awesome-icon :icon="['fas', 'wrench']" />
          </template>
          {{ t('panels.filesBar.advancedEdit') }}
        </n-button>
      </span>
      <div class="style-selection-wrap" v-show="files.length > 0">
        <span class="style-selection-title">{{ t('panels.settingsPanel.render.title') }}</span>
        <n-radio-group v-model:value="fontPreviewStyle" size="small" @update:value="handlePreviewStyleChange">
          <n-radio value="black">{{ t('panels.settingsPanel.render.black') }}</n-radio>
          <n-radio value="color">{{ t('panels.settingsPanel.render.color') }}</n-radio>
        </n-radio-group>
      </div>
      <div class="right-btns" v-if="selectedFile" style="margin-left: auto;">
        <font-awesome-icon 
          class="right-btn" 
          :class="{ 'searching': isCharacterSearching }"
          @click="searchFile"
          :icon="['fas', 'magnifying-glass']"
        />
        <n-popover
          placement="bottom-end"
          :width="120"
          trigger="hover"
        >
          <template #trigger>
            <font-awesome-icon class="right-btn" :icon="['fas', 'circle-info']" />
          </template>
          <div class="info-list">
            <div class="info-item">
              <span class="info-item-name">{{ t('programming.charCounts') }}</span>
              <span class="info-item-content">{{ selectedFile.characterList.length }}</span>
            </div>
            <div class="info-item">
              <span class="info-item-name">{{ t('programming.strokeCounts') }}</span>
              <span class="info-item-content">{{ strokeGlyphsCount }}</span>
            </div>
            <div class="info-item">
              <span class="info-item-name">{{ t('programming.radicalCounts') }}</span>
              <span class="info-item-content">{{ radicalGlyphsCount }}</span>
            </div>
            <div class="info-item">
              <span class="info-item-name">{{ t('programming.compCounts') }}</span>
              <span class="info-item-content">{{ compGlyphsCount }}</span>
            </div>
            <div class="info-item">
              <span class="info-item-name">{{ t('programming.glyphCompCounts') }}</span>
              <span class="info-item-content">{{ glyphsCount }}</span>
            </div>
          </div>
        </n-popover>
        <font-awesome-icon 
          class="right-btn" 
          @click="handleSettings"
          :icon="['fas', 'fa-gear']"
        />
        <div class="language-settings">
          <div 
            class="language-choice-item" 
            :class="{ selected: locale === 'zh' }"
            @click="handleLanguageChange('zh')"
          >
            中文
          </div>
          <div 
            class="language-choice-item" 
            :class="{ selected: locale === 'en' }"
            @click="handleLanguageChange('en')"
          >
            English
          </div>
        </div>
      </div>
    </div>

    <!-- 搜索字符对话框 -->
    <n-modal
      v-model:show="searchCharacterDialogVisible"
      preset="dialog"
      :title="t('panels.filesBar.searchCharacter')"
      :mask-closable="false"
      style="width: 400px"
    >
      <n-input
        v-model:value="searchInput"
        :placeholder="t('panels.filesBar.searchPlaceholder')"
        :maxlength="100"
        show-count
        @keyup.enter="confirmSearch"
      />
      <template #action>
        <n-button @click="cancelSearch">{{ t('dialogs.tipsDialog.cancel') }}</n-button>
        <n-button type="primary" @click="confirmSearch">{{ t('panels.filesBar.search') }}</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NButton, NPopover, NModal, NInput, NRadioGroup, NRadio, useMessage, useDialog } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import { EditStatus } from '@/core/types'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { isTauri } from '@/utils/env'
import { confirmLeaveGlyphEditIfDirty } from '@/stores/editorConstantsSession'

const projectStore = useProjectStore()
const editorStore = useEditorStore()
const message = useMessage()
const dialog = useDialog()
const { locale, t } = useI18n()

// 处理语言切换
const handleLanguageChange = async (lang: 'zh' | 'en') => {
  locale.value = lang
  // 更新 Tauri 菜单
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke('update_menu_language', { language: lang })
    } catch (error) {
      console.error('Failed to update menu language:', error)
    }
  }
}

// 监听语言变化，更新 Tauri 菜单（作为备用）
watch(() => locale.value, async (newLocale) => {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('update_menu_language', { language: newLocale })
    } catch (error) {
      console.error('Failed to update menu language:', error)
    }
  }
}, { immediate: false })

const files = computed(() => projectStore.files)
const selectedFileUUID = computed(() => projectStore.selectedFileUUID)
const selectedFile = computed(() => projectStore.selectedFile)
const editStatus = computed(() => editorStore.editStatus)
const isCharacterSearching = computed(() => editorStore.isCharacterSearching)

// 判断是否为列表模式
const isListMode = computed(() => {
  return editStatus.value === EditStatus.CharacterList ||
         editStatus.value === EditStatus.StrokeGlyphList ||
         editStatus.value === EditStatus.RadicalGlyphList ||
         editStatus.value === EditStatus.CompGlyphList ||
         editStatus.value === EditStatus.GlyphList
})

// 计算字形数量
const strokeGlyphsCount = computed(() => {
  return selectedFile.value?.stroke_glyphs?.length || 0
})

const radicalGlyphsCount = computed(() => {
  return selectedFile.value?.radical_glyphs?.length || 0
})

const compGlyphsCount = computed(() => {
  return selectedFile.value?.comp_glyphs?.length || 0
})

const glyphsCount = computed(() => {
  return selectedFile.value?.glyphs?.length || 0
})

// 搜索相关
const searchCharacterDialogVisible = ref(false)
const searchInput = ref('')

// 预览样式（列表模式使用，使用全局 store）
const fontPreviewStyle = computed({
  get: () => projectStore.fontPreviewStyle,
  set: (val) => { projectStore.fontPreviewStyle = val },
})

// 处理预览样式变化
const handlePreviewStyleChange = () => {
  // 全局变量已更新，列表将在下次渲染时使用新样式
}

async function openAdvancedEdit() {
  if (
    editStatus.value === EditStatus.Edit ||
    editStatus.value === EditStatus.Glyph
  ) {
    const ok = await confirmLeaveGlyphEditIfDirty({ dialog, t })
    if (!ok) return
  }
  editorStore.setEditStatus(EditStatus.AdvancedEdit)
}

// 处理设置按钮点击
const handleSettings = () => {
  // TODO: 打开设置对话框
  console.log('Settings clicked')
}

// 选择文件
const _selectFile = (uuid: string) => {
  projectStore.selectFile(uuid)
}
const selectFile = createDebouncedHandler(_selectFile, 'FilesBar.selectFile', (args) => args[0])

// 关闭文件
const closeFile = (uuid: string) => {
  const file = files.value.find(f => f.uuid === uuid)
  if (!file) return

  // 如果文件未保存，给出简单提示（保持与当前交互风格一致，先不弹确认框）
  if (!file.saved) {
    message.warning(t('dialogs.tipsDialog.unsavedWarning'))
  }

  projectStore.removeFile(uuid)
}

// 搜索文件功能
const searchFile = async () => {
  // 如果已经在搜索状态，则取消搜索
  if (isCharacterSearching.value) {
    editorStore.setIsCharacterSearching(false)
    searchInput.value = ''
    return
  }

  // 如果不在字符列表状态，先跳转到字符列表
  if (editStatus.value !== EditStatus.CharacterList) {
    if (editStatus.value === EditStatus.Edit || editStatus.value === EditStatus.Glyph) {
      const ok = await confirmLeaveGlyphEditIfDirty({ dialog, t })
      if (!ok) return
    }
    editorStore.setEditStatus(EditStatus.CharacterList)
  }

  // 打开搜索对话框
  searchInput.value = ''
  searchCharacterDialogVisible.value = true
}

// 确认搜索
const confirmSearch = () => {
  const keyword = searchInput.value.trim()
  
  // 验证输入：1-100个字符
  if (keyword.length === 0) {
    message.warning(t('panels.filesBar.searchWarning'))
    return
  }
  
  if (keyword.length > 100) {
    message.warning(t('panels.filesBar.searchWarningTooLong'))
    return
  }

  // 设置搜索关键词和搜索状态
  editorStore.setCharacterSearchKeyword(keyword)
  editorStore.setIsCharacterSearching(true)
  
  // 关闭对话框
  searchCharacterDialogVisible.value = false
}

// 取消搜索对话框
const cancelSearch = () => {
  searchCharacterDialogVisible.value = false
  searchInput.value = ''
}
</script>

<style scoped>
/* FilesBar styles - updated for HMR */
.files-bar {
  width: 100%;
  height: 36px;
  z-index: 99;
  background-color: white;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 0;
}

.files-bar-row {
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

.file-tag {
  display: flex;
  min-width: 120px;
  width: max-content;
  height: 36px;
  white-space: nowrap;
  line-height: 36px;
  flex-direction: row;
  text-align: center;
  border-right: 1px solid var(--dark-4);
  cursor: pointer;
  padding-right: 10px;
  background-color: var(--light-2);
  color: var(--primary-0);
}

.file-tag.selected {
  background-color: var(--primary-5);
  border: none;
  color: var(--primary-0);
  font-weight: bold;
}

.file-info-wrapper {
  display: flex;
  flex: auto;
  margin-left: 5px;
  padding: 0 10px;
  cursor: pointer;
}

.file-name {
  flex: auto;
  text-overflow: ellipsis;
  overflow: hidden;
}

.close-btn {
  cursor: pointer;
  flex: 0 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
}

.close-btn:hover {
  background-color: var(--primary-4);
  height: 20px;
  margin: auto;
}

.advanced-edit-btn {
  display: flex;
  align-items: center;
  height: 36px;
}

.right-btns {
  font-size: 22px;
  line-height: 36px;
  margin-right: 5px;
  display: flex;
  flex-direction: row;
  gap: 5px;
  align-items: center;
  color: var(--primary-0);
}

.right-btn {
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.right-btn:hover {
  background-color: var(--primary-5);
}

.right-btn.searching {
  background-color: var(--primary-5);
  border-radius: 4px;
}

.info-list {
  padding: 5px 0;
}

.info-item {
  margin-bottom: 5px;
  display: flex;
  justify-content: space-between;
}

.info-item-name {
  color: var(--primary-5);
}

.info-item-content {
  margin-left: 20px;
  color: var(--primary-5);
}

.style-selection-wrap {
  margin-left: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.style-selection-title {
  color: var(--primary-0);
}

.language-settings {
  color: var(--primary-0);
  font-weight: normal;
  display: flex;
  flex-direction: row;
  min-width: 140px;
  font-size: 14px;
  gap: 10px;
  align-items: center;
  justify-content: center;
  margin-left: 20px;
}

.language-choice-item {
  flex: 0 0 auto;
  min-width: 50px;
  text-align: center;
  line-height: 22px;
  cursor: pointer;
  padding: 2px 12px;
  border-radius: 20px;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.language-choice-item.selected {
  background-color: var(--primary-0);
  color: var(--light-0);
}

.language-choice-item:not(.selected):hover {
  background-color: var(--light-0);
}
</style>
