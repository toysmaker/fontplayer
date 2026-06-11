<template>
  <n-modal
    v-model:show="visible"
    preset="dialog"
    :title="tm('dialogs.addTextDialog.title')"
    class="add-character-dialog"
    :style="{ width: '380px' }"
  >
    <n-form
      :model="formData"
      label-placement="left"
      label-width="72"
      @submit.prevent="handleConfirm"
    >
      <n-form-item :label="tm('dialogs.addTextDialog.title')">
        <n-input
          v-model:value="formData.text"
          :maxlength="1"
          show-count
          @keyup.enter="handleConfirm"
        />
      </n-form-item>
    </n-form>

    <!-- 批量添加字符 -->
    <div class="batch-section">
      <div class="batch-row">
        <n-button
          class="batch-btn"
          :type="selectedFile ? 'success' : 'default'"
          @click="handleBatchBtnClick"
          @pointerup="handleBatchBtnClick"
        >
          <template v-if="selectedFile">
            <span class="check-icon">&#10003;</span>
            {{ t('dialogs.addTextDialog.viewSelectedChars') }}
          </template>
          <template v-else>
            {{ t('dialogs.addTextDialog.batchAddChars') }}
          </template>
        </n-button>
        <n-popover trigger="hover" v-if="!selectedFile">
          <template #trigger>
            <span class="help-icon" style="cursor: pointer;">&#9432;</span>
          </template>
          <span>{{ t('dialogs.addTextDialog.batchAddCharsTip') }}</span>
        </n-popover>
        <span v-else class="delete-icon" @click="handleClearFile" @pointerup="handleClearFile" style="cursor: pointer;">
          &#10005;
        </span>
      </div>
    </div>

    <!-- 查看已选字符 Modal -->
    <n-modal v-model:show="showCharListModal" preset="dialog" title="已选字符列表" :style="{ width: '440px' }">
      <n-scrollbar style="max-height: 280px;">
        <div class="char-grid">
          <span v-for="(ch, idx) in displayChars" :key="idx" class="char-item">{{ ch }}</span>
        </div>
      </n-scrollbar>
      <div class="char-count">共 {{ selectedChars.length }} 个字符</div>
      <template #action>
        <n-button @click="showCharListModal = false">关闭</n-button>
      </template>
    </n-modal>

    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel" @pointerup="handleCancel">
          {{ t('dialogs.addTextDialog.cancel') }}
        </n-button>
        <n-button type="primary" @click="handleConfirm" @pointerup="handleConfirm">
          {{ t('dialogs.addTextDialog.confirm') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, nextTick } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton, NPopover, NScrollbar, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import type { ICharacterFileLite, ICharacterFileMetadata, ICharacterInfo } from '@/core/types'
import { EditStatus } from '@/core/types'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { genUUID } from '@/utils/uuid'
import { isTauri } from '@/utils/env'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t, tm, locale } = useI18n()
const message = useMessage()
const projectStore = useProjectStore()
const editorStore = useEditorStore()

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [value: boolean] }>()

const visible = computed({ get: () => props.show, set: (v: boolean) => emit('update:show', v) })
const formData = reactive({ text: '' })
const selectedFile = ref<File | null>(null)
const selectedChars = ref<string[]>([])
const showCharListModal = ref(false)

const displayChars = computed(() => selectedChars.value.slice(0, 500))

async function pickTxtFileTauri(): Promise<File | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const { readTextFile } = await import('@tauri-apps/plugin-fs')
  const picked = await open({ multiple: false, filters: [{ name: 'Text', extensions: ['txt'] }] })
  if (picked == null) return null
  const filePath = typeof picked === 'string' ? picked : (picked as any)?.path ?? null
  if (!filePath) return null
  const content = await readTextFile(filePath)
  return new File([content], filePath.split('/').pop() || 'chars.txt', { type: 'text/plain' })
}

function pickTxtFileWeb(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt,text/plain'
    input.style.display = 'none'
    input.onchange = () => { resolve(input.files?.[0] || null); input.remove() }
    input.onclick = () => { /* noop */ }
    document.body.appendChild(input)
    input.click()
  })
}

async function pickTxtFile() {
  try {
    const file = isTauri() ? await pickTxtFileTauri() : await pickTxtFileWeb()
    if (!file) return
    const text = await file.text()
    const chars = Array.from(new Set(Array.from(text).filter((ch) => ch.trim() && ch !== '\n' && ch !== '\r')))
    if (chars.length === 0) { message.warning('文件中没有可识别的字符'); return }
    selectedFile.value = file
    selectedChars.value = chars
  } catch (e: any) {
    console.error('批量添加字符读取失败:', e)
    message.warning('文件读取失败: ' + (e?.message || '未知错误'))
  }
}

const handleBatchBtnClick = createDebouncedHandler(
  () => { selectedFile.value ? (showCharListModal.value = true) : pickTxtFile() },
  'AddCharacterDialog.batchBtn'
)
const handleClearFile = createDebouncedHandler(
  () => { selectedFile.value = null; selectedChars.value = [] },
  'AddCharacterDialog.clearFile'
)

