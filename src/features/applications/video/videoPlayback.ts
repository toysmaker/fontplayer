import { onUnmounted, ref } from 'vue'
import { renderAppVideoFrame } from './compose'
import type { FontLibrary } from '../fontLibraryService'
import type { ICardAppData, IAppVideoDocument } from '../types'
import { videoTotalDuration } from './videoData'

/**
 * 组合视频播放：RAF 循环按时间合成帧（多子轴播放的泛化）。
 * 无 GPU 资源；组件卸载时取消 RAF。
 */
export function useVideoPlayback(opts: {
  video: () => IAppVideoDocument | null
  cardData: () => ICardAppData | undefined
  library: () => FontLibrary | null
  canvas: () => HTMLCanvasElement | null
}) {
  const playing = ref(false)
  const currentTime = ref(0)

  let rafId = 0
  let playStart = 0
  let playStartTime = 0
  let renderToken = 0
  let rendering = false

  const duration = () => {
    const v = opts.video()
    return v ? videoTotalDuration(v) : 1
  }

  async function renderAt(time: number) {
    const canvas = opts.canvas()
    const video = opts.video()
    const cardData = opts.cardData()
    const library = opts.library()
    if (!canvas || !video || !cardData || !library) return
    const token = ++renderToken
    rendering = true
    try {
      await renderAppVideoFrame(canvas, video, cardData, library, time)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[videoPlayback] render frame failed:', err)
      }
    } finally {
      rendering = false
      // 渲染期间又收到了新请求，补渲染最新时间，保证最终一致
      if (token !== renderToken && !playing.value) {
        void renderAt(currentTime.value)
      }
    }
  }

  function loop(now: number) {
    if (!playing.value) return
    const v = opts.video()
    const d = v ? videoTotalDuration(v) : 1
    const t = playStartTime + (now - playStart) / 1000
    if (t >= d) {
      stop()
      seek(0)
      return
    }
    currentTime.value = t
    if (!rendering) void renderAt(t)
    rafId = requestAnimationFrame(loop)
  }

  function play() {
    if (playing.value) return
    const v = opts.video()
    if (!v) return
    if (currentTime.value >= duration()) {
      currentTime.value = 0
    }
    playing.value = true
    playStart = performance.now()
    playStartTime = currentTime.value
    rafId = requestAnimationFrame(loop)
  }

  function pause() {
    playing.value = false
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  }

  function stop() {
    pause()
    currentTime.value = 0
  }

  function seek(time: number) {
    currentTime.value = Math.max(0, Math.min(time, duration()))
    if (!playing.value) void renderAt(currentTime.value)
  }

  onUnmounted(() => {
    pause()
  })

  return {
    playing,
    currentTime,
    play,
    pause,
    stop,
    seek,
    renderAt,
    duration,
  }
}
