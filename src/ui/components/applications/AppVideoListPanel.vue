<template>
  <div class="video-list-panel">
    <div class="list-section">
      <div class="list-header">
        <span class="list-title">{{ t('applications.cardEditor.videos') }}</span>
        <n-button size="tiny" type="primary" @click="handleAddVideo" @pointerup="handleAddVideo">
          + {{ t('applications.cardEditor.addVideo') }}
        </n-button>
      </div>
      <div v-if="doc.videos.length === 0" class="empty-hint">
        {{ t('applications.cardEditor.noVideos') }}
      </div>
      <div v-for="video in doc.videos" :key="video.id" class="list-row">
        <span class="row-name" :title="video.name">{{ video.name }}</span>
        <span class="row-actions">
          <n-button size="tiny" @click="handleEditVideo(video.id)" @pointerup="handleEditVideo(video.id)">
            {{ t('applications.listPage.edit') }}
          </n-button>
          <n-button size="tiny" @click="handleAskExport(video)" @pointerup="handleAskExport(video)">
            {{ t('applications.cardEditor.exportVideo') }}
          </n-button>
          <n-button size="tiny" type="error" @click="handleAskDelete(video)" @pointerup="handleAskDelete(video)">
            {{ t('applications.listPage.delete') }}
          </n-button>
        </span>
      </div>
    </div>

    <VideoExportDialog
      v-model:show="showExportDialog"
      :scene-pkg-visible="scenePkgVisible"
      :heic-visible="heicVisible"
      @export="handleExportFormat"
      ref="exportDialogRef"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, useDialog, useMessage } from 'naive-ui'
import { createDebouncedHandler } from '@/utils/debounce-click'
import type { FontLibrary } from '@/features/applications/fontLibraryService'
import type { ICardAppData, IApplicationDocument, IAppVideoDocument } from '@/features/applications/types'
import {
  exportAppVideoToDisk,
  type AppVideoExportFormat,
} from '@/features/applications/export/videoExport'
import VideoExportDialog from './VideoExportDialog.vue'

const props = defineProps<{
  doc: IApplicationDocument
  cardData: ICardAppData
  library: FontLibrary | null
  /** Wallpaper Engine 场景包导出（Phase D 接入） */
  scenePkgVisible?: boolean
  /** macOS 动态壁纸导出（Phase G 接入） */
  heicVisible?: boolean
  /** 自定义格式导出的扩展（scenePkg / heic 等），返回 true 表示已处理 */
  onCustomExport?: (video: IAppVideoDocument, format: string) => Promise<boolean>
}>()

const emit = defineEmits<{
  'add-video': []
  'edit-video': [videoId: string]
}>()

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()

const showExportDialog = ref(false)
const pendingExport = ref<IAppVideoDocument | null>(null)
const exportDialogRef = ref<InstanceType<typeof VideoExportDialog> | null>(null)

const _handleAddVideo = () => {
  emit('add-video')
}
const handleAddVideo = createDebouncedHandler(_handleAddVideo, 'AppVideoListPanel.addVideo')

const _handleEditVideo = (videoId: string) => {
  emit('edit-video', videoId)
}
const handleEditVideo = createDebouncedHandler(_handleEditVideo, 'AppVideoListPanel.editVideo', (args) => args[0])

const _handleAskExport = (video: IAppVideoDocument) => {
  if (!video.name.trim()) {
    message.warning(t('applications.videoEditor.nameRequired'))
    return
  }
  pendingExport.value = video
  showExportDialog.value = true
}
const handleAskExport = createDebouncedHandler(_handleAskExport, 'AppVideoListPanel.askExport', (args) => args[0]?.id)

const _handleAskDelete = (video: IAppVideoDocument) => {
  dialog.warning({
    title: t('applications.listPage.deleteConfirmTitle'),
    content: t('applications.listPage.deleteConfirm'),
    positiveText: t('applications.exportDialog.confirm'),
    negativeText: t('applications.exportDialog.cancel'),
    onPositiveClick: () => {
      const index = props.doc.videos.findIndex((v) => v.id === video.id)
      if (index >= 0) props.doc.videos.splice(index, 1)
    },
  })
}
const handleAskDelete = createDebouncedHandler(_handleAskDelete, 'AppVideoListPanel.askDelete', (args) => args[0]?.id)

const _handleExportFormat = async (format: string) => {
  const video = pendingExport.value
  const library = props.library
  if (!video || !library) return
  try {
    if (format === 'scenePkg' || format === 'heic') {
      if (props.onCustomExport && (await props.onCustomExport(video, format))) {
        exportDialogRef.value?.finish()
      } else {
        exportDialogRef.value?.fail()
      }
      return
    }
    const ok = await exportAppVideoToDisk(
      video,
      props.cardData,
      library,
      format as AppVideoExportFormat,
      (done, total) => exportDialogRef.value?.setProgress(done, total)
    )
    if (ok) message.success(t('applications.exportDialog.success'))
    exportDialogRef.value?.finish()
  } catch (err) {
    message.error(t('applications.exportDialog.failed'))
    if (import.meta.env.DEV) {
      console.error('[applications] video export failed:', err)
    }
    exportDialogRef.value?.fail()
  }
}
const handleExportFormat = createDebouncedHandler(_handleExportFormat, 'AppVideoListPanel.exportFormat', (args) => args[0])
</script>

<style scoped>
.video-list-panel {
  display: flex;
  flex-direction: column;
}

.list-section {
  margin-bottom: 4px;
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
