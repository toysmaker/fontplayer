<template>
  <div class="app-editor-page">
    <header class="app-header">
      <n-button quaternary size="small" class="back-btn" @click="handleBack" @pointerup="handleBack">
        ← {{ t('applications.listPage.back') }}
      </n-button>
      <span class="app-title">{{ t('menus.applications.logo') }}</span>
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

    <main v-else-if="doc && logoData" class="editor-body">
      <AppVideoEditor
        v-if="activeVideo && videoCardData"
        :video="activeVideo"
        :card-data="videoCardData"
        :library="library"
        :layout-chars="() => videoLayoutChars"
        @back="handleVideoBack"
      />
      <template v-else>
        <aside class="left-panel">
          <div class="panel-section">
            <div class="section-label">{{ t('applications.logoEditor.name') }} *</div>
            <n-input v-model:value="doc.name" size="small" :placeholder="t('applications.logoEditor.name')" />
          </div>

          <div v-if="building" class="panel-section">
            <n-progress type="line" :percentage="progressPercent" :height="6" />
            <span class="progress-text">{{ progressDone }}/{{ progressTotal }}</span>
          </div>

          <div class="panel-section">
            <div class="section-label">{{ t('applications.logoEditor.iconSource') }}</div>
            <n-switch
              :value="useFontLibraryIcon"
              size="small"
              @update:value="handleIconSourceSwitch"
            >
              <template #checked>{{ t('applications.logoEditor.fontLibraryIcon') }}</template>
              <template #unchecked>{{ t('applications.logoEditor.externalIcon') }}</template>
            </n-switch>
          </div>

          <div v-if="useFontLibraryIcon" class="panel-section">
            <div class="section-label">{{ t('applications.logoEditor.iconUnicode') }}</div>
            <n-input v-model:value="iconUnicodeInput" size="small" placeholder="0x1000" />
          </div>
          <div v-else class="panel-section">
            <div class="section-label">{{ t('applications.logoEditor.importIcon') }}</div>
            <n-button size="small" @click="handleImportIcon" @pointerup="handleImportIcon">
              {{ t('applications.logoEditor.importIcon') }}
            </n-button>
            <span v-if="logoData.iconSource.kind === 'external' && logoData.iconSource.dataUrl" class="imported-hint">✓</span>
          </div>
          <input ref="iconFileInputRef" type="file" accept="image/*,.svg" class="hidden-input" @change="handleIconFileChange" />

          <div class="panel-section">
            <div class="section-label">{{ t('applications.logoEditor.logoText') }} *</div>
            <n-input v-model:value="logoData.text" size="small" :placeholder="t('applications.logoEditor.logoText')" />
          </div>

          <div class="panel-section">
            <div class="param-grid">
              <span class="param-label">{{ t('applications.logoEditor.iconFontSize') }}</span>
              <n-input-number v-model:value="logoData.iconFontSize" size="small" :min="1" />
              <span class="param-label">{{ t('applications.logoEditor.textFontSize') }}</span>
              <n-input-number v-model:value="logoData.textFontSize" size="small" :min="1" />
            </div>
          </div>

          <div class="panel-section">
            <div class="section-label">{{ t('applications.logoEditor.colorMode') }}</div>
            <n-switch
              :value="logoData.mode === 'color'"
              size="small"
              @update:value="handleModeSwitch"
            >
              <template #checked>{{ t('applications.logoEditor.color') }}</template>
              <template #unchecked>{{ t('applications.logoEditor.mono') }}</template>
            </n-switch>
          </div>

          <div class="panel-section">
            <div class="section-label">{{ t('applications.logoEditor.layout') }}</div>
            <n-select
              v-model:value="logoData.layout"
              size="small"
              :options="layoutOptions"
            />
          </div>

          <div class="panel-section">
            <n-button type="primary" size="small" block :loading="generating" @click="handleGenerate" @pointerup="handleGenerate">
              {{ t('applications.logoEditor.generate') }}
            </n-button>
          </div>

          <div v-if="logoData.layoutBlocks" class="panel-section">
            <div class="section-label">{{ t('applications.logoEditor.exportImage') }}</div>
            <n-radio-group v-model:value="imageFormat" size="small" class="format-group">
              <n-radio-button value="png">PNG</n-radio-button>
              <n-radio-button value="jpeg">JPEG</n-radio-button>
              <n-radio-button v-if="webpSupported" value="webp">WebP</n-radio-button>
            </n-radio-group>
          </div>

          <div v-if="logoData.layoutBlocks" class="panel-section">
            <AppVideoListPanel
              :doc="doc"
              :card-data="videoCardData!"
              :library="library"
              @add-video="handleAddVideo"
              @edit-video="handleEditVideo"
            />
            <AppMicroListPanel :doc="doc" :card-data="videoCardData!" :library="library" />
          </div>
        </aside>

        <section class="center-panel">
          <div class="logo-preview-wrap">
            <canvas
              v-if="resultCanvas"
              ref="previewCanvasRef"
              class="logo-preview-canvas"
              :style="previewStyle"
            />
            <div v-else class="canvas-placeholder">
              {{ t('applications.logoEditor.generate') }}
            </div>
          </div>
        </section>

        <aside class="right-panel">
          <div class="panel-section">
            <div class="section-label">{{ t('applications.logoEditor.exportImage') }} / {{ t('applications.logoEditor.exportSvg') }}</div>
            <p v-if="!logoData.layoutBlocks" class="placeholder-hint">
              {{ t('applications.logoEditor.generate') }}
            </p>
          </div>
          <div class="right-export-bar">
            <n-button type="primary" size="small" block :disabled="!logoData.layoutBlocks" @click="handleExportImage" @pointerup="handleExportImage">
              {{ t('applications.logoEditor.exportImage') }}
            </n-button>
            <n-button size="small" block :disabled="!logoData.layoutBlocks" style="margin-top: 6px" @click="handleExportSvg" @pointerup="handleExportSvg">
              {{ t('applications.logoEditor.exportSvg') }}
            </n-button>
          </div>
        </aside>
      </template>
    </main>
    <div v-if="building" class="build-overlay">
      <n-spin size="large" />
      <p class="build-text">{{ t('applications.cardEditor.buildingLibrary') }}</p>
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
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NInput,
  NInputNumber,
  NProgress,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSpin,
  NSwitch,
  useMessage,
} from 'naive-ui'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { unicodeToHexString } from '@/utils/unicode'
import { useProjectStore } from '@/stores/project'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { resolveFontSettings } from '@/features/editor/services/ExportFontService'
import { useAppEditorPage } from '@/features/applications/useAppEditorPage'
import { closeApplicationWindow } from '@/features/applications/applicationWindowBridge'
import { DEFAULT_LOGO_ICON_FONT_SIZE, DEFAULT_LOGO_TEXT_FONT_SIZE } from '@/features/applications/constants'
import {
  buildLogoGlyphRenderable,
  composeLogo,
  loadCharacterByUnicode,
  logoLayoutToCardData,
  normalizeUnicodeInput,
  type LogoGlyphRenderable,
} from '@/features/applications/canvas/renderLogo'
import { computeLayoutCharOccurrences } from '@/features/applications/canvas/AppCanvasRenderer'
import {
  canvasToBlob,
  saveBlobToDisk,
  sanitizeFilename,
  supportsWebp,
  type AppImageFormat,
} from '@/features/applications/export/imageExport'
import { buildLogoSvg, exportLogoSvgToDisk } from '@/features/applications/export/svgExport'
import { createAppVideoDoc } from '@/features/applications/video/videoData'
import type { FontLibrary } from '@/features/applications/fontLibraryService'
import type { ICardAppData, IAppLayoutChar, ILogoAppData } from '@/features/applications/types'
import AppVideoEditor from '@/ui/components/applications/AppVideoEditor.vue'
import AppEntryModal from '@/ui/components/applications/AppEntryModal.vue'
import AppVideoListPanel from '@/ui/components/applications/AppVideoListPanel.vue'
import AppMicroListPanel from '@/ui/components/applications/AppMicroListPanel.vue'

