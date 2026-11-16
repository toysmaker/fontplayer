<template>
  <canvas ref="canvasRef" class="clip-player-canvas" :width="size" :height="size" />
</template>

<script setup lang="ts">
/**
 * 片段播放器：矢量渲染播放字符动效视频片段（关键帧参数插值）。
 * 内存管理：矢量渲染，无 GPU 资源；克隆与临时实例逐帧释放。
 */
import { computed, ref, watch } from 'vue'
import type { IAnimationClip, ICharacterFileLite } from '@/core/types'
import { useAnimationPlayback } from '@/features/animation/useAnimationPlayback'

const props = defineProps<{
  clip: IAnimationClip | null
  char: ICharacterFileLite | null
  /** 是否播放 */
  playing: boolean
  /** 循环 */
  loop?: boolean
  /** 重播令牌：变化时重新开始 */
  restartToken?: number
  size?: number
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const size = props.size ?? 180

const playback = useAnimationPlayback({
  canvasRef,
  clipRef: computed(() => props.clip),
  charRef: computed(() => props.char),
})

function stopOrPlay() {
  playback.pause()
  if (props.playing && props.clip) {
    playback.play()
  } else {
    renderFirst()
  }
}

function renderFirst() {
  const kf = props.clip?.keyframes[0]
  if (kf) playback.renderKeyframe(kf)
  else playback.pause()
}

watch(
  () => [props.playing, props.restartToken, props.clip] as const,
  () => {
    stopOrPlay()
  },
  { immediate: true },
)
</script>

<style scoped>
.clip-player-canvas {
  background-color: #fff;
  border: 1px solid #e0e0e6;
  display: block;
}
</style>
