/**
 * 骨架自动重绑调度器
 *
 * 字形编辑器当前编辑字形自身的顶层钢笔几何变化(点编辑/移动/缩放/旋转/翻转)后,
 * 绑定数据采样已过期; 由 glyphStore.modifyComponent 集中触发本调度器,
 * 防抖 300ms 后按骨架类型重新绑定:
 * - 笔画骨架(skeletonBindData)   → 重跑 glyphSkeletonBind(重新采样)
 * - 字形骨架(glyphSkeletonBindData) → glyphSkeletonBindFromRefGlyph(重新采样 + 恒等跳过写回)
 *
 * 重绑只重新采样, 不修改原始锚点(恒等变换时拟合写回被跳过)。
 * 嵌套字形组件的自由编辑保持手动"编辑完成, 重新绑定"流程, 不在本调度器范围。
 */
import { useGlyphStore } from '@/stores/glyph'
import { onSkeletonBind } from '@/stores/skeletonDragger'
import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { glyphSkeletonBind, glyphSkeletonBindFromRefGlyph } from '@/features/glyphSkeletonBind'
import { getEditCanvasContext } from '@/features/editor/editCanvas'
import { strokeFnMap } from '@/templates/strokeFnMap'

const DEBOUNCE_MS = 300

let timer: ReturnType<typeof setTimeout> | null = null
let pendingGlyphUUID: string | null = null

function hasBindData(skeleton: any): boolean {
  return !!(skeleton?.skeletonBindData || skeleton?.glyphSkeletonBindData)
}

async function performRebind(): Promise<void> {
  const glyphUUID = pendingGlyphUUID
  pendingGlyphUUID = null
  if (!glyphUUID) return

  const glyphStore = useGlyphStore()
  const g = glyphStore.editingGlyph
  if (!g || g.uuid !== glyphUUID) return
  if (!hasBindData(g.skeleton)) return
  // 绑定前拖拽状态(骨架未绑定完成)不重绑
  if (onSkeletonBind.value) return

  const inst = instanceManager.getInstance(
    glyphUUID,
    () => new CustomGlyph(g),
    'glyph',
  ) as CustomGlyph | null
  if (!inst) {
    if (import.meta.env.DEV) {
      console.warn('[skeletonRebind] no editing instance for', glyphUUID)
    }
    return
  }
  inst._glyph = g

  try {
    if (g.skeleton.glyphSkeletonBindData) {
      const refData = g.skeleton.referenceGlyphData
      const segments = (g.skeleton as any).boneSegmentsPerRefLine || 5
      glyphSkeletonBindFromRefGlyph(inst, refData, segments)
    } else if (g.skeleton.skeletonBindData) {
      const strokeType = g.skeleton.type
      const strokeFn = (strokeFnMap as any)[strokeType]
      if (strokeFn?.instanceBasicGlyph) {
        // 确保实例具备 getSkeleton(与 GlyphEditPanel.handleRebind 相同的处理)
        const cloned = JSON.parse(JSON.stringify(g))
        const tempGlyph = new CustomGlyph(cloned)
        strokeFn.instanceBasicGlyph(cloned, tempGlyph)
        if ((tempGlyph as any).getSkeleton) {
          ;(inst as any).getSkeleton = (tempGlyph as any).getSkeleton
        }
      }
      glyphSkeletonBind(inst)
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[skeletonRebind] rebind failed:', err)
    }
  }

  const ctx = getEditCanvasContext()
  ctx?.onRender()
}

/** 请求防抖重绑(仅字形编辑器当前编辑字形自身的顶层钢笔几何变化时调用) */
export function requestSkeletonRebindForEditingGlyph(): void {
  const glyphStore = useGlyphStore()
  const g = glyphStore.editingGlyph
  if (!g || !hasBindData(g.skeleton)) return

  pendingGlyphUUID = g.uuid
  if (timer !== null) {
    clearTimeout(timer)
  }
  timer = setTimeout(() => {
    timer = null
    void performRebind()
  }, DEBOUNCE_MS)
}

/** 取消挂起的重绑(退出编辑/测试清理用) */
export function cancelSkeletonRebindScheduler(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  pendingGlyphUUID = null
}
