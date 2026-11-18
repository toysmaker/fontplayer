<template>
  <div class="micro-list-panel">
    <div class="list-header">
      <span class="list-title">{{ t('applications.cardEditor.micros') }}</span>
      <n-button size="tiny" type="primary" @click="handleAdd" @pointerup="handleAdd">
        + {{ t('applications.cardEditor.addMicro') }}
      </n-button>
    </div>
    <div v-if="doc.micros.length === 0" class="empty-hint">
      {{ t('applications.cardEditor.noMicros') }}
    </div>
    <div v-for="micro in doc.micros" :key="micro.id" class="list-row">
      <span class="row-name" :title="micro.name">{{ micro.name }}</span>
      <span class="row-actions">
        <n-button size="tiny" @click="handleEdit(micro.id)" @pointerup="handleEdit(micro.id)">
          {{ t('applications.listPage.edit') }}
        </n-button>
        <n-button size="tiny" @click="handleExport(micro)" @pointerup="handleExport(micro)">
          {{ t('applications.microEditor.export') }}
        </n-button>
        <n-button size="tiny" type="error" @click="handleAskDelete(micro)" @pointerup="handleAskDelete(micro)">
          {{ t('applications.listPage.delete') }}
        </n-button>
      </span>
    </div>

    <AppMicroEditorDialog
      v-model:show="showEditor"
      :doc="doc"
      :card-data="cardData"
      :library="library"
      :editing-micro-id="editingMicroId"
      @saved="handleSaved"
    />

    <n-modal
      v-model:show="showExportFormat"
      preset="dialog"
      :title="t('applications.exportDialog.title')"
      :show-icon="false"
    >
      <n-radio-group v-model:value="exportFormat" size="small">
        <n-radio-button value="json">JSON</n-radio-button>
        <n-radio-button value="html">{{ t('applications.exportDialog.html') }}</n-radio-button>
      </n-radio-group>
      <template #action>
        <n-button size="small" @click="handleExportCancel" @pointerup="handleExportCancel">
          {{ t('applications.exportDialog.cancel') }}
        </n-button>
        <n-button size="small" type="primary" @click="handleExportConfirm" @pointerup="handleExportConfirm">
          {{ t('applications.exportDialog.confirm') }}
        </n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NModal, NRadioButton, NRadioGroup, useDialog, useMessage } from 'naive-ui'
import { createDebouncedHandler } from '@/utils/debounce-click'
import type { FontLibrary } from '@/features/applications/fontLibraryService'
import type {
  ICardAppData,
  IApplicationDocument,
  IAppMicroDocument,
} from '@/features/applications/types'
import {
  exportAppMicroFile,
  exportAppMicroPlayerPage,
} from '@/features/applications/export/microExport'
import AppMicroEditorDialog from './AppMicroEditorDialog.vue'

const props = defineProps<{
  doc: IApplicationDocument
  cardData: ICardAppData
  library: FontLibrary | null
}>()

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()

const showEditor = ref(false)
const editingMicroId = ref<string | null>(null)
const showExportFormat = ref(false)
const exportFormat = ref<'json' | 'html'>('json')
const pendingExport = ref<IAppMicroDocument | null>(null)

const _handleAdd = () => {
  if (props.doc.videos.length === 0) {
    message.warning(t('applications.cardEditor.noVideos'))
    return
  }
  editingMicroId.value = null
  showEditor.value = true
}
const handleAdd = createDebouncedHandler(_handleAdd, 'AppMicroListPanel.add')

const _handleEdit = (id: string) => {
  editingMicroId.value = id
  showEditor.value = true
}
const handleEdit = createDebouncedHandler(_handleEdit, 'AppMicroListPanel.edit', (args) => args[0])

const _handleSaved = (micro: IAppMicroDocument) => {
  const index = props.doc.micros.findIndex((m) => m.id === micro.id)
  if (index >= 0) props.doc.micros[index] = micro
  else props.doc.micros.push(micro)
  message.success(t('applications.cardEditor.saved'))
}
const handleSaved = createDebouncedHandler(_handleSaved, 'AppMicroListPanel.saved')

const _handleExport = (micro: IAppMicroDocument) => {
  pendingExport.value = micro
  exportFormat.value = 'json'
  showExportFormat.value = true
}
const handleExport = createDebouncedHandler(_handleExport, 'AppMicroListPanel.export', (args) => args[0]?.id)

const _handleExportConfirm = () => {
  const micro = pendingExport.value
  const library = props.library
  showExportFormat.value = false
  if (!micro || !library) return
  try {
    if (exportFormat.value === 'json') {
      exportAppMicroFile(micro.micro, props.doc.videos, props.cardData, library)
    } else {
      exportAppMicroPlayerPage(micro.micro, props.doc.videos, props.cardData, library)
    }
    message.success(t('applications.exportDialog.success'))
  } catch (err) {
    message.error(t('applications.exportDialog.failed'))
    if (import.meta.env.DEV) {
      console.error('[applications] micro export failed:', err)
    }
  } finally {
    pendingExport.value = null
  }
}
const handleExportConfirm = createDebouncedHandler(_handleExportConfirm, 'AppMicroListPanel.exportConfirm')

const _handleExportCancel = () => {
  showExportFormat.value = false
  pendingExport.value = null
}
const handleExportCancel = createDebouncedHandler(_handleExportCancel, 'AppMicroListPanel.exportCancel')

const _handleAskDelete = (micro: IAppMicroDocument) => {
  dialog.warning({
    title: t('applications.listPage.deleteConfirmTitle'),
    content: t('applications.listPage.deleteConfirm'),
    positiveText: t('applications.exportDialog.confirm'),
    negativeText: t('applications.exportDialog.cancel'),
    onPositiveClick: () => {
      const index = props.doc.micros.findIndex((m) => m.id === micro.id)
      if (index >= 0) props.doc.micros.splice(index, 1)
    },
  })
}
const handleAskDelete = createDebouncedHandler(_handleAskDelete, 'AppMicroListPanel.askDelete', (args) => args[0]?.id)
</script>

<style scoped>
.micro-list-panel {
  display: flex;
  flex-direction: column;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.list-title {
  font-size: 13px;
  font-weight: 600;
}

.list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid var(--dark-4);
  border-radius: 6px;
  margin-bottom: 6px;
}

.row-name {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.row-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.empty-hint {
  font-size: 12px;
  opacity: 0.5;
  margin-bottom: 8px;
}
</style>
