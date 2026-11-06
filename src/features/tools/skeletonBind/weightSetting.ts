import { ref } from "vue"
import { pointToBoneDistance, calculatePointBones } from "@/features/glyphSkeletonBind"
import { ensureStoredBindRuntimeData, invalidatePointsBonesMap } from "@/features/skeletonSampling"
import {
  reprojectEntriesToRefLine,
  restoreAutomaticEntries,
  applyOverrideRuns,
  entryRefLineIdx,
  type FlatSegment,
  type OutlineOffsetBindData,
} from "@/features/skeletonFitting"
import { mapCanvasX, mapCanvasY } from "@/utils/canvas"
import i18n from "@/i18n"
import { useGlyphStore } from "@/stores/glyph"
import {
  selectedBone,
  brushSize,
  onWeightSetting,
  weightValue,
  selectedRefLineIdx,
  hoveredRefLineIdx,
  bindEditMode,
  hoveredBindInfo,
} from "@/stores/skeletonDragger"

type GetCoord = (coord: number) => number

/** 获取骨架绑定数据（兼容 glyphSkeletonBindData 和 skeletonBindData），并惰性重建运行时缓存 */
function getSkeletonBindData(glyph: any) {
  const stored = glyph?.skeleton?.glyphSkeletonBindData || glyph?.skeleton?.skeletonBindData || null
  if (stored?._sampleBindData) {
    ensureStoredBindRuntimeData(stored, calculatePointBones)
  }
  return stored
}

// ==================== 旧路径: LBS 权重刷 (参考字形) ====================

const currentBone = ref<any>(null)

const setWeight = (mouseX: number, mouseY: number) => {
  const glyphStore = useGlyphStore()
  const editGlyph = (glyphStore as any).editingGlyph
  const bindData = getSkeletonBindData(editGlyph)
  if (!bindData) return
  const { pointsBonesMap, originalPoints, bones: allBones } = bindData
  if (!pointsBonesMap) return

  for (let i = 0; i < pointsBonesMap.length; i++) {
    const { pointIndex, bones } = pointsBonesMap[i]
    const { x, y } = originalPoints[pointIndex]
    const dist = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2)
    if (dist <= brushSize.value / 2) {
      let mark = false
      const _bone = bones.find((b: any) => b.boneIndex === selectedBone.value.index)
      const originWeight = _bone ? _bone.weight : 0
      for (let j = 0; j < bones.length; j++) {
        const { boneIndex, weight } = bones[j]
        if (boneIndex === selectedBone.value.index) {
          bones[j].weight = weightValue.value
          mark = true
        } else {
          if (_bone) {
            if (originWeight === 1) {
              bones[j].weight = 0
            } else {
              bones[j].weight = (bones[j].weight / (1 - originWeight)) * (1 - weightValue.value)
            }
          } else {
            bones[j].weight = bones[j].weight * (1 - weightValue.value)
          }
        }
      }
      if (!mark && weightValue.value > 0) {
        const { localCoords } = pointToBoneDistance(
          originalPoints[pointIndex],
          allBones[selectedBone.value.index],
        )
        bones.push({
          boneIndex: selectedBone.value.index,
          weight: weightValue.value,
          localCoords,
        })
      }
    }
  }
}

const getWeightColor = (point: any) => {
  const { weight, otherWeight } = point
  const undefinedWeight = 1 - otherWeight - weight
  const red = Math.round(weight * 255)
  const blue = Math.round(otherWeight * 255)
  const green = Math.round(undefinedWeight * 255)
  return `rgba(${red}, ${green}, ${blue}, 1)`
}

