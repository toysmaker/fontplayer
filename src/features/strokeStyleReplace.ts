/**
 * 笔画风格替换：核心逻辑
 *
 * 对于脚本生成的字形组件或绑定骨架的字形组件，字形中通常带有骨架信息。
 * 同一个骨架可以替换成不同风格的笔画。替换前需要校验同名笔画实例的
 * 所有关键点（骨架关节）同名且对应匹配，否则不替换该笔画。
 */

import { useProjectStore } from '@/stores/project'
import type { ICharacterFileLite, ICustomGlyph, IGlyphComponent, IParameter } from '@/core/types'
import { ParameterType } from '@/core/types'
import { parameterRowsForGlyph } from '@/core/utils/glyph'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { genUUID } from '@/utils/uuid'
import { strokes } from '@/templates/private/v1/strokes'
import {
  glyphSkeletonBindFromRefGlyph,
  glyphSkeletonRebind,
} from '@/features/glyphSkeletonBind'

/**
 * 通用参数兼容：替换的目标风格脚本读取的参数名可能与目标字形参数列表不一致。
 * 只要笔画名称与关键点匹配即可替换，参数层在此兜底——目标脚本 getParam 需要的
 * 参数缺失时按优先级补全（缺失才补、幂等，值/范围与来源一致）：
 * 1. strokes 数据别名（originParam，如「竖-长度」←「竖-竖直延伸」）；
 * 2. 弯曲度 → 弯曲游标（如「撇-弯曲游标」←「撇-弯曲度」）；
 * 3. 源笔画同名参数（数值型才补，避免常量 UUID 字符串进入目标脚本算术产生 NaN）；
 * 4. 源笔画中带「X-弯曲度」且目标脚本需要「X-弯曲游标」而目标仅有「X-弯曲度」；
 * 5. 常量 UUID 字符串值解析：目标脚本自身不解析常量（脚本文本不含 getByUUID/constantsMap）
 *    时，把参数值里的常量 UUID 字符串解析为数值写入（治愈被历史复制污染的笔画池）。
 *
 * @param resolveConstant 常量解析器（返回数值或 undefined），仅在需要时提供
 */
export function ensureStrokeParamCompatibility(
  glyph: ICustomGlyph,
  sourceGlyph?: ICustomGlyph,
  resolveConstant?: (uuid: string) => number | undefined,
): void {
  const params = (glyph.parameters ||= []) as IParameter[]
  const has = (name: string) => params.some((p) => p.name === name)

  const pushAlias = (name: string, base: IParameter) => {
    if (has(name)) return
    params.push({
      uuid: genUUID(),
      name,
      type: base.type,
      value: base.value,
      min: base.min,
      max: base.max,
    })
  }

  // 1. strokes 数据别名（originParam）
  const data = (strokes as Array<{ name: string; params?: Array<{ name: string; originParam?: string; default?: number }> }>).find(
    (s) => s.name === glyph.name,
  )
  if (data) {
    for (const dp of data.params || []) {
      if (!dp.originParam) continue
      const base = params.find((p) => p.name === dp.name)
      if (base) pushAlias(dp.originParam, base)
    }
  }

  // 2. 弯曲度 → 弯曲游标 别名（对已存在的每个弯曲度参数）
  for (const p of [...params]) {
    if (!p.name.endsWith('弯曲度')) continue
    pushAlias(p.name.replace('弯曲度', '弯曲游标'), p)
  }

  // strokes 数据默认值表（供 3/5 兜底，任意风格只要数据注册了默认即可用）
  const dataDefaults = new Map<string, number>()
  if (data) {
    for (const dp of data.params || []) {
      if (typeof dp.default === 'number') dataDefaults.set(dp.name, dp.default)
    }
  }

  // 3/4. 扫描目标脚本实际读取的参数名，缺失的按优先级补齐：
  //     源笔画同名数值 → 弯曲度/弯曲游标互转 → strokes 数据规范默认值
  const script = glyph.script
  if (script) {
    const srcParams = (sourceGlyph?.parameters || []) as IParameter[]
    const srcByName = new Map<string, IParameter>()
    for (const p of srcParams) srcByName.set(p.name, p)
    const needed = new Set<string>()
    for (const m of script.matchAll(/(?:getParam|getParamRange)\('([^']+)'\)/g)) {
      needed.add(m[1])
    }
    for (const name of needed) {
      if (has(name)) continue
      const src = srcByName.get(name)
      if (src && typeof src.value === 'number') {
        pushAlias(name, src)
        continue
      }
      // 目标脚本需要「X-弯曲游标」，源只有「X-弯曲度」
      if (name.endsWith('弯曲游标')) {
        const bendSrc = srcByName.get(name.replace('弯曲游标', '弯曲度'))
        if (bendSrc && typeof bendSrc.value === 'number') {
          pushAlias(name, bendSrc)
          continue
        }
      }
      // 目标脚本需要「X-弯曲度」，源只有「X-弯曲游标」
      if (name.endsWith('弯曲度')) {
        const cursorSrc = srcByName.get(name.replace('弯曲度', '弯曲游标'))
        if (cursorSrc && typeof cursorSrc.value === 'number') {
          pushAlias(name, cursorSrc)
          continue
        }
      }
      // 数据默认值兜底：任意风格的导入数据缺参时，按注册的规范默认补一个数值参数
      const def = dataDefaults.get(name)
      if (typeof def === 'number') {
        params.push({
          uuid: genUUID(),
          name,
          type: ParameterType.Number,
          value: def,
          min: 0,
          max: 1000,
        })
      }
    }
  }

  // 5. 常量 UUID 字符串值解析（治愈被历史复制污染的笔画池）：
  //    优先用常量表解析；解析不出时回落到规范默认值（strokes 数据默认 → 通用参数默认表）
  if (script && !/getByUUID|constantsMap/.test(script)) {
    for (const p of params) {
      if (p.type === ParameterType.Constant || p.type === ParameterType.AdvancedEditConstant) continue
      if (typeof p.value !== 'string' || p.value.length < 16) continue
      let resolved: number | undefined
      if (resolveConstant) {
        resolved = resolveConstant(p.value)
      }
      if (typeof resolved !== 'number') {
        resolved = dataDefaults.get(p.name) ?? COMMON_PARAM_DEFAULT_FALLBACKS[p.name]
      }
      if (typeof resolved === 'number') {
        p.value = resolved
      } else if (import.meta.env.DEV) {
        // 无法解析且无默认可回落：保留原值并告警，便于模板作者发现数据缺漏
        console.warn(
          `[strokeStyleReplace] 参数「${p.name}」的常量 UUID 无法解析且无默认值，保留原值（可能导致该笔画渲染异常）`,
        )
      }
    }
  }
}

