/**
 * 后处理引擎
 * 在每次 executeGlyphScript 后自动应用后处理规则
 */

import { PostProcessRuleType } from '../types'
import type { IContour, IContours } from '../font/types'
import type { CustomGlyph } from '../instance/CustomGlyph'
import { contourDifference } from '../utils/booleanOperations'
import { ContourConverter } from '../font/converter'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'

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
      if (rule.type !== PostProcessRuleType.Difference) continue
      const targetUUIDs: string[] = (rule as any).targetComponentUUIDs || []
      if (!targetUUIDs.length) continue

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

      // 对每个脚本组件应用差集
      for (const comp of glyphInstance._components) {
        if (!comp.points?.length && !comp.contour?.length) continue

        // 脚本组件轮廓（提升到字符空间）
        const compContour = ContourConverter.componentsToContoursEditing(
          [comp as any], glyphOffset,
        )
        if (!compContour.length) continue

        const diffResult = PostProcessEngine.applyDifferenceToContours(
          compContour,
          targetEditContours.map(c => [c]),
        )
        if (diffResult.length > 0 && diffResult[0]?.length > 0) {
          // 移回字形局部空间，保持编辑空间坐标（与 component.render 一致）
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
          // 直接存储编辑空间轮廓用于 canvas 渲染（单个 IContour，与 updateData 输出格式一致）
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
