<template>
  <div class="app-editor-page">
    <header class="app-header">
      <n-button quaternary size="small" class="back-btn" @click="handleBack" @pointerup="handleBack">
        ← {{ t('applications.listPage.back') }}
      </n-button>
      <span class="app-title">{{ t('menus.applications.card') }}</span>
      <span class="header-spacer"></span>
      <n-button type="primary" size="small" :loading="building" @click="handleSave" @pointerup="handleSave">
        {{ t('applications.cardEditor.save') }}
      </n-button>
    </header>

    <div v-if="initializing" class="page-state">
      <n-spin size="large" />
      <p class="page-state-text">{{ t('applications.listPage.loading') }}</p>
    </div>
    <div v-else-if="errorText" class="page-state">
      <p>{{ errorText }}</p>
      <n-button type="primary" size="small" @click="handleOpenEditor" @pointerup="handleOpenEditor">
        {{ t('applications.listPage.openProject') }}
      </n-button>
    </div>

    <main v-else-if="doc && cardData" class="editor-body">
      <AppVideoEditor
        v-if="activeVideo"
        :video="activeVideo"
        :card-data="cardData"
        :library="library"
        :layout-chars="() => videoLayoutChars"
        @back="handleVideoBack"
      />
      <template v-else>
        <aside class="left-panel">
          <div class="panel-section">
            <div class="section-label">{{ t('applications.cardEditor.name') }} *</div>
            <n-input v-model:value="doc.name" size="small" :placeholder="t('applications.cardEditor.name')" />
          </div>

          <div v-if="building" class="panel-section">
            <n-progress type="line" :percentage="progressPercent" :height="6" />
            <span class="progress-text">{{ progressDone }}/{{ progressTotal }}</span>
          </div>

          <div class="panel-section">
            <div class="section-label">{{ t('applications.cardEditor.resolution') }}</div>
            <div class="resolution-row">
              <n-input-number v-model:value="cardData.canvas.width" size="small" :min="1" class="resolution-input" />
              <span class="resolution-sep">×</span>
              <n-input-number v-model:value="cardData.canvas.height" size="small" :min="1" class="resolution-input" />
            </div>
          </div>

          <div class="panel-section">
            <div class="section-label">{{ t('applications.cardEditor.imageExport') }}</div>
            <n-radio-group v-model:value="imageFormat" size="small" class="format-group app-radio-gray app-radio-vertical">
              <n-radio value="png">PNG</n-radio>
              <n-radio value="jpeg">JPEG</n-radio>
              <n-radio v-if="webpSupported" value="webp">WebP</n-radio>
            </n-radio-group>
            <div v-if="imageFormat === 'jpeg'">
              <ParamNumberField v-model:model-value="jpegQuality" :label="t('applications.cardEditor.quality')" :min="0.1" :max="1" :step="0.02" />
            </div>
          </div>

          <div class="panel-section">
            <AppVideoListPanel
              :doc="doc"
              :card-data="cardData"
              :library="library"
              scene-pkg-visible
              :heic-visible="heicExportSupported()"
              :on-custom-export="handleCustomVideoExport"
              @add-video="handleAddVideo"
              @edit-video="handleEditVideo"
            />
            <AppMicroListPanel :doc="doc" :card-data="cardData" :library="library" />
          </div>
        </aside>

        <section class="center-panel">
          <AppCanvasStage
            v-if="library"
            :data="cardData"
            :library="library"
            :editor="canvasEditor"
            :library-version="libraryVersion"
          />
        </section>

        <aside class="right-panel">
          <ComponentPropertiesPanel :editor="canvasEditor" />
          <div class="right-export-bar">
            <n-button
              type="primary"
              size="small"
              block
              :loading="exporting"
              @click="handleExport"
              @pointerup="handleExport"
            >
              {{ t('applications.cardEditor.export') }}
            </n-button>
          </div>
        </aside>
      </template>
    </main>

    <div v-if="building" class="build-overlay">
      <n-spin size="large" />
      <p class="build-text">{{
        buildPhase === 'assembling'
          ? t('applications.cardEditor.assemblingLibrary')
          : t('applications.cardEditor.buildingLibrary')
      }}</p>
      <n-progress type="line" :percentage="progressPercent" :height="6" class="build-progress" />
      <p class="build-count">{{ progressDone }}/{{ progressTotal }}</p>
    </div>

    <AppEntryModal
      v-model:show="showEntryModal"
      v-model:use-last-font="useLastFont"
      @confirm="handleEntryConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/stores/project'