const { t } = useI18n()
const message = useMessage()
const projectStore = useProjectStore()

const createDefaultData = (): ILogoAppData => ({
  iconSource: { kind: 'fontLibrary', unicode: '' },
  text: '',
  iconFontSize: DEFAULT_LOGO_ICON_FONT_SIZE,
  textFontSize: DEFAULT_LOGO_TEXT_FONT_SIZE,
  mode: 'mono',
  layout: 'leftRight',
  canvas: { width: 0, height: 0 },
  layoutBlocks: null,
})

const {
  doc,
  initializing,
  building,
  progressDone,
  progressTotal,
  errorText,
  libraryVersion,
  showEntryModal,
  useLastFont,
  confirmEntry,
  saveApp,
  backToList,
  getCurrentFontLibrary,
} = useAppEditorPage('logo', createDefaultData)

const logoData = computed(() => doc.value?.data as ILogoAppData | undefined)
const library = ref<FontLibrary | null>(null)
const useFontLibraryIcon = computed(() => logoData.value?.iconSource.kind === 'fontLibrary')
const iconUnicodeInput = ref('')
const generating = ref(false)
const resultCanvas = ref<HTMLCanvasElement | null>(null)
const iconRenderable = ref<LogoGlyphRenderable | null>(null)
const iconBlockCanvas = ref<HTMLCanvasElement | null>(null)
const textRenderables = ref<LogoGlyphRenderable[]>([])
const imageFormat = ref<AppImageFormat>('png')
const webpSupported = supportsWebp()
const activeVideoId = ref<string | null>(null)
const previewCanvasRef = ref<HTMLCanvasElement | null>(null)
const iconFileInputRef = ref<HTMLInputElement | null>(null)

