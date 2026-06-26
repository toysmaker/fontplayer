/**
 * 后处理引擎
 * 在每次 executeGlyphScript 后自动应用后处理规则
 */

import { PostProcessRuleType } from '../types'
import type { IContour, IContours } from '../font/types'
import type { CustomGlyph } from '../instance/CustomGlyph'
import { contourDifference } from '../utils/booleanOperations'
import { contourUnite, contourDilate } from '../utils/contourDilate'
import { ContourConverter } from '../font/converter'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'

/** 差集留白默认膨胀距离（px） */
const DEFAULT_WHITESPACE_MARGIN = 30

function getContourBounds(contours: IContours): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const c of contours) {
    for (const seg of c) {
      if (isFinite(seg.start.x)) { minX = Math.min(minX, seg.start.x); maxX = Math.max(maxX, seg.start.x) }
      if (isFinite(seg.start.y)) { minY = Math.min(minY, seg.start.y); maxY = Math.max(maxY, seg.start.y) }
      if (isFinite(seg.end.x)) { minX = Math.min(minX, seg.end.x); maxX = Math.max(maxX, seg.end.x) }
      if (isFinite(seg.end.y)) { minY = Math.min(minY, seg.end.y); maxY = Math.max(maxY, seg.end.y) }
    }
  }
  return { minX, minY, maxX, maxY }
}

