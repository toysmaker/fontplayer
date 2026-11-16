/**
 * 笔画风格替换：核心逻辑
 *
 * 对于脚本生成的字形组件或绑定骨架的字形组件，字形中通常带有骨架信息。
 * 同一个骨架可以替换成不同风格的笔画。替换前需要校验同名笔画实例的
 * 所有关键点（骨架关节）同名且对应匹配，否则不替换该笔画。
 */

import * as R from 'ramda'
import type { ICharacterFileLite, ICustomGlyph, IGlyphComponent } from '@/core/types'
import { ParameterType } from '@/core/types'
import { parameterRowsForGlyph } from '@/core/utils/glyph'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import {
  glyphSkeletonBindFromRefGlyph,
  glyphSkeletonRebind,
} from '@/features/glyphSkeletonBind'

/** 骨架对象上非关键点（关节）的元数据字段 */
const SKELETON_META_KEYS = new Set<string>([
  'type',
  'ox',
  'oy',
  'dynamicWeight',
  'originWeight',
  'onSkeletonBind',
  'skeletonBindData',
  'glyphSkeletonBindData',
  'cachedJoints',
  'cachedRefLines',
  'variableKeyframeBinds',
  'boneSegmentsPerRefLine',
  'referenceGlyphUUID',
  'referenceGlyphData',
])

/**
 * 提取字形骨架的关键点（关节）名称集合。
 * - glyphSkeleton 类型：从 cachedJoints 取关节名（缺失时回退到 cachedRefLines 引用的关节名）
 * - 普通骨架类型：骨架对象上除元数据字段外的键即为关节名
 * 返回 null 表示字形没有骨架信息。
 */
export function getGlyphSkeletonJointNames(glyph: ICustomGlyph): string[] | null {
  const s = (glyph as any).skeleton
  if (!s || typeof s !== 'object') return null

  if (s.type === 'glyphSkeleton') {
    const cachedJoints = s.cachedJoints as Array<{ name?: string }> | undefined
    if (Array.isArray(cachedJoints) && cachedJoints.length > 0) {
      const names = cachedJoints.map((j) => j?.name).filter((n): n is string => !!n)
      if (names.length > 0) return [...new Set(names)].sort()
    }
    const cachedRefLines = s.cachedRefLines as Array<{ start?: string; end?: string }> | undefined
    if (Array.isArray(cachedRefLines) && cachedRefLines.length > 0) {
      const set = new Set<string>()
      for (const r of cachedRefLines) {
        if (r?.start) set.add(r.start)
        if (r?.end) set.add(r.end)
      }
      if (set.size > 0) return [...set].sort()
    }
    return null
  }

  const names = Object.keys(s)
    .filter((k) => !SKELETON_META_KEYS.has(k) && s[k] !== null && typeof s[k] === 'object')
    .sort()
  return names.length > 0 ? names : null
}

/**
 * 检查两个同名笔画实例的所有关键点是否同名且对应匹配。
 * 双方都没有骨架信息时视为匹配（普通组件替换）。
 */
