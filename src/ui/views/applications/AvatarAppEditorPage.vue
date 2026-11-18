<template>
  <div class="app-editor-page">
    <header class="app-header">
      <n-button quaternary size="small" class="back-btn" @click="handleBack" @pointerup="handleBack">
        ← {{ t('applications.listPage.back') }}
      </n-button>
      <span class="app-title">{{ t('menus.applications.avatar') }}</span>
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

    <main v-else-if="doc && avatarData" class="editor-body">
      <aside class="left-panel">
        <div class="panel-section">
          <div class="section-label">{{ t('applications.avatarEditor.name') }} *</div>
          <n-input v-model:value="doc.name" size="small" :placeholder="t('applications.avatarEditor.name')" />
        </div>

        <div v-if="building" class="panel-section">
          <n-progress type="line" :percentage="progressPercent" :height="6" />
          <span class="progress-text">{{ progressDone }}/{{ progressTotal }}</span>
        </div>

        <div class="panel-section">
          <div class="section-label">{{ t('applications.avatarEditor.icon') }}</div>
          <n-switch :value="useFontIcon" size="small" @update:value="handleIconModeSwitch">
            <template #checked>{{ t('applications.logoEditor.fontLibraryIcon') }}</template>
            <template #unchecked>{{ t('applications.logoEditor.externalIcon') }}</template>
          </n-switch>
        </div>

        <div v-if="hasIcon" class="panel-section">
          <template v-if="useFontIcon">
            <div class="section-label">{{ t('applications.avatarEditor.iconUnicode') }}</div>
            <n-input v-model:value="iconUnicodeInput" size="small" placeholder="0x1000" />
          </template>
          <template v-else>
            <n-button size="small" @click="handleImportIcon" @pointerup="handleImportIcon">
              {{ t('applications.avatarEditor.importIcon') }}
            </n-button>
            <span v-if="avatarData.iconSource.kind === 'external' && avatarData.iconSource.dataUrl" class="imported-hint">✓</span>
          </template>
        </div>
        <input ref="iconFileInputRef" type="file" accept="image/*,.svg" class="hidden-input" @change="handleIconFileChange" />

        <div class="panel-section">
          <div class="section-label">{{ t('applications.avatarEditor.text') }}（1-4）</div>
          <n-input
            v-model:value="avatarData.text"
            size="small"
            :maxlength="4"
            :show-count="false"
            :placeholder="t('applications.avatarEditor.text')"
          />
        </div>

        <div class="panel-section">
          <div class="section-label">{{ t('applications.avatarEditor.size') }}</div>
          <n-input-number v-model:value="avatarData.size" size="small" :min="64" :max="4096" />
        </div>

        <div class="panel-section">
          <div class="section-label">{{ t('applications.avatarEditor.iconFontSize') }}</div>
          <n-input-number v-model:value="iconFontSize" size="small" :min="1" :max="4096" />
        </div>

        <div class="panel-section">
          <div class="section-label">{{ t('applications.avatarEditor.textFontSize') }}</div>
          <n-input-number v-model:value="textFontSize" size="small" :min="1" :max="4096" />
        </div>

        <div class="panel-section">
          <n-button type="primary" size="small" block :loading="generating" @click="handleGenerate" @pointerup="handleGenerate">
            {{ t('applications.avatarEditor.generate') }}
          </n-button>
        </div>
      </aside>

      <section class="center-panel">
        <div class="avatar-preview-wrap">
          <canvas v-if="resultCanvas" ref="previewCanvasRef" class="avatar-preview-canvas" :style="previewStyle" />
          <div v-else class="canvas-placeholder">
            {{ t('applications.avatarEditor.generate') }}
          </div>
        </div>
      </section>

      <aside class="right-panel">
        <div class="panel-section">
          <div class="section-label">{{ t('applications.avatarEditor.export') }}</div>
          <n-radio-group v-model:value="imageFormat" size="small" class="format-group">
            <n-radio-button value="png">PNG</n-radio-button>
            <n-radio-button value="jpeg">JPEG</n-radio-button>
            <n-radio-button v-if="webpSupported" value="webp">WebP</n-radio-button>
          </n-radio-group>
        </div>
        <div class="right-export-bar">
          <n-button
            type="primary"
            size="small"
            block
            :disabled="!resultCanvas"
            @click="handleExport"
            @pointerup="handleExport"
          >
            {{ t('applications.avatarEditor.export') }}
          </n-button>
        </div>
      </aside>
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
  NSpin,
  NSwitch,
  useMessage,
} from 'naive-ui'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { useProjectStore } from '@/stores/project'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { resolveFontSettings } from '@/features/editor/services/ExportFontService'
import { useAppEditorPage } from '@/features/applications/useAppEditorPage'
import { closeApplicationWindow } from '@/features/applications/applicationWindowBridge'
import { DEFAULT_AVATAR_SIZE } from '@/features/applications/constants'
import {
  buildLogoGlyphRenderable,
  loadCharacterByUnicode,
  normalizeUnicodeInput,
  type LogoGlyphRenderable,
} from '@/features/applications/canvas/renderLogo'
import { composeAvatar } from '@/features/applications/canvas/renderAvatar'
import {
  canvasToBlob,
  saveBlobToDisk,
  sanitizeFilename,
  supportsWebp,
  type AppImageFormat,
} from '@/features/applications/export/imageExport'
import type { IAvatarAppData } from '@/features/applications/types'
import AppEntryModal from '@/ui/components/applications/AppEntryModal.vue'

