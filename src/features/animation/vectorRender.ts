/**
 * 矢量渲染：完全复用编辑界面的绘制管线
 *
 * 关键帧 →（参数应用 + 字形脚本）→ EditorCanvasRenderer.render() 画到 2000×2000
 * 离屏画布（贝塞尔曲线原样保留，描边宽度/颜色与编辑界面一致）→ drawImage 等比
 * 缩放到目标画布。浏览器平滑缩放，曲线圆角、描边粗细天然一致，无像素化。
 *
 * 播放插帧：按关键帧**参数**线性插值（数值型），枚举取就近端；隐藏关键帧
 * 做透明度淡入淡出（形状取可见侧）。每帧在隔离克隆上重跑脚本并矢量重绘。
 *
 * 内存管理：烘焙克隆仅存在于调用栈内，结束即释放全部临时实例。
 */

import type { IAnimationClip, IAnimationKeyframe, ICharacterFileLite, IParameter } from '@/core/types'
import { ParameterType } from '@/core/types'
import { fontRenderStyle } from '@/core/script/globals'
import { useProjectStore } from '@/stores/project'
import {
  applyKeyframeParamsToCharacter,
  characterParameterRows,
  characterGlyphComponents,
  createBakeClone,
  editableParameterRows,
  executeAllGlyphScriptsOnClone,
  renderCharacterLikeEditor,
  visibleComponentsForBake,
  withKeyframeConstantsMap,
  type KeyframeOverride,
} from './render'

function sortedKeyframes(clip: IAnimationClip): IAnimationKeyframe[] {
  return [...clip.keyframes].sort((a, b) => a.time - b.time)
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** 收集参数类型（数值/枚举），枚举参数不插值、取就近端 */
function collectParamTypes(char: ICharacterFileLite): Map<string, 'number' | 'enum'> {
  const map = new Map<string, 'number' | 'enum'>()
  const add = (rows: IParameter[]) => {
    for (const r of rows) {
      map.set(r.uuid, r.type === ParameterType.Enum ? 'enum' : 'number')
    }
  }
  add(characterParameterRows(char))
  for (const gc of characterGlyphComponents(char)) {
    add(editableParameterRows(gc.value as never))
  }
  return map
}

/** 数值快照插值（两侧都已展开为完整快照，逐项 lerp） */
function lerpNumbers(a: Record<string, number>, b: Record<string, number>, t: number): Record<string, number> {
  const out: Record<string, number> = {}
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    const va = a[k]
    const vb = b[k]
    if (va === undefined) out[k] = vb!
    else if (vb === undefined) out[k] = va
    else out[k] = lerp(va, vb, t)
  }
  return out
}

/**
 * 将关键帧展开为完整快照：缺失的参数/位置/常量用字符当前值补全。
 * 关键帧存储的是增量（空 = 使用字符当前值），插值前必须补全，
 * 否则缺失端取另一端值会导致整个区间恒定、无过渡。
 */
export function expandKeyframeSnapshot(
  char: ICharacterFileLite,
  kf: IAnimationKeyframe,
): IAnimationKeyframe {
  const params: Record<string, Record<string, number>> = {}
  const positions: Record<string, { x: number; y: number }> = {}
  for (const gc of characterGlyphComponents(char)) {
    const glyph = gc.value as never
    const rows = editableParameterRows(glyph)
    const stored = kf.params[gc.uuid] ?? {}
    const merged: Record<string, number> = {}
    for (const r of rows) {
      if (r.type === ParameterType.Constant) continue
      merged[r.uuid] = stored[r.uuid] !== undefined ? stored[r.uuid] : Number(r.value)
    }
    if (Object.keys(merged).length > 0) params[gc.uuid] = merged
    const storedPos = kf.positions?.[gc.uuid]
    positions[gc.uuid] = {
      x: storedPos?.x ?? gc.ox ?? 0,
      y: storedPos?.y ?? gc.oy ?? 0,
    }
  }

  const charParams: Record<string, number> = {}
  for (const r of characterParameterRows(char)) {
    if (r.type === ParameterType.Constant) continue
    charParams[r.uuid] = kf.charParams?.[r.uuid] !== undefined ? kf.charParams[r.uuid] : Number(r.value)
  }

  // 常量：缺失项用工程当前解析值补全
  const constants: Record<string, number> = { ...(kf.constants ?? {}) }
  const file = useProjectStore().selectedFile
  const cm = useProjectStore().constantsMap as { getByUUID?: (u: string) => unknown } | null
  for (const c of file?.constants ?? []) {
    if (constants[c.uuid] !== undefined) continue
    const v = cm?.getByUUID?.(c.uuid)
    if (typeof v === 'number') constants[c.uuid] = v
  }

  return {
    ...kf,
    params,
    positions,
    charParams,
    constants,
  }
}

/**
 * 插值两个关键帧为合成快照（两侧先展开为完整快照，数值 lerp、枚举取就近端，
 * 位置/常量数值插值，隐藏组件取并集）。
 */