export const initWeightSelector = (
  canvas: HTMLCanvasElement,
  options: { getCoord: GetCoord; onRender: () => void },
) => {
  const { getCoord, onRender } = options
  const glyphStore = useGlyphStore()
  const bindData = getSkeletonBindData((glyphStore as any).editingGlyph)
  const bones = bindData?.bones || []

  currentBone.value = null

  const onMouseDown = (e: MouseEvent) => {
    const mouseX = getCoord(e.offsetX)
    const mouseY = getCoord(e.offsetY)
    if (currentBone.value) {
      selectedBone.value = currentBone.value
      currentBone.value = null
    } else if (onWeightSetting.value && brushSize.value > 0) {
      setWeight(mouseX, mouseY)
    }
    onRender()
    renderBoneAndWeight(canvas, { mouseX, mouseY })
  }

  const onMouseMove = (e: MouseEvent) => {
    const mouseX = getCoord(e.offsetX)
    const mouseY = getCoord(e.offsetY)
    currentBone.value = null
    for (let i = 0; i < bones.length; i++) {
      const { distance } = pointToBoneDistance({ x: mouseX, y: mouseY }, bones[i])
      if (distance <= 20) {
        currentBone.value = bones[i]
        currentBone.value.index = i
      }
    }
    onRender()
    renderBoneAndWeight(canvas, { mouseX, mouseY })
  }

  const onMouseUp = (e: MouseEvent) => {
    const mouseX = getCoord(e.offsetX)
    const mouseY = getCoord(e.offsetY)
    currentBone.value = null
    onRender()
    renderBoneAndWeight(canvas, { mouseX, mouseY })
  }

  canvas.addEventListener("mouseup", onMouseUp)
  canvas.addEventListener("mousemove", onMouseMove)
  canvas.addEventListener("mousedown", onMouseDown)

  const close = () => {
    canvas.removeEventListener("mouseup", onMouseUp)
    canvas.removeEventListener("mousemove", onMouseMove)
    canvas.removeEventListener("mousedown", onMouseDown)
    currentBone.value = null
  }

  return close
}

export const renderBoneAndWeight = (
  canvas: HTMLCanvasElement,
  options?: { mouseX?: number; mouseY?: number },
) => {
  // 细节迁移绑定 → 区域指派刷渲染 (新交互)
  const glyphStore = useGlyphStore()
  const bindData = getSkeletonBindData((glyphStore as any).editingGlyph)
  if (bindData?._outlineOffsetData && zoneRibbon) {
    renderZoneBrush(canvas, options)
    return
  }

  const bone = currentBone.value || selectedBone.value
  if (!bone) return

  const { pointsBonesMap, originalPoints } = bindData
  if (!pointsBonesMap) return

  const _points: Array<any> = []
  if (selectedBone.value) {
    for (let i = 0; i < pointsBonesMap.length; i++) {
      const { pointIndex, bones } = pointsBonesMap[i]
      let _weight = 0
      let _otherWeight = 0
      for (let j = 0; j < bones.length; j++) {
        const { boneIndex, weight } = bones[j]
        if (boneIndex === bone.index) _weight = weight
        else _otherWeight += weight
      }
      if (_weight > 0) {
        _points.push({
          x: originalPoints[pointIndex].x,
          y: originalPoints[pointIndex].y,
          weight: _weight,
          otherWeight: _otherWeight,
        })
      }
    }
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  // weight squares
  for (let i = 0; i < _points.length; i++) {
    const { x, y } = _points[i]
    ctx.fillStyle = getWeightColor(_points[i])
    ctx.fillRect(mapCanvasX(x), mapCanvasY(y), 10, 10)
  }

  // bone line
  const { start, end } = bone
  ctx.strokeStyle = "red"
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.moveTo(mapCanvasX(start.x), mapCanvasY(start.y))
  ctx.lineTo(mapCanvasX(end.x), mapCanvasY(end.y))
  ctx.stroke()
  ctx.closePath()

  // brush circle
  if (!currentBone.value && onWeightSetting.value) {
    const { mouseX, mouseY } = options || {}
    // 没有鼠标坐标时不绘制笔刷圆，否则会在 (0,0) 出现一个被裁剪的四分之一圆
    if (mouseX === undefined || mouseY === undefined) return
    if (!Number.isFinite(mouseX) || !Number.isFinite(mouseY)) return
    const _brushSize = mapCanvasX(brushSize.value)
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)"
    ctx.beginPath()
    ctx.ellipse(mapCanvasX(mouseX), mapCanvasY(mouseY), _brushSize / 2, _brushSize / 2, 0, 0, 2 * Math.PI)
    ctx.fill()
    ctx.closePath()
  }
}

// ==================== 新路径: 区域指派刷 (细节迁移绑定) ====================

/** 会话带子 (进入手动绑定模式时由当前骨架构建) */
let zoneRibbon: FlatSegment[] | null = null
/** 最近一次鼠标位置 (UPM), 供渲染循环画刷圈 */
let lastMouse: { x: number; y: number } | null = null

