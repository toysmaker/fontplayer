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

export class PostProcessEngine {
  /**
   * 在脚本执行后自动应用所有后处理规则
   * 由 ScriptExecutor.executeGlyphScript 调用
   */
  static executeAll(glyphInstance: CustomGlyph): void {
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

    // 找到当前字形组件在兄弟列表中的位置
    const glyphUuid = glyphInstance._glyph.uuid
    const selfComp = allComponents.find(c => c.uuid === glyphUuid || (c as any).value?.uuid === glyphUuid)
    if (!selfComp) {
      // 尝试通过 instance key 查找
      // 如果都找不到，跳过（可能是字形编辑模式下的独立字形）
    }

    const glyphOffset = {
      x: (selfComp?.x || 0) + ((selfComp as any)?.ox || 0),
      y: (selfComp?.y || 0) + ((selfComp as any)?.oy || 0),
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
        targetEditContours.push(
          ...ContourConverter.componentsToContoursEditing([targetComp as any], { x: 0, y: 0 }),
        )
      }
      if (!targetEditContours.length) continue

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

    let result = subjectContours
    for (const clipContours of clipContoursList) {
      if (!clipContours.length) continue
      result = contourDifference(result, clipContours)
      if (!result.length) break
    }
    return result
  }
}
