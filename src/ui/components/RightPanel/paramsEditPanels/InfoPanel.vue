<template>
  <div class="info-panel">
    <!-- 读音释义 section（最上方） -->
    <div class="section">
      <div class="section-title">{{ t('panels.infoPanel.reading.title') }}</div>
      <template v-if="character">
        <div class="char-row">
          <span class="char-display">{{ characterText }}</span>
          <n-tooltip trigger="hover">
            <template #trigger>
              <span class="copy-btn" @click="handleCopyCharacter" @pointerup="handleCopyCharacter">
                <font-awesome-icon :icon="['fas', 'copy']" />
              </span>
            </template>
            {{ t('panels.infoPanel.reading.copy') }}
          </n-tooltip>
        </div>
        <div class="reading-line">
          <span class="reading-label">{{ t('panels.infoPanel.reading.pinyin') }}</span>
          {{ readingPinyin || '—' }}
        </div>
        <div class="reading-line">
          <span class="reading-label">{{ t('panels.infoPanel.reading.definition') }}</span>
          {{ readingDefinition || '—' }}
        </div>
      </template>
      <n-empty v-else :description="t('panels.infoPanel.preview.noCharacter')" />
    </div>

    <!-- 预览 section -->
    <div class="section">
      <div class="section-title">{{ t('panels.infoPanel.preview.title') }}</div>

      <template v-if="character">
        <!-- 字号：与属性面板 param 一致 —— label 居左、浅色，input 与 slider 分两行 -->
        <n-form label-placement="left" size="small">
          <n-form-item :label="t('panels.infoPanel.preview.fontSize')">
            <div style="width: 100%;">
              <n-input-number
                v-model:value="fontSize"
                :min="12"
                :max="200"
                :step="1"
              />
              <n-slider
                v-model:value="fontSize"
                style="margin-top: 6px;"
                :min="12"
                :max="200"
                :step="1"
              />
            </div>
          </n-form-item>
        </n-form>

        <n-checkbox v-model:checked="removeOverlap" class="item-check">
          {{ t('panels.infoPanel.preview.removeOverlap') }}
        </n-checkbox>

        <!-- 字符预览：由单字符 OTF 经 FontFace 加载后按真实字体渲染 -->
        <div class="preview-box">
          <div v-if="building" class="preview-loading">
            <n-spin size="small" />
            <span class="preview-loading-text">{{ t('panels.infoPanel.preview.generating') }}</span>
          </div>
          <div v-else-if="error" class="preview-error">{{ error }}</div>
          <div
            v-else-if="previewFamily"
            class="preview-char"
            :style="{ fontFamily: `'${previewFamily}', sans-serif`, fontSize: `${fontSize}px` }">
            {{ characterText }}
          </div>
        </div>
      </template>

      <n-empty v-else :description="t('panels.infoPanel.preview.noCharacter')" />
    </div>

    <!-- 背景字体 section（仅 Tauri 端支持，需枚举本地系统字体） -->
    <div v-if="showBackgroundFontSection" class="section">
      <div class="section-title">{{ t('panels.infoPanel.backgroundFont.title') }}</div>
      <template v-if="character">
        <n-form label-placement="left" size="small" :label-width="bgLabelWidth">
          <n-form-item :label="t('panels.infoPanel.backgroundFont.enable')">
            <n-switch v-model:value="bgEnabled" />
          </n-form-item>
          <n-form-item :label="t('panels.infoPanel.backgroundFont.scope')">
            <n-space align="center" :size="8">
              <n-switch v-model:value="bgScopeAll" />
              <span class="bg-scope-hint">
                {{ bgScopeAll
                  ? t('panels.infoPanel.backgroundFont.applyToAll')
                  : t('panels.infoPanel.backgroundFont.applyToCurrent') }}
              </span>
            </n-space>
          </n-form-item>
          <n-form-item :label="t('panels.infoPanel.backgroundFont.font')">
            <n-select
              class="bg-font-select"
              v-model:value="bgFontFamily"
              :options="fontOptions"
              :loading="fontLoading"
              filterable
              :placeholder="t('panels.infoPanel.backgroundFont.selectPlaceholder')"
              style="width: 100%"
            />
          </n-form-item>
          <n-form-item :label="t('panels.infoPanel.backgroundFont.fontSize')">
            <div style="width: 100%;">
              <n-input-number
                v-model:value="bgFontSize"
                :min="10"
                :max="100"
                :step="1"
              />
              <n-slider
                v-model:value="bgFontSize"
                style="margin-top: 6px;"
                :min="10"
                :max="100"
                :step="1"
              />
            </div>
          </n-form-item>
        </n-form>
      </template>
      <n-empty v-else :description="t('panels.infoPanel.preview.noCharacter')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSlider, NInputNumber, NCheckbox, NSpin, NEmpty, NForm, NFormItem, NTooltip, NSpace, NSwitch, NSelect, useMessage } from 'naive-ui'
