<template>
  <n-modal
    :show="show"
    preset="card"
    :title="t('applications.microEditor.title')"
    class="micro-dialog"
    :style="{ width: '1100px', maxWidth: '96vw' }"
    @update:show="handleClose"
  >
    <div class="micro-dialog-body">
      <div class="micro-name-row">
        <label class="micro-name-label">{{ t('applications.microEditor.name') }}</label>
        <n-input v-model:value="microName" size="small" class="micro-name-input" />
      </div>

      <!-- 工具栏：新建状态 + 预览切换 -->
      <div class="micro-toolbar">
        <n-button size="small" @click="handleNewState" @pointerup="handleNewState">
          + {{ t('applications.microEditor.addState') }}
        </n-button>
        <n-button
          size="small"
          :type="store.previewMode ? 'warning' : 'default'"
          @click="handleTogglePreview"
          @pointerup="handleTogglePreview"
        >
          <template #icon>
            <font-awesome-icon :icon="['fas', store.previewMode ? 'eye-slash' : 'eye']" />
          </template>
          {{ t('applications.microEditor.preview') }}
        </n-button>
      </div>

      <div class="micro-main">
        <div class="micro-left">
          <SegmentList :segments="segments" />
          <n-divider style="margin: 8px 0" />
          <InputList
            :inputs="store.draft?.inputs ?? []"
            :selected-input-id="store.selected?.kind === 'input' ? store.selected.id : null"
            @select="(id: string) => store.select({ kind: 'input', id })"
          />
        </div>
        <div class="micro-center">
          <StateCanvas />
        </div>
        <div class="micro-right">
          <PropertiesPanel />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="micro-footer">
        <n-button size="small" @click="handleCancel" @pointerup="handleCancel">
          {{ t('applications.microEditor.cancel') }}
        </n-button>
        <n-button size="small" type="primary" @click="handleSave" @pointerup="handleSave">
          {{ t('applications.microEditor.save') }}
        </n-button>
      </div>
    </template>
  </n-modal>

  <!-- 预览独立模态框：固定大小、内容居中适配 -->
  <AppMicroPreviewModal :doc="doc" :card-data="cardData" :library="library" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NDivider, NInput, NModal, useMessage } from 'naive-ui'
import * as R from 'ramda'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { genUUID } from '@/utils/uuid'
import { useMicroInteractionStore } from '@/stores/microInteraction'
import { videoTotalDuration } from '@/features/applications/video/videoData'
import type { FontLibrary } from '@/features/applications/fontLibraryService'
import type {
  ICardAppData,
  IApplicationDocument,
  IAppMicroDocument,
} from '@/features/applications/types'
import SegmentList, { type SegmentItem } from '@/ui/components/MicroInteraction/SegmentList.vue'
import InputList from '@/ui/components/MicroInteraction/InputList.vue'
import StateCanvas from '@/ui/components/MicroInteraction/StateCanvas.vue'
import PropertiesPanel from '@/ui/components/MicroInteraction/PropertiesPanel.vue'
import AppMicroPreviewModal from './AppMicroPreviewModal.vue'

const props = defineProps<{
  show: boolean
  doc: IApplicationDocument
  cardData: ICardAppData
  library: FontLibrary | null
  /** 编辑目标（空 = 新建） */
  editingMicroId?: string | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: [micro: IAppMicroDocument]
}>()

const { t } = useI18n()
const message = useMessage()
const store = useMicroInteractionStore()

const microName = ref('')

const segments = computed<SegmentItem[]>(() =>
  props.doc.videos.map((v) => ({
    id: v.id,
    name: v.name,
    duration: Math.round(videoTotalDuration(v) * 10) / 10,
  }))
)

watch(
  () => props.show,
  (v) => {
    if (!v) return
    // 打开：加载草稿（新建 = 空状态机；编辑 = 深拷贝）
    const existing = props.editingMicroId
      ? props.doc.micros.find((m) => m.id === props.editingMicroId)
      : null
    microName.value = existing?.name ?? ''
    store.loadWithSegments(
      existing?.micro ?? {
        id: '',
        name: '',
        states: [],
        inputs: [],
        transitions: [],
      },
      props.doc.videos.map((v) => ({
        id: v.id,
        name: v.name,
        duration: videoTotalDuration(v),
        video: v,
        cardData: props.cardData,
        library: props.library,
      }))
    )
  }
)

const handleClose = (value: boolean) => {
  emit('update:show', value)
  if (!value) store.reset()
}

const _handleNewState = () => {
  if (!store.draft) return
  if (store.segments.length === 0) {
    message.warning(t('applications.cardEditor.noVideos'))
    return
  }
  const n = store.draft.states.length
  store.addState(store.segments[0].name, store.segments[0].id, {
    x: 60 + (n % 3) * 60,
    y: 60 + Math.floor(n / 3) * 90,
  })
}
const handleNewState = createDebouncedHandler(_handleNewState, 'AppMicroEditorDialog.newState')

const _handleTogglePreview = () => {
  store.togglePreviewMode()
}
const handleTogglePreview = createDebouncedHandler(_handleTogglePreview, 'AppMicroEditorDialog.togglePreview')

const _handleCancel = () => {
  emit('update:show', false)
  store.reset()
}
const handleCancel = createDebouncedHandler(_handleCancel, 'AppMicroEditorDialog.cancel')

const _handleSave = () => {
  const draft = store.draft
  if (!draft) return
  if (!microName.value.trim()) {
    message.warning(t('applications.videoEditor.nameRequired'))
    return
  }
  const saved: IAppMicroDocument = {
    id: props.editingMicroId ?? genUUID(),
    name: microName.value.trim(),
    micro: R.clone(draft) as never,
  }
  saved.micro.name = saved.name
  saved.micro.id = saved.id
  emit('saved', saved)
  emit('update:show', false)
  store.reset()
}
const handleSave = createDebouncedHandler(_handleSave, 'AppMicroEditorDialog.save')
</script>

<style scoped>
.micro-dialog-body {
  display: flex;
  flex-direction: column;
  height: 620px;
  min-height: 0;
}

.micro-name-row {
  margin-bottom: 8px;
}

.micro-name-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.micro-name-input {
  width: 100%;
  max-width: 100%;
}

.micro-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid #e0e0e6;
  margin-bottom: 8px;
}

.micro-main {
  flex: 1;
  display: flex;
  min-height: 0;
}

.micro-left {
  flex: 0 0 220px;
  border-right: 1px solid #e0e0e6;
  padding: 8px;
  overflow-y: auto;
}

.micro-center {
  flex: 1;
  position: relative;
  min-width: 0;
}

.micro-right {
  flex: 0 0 260px;
  min-width: 0;
  border-left: 1px solid #e0e0e6;
  overflow: hidden;
}

.micro-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
