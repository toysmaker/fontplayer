/**
 * 微交互状态机导出器
 *
 * 导出 JSON 格式（与播放器约定）：
 * {
 *   version, name,
 *   segments: [{ id, name, duration, type: 'font-clip' }],   // 片段引用
 *   states: [{ id, name, segmentId, loop, position }],
 *   inputs: [{ id, name, type, source, defaultValue }],
 *     source 为事件绑定契约：'hover' = pointerenter/pointerleave（进入 true / 离开 false）；
 *     'click' = click（trigger 瞬时复位 / boolean 点击切换）；'custom' = 宿主代码写入值
 *   transitions: [{ id, from, to, conditions: [{ inputId, operator, value }] }]
 * }
 */

import type { IAnimationClip, ICharacterFileLite, IMicroInteraction } from '@/core/types'
import { saveAs } from 'file-saver'
import { buildLottieJson } from './lottieExporter'
import { getCharacterMetrics, type SdfMetrics } from './render'
import { buildReferencePlayerHtml } from './referencePlayerHtml'

export interface StateMachineSegment {
  id: string
  name: string
  /** 时长（毫秒） */
  duration: number
  type: 'font-clip'
}

export function clipDurationMs(clip: IAnimationClip | undefined): number {
  if (!clip || clip.keyframes.length === 0) return 0
  const times = clip.keyframes.map((k) => k.time)
  return Math.max(0, Math.round((Math.max(...times) - Math.min(...times)) * 1000))
}

/**
 * 生成完整的状态机数据（version 2）：
 * - inputs 携带 source 事件绑定契约
 * - 被状态引用的片段直接内嵌 Lottie 动画数据（animation 字段），
 *   播放器无需再访问外部资源即可渲染
 */
export function buildStateMachineData(
  micro: IMicroInteraction,
  clips: IAnimationClip[],
  char: ICharacterFileLite,
  metrics?: SdfMetrics,
): Record<string, unknown> {
  const m = metrics ?? getCharacterMetrics()
  const referencedIds = new Set(micro.states.map((s) => s.segmentId))
  const segments = clips
    .filter((c) => referencedIds.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      duration: clipDurationMs(c),
      type: 'font-clip' as const,
      /** 内嵌 Lottie 动画（关键帧轮廓 + 交叉淡化），播放器可直接渲染 */
      animation: JSON.parse(
        buildLottieJson({ clip: c, char, metrics: m }),
      ) as unknown,
    }))

  return {
    version: 2,
    name: micro.name,
    segments,
    states: micro.states.map((s) => ({
      id: s.id,
      name: s.name,
      segmentId: s.segmentId,
      loop: s.loop,
      position: { x: s.position.x, y: s.position.y },
    })),
    inputs: micro.inputs.map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type,
      // 事件绑定契约：hover → pointerenter/pointerleave（进入 true / 离开 false）；
      // click → click（瞬时 true 后复位，或 boolean 时点击切换）；custom → 宿主代码写入值
      source: i.source ?? 'custom',
      defaultValue: i.defaultValue,
    })),
    transitions: micro.transitions.map((t) => ({
      id: t.id,
      from: t.from,
      to: t.to,
      conditions: t.conditions.map((c) => ({
        inputId: c.inputId,
        operator: c.operator,
        value: c.value,
      })),
    })),
  }
}

/** 导出完整状态机 JSON（内嵌片段动画，可直接交给播放器） */
export function exportMicroInteractionFile(
  micro: IMicroInteraction,
  clips: IAnimationClip[],
  char: ICharacterFileLite,
): void {
  const data = buildStateMachineData(micro, clips, char)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  saveAs(blob, `${micro.name || 'micro-interaction'}.json`)
}

/** 导出播放器演示页面：数据 + 通用播放器运行时打包为单个 HTML，双击即可运行 */
export function exportMicroPlayerPage(
  micro: IMicroInteraction,
  clips: IAnimationClip[],
  char: ICharacterFileLite,
): void {
  const data = buildStateMachineData(micro, clips, char)
  const html = buildReferencePlayerHtml(data)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  saveAs(blob, `${micro.name || 'micro-interaction'}-player.html`)
}
