/**
 * 在内存中的工程字形与字符组件树里查找引用指定全局常量 uuid 的位置（DFS，不物化命中列表）。
 */

import type { IFile, ICustomGlyph, IGlyphComponent, ICharacterFileLite, IParameter, IComponent } from '@/core/types'
import { ParameterType } from '@/core/types'

const GLYPH_BUCKETS = ['glyphs', 'stroke_glyphs', 'radical_glyphs', 'comp_glyphs'] as const

export type ConstantUsageHit = {
  glyph: ICustomGlyph
  /** executeGlyphScript(glyph, componentUuid) 的第二个参数；根字形参数为字形自身 uuid */
  componentUuid: string
  characterUuid?: string
}

/** 同一组件上多个参数引用同一常量时会产生多条命中；执行脚本只需每个 componentUuid 一次 */
export function dedupeConstantUsageHitsByComponent(hits: ConstantUsageHit[]): ConstantUsageHit[] {
  const seen = new Set<string>()
  const out: ConstantUsageHit[] = []
  for (const h of hits) {
    if (seen.has(h.componentUuid)) continue
    seen.add(h.componentUuid)
    out.push(h)
  }
  return out
}

function paramRefsConstant(p: IParameter, constantUuid: string): boolean {
  return p.type === ParameterType.Constant && String(p.value) === constantUuid
}

function countInGlyphParameters(gv: ICustomGlyph, constantUuid: string): number {
  const arr = gv.parameters
  if (!Array.isArray(arr)) return 0
  let n = 0
  for (const p of arr) {
    if (paramRefsConstant(p, constantUuid)) n++
  }
  return n
}

function walkComponentsCount(components: IGlyphComponent[] | IComponent[] | undefined, constantUuid: string): number {
  if (!components?.length) return 0
  let n = 0
  for (const c of components as IGlyphComponent[]) {
    if (c.type === 'glyph' && c.value) {
      const gv = c.value as ICustomGlyph
      n += countInGlyphParameters(gv, constantUuid)
      n += walkComponentsCount(gv.components, constantUuid)
    }
  }
  return n
}

function walkComponentsForEach(
  components: IGlyphComponent[] | IComponent[] | undefined,
  constantUuid: string,
  onHit: (hit: ConstantUsageHit) => void,
  characterUuid?: string,
) {
  if (!components?.length) return
  for (const c of components as IGlyphComponent[]) {
    if (c.type === 'glyph' && c.value) {
      const gv = c.value as ICustomGlyph
      const arr = gv.parameters
      if (Array.isArray(arr)) {
        for (const p of arr) {
          if (paramRefsConstant(p, constantUuid)) {
            onHit({ glyph: gv, componentUuid: c.uuid, characterUuid })
          }
        }
      }
      walkComponentsForEach(gv.components, constantUuid, onHit, characterUuid)
    }
  }
}

function scanTopLevelGlyph(g: ICustomGlyph, constantUuid: string, onHit: (hit: ConstantUsageHit) => void, characterUuid?: string) {
  const arr = g.parameters
  if (Array.isArray(arr)) {
    for (const p of arr) {
      if (paramRefsConstant(p, constantUuid)) {
        onHit({ glyph: g, componentUuid: g.uuid, characterUuid })
      }
    }
  }
  walkComponentsForEach(g.components, constantUuid, onHit, characterUuid)
}

/** 仅工程内四类字形列表（不含字符里的嵌套组件） */
export function collectGlyphBucketHits(file: IFile, constantUuid: string): ConstantUsageHit[] {
  const hits: ConstantUsageHit[] = []
  for (const key of GLYPH_BUCKETS) {
    const list = file[key] as ICustomGlyph[] | undefined
    if (!list?.length) continue
    for (const g of list) {
      scanTopLevelGlyph(g, constantUuid, (h) => hits.push(h), undefined)
    }
  }
  return hits
}

/**
 * 与 collectGlyphBucketHits 相同逻辑，但每处理若干个字形根节点让出主线程。
 * 大工程里同步扫全库会长时间占满线程，表现为「字符进度走完后卡住」。
 */