const activeVideo = computed(() => doc.value?.videos.find((v) => v.id === activeVideoId.value) ?? null)
const videoCardData = computed<ICardAppData | null>(() =>
  logoData.value ? logoLayoutToCardData(logoData.value) : null
)

const layoutOptions = computed(() => [
  { label: t('applications.logoEditor.leftRight'), value: 'leftRight' },
  { label: t('applications.logoEditor.topBottom'), value: 'topBottom' },
])

const previewStyle = computed(() => {
  const c = resultCanvas.value
  if (!c) return {}
  const maxW = 900
  const maxH = 560
  const s = Math.min(maxW / c.width, maxH / c.height, 1.5)
  return { width: `${c.width * s}px`, height: `${c.height * s}px` }
})

const progressPercent = computed(() =>
  progressTotal.value > 0 ? Math.round((progressDone.value / progressTotal.value) * 100) : 0
)

watch(libraryVersion, () => {
  library.value = getCurrentFontLibrary()
}, { immediate: true })

/** 把离屏生成结果绘制到中间预览画布（生成后同步） */
async function syncPreviewCanvas() {
  await nextTick()
  const preview = previewCanvasRef.value
  const src = resultCanvas.value
  if (!preview || !src) return
  preview.width = src.width
  preview.height = src.height
  preview.getContext('2d')!.drawImage(src, 0, 0)
}

watch(resultCanvas, () => {
  void syncPreviewCanvas()
})

// 编辑已有应用：恢复 icon unicode 输入框
watch(
  () => doc.value?.id,
  () => {
    const data = logoData.value
    if (data?.iconSource.kind === 'fontLibrary') iconUnicodeInput.value = data.iconSource.unicode
  }
)

