<template>
  <div class="video-editor">
    <!-- 左侧：视频名称 + 字符/图标列表 -->
    <aside class="ve-left">
      <div class="ve-section">
        <div class="ve-label">{{ t('applications.videoEditor.name') }} *</div>
        <n-input v-model:value="video.name" size="small" :placeholder="t('applications.videoEditor.name')" class="ve-full" />
      </div>
      <div class="ve-label">{{ t('applications.videoEditor.characters') }}</div>
      <div class="char-list">
        <div
          v-for="(occ, index) in layoutChars"
          :key="occ.id"
          class="char-row"
          :class="{ selected: occ.id === selectedOccurrenceId }"
          @click="handleSelectChar(occ.id)"
          @pointerup="handleSelectChar(occ.id)"
        >
          {{ occurrenceLabels[index] }}
        </div>
        <div v-if="layoutChars.length === 0" class="empty-hint">
          {{ t('applications.videoEditor.noCharacters') }}
        </div>
      </div>
    </aside>

    <!-- 中间：预览 + 按钮行 + 时间轴 -->
    <section class="ve-center">
      <div v-show="!previewHidden" class="ve-preview">
        <canvas ref="previewCanvasRef" class="preview-canvas" :width="video.width" :height="video.height" />
      </div>
      <div class="ve-controls">
        <div class="controls-left">
          <n-button size="tiny" @click="handleBack" @pointerup="handleBack">
            ← {{ t('applications.videoEditor.backToApp') }}
          </n-button>
          <n-button size="tiny" @click="handleQuickArrange" @pointerup="handleQuickArrange">
            {{ t('applications.videoEditor.quickArrange') }}
          </n-button>
          <n-button
            v-if="selectedClipId"
            size="tiny"
            type="error"
            @click="handleDeleteSelectedClip"
            @pointerup="handleDeleteSelectedClip"
          >
            {{ t('applications.videoEditor.deleteClip') }}
          </n-button>
          <n-button size="tiny" quaternary @click="handleTogglePreview" @pointerup="handleTogglePreview">
            {{ previewHidden ? t('applications.videoEditor.showPreview') : t('applications.videoEditor.hidePreview') }}
            {{ previewHidden ? '▼' : '▲' }}
          </n-button>
        </div>
        <div class="controls-right">
          <span class="time-label">{{ formatTime(currentTime) }} / {{ formatTime(duration()) }}</span>
          <n-button size="tiny" type="primary" @click="handlePlayToggle" @pointerup="handlePlayToggle">
            {{ playing ? t('applications.videoEditor.pause') : t('applications.videoEditor.play') }}
          </n-button>
        </div>
      </div>
      <div class="ve-timeline" :class="{ 'timeline-full': previewHidden }">
        <TimelineCanvas
          :video="video"
          :current-time="currentTime"
          @seek="handleSeek"
          @select-clip="selectedClipId = $event"
          @edit-clip="handleEditClip"
        />
      </div>
    </section>

    <!-- 右侧：选中字符的动效列表（带插入按钮） -->
    <aside class="ve-right">
      <div class="ve-label">
        {{ t('applications.videoEditor.clips') }} — {{ selectedCharText || '—' }}
      </div>
      <div class="clip-list">
        <div v-if="clips.length === 0" class="empty-hint">
          {{ t('applications.videoEditor.emptyClips') }}
        </div>
        <div v-for="clip in clips" :key="clip.id" class="clip-row">
          <div class="clip-info">
            <div class="clip-name">{{ clip.name }}</div>
            <div class="clip-meta">{{ formatTime(clipDurationSeconds(clip)) }}</div>
          </div>
          <n-button size="tiny" type="primary" @click="handleAskInsert(clip)" @pointerup="handleAskInsert(clip)">
            {{ t('applications.videoEditor.insert') }}
          </n-button>
        </div>
      </div>
    </aside>

    <!-- 插入时间对话框 -->
    <n-modal
      v-model:show="showInsertDialog"
      preset="dialog"
      :title="t('applications.videoEditor.insert')"
      :show-icon="false"
    >
      <div class="insert-row">
        <span class="ve-label">{{ t('applications.videoEditor.insertTime') }}</span>
        <n-input-number v-model:value="insertTime" :min="0" :step="0.1" size="small" />
      </div>
      <template #action>
        <n-button size="small" @click="handleInsertCancel" @pointerup="handleInsertCancel">
          {{ t('applications.videoEditor.insertCancel') }}
        </n-button>
        <n-button size="small" type="primary" @click="handleInsertConfirm" @pointerup="handleInsertConfirm">
          {{ t('applications.videoEditor.insertConfirm') }}
        </n-button>
      </template>
    </n-modal>

    <!-- 剪辑时间设置对话框（双击剪辑块弹出） -->
    <n-modal
      v-model:show="showEditClipDialog"
      preset="dialog"
      :title="t('applications.videoEditor.insertTime')"
      :show-icon="false"
    >
      <div class="insert-row">
        <span class="ve-label">{{ t('applications.videoEditor.insertTime') }}</span>
        <n-input-number v-model:value="editStartTime" :min="0" :step="0.1" size="small" />
      </div>
      <template #action>
        <n-button size="small" @click="handleEditClipCancel" @pointerup="handleEditClipCancel">
          {{ t('applications.videoEditor.insertCancel') }}
        </n-button>
        <n-button size="small" type="primary" @click="handleEditClipConfirm" @pointerup="handleEditClipConfirm">
          {{ t('applications.videoEditor.insertConfirm') }}
        </n-button>
      </template>
    </n-modal>

    <!-- 快速排列时间间隔对话框 -->
    <n-modal
      v-model:show="showArrangeDialog"
      preset="dialog"
      :title="t('applications.videoEditor.quickArrange')"
      :show-icon="false"
    >
      <div class="insert-row">
        <span class="ve-label">{{ t('applications.videoEditor.interval') }}</span>
        <n-input-number v-model:value="arrangeInterval" :min="0" :step="0.1" size="small" />
      </div>
      <template #action>
        <n-button size="small" @click="handleArrangeCancel" @pointerup="handleArrangeCancel">
          {{ t('applications.videoEditor.insertCancel') }}
        </n-button>
        <n-button size="small" type="primary" @click="handleArrangeConfirm" @pointerup="handleArrangeConfirm">
          {{ t('applications.videoEditor.insertConfirm') }}
        </n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NInput, NInputNumber, NModal, NScrollbar, useMessage } from 'naive-ui'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { genUUID } from '@/utils/uuid'