export class PostProcessEngine {
  /**
   * 在脚本执行后自动应用所有后处理规则
   * 由 ScriptExecutor.executeGlyphScript 调用
   */
  /**
   * @param glyphInstance 字形实例
   * @param selfComponentUuid 当前组件在字符组件列表中的 UUID（唯一标识，用于精确定位）
   */
  static executeAll(glyphInstance: CustomGlyph, selfComponentUuid?: string): void {
    const rules = glyphInstance._glyph.postProcessRules
    if (!rules?.length) return
    if (!glyphInstance._components?.length) return

    // 获取当前编辑环境中的兄弟组件
    let allComponents: Array<{ uuid: string; usedInCharacter?: boolean; [key: string]: any }> = []
    try {
      const characterStore = useCharacterStore()
      const glyphStore = useGlyphStore()
      const ch = characterStore.editingCharacter
      const eg = glyphStore.editingGlyph
      if (ch) {
        allComponents = ch.components || []
      } else if (eg) {
        allComponents = eg.components || []
      }
    } catch {
      // 非编辑上下文（如导出），跳过跨组件处理
      return
    }

    // 重置上一次后处理的遗留状态：清除 _postProcessed 标记和旧轮廓
    for (const comp of glyphInstance._components) {
      comp._postProcessed = false
      delete comp.contour
      delete comp.preview
    }

    // 找到当前字形组件在兄弟列表中的位置
    // 两阶段查找：先精确匹配组件 UUID，再回退到 glyph UUID
    // 同一字形被多个组件引用时，glyphUuid 相同，必须用 selfComponentUuid 精确区分
    const glyphUuid = glyphInstance._glyph.uuid
    let selfComp: any = undefined
    if (selfComponentUuid) {
      selfComp = allComponents.find(c => c.uuid === selfComponentUuid)
    }
    if (!selfComp) {
      selfComp = allComponents.find(c =>
        c.uuid === glyphUuid || (c as any).value?.uuid === glyphUuid,
      )
    }
    if (!selfComp) {
      // 如果都找不到，跳过（可能是字形编辑模式下的独立字形）
      if (import.meta.env.DEV) {
        console.warn(
          '[PostProcessEngine] selfComp not found: glyphUuid=%s selfComponentUuid=%s',
          glyphUuid,
          selfComponentUuid,
        )
      }
    }

    const glyphOffset = {
      x: (selfComp?.x || 0) + ((selfComp as any)?.ox || 0),
      y: (selfComp?.y || 0) + ((selfComp as any)?.oy || 0),
    }

    if (import.meta.env.DEV) {
      console.log(
        '[PostProcessEngine] selfComp: name=%s x=%d y=%d ox=%d oy=%d → glyphOffset=(%d, %d) | glyphUuid=%s selfComponentUuid=%s',
        selfComp?.name || '(unknown)',
        selfComp?.x ?? 0,
        selfComp?.y ?? 0,
        (selfComp as any)?.ox ?? 0,
        (selfComp as any)?.oy ?? 0,
        glyphOffset.x,
        glyphOffset.y,
        glyphUuid,
        selfComponentUuid || '(undefined)',
      )
      // 列出所有匹配的组件，帮助排查同一字形多实例问题
      const matching = allComponents.filter(c =>
        (c as any).value?.uuid === glyphUuid,
      )
      if (matching.length > 1) {
        console.log(
          '[PostProcessEngine] ⚠ 同一字形 %d 个组件实例: %s',
          matching.length,
          matching.map(c => `${c.name}(uuid=${c.uuid} ox=${(c as any).ox ?? 0} oy=${(c as any).oy ?? 0})`).join(', '),
        )
      }
    }

    for (const rule of rules) {
      const targetUUIDs: string[] = (rule as any).targetComponentUUIDs || []
      if (!targetUUIDs.length) continue

      const isRetainWhitespace = rule.type === PostProcessRuleType.DifferenceRetainWhitespace
      const isDifference = rule.type === PostProcessRuleType.Difference
      if (!isDifference && !isRetainWhitespace) continue

      // 获取目标组件的编辑空间轮廓
      const targetEditContours: IContour[] = []
      for (const uuid of targetUUIDs) {
        const targetComp = allComponents.find((c: any) => c.uuid === uuid)
        if (!targetComp || targetComp.usedInCharacter === false) continue
        if (import.meta.env.DEV) {
          console.log(
            '[PostProcessEngine] target: name=%s uuid=%s type=%s x=%d y=%d ox=%d oy=%d',
            targetComp.name || '(unknown)',
            uuid,
            targetComp.type,
            targetComp.x ?? 0,
            targetComp.y ?? 0,
            (targetComp as any).ox ?? 0,
            (targetComp as any).oy ?? 0,
          )
        }
        targetEditContours.push(
          ...ContourConverter.componentsToContoursEditing([targetComp as any], { x: 0, y: 0 }),
        )
      }
      if (!targetEditContours.length) continue

      if (import.meta.env.DEV) {
        console.log(
          '[PostProcessEngine] 规则类型: %s, 目标轮廓数: %d',
          isRetainWhitespace ? '差集留白' : '差集',
          targetEditContours.length,
        )
        targetEditContours.forEach((c, i) => {
          console.log('[PostProcessEngine]   目标轮廓[%d]: %d 段', i, c.length)
        })
      }

      // 差集留白：先合并目标轮廓，再膨胀指定距离
      let clipContoursList: IContours[]
      if (isRetainWhitespace) {
        const margin = (rule as any).whitespaceMargin ?? DEFAULT_WHITESPACE_MARGIN
        const united = contourUnite(targetEditContours)
        if (import.meta.env.DEV) {
          console.log(
            '[PostProcessEngine] 差集留白: %d 个目标轮廓 → unite 后 %d 个轮廓 → dilate(%d)',
            targetEditContours.length,
            united.length,
            margin,
          )
        }
        const dilated = contourDilate(united, margin)
        if (import.meta.env.DEV) {
          console.log(
            '[PostProcessEngine] dilate 结果: %d 个轮廓 (原始 %d 个)',
            dilated.length,
            united.length,
          )
        }
        clipContoursList = dilated.map((c) => [c])
      } else {
        clipContoursList = targetEditContours.map((c) => [c])
      }

      // 对每个脚本组件应用差集
      for (const comp of glyphInstance._components) {
        if (!comp.points?.length && !comp.contour?.length) continue

        const compContour = ContourConverter.componentsToContoursEditing(
          [comp as any], glyphOffset,
        )
        if (!compContour.length) continue

        if (import.meta.env.DEV) {
          const subBounds = getContourBounds(compContour)
          const clipBounds = clipContoursList.map(cs => getContourBounds(cs))
          console.log(
            '[PostProcessEngine] 差集: subject[%d] bounds(%d,%d,%d,%d) glyphOffset(%d,%d) clipCount=%d',
            compContour.length,
            Math.round(subBounds.minX), Math.round(subBounds.minY),
            Math.round(subBounds.maxX), Math.round(subBounds.maxY),
            glyphOffset.x, glyphOffset.y,
            clipContoursList.length,
          )
          clipBounds.forEach((b, i) => {
            console.log(
              '[PostProcessEngine]   clip[%d] bounds(%d,%d,%d,%d)',
              i,
              Math.round(b.minX), Math.round(b.minY),
              Math.round(b.maxX), Math.round(b.maxY),
            )
          })
        }

        const diffResult = PostProcessEngine.applyDifferenceToContours(
          compContour,
          clipContoursList,
        )
        if (diffResult.length > 0 && diffResult[0]?.length > 0) {
          const localContour: IContour = diffResult[0].map((path: any) => ({
            ...path,
            start: { x: path.start.x - glyphOffset.x, y: path.start.y - glyphOffset.y },
            end: { x: path.end.x - glyphOffset.x, y: path.end.y - glyphOffset.y },
            ...(path.control1 ? {
              control1: { x: path.control1.x - glyphOffset.x, y: path.control1.y - glyphOffset.y },
              control2: { x: path.control2.x - glyphOffset.x, y: path.control2.y - glyphOffset.y },
            } : {}),
            ...(path.control && !path.control1 ? {
              control: { x: path.control.x - glyphOffset.x, y: path.control.y - glyphOffset.y },
            } : {}),
          }))
          comp.contour = localContour
          comp.preview = localContour
          comp._postProcessed = true

          if (import.meta.env.DEV) {
            const localBounds = getContourBounds([localContour])
            const origBounds = getContourBounds(compContour)
            console.log(
              '[PostProcessEngine] diff结果 localBounds(%d,%d,%d,%d) 原始subjBounds(%d,%d,%d,%d)',
              Math.round(localBounds.minX), Math.round(localBounds.minY),
              Math.round(localBounds.maxX), Math.round(localBounds.maxY),
              Math.round(origBounds.minX), Math.round(origBounds.minY),
              Math.round(origBounds.maxX), Math.round(origBounds.maxY),
            )
            // 检查差集后轮廓中所有远离主体（200px 以外）的孤立点
            const cx = (localBounds.minX + localBounds.maxX) / 2
            const cy = (localBounds.minY + localBounds.maxY) / 2
            const allPts: Array<{x: number; y: number; label: string}> = []
            for (const seg of localContour) {
              allPts.push({ x: seg.start.x, y: seg.start.y, label: 'start' })
              allPts.push({ x: seg.end.x, y: seg.end.y, label: 'end' })
            }
            // 找到离中心最远的10%的点 → 可能是异常 spike
            const sorted = allPts.map(p => ({...p, d: Math.hypot(p.x-cx, p.y-cy)})).sort((a,b) => b.d - a.d)
            const threshold = sorted[Math.max(0, Math.floor(sorted.length * 0.05))]?.d ?? 300
            for (const p of sorted) {
              if (p.d > threshold && p.d > 200) {
                console.warn(
                  '[PostProcessEngine] ⚠ 远端顶点: %s(%d,%d) 距中心(%d,%d) d=%d',
                  p.label, Math.round(p.x), Math.round(p.y), Math.round(cx), Math.round(cy), Math.round(p.d),
                )
              }
            }
          }
          comp.contour = localContour
          comp.preview = localContour
          comp._postProcessed = true
          if (import.meta.env.DEV) {
            console.log('[PostProcessEngine] selfComp完整:', selfComp)
            console.log('[PostProcessEngine] glyphInstance:', glyphInstance)
          }
        }
      }
    }
  }