/** 骨架段配色: 黄金角色相, 段间区分度大 */
function refLineColor(refLineIdx: number): string {
  const hue = (refLineIdx * 137.508) % 360
  return `hsl(${hue.toFixed(0)}, 72%, 52%)`
}

function getZoneData(glyph: any): { od: OutlineOffsetBindData; samplePoints: number[] } | null {
  const bindData = getSkeletonBindData(glyph)
  const od = bindData?._outlineOffsetData as OutlineOffsetBindData | undefined
  const samplePoints = bindData?._sampleBindData?.samplePoints as number[] | undefined
  if (!od || !samplePoints || !zoneRibbon) return null
  return { od, samplePoints }
}

/** 找离鼠标最近的采样点下标 */
function nearestSampleIndex(samplePoints: number[], mx: number, my: number): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < samplePoints.length / 2; i++) {
    const d = Math.hypot(samplePoints[i * 2] - mx, samplePoints[i * 2 + 1] - my)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

/** 笔刷命中的连续采样区间: 从最近采样点沿轮廓向两侧扩展 (不跨环) */
function collectContiguousHitRange(
  samplePoints: number[],
  nearest: number,
  radius: number,
): { start: number; end: number } {
  const n = samplePoints.length / 2
  let start = nearest
  let end = nearest
  while (start > 0) {
    const d = Math.hypot(samplePoints[(start - 1) * 2] - samplePoints[nearest * 2], samplePoints[(start - 1) * 2 + 1] - samplePoints[nearest * 2 + 1])
    if (d > radius) break
    start--
  }
  while (end < n - 1) {
    const d = Math.hypot(samplePoints[(end + 1) * 2] - samplePoints[nearest * 2], samplePoints[(end + 1) * 2 + 1] - samplePoints[nearest * 2 + 1])
    if (d > radius) break
    end++
  }
  return { start, end }
}

/** 操作提示回调 (面板传入, 用于指派时未选骨架段的警告) */
let zoneHint: ((msg: string) => void) | null = null

/** 刚刷过的区间闪烁标记 (无论指派/清除/无变化都闪烁, 给用户明确的操作反馈) */
let flashRange: { start: number; end: number; until: number } | null = null

/**
 * 恢复全部自动绑定 (清空所有手动指派), 不退出编辑模式。
 * 细节迁移路径: 全区间恢复自动最近点匹配 + 清空 override 列表。
 */
export function restoreAllZoneBindings(): void {
  const glyphStore = useGlyphStore()
  const data = getZoneData((glyphStore as any).editingGlyph)
  if (!data || !zoneRibbon) return
  const { od } = data
  if (od.entries.length > 0) {
    restoreAutomaticEntries(od, zoneRibbon, 0, od.entries.length - 1)
    applyOverrideRuns(od, 0, od.entries.length - 1, null)
  }
  hoveredBindInfo.value = null
}

/** 恢复全部自动权重 (LBS 回退路径): 失效并重建骨骼权重映射 */
export function restoreAllLbsWeights(): void {
  const glyphStore = useGlyphStore()
  const stored = getSkeletonBindData((glyphStore as any).editingGlyph)
  if (!stored?._sampleBindData) return
  invalidatePointsBonesMap(stored._sampleBindData)
  ensureStoredBindRuntimeData(stored, calculatePointBones)
}

function paintZone(mx: number, my: number, clear: boolean) {
  const glyphStore = useGlyphStore()
  const data = getZoneData((glyphStore as any).editingGlyph)
  if (!data || !zoneRibbon) return
  const { od, samplePoints } = data
  const nearest = nearestSampleIndex(samplePoints, mx, my)
  const radius = brushSize.value / 2
  // 命中阈值 = max(笔刷半径, 30): 允许小幅点偏 (缩放视图下点击难以精确压线),
  // 只在点击处离轮廓很远时拒绝 (否则清除会落在远处最近的采样点上, 清错地方)
  const distToNearest = Math.hypot(samplePoints[nearest * 2] - mx, samplePoints[nearest * 2 + 1] - my)
  if (distToNearest > Math.max(radius, 30)) return
  const range = collectContiguousHitRange(samplePoints, nearest, radius)
  if (range.end < range.start) return
  // 刷到的区间闪烁: 无论是否有 override 变化都反馈 (指派/清除/已自动区域均可见)
  flashRange = { start: range.start, end: range.end, until: performance.now() + 700 }
  if (clear) {
    restoreAutomaticEntries(od, zoneRibbon, range.start, range.end)
    applyOverrideRuns(od, range.start, range.end, null)
  } else if (selectedRefLineIdx.value == null) {
    // 指派模式但未选骨架段: 提示用户 (静默无操作会让人以为功能坏了)
    zoneHint?.(i18n.global.t('panels.paramsPanel.glyphParamsPanel.bindNeedSelect'))
  } else {
    // 指派: 锚点为骨架段上离采样点最近处 (自动计算)
    reprojectEntriesToRefLine(od, zoneRibbon, range.start, range.end, selectedRefLineIdx.value)
    applyOverrideRuns(od, range.start, range.end, selectedRefLineIdx.value)
  }
}

/**
 * 区域指派刷选择器 (细节迁移路径):
 * 悬停骨架段高亮选中; 左键拖动 = 指派刷 (或按模式清除); 右键拖动 = 清除刷。
 */
export const initZoneBrushSelector = (
  canvas: HTMLCanvasElement,
  options: { getCoord: GetCoord; onRender: () => void; ribbon: FlatSegment[]; onHint?: (msg: string) => void },
) => {
  const { getCoord, onRender, ribbon } = options
  zoneRibbon = ribbon
  zoneHint = options.onHint ?? null
  lastMouse = null
  hoveredBindInfo.value = null
  hoveredRefLineIdx.value = null

  let painting = false
  let clearBrush = false

  const onContextMenu = (e: MouseEvent) => {
    // mac 触控板双指轻点只触发 contextmenu (无 button=2 的 mousedown) — 在此做清除刷
    e.preventDefault()
    painting = true
    clearBrush = true
    const mouseX = getCoord(e.offsetX)
    const mouseY = getCoord(e.offsetY)
    lastMouse = { x: mouseX, y: mouseY }
    paintZone(mouseX, mouseY, true)
    onRender()
    renderZoneBrush(canvas, { mouseX, mouseY })
  }

  const onMouseDown = (e: MouseEvent) => {
    painting = true
    clearBrush = e.button === 2 || bindEditMode.value === 'clear'
    const mouseX = getCoord(e.offsetX)
    const mouseY = getCoord(e.offsetY)
    lastMouse = { x: mouseX, y: mouseY }
    paintZone(mouseX, mouseY, clearBrush)
    onRender()
    renderZoneBrush(canvas, { mouseX, mouseY })
  }

  const onMouseMove = (e: MouseEvent) => {
    const mouseX = getCoord(e.offsetX)
    const mouseY = getCoord(e.offsetY)
    lastMouse = { x: mouseX, y: mouseY }
    if (!painting) {
      // 悬停只做高亮提示, 不改变选中 (选中仅由面板下拉设置)
      let hovered: number | null = null
      let bestDist = 20
      const maxRefLine = Math.max(-1, ...zoneRibbon!.map((s) => s.refLineIdx))
      for (let r = 0; r <= maxRefLine; r++) {
        for (const sgm of zoneRibbon!) {
          const belong = sgm.refLineIdx === r || (sgm.arcAdjRefLines && sgm.arcAdjRefLines.includes(r))
          if (!belong) continue
          for (const q of sgm.pts) {
            const d = Math.hypot(q.x - mouseX, q.y - mouseY)
            if (d < bestDist) {
              bestDist = d
              hovered = r
            }
          }
        }
      }
      hoveredRefLineIdx.value = hovered
      updateHoveredInfo(mouseX, mouseY)
    } else if (e.buttons & 1 || e.buttons & 2) {
      paintZone(mouseX, mouseY, clearBrush)
    }
    onRender()
    renderZoneBrush(canvas, { mouseX, mouseY })
  }

  const onMouseUp = () => {
    painting = false
    onRender()
    renderZoneBrush(canvas)
  }

  const onMouseLeave = () => {
    lastMouse = null
    hoveredBindInfo.value = null
    hoveredRefLineIdx.value = null
    onRender()
  }

  canvas.addEventListener("mousedown", onMouseDown)
  canvas.addEventListener("mousemove", onMouseMove)
  canvas.addEventListener("mouseup", onMouseUp)
  canvas.addEventListener("mouseleave", onMouseLeave)
  canvas.addEventListener("contextmenu", onContextMenu)

  const close = () => {
    canvas.removeEventListener("mousedown", onMouseDown)
    canvas.removeEventListener("mousemove", onMouseMove)
    canvas.removeEventListener("mouseup", onMouseUp)
    canvas.removeEventListener("mouseleave", onMouseLeave)
    canvas.removeEventListener("contextmenu", onContextMenu)
    zoneRibbon = null
    zoneHint = null
    lastMouse = null
    flashRange = null
    hoveredBindInfo.value = null
    hoveredRefLineIdx.value = null
  }

  return close
}

/** 悬停查看: 记录最近采样点的绑定明细 (面板显示) */
function updateHoveredInfo(mx: number, my: number) {
  const glyphStore = useGlyphStore()
  const data = getZoneData((glyphStore as any).editingGlyph)
  if (!data || !zoneRibbon) {
    hoveredBindInfo.value = null
    return
  }
  const { od, samplePoints } = data
  const idx = nearestSampleIndex(samplePoints, mx, my)
  const d = Math.hypot(samplePoints[idx * 2] - mx, samplePoints[idx * 2 + 1] - my)
  if (d > 20) {
    hoveredBindInfo.value = null
    return
  }
  const e = od.entries[idx]
  const sgm = zoneRibbon.find((x) => x.segIdx === e.bezierIdx)
  const anchor = sgm?.pts?.[e.s]
  hoveredBindInfo.value = {
    index: idx,
    refLineIdx: entryRefLineIdx(e, zoneRibbon),
    segIdx: e.bezierIdx,
    s: e.s,
    u: e.u,
    v: e.v,
    bindSegLen: e.bindSegLen,
    px: samplePoints[idx * 2],
    py: samplePoints[idx * 2 + 1],
    anchor,
    overridden: !!od.overrides?.some((r) => idx >= r.start && idx <= r.end),
  }
}

/**
 * 区域指派刷渲染: 轮廓色带 (按骨架段着色) + 选中段高亮 + override 描边 + 刷圈 + 悬停锚点连线。
 */
export const renderZoneBrush = (
  canvas: HTMLCanvasElement,
  options?: { mouseX?: number; mouseY?: number },
) => {
  const glyphStore = useGlyphStore()
  const data = getZoneData((glyphStore as any).editingGlyph)
  if (!data || !zoneRibbon) return
  const { od, samplePoints } = data
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const n = samplePoints.length / 2
  const strokeW = Math.max(mapCanvasX(3), 1.5)

  ctx.save()

  // 1. 轮廓色带: 连续相同骨架段的采样点合成一条折线
  {
    let runStart = 0
    let runRef = entryRefLineIdx(od.entries[0], zoneRibbon)
    const flushRun = (start: number, end: number, refIdx: number) => {
      if (refIdx < 0 || end < start) return
      ctx.strokeStyle = refLineColor(refIdx)
      ctx.lineWidth = strokeW
      ctx.beginPath()
      ctx.moveTo(mapCanvasX(samplePoints[start * 2]), mapCanvasY(samplePoints[start * 2 + 1]))
      for (let i = start + 1; i <= end; i++) {
        ctx.lineTo(mapCanvasX(samplePoints[i * 2]), mapCanvasY(samplePoints[i * 2 + 1]))
      }
      ctx.stroke()
    }
    for (let i = 1; i < n; i++) {
      const r = entryRefLineIdx(od.entries[i], zoneRibbon)
      if (r !== runRef) {
        flushRun(runStart, i - 1, runRef)
        runStart = i
        runRef = r
      }
    }
    flushRun(runStart, n - 1, runRef)
  }

  // 2. override 区间标记 (细虚线描边 — 不遮挡色带, 避免白色实线看起来像被擦除)
  if (od.overrides && od.overrides.length > 0) {
    ctx.setLineDash([6, 4])
    ctx.lineWidth = 1.4
    for (const r of od.overrides) {
      ctx.strokeStyle = "#222"
      ctx.beginPath()
      ctx.moveTo(mapCanvasX(samplePoints[r.start * 2]), mapCanvasY(samplePoints[r.start * 2 + 1]))
      for (let i = r.start + 1; i <= r.end; i++) {
        ctx.lineTo(mapCanvasX(samplePoints[i * 2]), mapCanvasY(samplePoints[i * 2 + 1]))
      }
      ctx.stroke()
    }
    ctx.setLineDash([])
  }

  // 3. 选中骨架段高亮 (面板下拉设置) + 悬停骨架段高亮 (仅视觉提示)
  {
    const drawSegHighlight = (refIdx: number, alpha: number, widthScale: number) => {
      ctx.strokeStyle = refLineColor(refIdx)
      ctx.lineWidth = strokeW * widthScale
      ctx.globalAlpha = alpha
      for (const sgm of zoneRibbon) {
        const belong = sgm.refLineIdx === refIdx ||
          (sgm.arcAdjRefLines && sgm.arcAdjRefLines.includes(refIdx))
        if (!belong) continue
        ctx.beginPath()
        ctx.moveTo(mapCanvasX(sgm.pts[0].x), mapCanvasY(sgm.pts[0].y))
        for (let s = 1; s < sgm.pts.length; s++) {
          ctx.lineTo(mapCanvasX(sgm.pts[s].x), mapCanvasY(sgm.pts[s].y))
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
    if (hoveredRefLineIdx.value != null && hoveredRefLineIdx.value !== selectedRefLineIdx.value) {
      drawSegHighlight(hoveredRefLineIdx.value, 0.3, 1.2)
    }
    if (selectedRefLineIdx.value != null) {
      drawSegHighlight(selectedRefLineIdx.value, 0.55, 1.6)
    }
  }

  // 4. 悬停锚点连线 (采样点 → 带子锚点)
  if (hoveredBindInfo.value?.anchor && hoveredBindInfo.value.index != null) {
    const info = hoveredBindInfo.value
    ctx.strokeStyle = refLineColor(info.refLineIdx >= 0 ? info.refLineIdx : 0)
    ctx.lineWidth = 1.2
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(mapCanvasX(info.px), mapCanvasY(info.py))
    ctx.lineTo(mapCanvasX(info.anchor.x), mapCanvasY(info.anchor.y))
    ctx.stroke()
    ctx.setLineDash([])
    // 锚点圆
    ctx.fillStyle = ctx.strokeStyle
    ctx.beginPath()
    ctx.arc(mapCanvasX(info.anchor.x), mapCanvasY(info.anchor.y), 4, 0, Math.PI * 2)
    ctx.fill()
  }

  // 4.5 刚刷区间的闪烁反馈 (亮黄色描边, 700ms 后消失)
  if (flashRange) {
    if (performance.now() < flashRange.until) {
      ctx.strokeStyle = "rgba(255, 200, 0, 0.85)"
      ctx.lineWidth = strokeW * 1.8
      ctx.beginPath()
      ctx.moveTo(mapCanvasX(samplePoints[flashRange.start * 2]), mapCanvasY(samplePoints[flashRange.start * 2 + 1]))
      for (let i = flashRange.start + 1; i <= flashRange.end; i++) {
        ctx.lineTo(mapCanvasX(samplePoints[i * 2]), mapCanvasY(samplePoints[i * 2 + 1]))
      }
      ctx.stroke()
    } else {
      flashRange = null
    }
  }

  // 5. 刷圈 (跟随鼠标, 无文字 — 模式看面板单选)
  {
    const mouseX = options?.mouseX ?? lastMouse?.x
    const mouseY = options?.mouseY ?? lastMouse?.y
    if (mouseX !== undefined && mouseY !== undefined && Number.isFinite(mouseX) && Number.isFinite(mouseY)) {
      const isClear = bindEditMode.value === 'clear'
      ctx.fillStyle = isClear ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 0, 0, 0.35)"
      ctx.beginPath()
      ctx.ellipse(mapCanvasX(mouseX), mapCanvasY(mouseY), mapCanvasX(brushSize.value) / 2, mapCanvasX(brushSize.value) / 2, 0, 0, 2 * Math.PI)
      ctx.fill()
    }
  }

  ctx.restore()
}
