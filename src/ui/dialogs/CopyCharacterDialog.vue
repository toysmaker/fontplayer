<template>
  <n-modal
    v-model:show="visible"
    preset="dialog"
    :title="t('dialogs.copyCharacterDialog.title')"
    class="copy-character-dialog"
    :style="{ width: '380px' }"
  >
    <n-form label-placement="left" label-width="80" @submit.prevent="handleConfirm">
      <n-form-item :label="t('dialogs.copyCharacterDialog.copyType')">
        <n-radio-group v-model:value="copyType" class="app-radio-gray">
          <n-radio value="character">
            {{ t('dialogs.copyCharacterDialog.typeCharacter') }}
          </n-radio>
          <n-radio value="icon">
            {{ t('dialogs.copyCharacterDialog.typeIcon') }}
          </n-radio>
        </n-radio-group>
      </n-form-item>
      <!-- 固定高度的输入槽：图标模式下 input 消失时对话框高度保持不变 -->
      <n-form-item
        :label="copyType === 'character' ? t('dialogs.copyCharacterDialog.characterName') : ' '"
      >
        <div class="input-slot">
          <n-input
            v-if="copyType === 'character'"
            v-model:value="inputValue"
            :placeholder="t('dialogs.copyCharacterDialog.placeholder')"
            :maxlength="1"
            show-count
            @keyup.enter="handleConfirm"
          />
          <span v-else class="auto-unicode-hint">
            {{ t('dialogs.copyCharacterDialog.autoUnicodeHint') }}
          </span>
        </div>
      </n-form-item>
      <n-form-item v-if="errorMsg" label=" ">
        <span class="error-msg">{{ errorMsg }}</span>
      </n-form-item>
    </n-form>
    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel" @pointerup="handleCancel">
          {{ t('dialogs.copyCharacterDialog.cancel') }}
        </n-button>
        <n-button type="primary" @click="handleConfirm" @pointerup="handleConfirm">
          {{ t('dialogs.copyCharacterDialog.confirm') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton, NRadioGroup, NRadio, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/stores/project'
import type { ICharacterFileLite, ICharacterFileMetadata } from '@/core/types'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { rewriteScriptUUIDReference } from '@/core/script/ScriptExecutor'
import { genUUID } from '@/utils/uuid'
import { createDebouncedHandler } from '@/utils/debounce-click'
import * as R from 'ramda'

const { t } = useI18n()
const message = useMessage()
const projectStore = useProjectStore()

const props = defineProps<{
  show: boolean
  character: ICharacterFileLite
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

const copyType = ref<'character' | 'icon'>('character')
const inputValue = ref('')
const errorMsg = ref<string | null>(null)

const toUnicodeString = (ch: string): string => {
  if (!ch) return ''
  const code = ch.codePointAt(0) ?? 0
  return 'U+' + code.toString(16).toUpperCase().padStart(4, '0')
}

const toIconUnicodeString = (index: number): string => {
  // 与添加图标流程一致：从 F000 开始递增，由系统自动分配
  const base = 0xf000
  const code = base + index
  return 'U+' + code.toString(16).toUpperCase()
}

// 每次打开对话框时重置状态
watch(() => props.show, (val) => {
  if (!val) return
  copyType.value = 'character'
  errorMsg.value = null
  // 图标名称可能包含多个字符，不能直接作为字符文本预填
  inputValue.value =
    props.character.type !== 'icon'
      ? `${props.character.character.text} (${t('dialogs.copyCharacterDialog.copySuffix')})`
      : ''
})

// 切换类型时清除错误提示
watch(copyType, () => {
  errorMsg.value = null
})

const validateCharacterText = (val: string): string | null => {
  if (Array.from(val).length !== 1) {
    return t('dialogs.copyCharacterDialog.singleCharError')
  }
  if (val === '.notdef') {
    return t('dialogs.copyCharacterDialog.notdefError')
  }
  const unicodeLabel = toUnicodeString(val)
  const file = projectStore.selectedFile
  if (file?.characterList?.some(m => m.character?.unicode === unicodeLabel)) {
    return t('dialogs.copyCharacterDialog.duplicateError')
  }
  return null
}

const _handleConfirm = async () => {
  const file = projectStore.selectedFile
  const fileUUID = file?.uuid
  if (!file || !fileUUID) return

  let newType: string
  let newText: string
  let newUnicode: string

  if (copyType.value === 'character') {
    const text = inputValue.value.trim()
    if (!text) return
    const err = validateCharacterText(text)
    if (err) {
      errorMsg.value = err
      return
    }
    newType = 'text'
    newText = text
    newUnicode = toUnicodeString(text)
  } else {
    // 图标：无需输入任何内容，unicode 由系统自动分配（与添加图标流程一致）
    newType = 'icon'
    newText = props.character.character.text
    newUnicode = toIconUnicodeString(file.iconsCount || 0)
  }

  const fullChar = await characterDataManager.loadCharacter(fileUUID, props.character.uuid)
  if (!fullChar) {
    message.warning(t('dialogs.copyCharacterDialog.loadFailed'))
    return
  }

  // 图标分支：确认能完成复制后再递增图标计数
  if (newType === 'icon') {
    file.iconsCount = (file.iconsCount || 0) + 1
  }

  const newChar = R.clone(fullChar) as ICharacterFileLite
  newChar.uuid = genUUID()
  // 脚本随数据一并复制，函数名引用旧 uuid；改写为新 uuid，否则执行时报
  // ReferenceError: script_<uuid> is not defined
  newChar.script = rewriteScriptUUIDReference(newChar.script, newChar.uuid)
  newChar.type = newType
  newChar.character = {
    uuid: genUUID(),
    text: newText,
    unicode: newUnicode,
  }
  newChar.previewRef = undefined
  newChar.contourRef = undefined

  try {
    await characterDataManager.updateCharacter(fileUUID, newChar)

    const metadata: ICharacterFileMetadata = {
      uuid: newChar.uuid,
      type: newChar.type,
      character: newChar.character,
    }
    file.characterList.push(metadata)
    projectStore.markFileUnsaved(file.uuid)

    message.success(
      newType === 'icon'
        ? t('dialogs.copyCharacterDialog.copyIconSuccess')
        : t('dialogs.copyCharacterDialog.copySuccess')
    )
    visible.value = false
  } catch (error: any) {
    if (import.meta.env.DEV) {
      console.error('Failed to copy character:', error)
    }
    message.error(t('dialogs.copyCharacterDialog.copyFailed'))
  }
}

const handleConfirm = createDebouncedHandler(_handleConfirm, 'CopyCharacterDialog.confirm')

const _handleCancel = () => {
  errorMsg.value = null
  visible.value = false
}

const handleCancel = createDebouncedHandler(_handleCancel, 'CopyCharacterDialog.cancel')
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

/* 固定高度输入槽：与 n-input 默认高度（34px）一致，保证图标模式下对话框高度不跳动 */
.input-slot {
  display: flex;
  align-items: center;
  width: 100%;
  height: 34px;
}

.auto-unicode-hint {
  font-size: 13px;
  color: var(--light-0);
}

.error-msg {
  color: #d03050;
  font-size: 12px;
}
</style>