import { useProjectStore } from '@/stores/project'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import type { IAnimationClip } from '@/core/types'
import type { FontLibrary } from '@/features/applications/fontLibraryService'
import type { ICardAppData, IAppLayoutChar, IAppVideoDocument } from '@/features/applications/types'
import {
  clipDurationSeconds,
  ensureTrackForOccurrence,
  quickArrange,
  upsertSnapshot,
} from '@/features/applications/video/videoData'
import { useVideoPlayback } from '@/features/applications/video/videoPlayback'
import TimelineCanvas from './TimelineCanvas.vue'

const props = defineProps<{
  video: IAppVideoDocument
  cardData: ICardAppData
  library: FontLibrary | null
  /** 卡片布局中的全部字符出现（含重复，与卡片字符一一对应；由父页面计算） */
  layoutChars: () => IAppLayoutChar[]
}>()

const emit = defineEmits<{
  back: []
}>()

const { t } = useI18n()
const message = useMessage()
const projectStore = useProjectStore()

const previewCanvasRef = ref<HTMLCanvasElement | null>(null)
const previewHidden = ref(false)
const selectedOccurrenceId = ref<string | null>(null)
const selectedClips = ref<IAnimationClip[]>([])
const showInsertDialog = ref(false)
const insertTime = ref(0)
const pendingInsertClip = ref<IAnimationClip | null>(null)
const showArrangeDialog = ref(false)
const arrangeInterval = ref(1)
const showEditClipDialog = ref(false)
const editingPlacedId = ref<string | null>(null)
const editStartTime = ref(0)
const selectedClipId = ref<string | null>(null)

const layoutChars = computed(() => props.layoutChars())
const selectedOccurrence = computed(
  () => layoutChars.value.find((c) => c.id === selectedOccurrenceId.value) ?? null
)
const selectedCharText = computed(() => selectedOccurrence.value?.char ?? '')
const clips = computed(() => selectedClips.value)