import {
  NButton,
  NInput,
  NInputNumber,
  NProgress,
  NRadio,
  NRadioGroup,
  NSpin,
  useMessage,
} from 'naive-ui'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { useAppEditorPage } from '@/features/applications/useAppEditorPage'
import { closeApplicationWindow } from '@/features/applications/applicationWindowBridge'
import { DEFAULT_CARD_BACKGROUND, DEFAULT_CARD_CANVAS } from '@/features/applications/constants'
import { useAppCanvasEditor } from '@/features/applications/canvas/useAppCanvasEditor'
import { computeLayoutCharOccurrences } from '@/features/applications/canvas/AppCanvasRenderer'
import { exportAppImage, supportsWebp, type AppImageFormat } from '@/features/applications/export/imageExport'
import { createAppVideoDoc } from '@/features/applications/video/videoData'
import type { FontLibrary } from '@/features/applications/fontLibraryService'
import type { ICardAppData, IAppLayoutChar } from '@/features/applications/types'
import AppCanvasStage from '@/ui/components/applications/AppCanvasStage.vue'
import ComponentPropertiesPanel from '@/ui/components/applications/ComponentPropertiesPanel.vue'
import AppEntryModal from '@/ui/components/applications/AppEntryModal.vue'
import AppVideoEditor from '@/ui/components/applications/AppVideoEditor.vue'
import AppVideoListPanel from '@/ui/components/applications/AppVideoListPanel.vue'
import ParamNumberField from '@/ui/components/applications/ParamNumberField.vue'
import AppMicroListPanel from '@/ui/components/applications/AppMicroListPanel.vue'
import { exportScenePkg } from '@/features/applications/export/wallpaperPkgExport'
import { exportMacWallpaperHeic, heicExportSupported } from '@/features/applications/export/heicBridge'
import type { IAppVideoDocument } from '@/features/applications/types'

const { t } = useI18n()
const message = useMessage()
const projectStore = useProjectStore()

const createDefaultData = (): ICardAppData => ({
  canvas: { ...DEFAULT_CARD_CANVAS, background: DEFAULT_CARD_BACKGROUND },
  components: [],
})

const {
  doc,
  initializing,
  building,
  progressDone,
  progressTotal,
  buildPhase,
  errorText,
  libraryVersion,
  showEntryModal,
  useLastFont,
  confirmEntry,
  saveApp,
  backToList,
  getCurrentFontLibrary,
} = useAppEditorPage('card', createDefaultData)

const cardData = computed(() => doc.value?.data as ICardAppData | undefined)
const library = ref<FontLibrary | null>(null)
const imageFormat = ref<AppImageFormat>('png')
const jpegQuality = ref(0.92)
const exporting = ref(false)
const webpSupported = supportsWebp()
const activeVideoId = ref<string | null>(null)

const activeVideo = computed(() =>
  doc.value?.videos.find((v) => v.id === activeVideoId.value) ?? null
)

const canvasEditor = useAppCanvasEditor(() => cardData.value)

/** 解析当前应用布局中字符 → 位置（视频轨位置） */
/** 卡片布局中的全部字符出现（含重复，与视频左侧列表一一对应） */
const videoLayoutChars = computed<IAppLayoutChar[]>(() => {
  const data = cardData.value
  const lib = library.value
  const file = projectStore.selectedFile
  if (!data || !lib || !file) return []
  const measure = document.createElement('canvas')
  const ctx = measure.getContext('2d')!
  const byText = new Map(file.characterList.map((m) => [m.character.text, m]))
  return computeLayoutCharOccurrences(data, ctx, lib.family)
    .filter((o) => o.char.trim() !== '')
    .map((o) => ({ ...o, charUuid: byText.get(o.char)?.uuid ?? null }))
})

const progressPercent = computed(() =>
  progressTotal.value > 0 ? Math.round((progressDone.value / progressTotal.value) * 100) : 0
)

// 字库构建完成后同步到页面（构建期间 libraryVersion 变化触发）
watch(
  libraryVersion,
  () => {
    library.value = getCurrentFontLibrary()
  },
  { immediate: true }
)

const _handleSave = async () => {
  if (!doc.value) return
  if (!doc.value.name.trim()) {
    message.warning(t('applications.cardEditor.nameRequired'))
    return
  }
  // 视频名称必填
  for (const v of doc.value.videos) {
    if (!v.name.trim()) {
      message.warning(t('applications.videoEditor.nameRequired'))
      return
    }
  }
  await saveApp()
}
const handleSave = createDebouncedHandler(_handleSave, 'CardAppEditorPage.save')

const _handleEntryConfirm = () => {
  void confirmEntry()
}
const handleEntryConfirm = createDebouncedHandler(_handleEntryConfirm, 'CardAppEditorPage.entryConfirm')