/** Logo 布局中的全部字符出现（图标+文本逐字，与视频左侧列表一一对应） */
const videoLayoutChars = computed<IAppLayoutChar[]>(() => {
  const data = videoCardData.value
  const lib = library.value
  const file = projectStore.selectedFile
  if (!data || !lib || !file) return []
  const measure = document.createElement('canvas')
  const ctx = measure.getContext('2d')!
  const byText = new Map(file.characterList.map((m) => [m.character.text, m]))
  const byUnicode = new Map(file.characterList.map((m) => [unicodeToHexString(m.character.unicode), m]))
  return computeLayoutCharOccurrences(data, ctx, lib.family)
    .filter((o) => o.char.trim() !== '')
    .map((o) => {
      const unicode = `U+${(o.char.codePointAt(0) ?? 0).toString(16).toUpperCase()}`
      return { ...o, charUuid: byText.get(o.char)?.uuid ?? byUnicode.get(unicode)?.uuid ?? null }
    })
})

async function doGenerate(silent = false) {
  const data = logoData.value
  const file = projectStore.selectedFile
  if (!data || !file) return
  if (!data.text.trim()) {
    if (!silent) message.warning(t('applications.logoEditor.textRequired'))
    return
  }
  const fs = resolveFontSettings(file)
  generating.value = true
  try {
    let icon: LogoGlyphRenderable | null = null
    let externalIconCanvas: HTMLCanvasElement | null = null
    if (data.iconSource.kind === 'fontLibrary') {
      const normalized = normalizeUnicodeInput(iconUnicodeInput.value || data.iconSource.unicode)
      if (!normalized) {
        if (!silent) message.warning(t('applications.logoEditor.invalidUnicode'))
        return
      }
      const char = await loadCharacterByUnicode(file, normalized)
      if (!char) {
        if (!silent) message.warning(t('applications.logoEditor.iconNotFound'))
        return
      }
      data.iconSource = { kind: 'fontLibrary', unicode: normalized }
      icon = await buildLogoGlyphRenderable(char, file, fs, data.mode === 'color')
    } else if (data.iconSource.dataUrl) {
      // 外部图标：加载图片，按 iconFontSize 高度等比缩放为块画布
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('icon image load failed'))
        image.src = data.iconSource.kind === 'external' ? data.iconSource.dataUrl : ''
      })
      const blockH = Math.max(1, Math.round(data.iconFontSize))
      const blockW = Math.max(1, Math.round((img.width / img.height) * blockH))
      externalIconCanvas = document.createElement('canvas')
      externalIconCanvas.width = blockW
      externalIconCanvas.height = blockH
      externalIconCanvas.getContext('2d')!.drawImage(img, 0, 0, blockW, blockH)
    }

    // 文本逐字（按工程字符 text 匹配，去重）
    const textChars = [...new Set([...data.text])]
    const renderables: LogoGlyphRenderable[] = []
    for (const ch of textChars) {
      const meta = file.characterList.find((m) => m.character.text === ch)
      const char = meta ? await characterDataManager.loadCharacter(file.uuid, meta.uuid) : null
      const r = await buildLogoGlyphRenderable(char, file, fs, data.mode === 'color')
      if (r) renderables.push(r)
    }
    if (renderables.length === 0) {
      if (!silent) message.warning(t('applications.logoEditor.iconNotFound'))
      return
    }
    // composeLogo 按 data.text 顺序取 renderable；重建与 text 顺序一致的数组
    const ordered: LogoGlyphRenderable[] = []
    const byChar = new Map(textChars.map((ch, i) => [ch, renderables[i]]))
    for (const ch of data.text) {
      const r = byChar.get(ch)
      if (r) ordered.push(r)
    }

    const result = composeLogo({ iconRenderable: icon, iconBlockCanvas: externalIconCanvas, textRenderables: ordered, data, fs })
    iconRenderable.value = icon
    iconBlockCanvas.value = externalIconCanvas
    textRenderables.value = ordered
    resultCanvas.value = result.canvas
    data.canvas = { width: result.canvas.width, height: result.canvas.height }

    // 固化布局块（视频合成 / SVG 复现）
    const iconChar = data.iconSource.kind === 'fontLibrary'
      ? String.fromCodePoint(parseInt(data.iconSource.unicode.replace(/^U\+/i, ''), 16))
      : ''
    data.layoutBlocks = {
      totalW: result.layout.totalW,
      totalH: result.layout.totalH,
      iconBlock: result.layout.iconBlock
        ? { char: iconChar, ...result.layout.iconBlock, fontSize: data.iconFontSize }
        : null,
      textBlocks: result.layout.textBlocks.map((tb) => ({
        char: tb.char,
        x: tb.x,
        y: tb.y,
        width: tb.width,
        height: tb.height,
        fontSize: data.textFontSize,
      })),
    }
  } catch (err) {
    if (!silent) message.error(t('applications.exportDialog.failed'))
    if (import.meta.env.DEV) {
      console.error('[logo] generate failed:', err)
    }
  } finally {
    generating.value = false
  }
}