const buildCharacterInfo = (width: number): ICharacterInfo => {
  const size = width || 1000
  const centerSquareSize = size / 3
  return {
    gridSettings: {
      dx: 0, dy: 0, centerSquareSize, size, default: true,
      initialGrid: { dx: 0, dy: 0, dx1: 0, dx2: 0, dx3: 0, dx4: 0, dy1: 0, dy2: 0, dy3: 0, dy4: 0, ox: 500, oy: 500, width: 1000, height: 1000, centerSquareScale: 1 },
      currentGrid: { dx: 0, dy: 0, dx1: 0, dx2: 0, dx3: 0, dx4: 0, dy1: 0, dy2: 0, dy3: 0, dy4: 0, ox: 500, oy: 500, width: 1000, height: 1000, centerSquareScale: 1 },
    },
    useSkeletonGrid: false, layout: '', layoutTree: [],
  }
}

const toUnicodeString = (ch: string): string => {
  if (!ch) return ''
  const code = ch.codePointAt(0) ?? 0
  return 'U+' + code.toString(16).toUpperCase().padStart(4, '0')
}

const resetForm = () => {
  formData.text = ''
  selectedFile.value = null; selectedChars.value = []
}

const _handleConfirm = async () => {
  const singleText = formData.text
  const hasBatch = selectedChars.value.length > 0

  if (!singleText && !hasBatch) {
    message.warning(locale.value === 'en' ? 'Please input a character or select a txt file.' : '请输入字符或选择批量添加文件。')
    return
  }

  const file = projectStore.selectedFile
  if (!file) { message.error('No project file selected.'); return }

  // 收集所有要添加的字符（去重）
  const existingUnicodes = new Set(file.characterList?.map((m) => m.character?.unicode) || [])
  const charsToAdd: string[] = []

  if (singleText) {
    const ch = Array.from(singleText)[0]
    if (ch === '.notdef') { message.warning('不能创建.notdef字符，该字符已自动添加'); return }
    const ul = toUnicodeString(ch)
    if (existingUnicodes.has(ul)) { message.warning(t('dialogs.addTextDialog.duplicateUnicode')); return }
    charsToAdd.push(ch)
  }

  if (hasBatch) {
    for (const ch of selectedChars.value) {
      if (ch === '.notdef') continue
      const ul = toUnicodeString(ch)
      if (!existingUnicodes.has(ul) && !charsToAdd.includes(ch)) {
        charsToAdd.push(ch)
      }
    }
  }

  if (charsToAdd.length === 0) {
    message.warning('所有字符均已存在')
    return
  }

  const newRecords: ICharacterFileLite[] = []
  const newMetas: ICharacterFileMetadata[] = []

  for (const ch of charsToAdd) {
    const fuuid = genUUID()
    const cuuid = genUUID()
    const ul = toUnicodeString(ch)
    const lite: ICharacterFileLite = {
      uuid: fuuid, type: 'text',
      character: { uuid: cuuid, text: ch, unicode: ul },
      components: [], groups: [], orderedList: [],
      view: { zoom: 100, translateX: 0, translateY: 0 },
      info: buildCharacterInfo(file.width),
      selectedComponentsTree: [], selectedComponentsUUIDs: [],
      script: `function script_${fuuid.replaceAll('-', '_')}(character, constants, FP) {\n\t// Todo something\n}`,
    }
    newRecords.push(lite)
    newMetas.push({ uuid: fuuid, type: 'text', character: lite.character })
  }

  try {
    file.characterList.push(...newMetas)
    projectStore.markFileUnsaved(file.uuid)
    await characterDataManager.storeCharacters(file.uuid, newRecords)
    if (editorStore.editStatus !== EditStatus.CharacterList) {
      editorStore.setEditStatus(EditStatus.CharacterList)
    }
    resetForm()
    visible.value = false
    message.success(`已添加 ${charsToAdd.length} 个字符`)
  } catch (error: any) {
    console.error('Failed to add characters:', error)
    message.error(error?.message || '添加字符失败')
  } finally {
    // 释放大字符串内存
    await nextTick()
    selectedChars.value = []
    selectedFile.value = null
  }
}

const handleConfirm = createDebouncedHandler(_handleConfirm, 'AddCharacterDialog.confirm')

const _handleCancel = () => { resetForm(); visible.value = false }
const handleCancel = createDebouncedHandler(_handleCancel, 'AddCharacterDialog.cancel')
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
.batch-section {
  margin-top: 12px;
}
.batch-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.batch-btn {
  flex: 1;
}
.check-icon {
  margin-right: 4px;
  font-weight: bold;
  color: #18a058;
}
.help-icon {
  font-size: 16px;
  color: var(--primary-color, #2080f0);
}
.delete-icon {
  font-size: 16px;
  color: #d03050;
}
.char-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.char-item {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  border: 1px solid var(--light-5); border-radius: 4px;
  font-size: 18px; color: var(--light-0);
}
.char-count { margin-top: 12px; font-size: 13px; color: var(--light-0); text-align: center; }
</style>
