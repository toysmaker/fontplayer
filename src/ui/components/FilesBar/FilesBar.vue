<template>
  <div class="files-bar">
    <div class="files-bar-row" v-if="isListMode">
      <span
        v-for="file in files"
        :key="file.uuid"
        :class="{
          'file-tag': true,
          'selected': file.uuid === selectedFileUUID
        }"
      >
        <span class="file-info-wrapper" @pointerdown="() => selectFile(file.uuid)">
          <span class="file-name">
            {{ file.name }}
          </span>
        </span>
        <span class="close-btn" @pointerdown="() => closeFile(file.uuid)">
          <CloseOutline />
        </span>
      </span>
      <span class="advanced-edit-btn" v-show="files.length > 0">
        <n-button type="primary" size="small">
          <template #icon>
            <BuildOutline />
          </template>
          高级编辑
        </n-button>
      </span>
      <div class="right-btns" v-if="selectedFile" style="margin-left: auto;">
        <n-icon 
          class="right-btn" 
          :class="{ 'searching': isCharacterSearching }"
          @click="searchFile"
          size="22"
        >
          <SearchOutline />
        </n-icon>
        <n-popover
          placement="bottom-end"
          :width="120"
          trigger="hover"
        >
          <template #trigger>
            <n-icon class="right-btn" size="22">
              <InformationCircleOutline />
            </n-icon>
          </template>
          <div class="info-list">
            <div class="info-item">
              <span class="info-item-name">字符数</span>
              <span class="info-item-content">{{ selectedFile.characterList.length }}</span>
            </div>
            <div class="info-item">
              <span class="info-item-name">笔画数</span>
              <span class="info-item-content">{{ strokeGlyphsCount }}</span>
            </div>
            <div class="info-item">
              <span class="info-item-name">部首数</span>
              <span class="info-item-content">{{ radicalGlyphsCount }}</span>
            </div>
            <div class="info-item">
              <span class="info-item-name">部件数</span>
              <span class="info-item-content">{{ compGlyphsCount }}</span>
            </div>
            <div class="info-item">
              <span class="info-item-name">字形数</span>
              <span class="info-item-content">{{ glyphsCount }}</span>
            </div>
          </div>
        </n-popover>
      </div>
    </div>

    <!-- 搜索字符对话框 -->
    <n-modal
      v-model:show="searchCharacterDialogVisible"
      preset="dialog"
      title="搜索字符"
      :mask-closable="false"
      style="width: 400px"
    >
      <n-input
        v-model:value="searchInput"
        placeholder="请输入要搜索的字符（1-100个字符）"
        :maxlength="100"
        show-count
        @keyup.enter="confirmSearch"
      />
      <template #action>
        <n-button @click="cancelSearch">取消</n-button>
        <n-button type="primary" @click="confirmSearch">搜索</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NButton, NIcon, NPopover, NModal, NInput, useMessage } from 'naive-ui'
import { CloseOutline, SearchOutline, InformationCircleOutline, BuildOutline } from '@vicons/ionicons5'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import { EditStatus } from '@/core/types'

const projectStore = useProjectStore()
const editorStore = useEditorStore()
const message = useMessage()

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

// 选择文件
const selectFile = (uuid: string) => {
  projectStore.selectFile(uuid)
}

// 关闭文件
const closeFile = (uuid: string) => {
  // TODO: 实现关闭文件逻辑
  console.log('Close file:', uuid)
}

// 搜索文件功能
const searchFile = () => {
  // 如果已经在搜索状态，则取消搜索
  if (isCharacterSearching.value) {
    editorStore.setIsCharacterSearching(false)
    searchInput.value = ''
    return
  }

  // 如果不在字符列表状态，先跳转到字符列表
  if (editStatus.value !== EditStatus.CharacterList) {
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
    message.warning('请输入搜索关键词（1-100个字符）')
    return
  }
  
  if (keyword.length > 100) {
    message.warning('搜索关键词不能超过100个字符')
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
.files-bar {
  width: 100%;
  height: 36px;
  z-index: 99;
  background-color: white;
  border-bottom: 1px solid var(--dark-4);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 0 10px;
}

.files-bar-row {
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 15px;
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
  background-color: var(--primary-2);
  border-radius: 2px;
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
  color: var(--primary-0);
}

.info-item-content {
  margin-left: 20px;
  color: var(--dark-0);
}
</style>