import { useCharacterStore } from '@/stores/character'
import { useProjectStore } from '@/stores/project'
import { buildCharacterPreviewFontBuffer } from '@/features/editor/services/ExportFontService'
import { ensureDictionary, lookupByUnicode, type DictionaryIndex } from '@/features/dictionary/DictionaryService'
import { copyTextToClipboard } from '@/features/dictionary/copyText'
import { isTauri } from '@/utils/env'
import { useBackgroundFontStore, DEFAULT_FONT_SIZE_RATIO } from '@/features/backgroundFont/backgroundFontStore'
import { getSystemFonts } from '@/features/backgroundFont/systemFonts'
import type { ICharacterFileMetadata } from '@/core/types'

const { t, locale } = useI18n()
const characterStore = useCharacterStore()
const projectStore = useProjectStore()
const message = useMessage()

const fontSize = ref(72)
const removeOverlap = ref(false)
const building = ref(false)
const error = ref('')
const previewFamily = ref('')

// ---- 读音释义 ----
const readingPinyin = ref('')
const readingDefinition = ref('')
let dictIndex: DictionaryIndex | null = null
// 防止快速切换字符时旧查询结果覆盖新结果
let readingToken = 0

const loadReading = async () => {
  const ch = character.value
  const token = ++readingToken
  dictIndex = await ensureDictionary()
  if (token !== readingToken) return // 已有更新的查询，丢弃本次结果
  const entry = lookupByUnicode(dictIndex, ch?.character?.unicode ?? '')
  readingPinyin.value = entry?.pinyin?.join('、') ?? ''
  readingDefinition.value = entry?.definitionZh ?? ''
}

// 复制按钮同时绑定 click 与 pointerup，加防抖防止多重触发
let lastCopyTime = 0
const handleCopyCharacter = async () => {
  const now = Date.now()
  if (now - lastCopyTime < 300) return
  lastCopyTime = now
  const ok = await copyTextToClipboard(characterText.value)
  message[ok ? 'success' : 'warning'](
    ok ? t('panels.infoPanel.reading.copySuccess') : t('panels.infoPanel.reading.copyFailed'),
  )
}

// ---- 背景字体（仅 Tauri 端） ----
const showBackgroundFontSection = isTauri()
const backgroundFontStore = useBackgroundFontStore()
const bgEnabled = computed({
  get: () => backgroundFontStore.effective.enabled,
  set: (v: boolean) => backgroundFontStore.setEnabled(v),
})
const bgScopeAll = computed({
  get: () => backgroundFontStore.applyToAll,
  set: (v: boolean) => backgroundFontStore.setApplyToAll(v),
})
const bgFontFamily = computed({
  get: () => backgroundFontStore.effective.fontFamily,
  set: (v: string) => backgroundFontStore.setFontFamily(v),
})
const bgFontSize = computed({
  get: () => backgroundFontStore.effective.fontSizeRatio,
  set: (v: number | null) => backgroundFontStore.setFontSizeRatio(v ?? DEFAULT_FONT_SIZE_RATIO),
})
const fontOptions = ref<Array<{ label: string; value: string }>>([])
const fontLoading = ref(false)
// label 等长对齐：中文 6 字宽约 88px，英文标签较长放宽
const bgLabelWidth = computed(() => (locale.value.startsWith('zh') ? '88px' : '150px'))