const _handleGenerate = () => {
  void doGenerate(false)
}
const handleGenerate = createDebouncedHandler(_handleGenerate, 'LogoAppEditorPage.generate')

// 打开已有应用：自动重新生成（无需手动点击生成按钮）
watch(
  () => [initializing.value, doc.value?.id] as const,
  ([init, id]) => {
    if (init || !id) return
    const data = logoData.value
    if (!data) return
    if (data.layoutBlocks !== null || data.text.trim() !== '') {
      void doGenerate(true)
    }
  }
)

const _handleIconSourceSwitch = (value: boolean) => {
  const data = logoData.value
  if (!data) return
  data.iconSource = value
    ? { kind: 'fontLibrary', unicode: iconUnicodeInput.value }
    : { kind: 'external', dataUrl: '', isSvg: false }
}
const handleIconSourceSwitch = createDebouncedHandler(_handleIconSourceSwitch, 'LogoAppEditorPage.iconSourceSwitch')

const _handleModeSwitch = (value: boolean) => {
  const data = logoData.value
  if (!data) return
  data.mode = value ? 'color' : 'mono'
}
const handleModeSwitch = createDebouncedHandler(_handleModeSwitch, 'LogoAppEditorPage.modeSwitch')

const _handleImportIcon = () => {
  iconFileInputRef.value?.click()
}
const handleImportIcon = createDebouncedHandler(_handleImportIcon, 'LogoAppEditorPage.importIcon')

function handleIconFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const data = logoData.value
  if (!file || !data) return
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      data.iconSource = {
        kind: 'external',
        dataUrl: reader.result,
        isSvg: file.name.toLowerCase().endsWith('.svg'),
      }
    }
  }
  reader.readAsDataURL(file)
}

const _handleExportImage = async () => {
  const canvas = resultCanvas.value
  if (!canvas) return
  try {
    const blob = await canvasToBlob(canvas, imageFormat.value, 0.92)
    await saveBlobToDisk(blob, `${sanitizeFilename(doc.value?.name || 'logo')}.${imageFormat.value === 'jpeg' ? 'jpg' : imageFormat.value}`)
    message.success(t('applications.cardEditor.exportSuccess'))
  } catch (err) {
    message.error(t('applications.cardEditor.exportFailed'))
    if (import.meta.env.DEV) {
      console.error('[logo] image export failed:', err)
    }
  }
}
const handleExportImage = createDebouncedHandler(_handleExportImage, 'LogoAppEditorPage.exportImage')