/** 重复字符加序号（乐、乐2…），与卡片中的出现一一对应 */
const occurrenceLabels = computed(() => {
  const counts = new Map<string, number>()
  for (const occ of layoutChars.value) {
    counts.set(occ.char, (counts.get(occ.char) ?? 0) + 1)
  }
  const seen = new Map<string, number>()
  return layoutChars.value.map((occ) => {
    const n = (seen.get(occ.char) ?? 0) + 1
    seen.set(occ.char, n)
    const total = counts.get(occ.char) ?? 1
    return total > 1 ? `${occ.char}${n}` : occ.char
  })
})

const { playing, currentTime, play, pause, seek, duration } = useVideoPlayback({
  video: () => props.video,
  cardData: () => props.cardData,
  library: () => props.library,
  canvas: () => previewCanvasRef.value,
})

function formatTime(sec: number): string {
  const s = Math.max(0, sec)
  const m = Math.floor(s / 60)
  const r = s - m * 60
  return `${m}:${r.toFixed(1).padStart(4, '0')}`
}

const _handleSelectChar = async (occurrenceId: string) => {
  if (selectedOccurrenceId.value === occurrenceId) return
  selectedOccurrenceId.value = occurrenceId
  const occ = layoutChars.value.find((c) => c.id === occurrenceId)
  const file = projectStore.selectedFile
  if (!occ || !occ.charUuid || !file) {
    selectedClips.value = []
    return
  }
  try {
    const char = await characterDataManager.loadCharacter(file.uuid, occ.charUuid)
    selectedClips.value = char?.animations ?? []
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[videoEditor] load character failed:', err)
    }
    selectedClips.value = []
  }
}
const handleSelectChar = createDebouncedHandler(_handleSelectChar, 'AppVideoEditor.selectChar', (args) => args[0])

const _handleAskInsert = (clip: IAnimationClip) => {
  pendingInsertClip.value = clip
  insertTime.value = 0
  showInsertDialog.value = true
}
const handleAskInsert = createDebouncedHandler(_handleAskInsert, 'AppVideoEditor.askInsert', (args) => args[0]?.id)

const _handleInsertConfirm = () => {
  const clip = pendingInsertClip.value
  const occ = selectedOccurrence.value
  const file = projectStore.selectedFile
  if (!clip || !occ || !occ.charUuid || !file) return
  showInsertDialog.value = false
  pendingInsertClip.value = null

  const occurrenceIndex = layoutChars.value.findIndex((c) => c.id === occ.id)
  const charUuid = occ.charUuid
  const track = ensureTrackForOccurrence(
    props.video,
    { id: occ.id, char: occ.char, charUuid, x: occ.x, y: occ.y, fontSize: occ.fontSize },
    occurrenceLabels.value[occurrenceIndex] ?? occ.char,
    occurrenceIndex
  )

  // 固化快照（需要完整字符数据）
  characterDataManager.loadCharacter(file.uuid, charUuid).then((char) => {
    if (!char) return
    upsertSnapshot(props.video, charUuid, clip.id, clip, char)
    track.clips.push({ id: genUUID(), clipId: clip.id, startTime: insertTime.value })
    if (import.meta.env.DEV) {
      console.log('[videoEditor] inserted clip at', insertTime.value)
    }
  })
}
const handleInsertConfirm = createDebouncedHandler(_handleInsertConfirm, 'AppVideoEditor.insertConfirm')

const _handleInsertCancel = () => {
  showInsertDialog.value = false
  pendingInsertClip.value = null
}
const handleInsertCancel = createDebouncedHandler(_handleInsertCancel, 'AppVideoEditor.insertCancel')

const _handleQuickArrange = () => {
  arrangeInterval.value = 1
  showArrangeDialog.value = true
}
const handleQuickArrange = createDebouncedHandler(_handleQuickArrange, 'AppVideoEditor.quickArrange')

const _handleArrangeConfirm = () => {
  showArrangeDialog.value = false
  quickArrange(props.video.tracks, arrangeInterval.value)
  seek(0)
}
const handleArrangeConfirm = createDebouncedHandler(_handleArrangeConfirm, 'AppVideoEditor.arrangeConfirm')

const _handleArrangeCancel = () => {
  showArrangeDialog.value = false
}
const handleArrangeCancel = createDebouncedHandler(_handleArrangeCancel, 'AppVideoEditor.arrangeCancel')

const _handlePlayToggle = () => {
  // 字库尚未就绪（入口构建中/未确认）时预览无法渲染
  if (!props.library) {
    message.warning(t('applications.cardEditor.buildingLibrary'))
    return
  }
  if (playing.value) pause()
  else play()
}
const handlePlayToggle = createDebouncedHandler(_handlePlayToggle, 'AppVideoEditor.playToggle')