async function collectGlyphBucketHitsYielding(
  file: IFile,
  constantUuid: string,
  options?: { yieldEvery?: number; onYield?: () => void },
): Promise<ConstantUsageHit[]> {
  const yieldEvery = Math.max(1, options?.yieldEvery ?? 40)
  const hits: ConstantUsageHit[] = []
  let processedRoots = 0
  for (const bucketKey of GLYPH_BUCKETS) {
    const list = file[bucketKey] as ICustomGlyph[] | undefined
    if (!list?.length) continue
    for (const g of list) {
      scanTopLevelGlyph(g, constantUuid, (h) => hits.push(h), undefined)
      processedRoots++
      if (processedRoots % yieldEvery === 0) {
        options?.onYield?.()
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
    }
  }
  return hits
}

/** 单个字符文件的组件树中的常量引用 */
export function collectCharacterComponentHits(ch: ICharacterFileLite, constantUuid: string): ConstantUsageHit[] {
  const hits: ConstantUsageHit[] = []
  if (!ch.components?.length) return hits
  walkComponentsForEach(ch.components as IGlyphComponent[], constantUuid, (h) => hits.push(h), ch.uuid)
  return hits
}

/**
 * 全工程收集命中：按 characterList 从 IDB 逐个加载字符（与内存中正在编辑的字符同 uuid 时用内存对象），再扫四类字形列表。
 */
export async function collectProjectConstantUsageHitsAsync(options: {
  file: IFile
  constantUuid: string
  editingCharacter: ICharacterFileLite | null | undefined
  loadCharacter: (fileUUID: string, characterUUID: string) => Promise<ICharacterFileLite | null>
  onScanProgress?: (done: number, total: number) => void
}): Promise<ConstantUsageHit[]> {
  const { file, constantUuid, editingCharacter, loadCharacter, onScanProgress } = options
  const hits: ConstantUsageHit[] = []
  const charList = file.characterList ?? []
  const editingUuid = editingCharacter?.uuid
  const scanTotal = Math.max(1, charList.length + 1)

  let done = 0
  for (let i = 0; i < charList.length; i++) {
    const meta = charList[i]
    let ch: ICharacterFileLite | null = null
    if (editingUuid && meta.uuid === editingUuid && editingCharacter) {
      ch = editingCharacter
    } else {
      try {
        ch = await loadCharacter(file.uuid, meta.uuid)
      } catch (e) {
        console.warn('[collectProjectConstantUsageHitsAsync] loadCharacter failed', meta.uuid, e)
        ch = null
      }
    }
    if (ch) {
      hits.push(...collectCharacterComponentHits(ch, constantUuid))
    }
    done++
    onScanProgress?.(done, scanTotal)
  }

  const bucketHits = await collectGlyphBucketHitsYielding(file, constantUuid, {
    yieldEvery: 40,
    onYield: () => onScanProgress?.(done, scanTotal),
  })
  hits.push(...bucketHits)
  done++
  onScanProgress?.(done, scanTotal)

  return dedupeConstantUsageHitsByComponent(hits)
}

/** 命中次数（与需要执行的 executeGlyphScript 次数一致） */
export function countConstantUsagesInProject(options: {
  file: IFile
  constantUuid: string
  characterFiles?: Array<ICharacterFileLite | null | undefined>
}): number {
  const { file, constantUuid, characterFiles } = options
  let n = 0
  for (const key of GLYPH_BUCKETS) {
    const list = file[key] as ICustomGlyph[] | undefined
    if (!list?.length) continue
    for (const g of list) {
      n += countInGlyphParameters(g, constantUuid)
      n += walkComponentsCount(g.components, constantUuid)
    }
  }
  for (const ch of characterFiles || []) {
    if (!ch?.components?.length) continue
    n += walkComponentsCount(ch.components as IGlyphComponent[], constantUuid)
  }
  return n
}

/** 同步 DFS；onHit 内可调用 executeGlyphScript(hit.glyph, hit.componentUuid) */
export function forEachConstantUsageInProject(options: {
  file: IFile
  constantUuid: string
  characterFiles?: Array<ICharacterFileLite | null | undefined>
  onHit: (hit: ConstantUsageHit) => void
}): void {
  const { file, constantUuid, characterFiles, onHit } = options
  for (const h of collectGlyphBucketHits(file, constantUuid)) {
    onHit(h)
  }
  for (const ch of characterFiles || []) {
    if (!ch?.components?.length) continue
    walkComponentsForEach(ch.components as IGlyphComponent[], constantUuid, onHit, ch.uuid)
  }
}

/** 仅用于测试或纯内存场景；全工程请用 collectProjectConstantUsageHitsAsync */
export function collectConstantUsageHits(options: {
  file: IFile
  constantUuid: string
  characterFiles?: Array<ICharacterFileLite | null | undefined>
}): ConstantUsageHit[] {
  const hits = collectGlyphBucketHits(options.file, options.constantUuid)
  for (const ch of options.characterFiles || []) {
    if (ch) hits.push(...collectCharacterComponentHits(ch, options.constantUuid))
  }
  return hits
}