const _handleBack = () => {
  // 上下文感知：视频编辑中先返回应用编辑页，否则回列表
  if (activeVideoId.value) {
    activeVideoId.value = null
    return
  }
  backToList()
}
const handleBack = createDebouncedHandler(_handleBack, 'CardAppEditorPage.back')

const _handleOpenEditor = () => {
  // 无工程快照：关闭窗口，回到主窗口打开工程
  void closeApplicationWindow()
}
const handleOpenEditor = createDebouncedHandler(_handleOpenEditor, 'CardAppEditorPage.openEditor')

const _handleExport = async () => {
  const data = cardData.value
  const lib = library.value
  if (!data || !lib) return
  const name = doc.value?.name?.trim() || 'card'
  exporting.value = true
  try {
    const ok = await exportAppImage(data, lib, name, imageFormat.value, jpegQuality.value)
    if (ok) message.success(t('applications.cardEditor.exportSuccess'))
  } catch (err) {
    message.error(t('applications.cardEditor.exportFailed'))
    if (import.meta.env.DEV) {
      console.error('[applications] image export failed:', err)
    }
  } finally {
    exporting.value = false
  }
}
const handleExport = createDebouncedHandler(_handleExport, 'CardAppEditorPage.export')

// ---- 视频编辑 ----

const _handleAddVideo = () => {
  if (!doc.value || !cardData.value) return
  const video = createAppVideoDoc('', cardData.value.canvas.width, cardData.value.canvas.height, 30)
  doc.value.videos.push(video)
  activeVideoId.value = video.id
}
const handleAddVideo = createDebouncedHandler(_handleAddVideo, 'CardAppEditorPage.addVideo')

const _handleEditVideo = (videoId: string) => {
  activeVideoId.value = videoId
}
const handleEditVideo = createDebouncedHandler(_handleEditVideo, 'CardAppEditorPage.editVideo', (args) => args[0])

const _handleVideoBack = () => {
  activeVideoId.value = null
}
const handleVideoBack = createDebouncedHandler(_handleVideoBack, 'CardAppEditorPage.videoBack')

// ---- 模板 ----

// ---- 自定义视频导出（scenePkg 等） ----

const _handleCustomVideoExport = async (video: IAppVideoDocument, format: string): Promise<boolean> => {
  const data = cardData.value
  const lib = library.value
  if (!data || !lib) return false
  if (format === 'scenePkg') {
    await exportScenePkg(video, data, lib, { name: video.name, sceneType: 'video' })
    return true
  }
  if (format === 'heic') {
    return exportMacWallpaperHeic(video, data, lib, video.name)
  }
  return false
}
const handleCustomVideoExport = createDebouncedHandler(_handleCustomVideoExport, 'CardAppEditorPage.customVideoExport', (args) => `${args[0]?.id}-${args[1]}`)
</script>

<style scoped>
.app-editor-page {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--dark-1);
  color: #e8eaed;
  box-sizing: border-box;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--dark-4);
  flex-shrink: 0;
}

.app-title {
  font-size: 15px;
  font-weight: 600;
}

.header-spacer {
  flex: 1;
}

.page-state {

.page-state-text {
  font-size: 13px;
  opacity: 0.8;
  margin: 0;
}

  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.editor-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.left-panel {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid var(--dark-4);
  padding: 12px;
  overflow-y: auto;
}

.panel-section {
  margin-bottom: 16px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}

.resolution-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.resolution-input {
  flex: 1;
  min-width: 0;
}

.resolution-sep {
  flex-shrink: 0;
  opacity: 0.7;
}

.param-label {
  font-size: 12px;
  opacity: 0.8;
}

.format-group {
  display: flex;
  flex-wrap: wrap;
}

.center-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--dark-2);
}
.build-overlay {
  position: fixed;
  inset: 0;
  z-index: 150;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(20, 22, 26, 0.72);
  backdrop-filter: blur(2px);
}

.build-text {
  font-size: 13px;
  opacity: 0.85;
  margin: 0;
}

.build-progress {
  width: 320px;
  max-width: 60%;
}

.build-count {
  font-size: 12px;
  opacity: 0.7;
  margin: 0;
  font-variant-numeric: tabular-nums;
}


.right-panel {
  width: 280px;
  flex-shrink: 0;
  border-left: 1px solid var(--dark-4);
  display: flex;
  flex-direction: column;
  padding: 12px;
  min-height: 0;
}

.right-export-bar {
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--dark-4);
  flex-shrink: 0;
}

.progress-text {
  font-size: 12px;
  opacity: 0.7;
}
</style>