const _handleBack = () => {
  pause()
  emit('back')
}
const handleBack = createDebouncedHandler(_handleBack, 'AppVideoEditor.back')


const _handleTogglePreview = () => {
  previewHidden.value = !previewHidden.value
}
const handleTogglePreview = createDebouncedHandler(_handleTogglePreview, 'AppVideoEditor.togglePreview')

const _handleSeek = (time: number) => {
  seek(time)
}
const handleSeek = createDebouncedHandler(_handleSeek, 'AppVideoEditor.seek', (args) => args[0])

const _handleDeleteSelectedClip = () => {
  if (!selectedClipId.value) return
  for (const track of props.video.tracks) {
    const index = track.clips.findIndex((c) => c.id === selectedClipId.value)
    if (index >= 0) {
      track.clips.splice(index, 1)
      break
    }
  }
  // 清理空轨道
  props.video.tracks = props.video.tracks.filter((tr) => tr.clips.length > 0)
  selectedClipId.value = null
  seek(currentTime.value)
}
const handleDeleteSelectedClip = createDebouncedHandler(_handleDeleteSelectedClip, 'AppVideoEditor.deleteClip')

const _handleEditClip = (clipId: string) => {
  const placed = props.video.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId)
  if (!placed) return
  editingPlacedId.value = clipId
  editStartTime.value = placed.startTime
  showEditClipDialog.value = true
}
const handleEditClip = createDebouncedHandler(_handleEditClip, 'AppVideoEditor.editClip', (args) => args[0])

const _handleEditClipConfirm = () => {
  const placed = props.video.tracks.flatMap((t) => t.clips).find((c) => c.id === editingPlacedId.value)
  if (placed) {
    placed.startTime = Math.max(0, editStartTime.value)
    seek(currentTime.value)
  }
  showEditClipDialog.value = false
  editingPlacedId.value = null
}
const handleEditClipConfirm = createDebouncedHandler(_handleEditClipConfirm, 'AppVideoEditor.editClipConfirm')

const _handleEditClipCancel = () => {
  showEditClipDialog.value = false
  editingPlacedId.value = null
}
const handleEditClipCancel = createDebouncedHandler(_handleEditClipCancel, 'AppVideoEditor.editClipCancel')

onMounted(() => {
  seek(0)
})
</script>

<style scoped>
.video-editor {
  flex: 1;
  min-height: 0;
  min-width: 0; /* 关键：时间轴内容变宽时不把页面撑开，由内部 overflow 滚动 */
  display: flex;
}

.ve-left {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid var(--dark-4);
  padding: 12px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #26282e; /* 整列淡黑面板，列表区域下方不再露出页面深黑底色 */
}

.ve-section {
  margin-bottom: 14px;
}

.ve-full {
  width: 100%;
}

.ve-label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}

.char-list,
.clip-list {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.char-row {
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  border: 1px solid transparent;
}

.char-row:hover {
  background: rgba(255, 255, 255, 0.04);
}

.char-row.selected {
  border-color: #4a90e2;
  background: rgba(74, 144, 226, 0.12);
}

.ve-center {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--dark-2);
  min-height: 0;
}

.ve-preview {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
}

.preview-canvas {
  max-width: 100%;
  max-height: 100%;
  display: block;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}

.ve-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-top: 1px solid var(--dark-4);
  border-bottom: 1px solid var(--dark-4);
  flex-shrink: 0;
}

.controls-left,
.controls-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-label {
  font-size: 12px;
  opacity: 0.8;
  font-variant-numeric: tabular-nums;
}

.ve-timeline {
  height: 45%;
  min-height: 140px;
  flex-shrink: 0;
}

/* 隐藏预览：时间轴占满整个中央区 */
.ve-timeline.timeline-full {
  height: auto;
  flex: 1;
}

.ve-right {
  width: 240px;
  flex-shrink: 0;
  border-left: 1px solid var(--dark-4);
  padding: 12px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #26282e; /* 整列淡黑面板 */
}


.clip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--dark-4);
  border-radius: 6px;
  margin-bottom: 8px;
}

.clip-info {
  min-width: 0;
}

.clip-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clip-meta {
  font-size: 11px;
  opacity: 0.6;
}

.empty-hint {
  font-size: 12px;
  opacity: 0.5;
  padding: 10px 0;
}

.insert-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