export function strokeKeyPointsMatch(current: ICustomGlyph, target: ICustomGlyph): boolean {
  const a = getGlyphSkeletonJointNames(current)
  const b = getGlyphSkeletonJointNames(target)
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * 用目标风格的字形替换字符文件中一个字形组件的 value。
 * 保留当前笔画同名参数值；glyphSkeleton 类型同时迁移 ox/oy 并重新绑定。
 * 返回 false 表示组件不存在或不是字形组件。
 */
export function replaceGlyphComponentValueWithTarget(
  characterFile: ICharacterFileLite,
  componentUuid: string,
  targetGlyph: ICustomGlyph,
): boolean {
  const comp = (characterFile.components || []).find((c) => c.uuid === componentUuid)
  if (!comp || comp.type !== 'glyph') return false
  const gc = comp as IGlyphComponent
  const curGlyph = gc.value as ICustomGlyph | undefined
  if (!curGlyph || typeof curGlyph !== 'object') return false

  const newGlyph = R.clone(targetGlyph) as ICustomGlyph
  const destParams = parameterRowsForGlyph(newGlyph) ?? []
  const srcParams = parameterRowsForGlyph(curGlyph) ?? []

  // 复制同名参数值：保持当前笔画骨架姿态（字重、弯曲程度等）
  for (const dp of destParams) {
    const sp = srcParams.find((q: { name: string }) => q.name === dp.name)
    if (!sp) continue
    if (sp.type === ParameterType.Constant) {
      dp.type = ParameterType.Constant
      dp.value = sp.value
    } else if (dp.type !== ParameterType.Constant) {
      dp.value = sp.value
    }
  }

  // 字形骨架切换：复制 ox/oy，保留新风格字形的笔组件（由新骨架变形）
  const isOldGlyphSkeleton = (curGlyph.skeleton as any)?.type === 'glyphSkeleton'
  const isNewGlyphSkeleton = (newGlyph.skeleton as any)?.type === 'glyphSkeleton'

  if (isOldGlyphSkeleton && isNewGlyphSkeleton) {
    if ((newGlyph.skeleton as any) && (curGlyph.skeleton as any)) {
      ;(newGlyph.skeleton as any).ox = (curGlyph.skeleton as any).ox ?? 0
      ;(newGlyph.skeleton as any).oy = (curGlyph.skeleton as any).oy ?? 0
    }
    // 确保 adaptedScript 函数名匹配新字形 UUID
    const refData = (newGlyph.skeleton as any)?.referenceGlyphData
    if (refData) {
      if (!refData.adaptedScript && refData.script) {
        const refUuid = (newGlyph.skeleton as any).referenceGlyphUUID || ''
        const editUuid = newGlyph.uuid
        refData.adaptedScript = refData.script.replace(
          `script_${refUuid.replaceAll('-', '_')}`,
          `script_${editUuid.replaceAll('-', '_')}`,
        )
      } else if (refData.adaptedScript) {
        const editFnName = `script_${newGlyph.uuid.replaceAll('-', '_')}`
        if (!refData.adaptedScript.includes(editFnName)) {
          refData.adaptedScript = refData.adaptedScript.replace(/script_[a-z0-9_]+/g, editFnName)
        }
      }
    }
  }

  gc.value = newGlyph

  if (isNewGlyphSkeleton) {
    // 字形骨架绑定：需要将 adaptedScript 临时设置到 glyph.script 上供脚本执行
    const refData = (newGlyph.skeleton as any)?.referenceGlyphData
    const adaptedScript = refData?.adaptedScript
    const savedScript = newGlyph.script
    if (adaptedScript) {
      newGlyph.script = adaptedScript
      newGlyph.script_reference = undefined
    }
    try {
      executeGlyphScript(newGlyph, comp.uuid, { ignoreTempDataGuard: true })
    } finally {
      newGlyph.script = savedScript
    }
    // 脚本执行后绑定笔组件到新骨架
    const inst = instanceManager.getInstance(
      comp.uuid,
      () => new CustomGlyph(newGlyph),
      'glyph',
    ) as unknown as CustomGlyph
    if (inst) {
      inst._components = []
      const hasExistingBind = !!(newGlyph.skeleton as any)?.glyphSkeletonBindData
      if (import.meta.env.DEV) {
        console.log('[strokeStyleReplace] glyphSkeleton bind:', {
          strokeName: newGlyph.name,
          hasExistingBind,
          hasPenComps: newGlyph.components?.some((c: any) => c.type === 'pen'),
          penCount: newGlyph.components?.filter((c: any) => c.type === 'pen').length || 0,
          oldBindBones: (newGlyph.skeleton as any)?.glyphSkeletonBindData?.bones?.length || 0,
        })
      }
      if (hasExistingBind) {
        glyphSkeletonRebind(inst)
      } else if (refData && newGlyph.components?.some((c: any) => c.type === 'pen')) {
        glyphSkeletonBindFromRefGlyph(inst, refData, (newGlyph.skeleton as any).boneSegmentsPerRefLine || 5)
      }
      // 更新 componentPointRanges 为新字形笔组件的 UUID（originalPoints 和 bindMatrix 由 rebind/bindFn 保留）
      const bindData = (newGlyph.skeleton as any)?.glyphSkeletonBindData
      if (bindData && newGlyph.components) {
        const penComps = (newGlyph.components as any[]).filter((c: any) => c.type === 'pen')
        const newRanges: Array<{ componentUUID: string; start: number; end: number }> = []
        let offset = 0
        for (const pc of penComps) {
          const pts = pc.value?.points
          if (pts && pts.length > 0) {
            newRanges.push({ componentUUID: pc.uuid, start: offset, end: offset + pts.length })
            offset += pts.length
          }
        }
        if (newRanges.length > 0) {
          bindData.componentPointRanges = newRanges
        }
      }
    }
  } else {
    executeGlyphScript(newGlyph, comp.uuid)
  }

  return true
}

/** 整体替换计划中可替换的笔画对 */
export type StrokeReplacePair = {
  componentUuid: string
  name: string
  targetGlyph: ICustomGlyph
}

/** 整体替换计划中跳过（不替换）的笔画 */
export type StrokeReplaceSkipped = {
  componentUuid: string
  name: string
  /** noSameName: 目标风格没有同名笔画; keyPoints: 关键点不匹配 */
  reason: 'noSameName' | 'keyPoints'
}

export type WholeStyleReplacePlan = {
  pairs: StrokeReplacePair[]
  skipped: StrokeReplaceSkipped[]
}

/**
 * 规划整体笔画风格替换：检查当前字符中所有笔画与目标风格同名笔画的关键点匹配情况。
 * 不匹配或没有同名笔画的笔画记入 skipped，不作替换。
 */
export function planWholeStyleReplace(
  characterFile: ICharacterFileLite,
  style: string,
  styledStrokes: ICustomGlyph[],
): WholeStyleReplacePlan {
  const plan: WholeStyleReplacePlan = { pairs: [], skipped: [] }
  for (const comp of characterFile.components || []) {
    if (comp.type !== 'glyph') continue
    const gc = comp as IGlyphComponent
    const cur = gc.value as ICustomGlyph | undefined
    if (!cur || typeof cur !== 'object') continue
    const strokeName = cur.name
    const target = styledStrokes.find((g) => g.name === strokeName)
    if (!target) {
      plan.skipped.push({ componentUuid: comp.uuid, name: strokeName, reason: 'noSameName' })
      continue
    }
    if (!strokeKeyPointsMatch(cur, target)) {
      plan.skipped.push({ componentUuid: comp.uuid, name: strokeName, reason: 'keyPoints' })
      continue
    }
    plan.pairs.push({ componentUuid: comp.uuid, name: strokeName, targetGlyph: target })
  }
  return plan
}