  /**
   * 应用差集后处理到轮廓数据
   */
  static applyDifferenceToContours(
    subjectContours: IContours,
    clipContoursList: IContours[],
  ): IContours {
    if (!subjectContours.length) return []
    if (!clipContoursList.length) return [...subjectContours]

    if (import.meta.env.DEV) {
      const sb = getContourBounds(subjectContours)
      console.log(
        '[PostProcessEngine.applyDiff] 输入: subject %d段 bounds(%.0f,%.0f,%.0f,%.0f) clipList长度=%d',
        subjectContours.length,
        sb.minX, sb.minY, sb.maxX, sb.maxY,
        clipContoursList.length,
      )
      clipContoursList.forEach((cc, i) => {
        if (cc.length) {
          const cb = getContourBounds(cc)
          console.log(
            '[PostProcessEngine.applyDiff]   clip[%d] %d段 bounds(%.0f,%.0f,%.0f,%.0f)',
            i, cc.length, cb.minX, cb.minY, cb.maxX, cb.maxY,
          )
        }
      })
    }

    let result = subjectContours
    for (const clipContours of clipContoursList) {
      if (!clipContours.length) continue
      result = contourDifference(result, clipContours)
      if (!result.length) {
        if (import.meta.env.DEV) console.warn('[PostProcessEngine.applyDiff] contourDifference 返回空!')
        break
      }
    }

    if (import.meta.env.DEV) {
      const rb = getContourBounds(result)
      console.log(
        '[PostProcessEngine.applyDiff] 输出: %d段 bounds(%.0f,%.0f,%.0f,%.0f)',
        result.length,
        rb.minX, rb.minY, rb.maxX, rb.maxY,
      )
    }

    return result
  }
}
