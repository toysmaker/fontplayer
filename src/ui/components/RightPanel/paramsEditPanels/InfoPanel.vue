<template>
  <div class="info-panel">
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSlider, NInputNumber, NCheckbox, NSpin, NEmpty, NForm, NFormItem } from 'naive-ui'
import { useCharacterStore } from '@/stores/character'
import { useProjectStore } from '@/stores/project'
import { buildCharacterPreviewFontBuffer } from '@/features/editor/services/ExportFontService'
import type { ICharacterFileMetadata } from '@/core/types'

const { t } = useI18n()
const characterStore = useCharacterStore()
const projectStore = useProjectStore()

const fontSize = ref(72)
const removeOverlap = ref(false)
const building = ref(false)
const error = ref('')
const previewFamily = ref('')

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
