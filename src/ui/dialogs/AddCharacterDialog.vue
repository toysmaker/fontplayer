<template>
  <n-modal
    v-model:show="visible"
    preset="dialog"
    :title="tm('dialogs.addTextDialog.title')"
    class="add-character-dialog"
    :style="{ width: '360px' }"
  >
    <n-form
      :model="formData"
      label-placement="left"
      label-width="100"
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
import { computed, reactive } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import type { ICharacterFileLite, ICharacterFileMetadata, ICharacterInfo } from '@/core/types'
import { EditStatus } from '@/core/types'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { genUUID } from '@/utils/uuid'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t, tm, locale } = useI18n()
const message = useMessage()
const projectStore = useProjectStore()
const editorStore = useEditorStore()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

const formData = reactive({
  text: '',
})

const buildCharacterInfo = (width: number): ICharacterInfo => {
  const size = width || 1000
  const centerSquareSize = size / 3
  return {
    gridSettings: {
      dx: 0,
      dy: 0,
      centerSquareSize,
      size,
      default: true,
      initialGrid: {
        dx: 0,
        dy: 0,
        dx1: 0,
        dx2: 0,
        dx3: 0,
        dx4: 0,
        dy1: 0,
        dy2: 0,
        dy3: 0,
        dy4: 0,
        ox: 500,
        oy: 500,
        width: 1000,
        height: 1000,
        centerSquareScale: 1,
      },
      currentGrid: {
        dx: 0,
        dy: 0,
        dx1: 0,
        dx2: 0,
        dx3: 0,
        dx4: 0,
        dy1: 0,
        dy2: 0,
        dy3: 0,
        dy4: 0,
        ox: 500,
        oy: 500,
        width: 1000,
        height: 1000,
        centerSquareScale: 1,
      },
    },
    useSkeletonGrid: false,
    layout: '',
    layoutTree: [],
  }
}

const toUnicodeString = (ch: string): string => {
  if (!ch) return ''
  const code = ch.codePointAt(0) ?? 0
  return 'U+' + code.toString(16).toUpperCase().padStart(4, '0')
}

const resetForm = () => {
  formData.text = ''
}

const _handleConfirm = async () => {
  const text = formData.text
  if (!text) {
    const msg =
      locale.value === 'en'
        ? "Please input character's name."
        : '请输入字符名称。'
    message.warning(msg)
    return
  }

  if (Array.from(text).length !== 1) {
    const msg =
      locale.value === 'en'
        ? 'Please input a single character.'
        : '请输入单个字符。'
    message.warning(msg)
    return
  }

  const file = projectStore.selectedFile
  if (!file) {
    message.error('No project file selected.')
    return
  }

  const ch = Array.from(text)[0]
  if (ch === '.notdef') {
    message.warning('不能创建.notdef字符，该字符已自动添加')
    return
  }

  const characterUUID = genUUID()
  const fileUUID = genUUID()

  const characterLite: ICharacterFileLite = {
    uuid: fileUUID,
    type: 'text',
    character: {
      uuid: characterUUID,
      text: ch,
      unicode: toUnicodeString(ch),
    },
    components: [],
    groups: [],
    orderedList: [],
    view: {
      zoom: 100,
      translateX: 0,
      translateY: 0,
    },
    info: buildCharacterInfo(file.width),
    selectedComponentsTree: [],
    selectedComponentsUUIDs: [],
    script: `function script_${fileUUID.replaceAll('-', '_')}(character, constants, FP) {\n\t// Todo something\n}`,
  }

  const metadata: ICharacterFileMetadata = {
    uuid: characterLite.uuid,
    type: characterLite.type,
    character: characterLite.character,
  }

  try {
    // 1. 更新内存中的元数据列表
    file.characterList.push(metadata)
    projectStore.markFileUnsaved(file.uuid)

    // 2. 将完整字符数据存入 IndexedDB
    await characterDataManager.storeCharacters(file.uuid, [characterLite])

    // 3. 如果当前不在字符列表，切换到字符列表
    if (editorStore.editStatus !== EditStatus.CharacterList) {
      editorStore.setEditStatus(EditStatus.CharacterList)
    }

    resetForm()
    visible.value = false
  } catch (error: any) {
    console.error('Failed to add character:', error)
    message.error(error?.message || '添加字符失败')
  }
}

const handleConfirm = createDebouncedHandler(_handleConfirm, 'AddCharacterDialog.confirm')

const _handleCancel = () => {
  resetForm()
  visible.value = false
}

const handleCancel = createDebouncedHandler(_handleCancel, 'AddCharacterDialog.cancel')
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
</style>