const { t } = useI18n()
const message = useMessage()
const projectStore = useProjectStore()

const createDefaultData = (): IAvatarAppData => ({
  iconSource: { kind: 'none' },
  text: '',
  size: DEFAULT_AVATAR_SIZE,
  iconFontSize: Math.round(DEFAULT_AVATAR_SIZE * 0.35),
  textFontSize: Math.round(DEFAULT_AVATAR_SIZE * 0.35),
})

/** 图标/文本字号（旧数据缺失时按 size 回退） */
const iconFontSize = computed({
  get: () => avatarData.value?.iconFontSize ?? Math.round((avatarData.value?.size ?? DEFAULT_AVATAR_SIZE) * 0.35),
  set: (v: number) => {
    if (avatarData.value) avatarData.value.iconFontSize = v
  },
})
const textFontSize = computed({
  get: () => avatarData.value?.textFontSize ?? Math.round((avatarData.value?.size ?? DEFAULT_AVATAR_SIZE) * 0.35),
  set: (v: number) => {
    if (avatarData.value) avatarData.value.textFontSize = v
  },
})

const {
  doc,
  initializing,
  building,
  progressDone,
  progressTotal,
  errorText,
  showEntryModal,
  useLastFont,
  confirmEntry,
  saveApp,
  backToList,
} = useAppEditorPage('avatar', createDefaultData, { needsFontLibrary: false })

const avatarData = computed(() => doc.value?.data as IAvatarAppData | undefined)
const useFontIcon = ref(true)
const iconUnicodeInput = ref('')
const generating = ref(false)
const resultCanvas = ref<HTMLCanvasElement | null>(null)
const previewCanvasRef = ref<HTMLCanvasElement | null>(null)
const imageFormat = ref<AppImageFormat>('png')
const webpSupported = supportsWebp()
const iconFileInputRef = ref<HTMLInputElement | null>(null)

const hasIcon = computed(() => avatarData.value?.iconSource.kind !== 'none')

const previewStyle = computed(() => {
  const c = resultCanvas.value
  if (!c) return {}
  const max = 560
  const s = Math.min(max / c.width, max / c.height, 1.5)
  return { width: `${c.width * s}px`, height: `${c.height * s}px` }
})

const progressPercent = computed(() =>
  progressTotal.value > 0 ? Math.round((progressDone.value / progressTotal.value) * 100) : 0
)

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

const _handleIconModeSwitch = (value: boolean) => {
  useFontIcon.value = value
  const data = avatarData.value
  if (!data) return
  if (value) {
    data.iconSource = { kind: 'fontLibrary', unicode: iconUnicodeInput.value || '' }
  } else {
    data.iconSource = { kind: 'external', dataUrl: '', isSvg: false }
  }
}
const handleIconModeSwitch = createDebouncedHandler(_handleIconModeSwitch, 'AvatarAppEditorPage.iconModeSwitch')

const _handleImportIcon = () => {
  iconFileInputRef.value?.click()
}
const handleImportIcon = createDebouncedHandler(_handleImportIcon, 'AvatarAppEditorPage.importIcon')

function handleIconFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const data = avatarData.value
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

