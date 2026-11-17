<template>
  <n-modal
    :show="visible"
    preset="card"
    :title="t('dialogs.microInteraction.title')"
    class="micro-interaction-dialog"
    :style="{ width: '1100px', maxWidth: '96vw' }"
    :mask-closable="false"
    @update:show="(v: boolean) => emit('update:visible', v)"
  >
    <!-- 顶部：名称 -->
    <div class="micro-dialog-top">
      <span class="micro-dialog-label">{{ t('dialogs.microInteraction.name') }}</span>
      <n-input
        v-model:value="draftName"
        class="micro-dialog-name"
        :placeholder="t('dialogs.microInteraction.namePlaceholder')"
        :status="nameError ? 'error' : undefined"
        maxlength="40"
        show-count
        @update:value="nameError = false"
      />
    </div>

    <div class="micro-dialog-body">
      <MicroInteractionEditor />
    </div>

    <template #footer>
      <div class="micro-dialog-footer">
        <n-button @click="handleCancel" @pointerup="handleCancel">{{ t('dialogs.microInteraction.cancel') }}</n-button>
        <n-button type="primary" @click="handleSave" @pointerup="handleSave">{{ t('dialogs.microInteraction.save') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
/**
 * 微交互编辑对话框：加载/保存字符上的微交互数据（状态机）。
 * 编辑器草稿由 microInteraction store 持有，保存时深拷贝写回并重置，避免引用滞留。
 */
import { ref, watch } from 'vue'
import { NButton, NInput, NModal, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import * as R from 'ramda'
import { genUUID } from '@/utils/uuid'
import type { IMicroInteraction } from '@/core/types'
import { useAnimationStore } from '@/stores/animation'
import { useMicroInteractionStore } from '@/stores/microInteraction'
import MicroInteractionEditor from '@/ui/components/MicroInteraction/MicroInteractionEditor.vue'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t } = useI18n()
const message = useMessage()
const animationStore = useAnimationStore()
const store = useMicroInteractionStore()

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const draftName = ref('')
const nameError = ref(false)

watch(
  () => props.visible,
  (v) => {
    if (v) {
      nameError.value = false
      const id = animationStore.editingMicroId
      const existing = id ? animationStore.getMicro(id) : null
      if (existing) {
        draftName.value = existing.name
        store.load(existing)
      } else {
        draftName.value = ''
        store.load({
          id: genUUID(),
          name: '',
          states: [],
          inputs: [],
          transitions: [],
        })
      }
    } else {
      // 关闭时释放草稿，防止大对象滞留内存
      store.reset()
    }
  },
)

const _save = () => {
  const name = draftName.value.trim()
  if (!name) {
    nameError.value = true
    message.warning(t('dialogs.microInteraction.nameRequired'))
    return
  }
  const draft = store.draft
  if (!draft) return
  const id = animationStore.editingMicroId
  const existing = id ? animationStore.getMicro(id) : null
  const micro: IMicroInteraction = {
    ...R.clone(draft),
    id: existing?.id ?? draft.id,
    name,
  }
  animationStore.saveMicro(micro)
  emit('update:visible', false)
  message.success(t('dialogs.microInteraction.saved'))
}

const _cancel = () => {
  emit('update:visible', false)
}
const handleSave = createDebouncedHandler(_save, 'MicroInteractionDialog.save')
const handleCancel = createDebouncedHandler(_cancel, 'MicroInteractionDialog.cancel')
</script>

<style scoped>
.micro-interaction-dialog {
  height: 680px;
}
.micro-dialog-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.micro-dialog-label {
  flex: 0 0 auto;
  font-size: 13px;
}
.micro-dialog-name {
  max-width: 320px;
}
.micro-dialog-body {
  height: 560px;
}
.micro-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