const _handleExportSvg = async () => {
  const data = logoData.value
  const file = projectStore.selectedFile
  if (!data || !file) return
  try {
    const fs = resolveFontSettings(file)
    const svg = buildLogoSvg({
      iconRenderable: iconRenderable.value,
      iconBlockCanvas: iconBlockCanvas.value,
      textRenderables: textRenderables.value,
      data,
      fs: { unitsPerEm: fs.unitsPerEm, ascender: fs.ascender ?? 800, descender: fs.descender ?? -200 },
      monoColor: '#000000',
    })
    await exportLogoSvgToDisk(svg, doc.value?.name || 'logo')
    message.success(t('applications.cardEditor.exportSuccess'))
  } catch (err) {
    message.error(t('applications.cardEditor.exportFailed'))
    if (import.meta.env.DEV) {
      console.error('[logo] svg export failed:', err)
    }
  }
}
const handleExportSvg = createDebouncedHandler(_handleExportSvg, 'LogoAppEditorPage.exportSvg')

const _handleSave = async () => {
  if (!doc.value) return
  if (!doc.value.name.trim()) {
    message.warning(t('applications.logoEditor.nameRequired'))
    return
  }
  for (const v of doc.value.videos) {
    if (!v.name.trim()) {
      message.warning(t('applications.videoEditor.nameRequired'))
      return
    }
  }
  // 彩色模式保存彩色字体
  await saveApp(logoData.value?.mode === 'color')
}
const handleSave = createDebouncedHandler(_handleSave, 'LogoAppEditorPage.save')

const _handleEntryConfirm = () => {
  void confirmEntry()
}
const handleEntryConfirm = createDebouncedHandler(_handleEntryConfirm, 'LogoAppEditorPage.entryConfirm')

const _handleBack = () => {
  // 上下文感知：视频编辑中先返回应用编辑页，否则回列表
  if (activeVideoId.value) {
    activeVideoId.value = null
    return
  }
  backToList()
}
const handleBack = createDebouncedHandler(_handleBack, 'LogoAppEditorPage.back')

const _handleOpenEditor = () => {
  // 无工程快照：关闭窗口，回到主窗口打开工程
  void closeApplicationWindow()
}
const handleOpenEditor = createDebouncedHandler(_handleOpenEditor, 'LogoAppEditorPage.openEditor')

const _handleAddVideo = () => {
  if (!doc.value || !videoCardData.value) {
    message.warning(t('applications.logoEditor.generate'))
    return
  }
  const v = createAppVideoDoc('', videoCardData.value.canvas.width, videoCardData.value.canvas.height, 30)
  doc.value.videos.push(v)
  activeVideoId.value = v.id
}
const handleAddVideo = createDebouncedHandler(_handleAddVideo, 'LogoAppEditorPage.addVideo')

const _handleEditVideo = (videoId: string) => {
  activeVideoId.value = videoId
}
const handleEditVideo = createDebouncedHandler(_handleEditVideo, 'LogoAppEditorPage.editVideo', (args) => args[0])

const _handleVideoBack = () => {
  activeVideoId.value = null
}
const handleVideoBack = createDebouncedHandler(_handleVideoBack, 'LogoAppEditorPage.videoBack')
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

.param-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: center;
}

.param-label {
  font-size: 12px;
  opacity: 0.8;
}

.format-group {
  display: flex;
  flex-wrap: wrap;
}

.imported-hint {
  margin-left: 8px;
  color: #4caf50;
}

.hidden-input {
  display: none;
}

.center-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--dark-2);
  padding: 20px;
  position: relative;
  box-sizing: border-box;
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


.logo-preview-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100vh;
}

.logo-preview-canvas {
  display: block;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}

.canvas-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--dark-4);
  border-radius: 8px;
  width: 60%;
  height: 60%;
  opacity: 0.5;
}

.right-panel {
  width: 240px;
  flex-shrink: 0;
  border-left: 1px solid var(--dark-4);
  display: flex;
  flex-direction: column;
  padding: 12px;
  min-height: 0;
}

.placeholder-hint {
  font-size: 12px;
  opacity: 0.5;
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
