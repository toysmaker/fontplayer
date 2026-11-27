<template>
  <div class="segment-list">
    <div class="segment-list-title">{{ t('dialogs.microInteraction.segments') }}</div>
    <n-empty
      v-if="segments.length === 0"
      size="small"
      :description="t('dialogs.microInteraction.emptySegments')"
    />
    <div
      v-for="seg in segments"
      :key="seg.id"
      class="segment-item"
      draggable="true"
      :title="t('dialogs.microInteraction.dragHint')"
      @dragstart="onDragStart(seg.id, $event)"
    >
      <font-awesome-icon class="segment-icon" :icon="['fas', 'film']" />
      <div class="segment-info">
        <span class="segment-name">{{ seg.name }}</span>
        <span class="segment-duration">{{ seg.duration }}s</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 动画片段列表：拖拽片段到画布创建状态节点。
 * 片段数据来自当前字符已有的动效视频列表（只读引用，不在此处拷贝）。
 */
import { useI18n } from 'vue-i18n'
import { NEmpty } from 'naive-ui'

export interface SegmentItem {
  id: string
  name: string
  duration: number
}

defineProps<{ segments: SegmentItem[] }>()
const { t } = useI18n()

function onDragStart(segmentId: string, ev: DragEvent) {
  // HTML5 DnD：携带片段 id 到画布
  if (!ev.dataTransfer) return
  ev.dataTransfer.setData('application/x-fontplayer-segment', segmentId)
  ev.dataTransfer.effectAllowed = 'copy'
}
</script>

<style scoped>
.segment-list-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
}
.segment-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  margin-bottom: 4px;
  border: 1px solid #e0e0e6;
  border-radius: 3px;
  cursor: grab;
  font-size: 12px;
  background-color: #fff;
}
.segment-item:hover {
  border-color: var(--primary-3);
  background-color: var(--primary-5);
}
.segment-icon {
  color: var(--primary-1);
}
.segment-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.segment-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--primary-0);
}
.segment-duration {
  font-size: 10px;
  color: #666666;
}
</style>