async function doGenerate(silent = false) {
  const data = avatarData.value
  const file = projectStore.selectedFile
  if (!data || !file) return
  const text = [...data.text]
  if (text.length === 0 || text.length > 4) {
    if (!silent) message.warning(t('applications.avatarEditor.textLength'))
    return
  }
  const fs = resolveFontSettings(file)
  generating.value = true
  try {
    let icon: LogoGlyphRenderable | null = null
    let iconBlockCanvas: HTMLCanvasElement | null = null

    if (data.iconSource.kind === 'fontLibrary') {
      const normalized = normalizeUnicodeInput(iconUnicodeInput.value || data.iconSource.unicode)
      if (!normalized) {
        if (!silent) message.warning(t('applications.logoEditor.invalidUnicode'))
        return
      }
      const char = await loadCharacterByUnicode(file, normalized)
      if (!char) {
        if (!silent) message.warning(t('applications.avatarEditor.iconNotFound'))
        return
      }
      data.iconSource = { kind: 'fontLibrary', unicode: normalized }
      icon = await buildLogoGlyphRenderable(char, file, fs, false)
    } else if (data.iconSource.kind === 'external' && data.iconSource.dataUrl) {
      const iconDataUrl = data.iconSource.dataUrl
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('icon image load failed'))
        image.src = iconDataUrl
      })
      const blockH = Math.max(1, Math.round(data.size * 0.35))
      const blockW = Math.max(1, Math.round((img.width / img.height) * blockH))
      iconBlockCanvas = document.createElement('canvas')
      iconBlockCanvas.width = blockW
      iconBlockCanvas.height = blockH
      iconBlockCanvas.getContext('2d')!.drawImage(img, 0, 0, blockW, blockH)
    }

    // 文本逐字（按工程字符 text 匹配）
    const textChars = [...new Set(text)]
    const renderables: LogoGlyphRenderable[] = []
    const byChar = new Map<string, LogoGlyphRenderable>()
    for (const ch of textChars) {
      const meta = file.characterList.find((m) => m.character.text === ch)
      const char = meta ? await characterDataManager.loadCharacter(file.uuid, meta.uuid) : null
      const r = await buildLogoGlyphRenderable(char, file, fs, false)
      if (r) byChar.set(ch, r)
    }
    for (const ch of text) {
      const r = byChar.get(ch)
      if (r) renderables.push(r)
    }
    if (renderables.length === 0) {
      if (!silent) message.warning(t('applications.avatarEditor.iconNotFound'))
      return
    }

    resultCanvas.value = composeAvatar({
      iconRenderable: icon,
      iconBlockCanvas,
      textRenderables: renderables,
      text: data.text,
      size: data.size,
      iconFontSize: iconFontSize.value,
      textFontSize: textFontSize.value,
      fs,
    })
  } catch (err) {
    if (!silent) message.error(t('applications.exportDialog.failed'))
    if (import.meta.env.DEV) {
      console.error('[avatar] generate failed:', err)
    }
  } finally {
    generating.value = false
  }
}

const _handleGenerate = () => {
  void doGenerate(false)
}
const handleGenerate = createDebouncedHandler(_handleGenerate, 'AvatarAppEditorPage.generate')

// 打开已有应用：自动重新生成（无需手动点击生成按钮）
watch(
  () => [initializing.value, doc.value?.id] as const,
  ([init, id]) => {
    if (init || !id) return
    const data = avatarData.value
    if (!data) return
    if (data.text.trim() !== '') {
      void doGenerate(true)
    }
  }
)

const _handleExport = async () => {
  const canvas = resultCanvas.value
  if (!canvas) return
  try {
    const blob = await canvasToBlob(canvas, imageFormat.value, 0.92)
    await saveBlobToDisk(blob, `${sanitizeFilename(doc.value?.name || 'avatar')}.${imageFormat.value === 'jpeg' ? 'jpg' : imageFormat.value}`)
    message.success(t('applications.cardEditor.exportSuccess'))
  } catch (err) {
    message.error(t('applications.cardEditor.exportFailed'))
    if (import.meta.env.DEV) {
      console.error('[avatar] export failed:', err)
    }
  }
}
const handleExport = createDebouncedHandler(_handleExport, 'AvatarAppEditorPage.export')

const _handleSave = async () => {
  if (!doc.value) return
  if (!doc.value.name.trim()) {
    message.warning(t('applications.avatarEditor.nameRequired'))
    return
  }
  await saveApp()
}
const handleSave = createDebouncedHandler(_handleSave, 'AvatarAppEditorPage.save')

const _handleEntryConfirm = () => {
  void confirmEntry()
}
const handleEntryConfirm = createDebouncedHandler(_handleEntryConfirm, 'AvatarAppEditorPage.entryConfirm')

const _handleBack = () => {
  backToList()
}
const handleBack = createDebouncedHandler(_handleBack, 'AvatarAppEditorPage.back')

const _handleOpenEditor = () => {
  // 无工程快照：关闭窗口，回到主窗口打开工程
  void closeApplicationWindow()
}
const handleOpenEditor = createDebouncedHandler(_handleOpenEditor, 'AvatarAppEditorPage.openEditor')
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
  position: relative;
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

.avatar-preview-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100vh;
}

.avatar-preview-canvas {
  display: block;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
  border-radius: 8px;
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

.format-group {
  display: flex;
  flex-wrap: wrap;
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
