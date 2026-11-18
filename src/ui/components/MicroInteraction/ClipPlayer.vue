<template>
  <canvas ref="canvasRef" class="clip-player-canvas" :width="size" :height="size" />
</template>

<script setup lang="ts">
/**
 * 片段播放器：矢量渲染播放字符动效视频片段（关键帧参数插值）。
 * 应用级：传入 video/cardData/library 时播放组合视频（渲染整个应用画布）。
 * 内存管理：矢量渲染，无 GPU 资源；克隆与临时实例逐帧释放。
 */
import { computed, onUnmounted, ref, watch } from 'vue'
import type { IAnimationClip, ICharacterFileLite } from '@/core/types'
import { useAnimationPlayback } from '@/features/animation/useAnimationPlayback'
import type { FontLibrary } from '@/features/applications/fontLibraryService'
import type { ICardAppData, IAppVideoDocument } from '@/features/applications/types'
import { renderAppVideoFrame } from '@/features/applications/video/compose'
import { videoTotalDuration } from '@/features/applications/video/videoData'

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
  /** 应用级：组合视频播放 */
  video?: IAppVideoDocument | null
  cardData?: ICardAppData | null
  library?: FontLibrary | null
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const size = props.size ?? 180

const playback = useAnimationPlayback({
  canvasRef,
  clipRef: computed(() => props.clip),
  charRef: computed(() => props.char),
})

let videoRaf = 0
let videoStart = 0
let videoToken = 0

function stopVideoLoop() {
  if (videoRaf) cancelAnimationFrame(videoRaf)
  videoRaf = 0
}

function startVideoLoop() {
  stopVideoLoop()
  if (!props.video || !props.cardData || !props.library) return
  const canvas = canvasRef.value
  if (!canvas) return
  const token = ++videoToken
  videoStart = performance.now()
  const loopFrame = (now: number) => {
    if (token !== videoToken) return
    const duration = videoTotalDuration(props.video!)
    const t = ((now - videoStart) / 1000) % duration
    void renderAppVideoFrame(canvas, props.video!, props.cardData!, props.library!, t).catch(
      (err) => {
        if (import.meta.env.DEV) {
          console.warn('[ClipPlayer] app video render failed:', err)
        }
      }
    )
    videoRaf = requestAnimationFrame(loopFrame)
  }
  videoRaf = requestAnimationFrame(loopFrame)
}

function stopOrPlay() {
  if (props.video) {
    stopVideoLoop()
    if (props.playing) startVideoLoop()
    return
  }
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
  () => [props.playing, props.restartToken, props.clip, props.video] as const,
  () => {
    stopOrPlay()
  },
  { immediate: true },
)

onUnmounted(() => {
  stopVideoLoop()
})
</script>

<style scoped>
.clip-player-canvas {
  background-color: #fff;
  border: 1px solid #e0e0e6;
  display: block;
}
</style>