export function interpolateKeyframes(
  char: ICharacterFileLite,
  a: IAnimationKeyframe,
  b: IAnimationKeyframe,
  t: number,
): IAnimationKeyframe {
  const fa = expandKeyframeSnapshot(char, a)
  const fb = expandKeyframeSnapshot(char, b)
  const types = collectParamTypes(char)
  const params: Record<string, Record<string, number>> = {}
  const compIds = new Set([...Object.keys(fa.params), ...Object.keys(fb.params)])
  for (const cid of compIds) {
    const pa = fa.params[cid] ?? {}
    const pb = fb.params[cid] ?? {}
    const pids = new Set([...Object.keys(pa), ...Object.keys(pb)])
    const merged: Record<string, number> = {}
    for (const pid of pids) {
      const va = pa[pid]
      const vb = pb[pid]
      if (va === undefined) merged[pid] = vb!
      else if (vb === undefined) merged[pid] = va
      else if (types.get(pid) === 'enum') merged[pid] = t < 0.5 ? va : vb
      else merged[pid] = lerp(va, vb, t)
    }
    params[cid] = merged
  }

  const positions: Record<string, { x: number; y: number }> = {}
  const posIds = new Set([...Object.keys(fa.positions ?? {}), ...Object.keys(fb.positions ?? {})])
  for (const cid of posIds) {
    const pa = fa.positions?.[cid]
    const pb = fb.positions?.[cid]
    positions[cid] = {
      x: pa && pb ? lerp(pa.x, pb.x, t) : pa ? pa.x : pb ? pb.x : 0,
      y: pa && pb ? lerp(pa.y, pb.y, t) : pa ? pa.y : pb ? pb.y : 0,
    }
  }

  return {
    id: '__lerp__',
    time: lerp(fa.time, fb.time, t),
    hidden: false,
    hiddenComponents: Array.from(
      new Set([...(fa.hiddenComponents ?? []), ...(fb.hiddenComponents ?? [])]),
    ),
    params,
    positions,
    charParams: lerpNumbers(fa.charParams ?? {}, fb.charParams ?? {}, t),
    constants: lerpNumbers(fa.constants ?? {}, fb.constants ?? {}, t),
  }
}

/**
 * 渲染某个时间点到目标画布（等比缩放）。
 * - 目标画布被完整覆盖（白色背景 + 内容）
 * - 关键帧隐藏 → 透明度按区间线性淡入淡出（形状取可见侧）
 */
export function renderClipFrameAt(
  char: ICharacterFileLite,
  clip: IAnimationClip,
  time: number,
  targetCanvas: HTMLCanvasElement,
  override?: KeyframeOverride & { keyframeId?: string },
): void {
  const kfs = sortedKeyframes(clip)
  if (kfs.length === 0) return
  let i = 0
  while (i < kfs.length - 1 && kfs[i + 1].time <= time) i++
  const kf0 = kfs[i]
  const kf1 = kfs[Math.min(i + 1, kfs.length - 1)]

  if (kf0.id === kf1.id) {
    renderKeyframeVector(char, kf0, targetCanvas, override && override.keyframeId === kf0.id ? override : undefined)
    return
  }

  const dur = Math.max(0.001, kf1.time - kf0.time)
  const t = Math.min(1, Math.max(0, (time - kf0.time) / dur))
  const vis0 = kf0.hidden ? 0 : 1
  const vis1 = kf1.hidden ? 0 : 1
  const opacity = vis0 + (vis1 - vis0) * t

  // 形状：某一侧隐藏时取可见侧快照（不做跨隐藏形状插值，配合透明度淡变）
  let snapshot: IAnimationKeyframe
  if (vis0 === 0 && vis1 === 1) snapshot = kf1
  else if (vis0 === 1 && vis1 === 0) snapshot = kf0
  else snapshot = interpolateKeyframes(char, kf0, kf1, t)

  const kfOverride =
    override && (override.keyframeId === kf0.id || override.keyframeId === kf1.id)
      ? override
      : undefined
  drawSnapshotToCanvas(char, snapshot, targetCanvas, kfOverride, opacity)
}

/** 渲染单个关键帧（静态预览） */
export function renderKeyframeVector(
  char: ICharacterFileLite,
  kf: IAnimationKeyframe,
  targetCanvas: HTMLCanvasElement,
  override?: KeyframeOverride,
): void {
  drawSnapshotToCanvas(char, kf, targetCanvas, override, kf.hidden ? 0 : 1)
}

function drawSnapshotToCanvas(
  char: ICharacterFileLite,
  kf: IAnimationKeyframe,
  targetCanvas: HTMLCanvasElement,
  override: KeyframeOverride | undefined,
  opacity: number,
): void {
  const session = createBakeClone(char)
  try {
    // 常量覆盖注入整个"参数应用 + 脚本执行 + 渲染"链路
    withKeyframeConstantsMap(kf.constants, () => {
      applyKeyframeParamsToCharacter(session.clone, kf, override, session.uuidMap)
      const hasCharAnim =
        (kf.charParams && Object.keys(kf.charParams).length > 0) ||
        (override?.charParams && Object.keys(override.charParams).length > 0)
      session.runCharacterScript(hasCharAnim)
      executeAllGlyphScriptsOnClone(session.clone)
      const visible = visibleComponentsForBake(session, kf)
      const renderCanvas = renderCharacterLikeEditor(
        session.clone,
        visible,
        fontRenderStyle.value as 'color' | 'black' | 'contour',
      )
      const ctx = targetCanvas.getContext('2d')
      if (!ctx) return
      ctx.save()
      ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height)
      if (opacity < 1) ctx.globalAlpha = Math.max(0, Math.min(1, opacity))
      ctx.drawImage(renderCanvas, 0, 0, targetCanvas.width, targetCanvas.height)
      ctx.restore()
    })
  } finally {
    session.release()
  }
}