/** 导入模板时统一追加的通用参数规范默认值（参数被常量 UUID 污染且无法解析时的最终兜底） */
const COMMON_PARAM_DEFAULT_FALLBACKS: Record<string, number> = {
  '字重': 50,
  '字重比率': 1,
  '竖横比': 3,
  '参考位置': 0,
  '起笔风格': 1,
  '起笔数值': 2,
  '收笔风格': 1,
  '收笔数值': 2,
  '转角风格': 1,
  '转角数值': 2,
  '字重变化': 0,
  '弯曲程度': 1,
}

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

  // JSON 深拷贝：避免 ramda clone 对 Vue 响应式代理的别名问题污染笔画池
  const newGlyph = JSON.parse(JSON.stringify(targetGlyph)) as ICustomGlyph
  const destParams = parameterRowsForGlyph(newGlyph) ?? []
  const srcParams = parameterRowsForGlyph(curGlyph) ?? []

  // 复制同名参数值：保持当前笔画骨架姿态（字重、弯曲程度等）
  for (const dp of destParams) {
    const sp = srcParams.find((q: { name: string }) => q.name === dp.name)
    if (!sp) continue
    if (sp.value === undefined || sp.value === null) continue
    // 兼容处理 1：Enum 参数（起笔/收笔/转角风格等）是风格专属语义，跨风格复制会带错值
    // （如黑体起笔风格=2 在宋体脚本中无对应分支 → 空笔画），目标保留自身枚举默认值
    if (sp.type === ParameterType.Enum || dp.type === ParameterType.Enum) continue
    // 兼容处理 2：内置模板笔画的参数值可能是常量 UUID 字符串（源脚本自行解析），
    // 而目标风格脚本期望普通数值；跨风格复制时类型不一致会算出 NaN（画布空白）。
    // 类型不一致时保留目标风格自身默认值，不复制。
    if (sp.type !== ParameterType.Constant && typeof sp.value !== typeof dp.value) continue
    if (sp.type === ParameterType.Constant) {
      dp.type = ParameterType.Constant
      dp.value = sp.value
    } else if (dp.type !== ParameterType.Constant) {
      dp.value = sp.value
    }
  }

  // 通用参数兼容：目标风格脚本读取的参数名与目标参数列表不一致时，
  // 按别名 registry / 弯曲度↔弯曲游标 / 源笔画同名参数 补全缺失参数；
  // 并解析目标参数里的常量 UUID 字符串值（治愈被历史复制污染的笔画池）
  const resolveConstant = (uuid: string): number | undefined => {
    const cm = useProjectStore().constantsMap as unknown as { getByUUID?: (u: string) => unknown } | undefined
    const v = cm?.getByUUID?.(uuid)
    return typeof v === 'number' ? v : undefined
  }
  ensureStrokeParamCompatibility(newGlyph, curGlyph, resolveConstant)

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