onMounted(() => {
  if (!showBackgroundFontSection) return
  fontLoading.value = true
  void getSystemFonts()
    .then((fonts) => {
      // 优先显示中文名，附带英文族名便于搜索
      fontOptions.value = fonts.map((f) => ({
        label: f.display && f.display !== f.family ? `${f.display}（${f.family}）` : f.family,
        value: f.family,
      }))
    })
    .finally(() => {
      fontLoading.value = false
    })
})

// 内存管理：始终只保留当前字符的 FontFace；重建前删除旧 face，组件卸载时再删一次
let activeFace: FontFace | null = null
let familyCounter = 0
// 防止快速切换字符时旧构建结果覆盖新结果
let buildToken = 0

const character = computed(() => characterStore.editingCharacter)
const characterText = computed(() => character.value?.character?.text ?? '')

const cleanupFace = () => {
  if (activeFace && document.fonts?.delete) {
    try {
      document.fonts.delete(activeFace)
    } catch {
      /* ignore */
    }
  }
  activeFace = null
}

const rebuild = async () => {
  cleanupFace()
  previewFamily.value = ''
  error.value = ''

  const ch = character.value
  const file = projectStore.selectedFile
  if (!ch || !file) return

  const meta = (file.characterList || []).find(
    (m) => m?.uuid === characterStore.editingCharacterUUID,
  )
  if (!meta) return

  const token = ++buildToken
  building.value = true
  try {
    const buffer = await buildCharacterPreviewFontBuffer(
      file,
      meta as ICharacterFileMetadata,
      ch,
      removeOverlap.value,
    )
    if (token !== buildToken) return // 已有更新的构建，丢弃本次结果

    const family = `fp-preview-${++familyCounter}`
    const face = new FontFace(family, buffer)
    await face.load()
    if (token !== buildToken) return

    document.fonts?.add(face)
    activeFace = face
    previewFamily.value = family
  } catch (e) {
    if (token !== buildToken) return
    if (import.meta.env.DEV) {
      console.warn('[InfoPanel] preview font build failed:', e)
    }
    error.value =
      (e as Error)?.message === 'Character has no valid unicode'
        ? t('panels.infoPanel.preview.invalidUnicode')
        : t('panels.infoPanel.preview.buildFailed')
  } finally {
    if (token === buildToken) {
      building.value = false
    }
  }
}

// 切换字符 / 切换去除重叠 / 字体设置变化时重建字体；字号变化只改 CSS 不重建
watch(
  () => characterStore.editingCharacter?.uuid,
  () => {
    void rebuild()
    void loadReading()
  },
  { immediate: true },
)
watch(removeOverlap, () => {
  void rebuild()
})
watch(
  () => JSON.stringify(projectStore.selectedFile?.fontSettings ?? null),
  () => {
    void rebuild()
  },
)

onUnmounted(() => {
  cleanupFace()
})
</script>

<style scoped>
.info-panel {
  padding: 8px 12px;
  height: 100%;
  overflow-y: auto;
}

.char-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.char-display {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.2;
}

.copy-btn {
  cursor: pointer;
  font-size: 14px;
  color: #888;
  display: inline-flex;
  align-items: center;
}

.copy-btn:hover {
  color: var(--primary-0);
}

.reading-line {
  font-size: 13px;
  color: var(--light-4);
  margin: 2px 0;
  line-height: 1.5;
}

.reading-label {
  color: #999;
  margin-right: 4px;
}
.bg-scope-hint {
  font-size: 12px;
  color: var(--light-4);
}
/* placeholder 加深（main.css 全局规则为 primary-5 浅色，此处用更高优先级覆盖） */
.bg-font-select :deep(.n-base-selection-placeholder) {
  color: var(--light-5) !important;
}
.section {
  margin-bottom: 20px;
}
.item-check {
  margin-bottom: 12px;
}
.preview-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  border: 1px solid var(--dark-4);
  border-radius: 4px;
  background-color: var(--dark-1);
  overflow: hidden;
  position: relative;
}
.preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.preview-loading-text {
  font-size: 12px;
  color: var(--light-3);
}
.preview-error {
  font-size: 12px;
  color: #d03050;
  padding: 0 16px;
  text-align: center;
}
.preview-char {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 220px;
  padding: 12px;
  box-sizing: border-box;
  line-height: 1;
  color: var(--light-0);
  white-space: nowrap;
}
</style>
