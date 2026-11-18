/**
 * 动效播放 composable：矢量渲染 + RAF 播放
 *
 * 静态预览：编辑管线矢量绘制 → 离屏画布 → 等比缩放 drawImage（贝塞尔原样保留）
 * 播放：按关键帧参数插值，逐帧矢量重绘（与编辑界面完全一致的渲染质量）
 * 样式跟随 fontRenderStyle（轮廓/黑白/彩色），变化时立即重绘。
 *
 * 无 WebGL/GPU 资源；克隆与临时实例在每帧渲染结束后释放。
 */

import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { ICharacterFileLite, IAnimationClip, IAnimationKeyframe } from '@/core/types'
import { fontRenderStyle } from '@/core/script/globals'
import { renderClipFrameAt, renderKeyframeVector } from './vectorRender'

export interface AnimationPlaybackOptions {
  canvasRef: Ref<HTMLCanvasElement | null>
  /** 当前片段（响应式） */
  clipRef: Ref<IAnimationClip | null>
  /** 基础字符数据（关键帧只存参数增量） */
  charRef: Ref<ICharacterFileLite | null>
  /** 正在编辑的参数草稿（渲染对应关键帧时覆盖存储值） */
  overrideRef?: Ref<{
    keyframeId: string
    componentUuid?: string
    params?: Record<string, number>
    charParams?: Record<string, number>
    positions?: { x: number; y: number }
  } | null>
}

export function useAnimationPlayback(opts: AnimationPlaybackOptions) {
  const { canvasRef, clipRef, charRef, overrideRef } = opts

  const playing = ref(false)
  const currentTime = ref(0)

  let rafId = 0
  let playStartMs = 0
  let playStartTime = 0

  /** 渲染指定时间点（按关键帧参数插值，矢量重绘；不带编辑草稿覆盖） */
  function renderAt(time: number) {
    const canvas = canvasRef.value
    const clip = clipRef.value
    const char = charRef.value
    if (!canvas || !clip || !char || clip.keyframes.length === 0) return
    // 注意：播放/插值不使用 overrideRef（草稿只影响静态预览的选中关键帧；
    // 否则每帧都被选中帧草稿覆盖，插值失效、画面恒定）
    renderClipFrameAt(char, clip, time, canvas, undefined, false, clip.renderStyle)
    currentTime.value = time
  }

  /** 渲染单个关键帧（静态预览，应用编辑草稿覆盖） */
  function renderKeyframe(kf: IAnimationKeyframe) {
    const canvas = canvasRef.value
    const char = charRef.value
    if (!canvas || !char) return
    renderKeyframeVector(char, kf, canvas, overrideRef?.value ?? undefined, false, clipRef.value?.renderStyle)
  }

  function clipDuration(): number {
    const clip = clipRef.value
    if (!clip || clip.keyframes.length === 0) return 0
    const kfs = [...clip.keyframes].sort((a, b) => a.time - b.time)
    return kfs[kfs.length - 1].time - kfs[0].time
  }

  function play() {
    const clip = clipRef.value
    if (!clip || clip.keyframes.length === 0) return
    playing.value = true
    const kfs = [...clip.keyframes].sort((a, b) => a.time - b.time)
    const start = kfs[0].time
    const dur = Math.max(0.001, clipDuration())
    playStartMs = performance.now()
    playStartTime = start
    const step = () => {
      if (!playing.value) return
      const elapsed = (performance.now() - playStartMs) / 1000
      let t = playStartTime + elapsed
      if (t > start + dur) {
        t = start + dur
        playing.value = false
      }
      renderAt(t)
      if (playing.value) rafId = requestAnimationFrame(step)
    }
    rafId = requestAnimationFrame(step)
  }

  function pause() {
    playing.value = false
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  }

  // 编辑页面渲染样式变化（轮廓/黑白/彩色）时，播放中立即以新样式重绘
  watch(fontRenderStyle, () => {
    if (playing.value) renderAt(currentTime.value)
  })

  /** 兼容旧 API：参数/隐藏态变化后无需缓存失效（矢量渲染总是全量重绘） */
  function invalidate(_keyframeId?: string) {
    /* no-op */
  }

  /** 释放资源（取消 RAF；无 GPU 资源需清理） */
  function dispose() {
    pause()
  }

  onBeforeUnmount(dispose)

  return {
    playing,
    currentTime,
    renderAt,
    renderKeyframe,
    play,
    pause,
    invalidate,
    dispose,
  }
}
