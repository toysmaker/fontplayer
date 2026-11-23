/**
 * advancedEdit store 测试：自由布局非破坏式写入 + 整体笔画风格替换规划
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  loadCharacter: vi.fn(),
  updateCharacter: vi.fn(),
  formatContainerGlyphComponents: vi.fn(),
  formatGridComponents: vi.fn(),
}))

vi.mock('@/core/storage/CharacterDataManager', () => ({
  characterDataManager: {
    loadCharacter: mocks.loadCharacter,
    updateCharacter: mocks.updateCharacter,
  },
}))

vi.mock('@/features/editor/services/FormatGlyphService', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/features/editor/services/FormatGlyphService')>()
  return {
    ...orig,
    formatContainerGlyphComponents: mocks.formatContainerGlyphComponents,
    formatGridComponents: mocks.formatGridComponents,
  }
})

vi.mock('@/core/instance/InstanceManager', () => ({
  instanceManager: {
    isTemporary: vi.fn(() => false),
    releaseTemporaryInstance: vi.fn(),
    acquireTemporaryInstance: vi.fn(),
    isEditing: vi.fn(() => false),
    getInstance: vi.fn(),
    pinTemporaryFromLRUEviction: vi.fn(),
    unpinTemporaryFromLRUEviction: vi.fn(),
    hasInstance: vi.fn(() => false),
    getPooledInstance: vi.fn(),
    getOrCreateGlyphInstance: vi.fn(),
  },
}))

import { useAdvancedEditStore } from '@/stores/advancedEdit'
import { useProjectStore } from '@/stores/project'
import { defaultGridItem } from '@/stores/character'
import { formatContainerGlyphComponents, formatGridComponents } from '@/features/editor/services/FormatGlyphService'
import { replaceGlyphComponentValueWithTarget, ensureStrokeParamCompatibility } from '@/features/strokeStyleReplace'

/** 让 afterBulkMutateMainList 的 force-character-list-refresh 立即完成，避免测试等待 800ms 超时 */
function resolveForceListRefreshImmediately() {
  window.addEventListener('force-character-list-refresh', ((e: CustomEvent) => {
    e.detail?.done?.()
  }) as EventListener)
}

function makeGlyphComp(name: string, jointKeys: string[]) {
  const skeleton: Record<string, unknown> = { type: 'plain' }
  for (const k of jointKeys) skeleton[k] = { x: 0, y: 0 }
  return {
    type: 'glyph' as const,
    uuid: `comp-${name}`,
    ox: 0,
    oy: 0,
    usedInCharacter: true,
    value: {
      uuid: `glyph-${name}`,
      name,
      style: 'S',
      skeleton,
      parameters: [],
      components: [],
    },
  }
}

function makeChar(uuid: string, comps: ReturnType<typeof makeGlyphComp>[]) {
  return {
    uuid,
    type: 'character',
    character: { text: uuid, unicode: 1 },
    components: comps,
    orderedList: comps.map((c) => ({ type: 'component', uuid: c.uuid })),
    selectedComponentsUUIDs: [],
    info: { gridSettings: null },
  }
}

describe('advancedEdit store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    resolveForceListRefreshImmediately()
    const projectStore = useProjectStore()
    projectStore.addFile({
      uuid: 'file-1',
      name: 'test',
      width: 1000,
      height: 1000,
      saved: true,
      fontSettings: { unitsPerEm: 1000, ascender: 800, descender: -200, tables: { name: [] } },
      characterList: [
        { uuid: 'char-a', type: 'character', character: { text: 'A', unicode: 1 } },
        { uuid: 'char-b', type: 'character', character: { text: 'B', unicode: 2 } },
      ],
      glyphs: [],
      stroke_glyphs: [],
      radical_glyphs: [],
      comp_glyphs: [],
      constants: [],
    } as any)
    projectStore.selectFile('file-1')
  })

  it('applyFreeLayoutToEntireProject 只写布局数据，不格式化组件', async () => {
    mocks.loadCharacter.mockResolvedValue(makeChar('char-a', []))
    const store = useAdvancedEditStore()
    store.freeLayoutInitialGrid = { ...defaultGridItem(), width: 800 }
    store.freeLayoutCurrentGrid = {
      ...defaultGridItem(),
      width: 900,
      dx: 50,
      dy: 60,
      centerSquareScale: 0.3,
    }

    await store.applyFreeLayoutToEntireProject()

    // 2 次自由布局写入 + 2 次 invalidateAllCachedCharacterPreviews 的清缓存写回
    expect(mocks.updateCharacter).toHaveBeenCalledTimes(4)
    const written = mocks.updateCharacter.mock.calls[0][1]
    expect(written.info.gridSettings.initialGrid.width).toBe(800)
    expect(written.info.gridSettings.currentGrid.width).toBe(900)
    expect(written.info.gridSettings.dx).toBe(50)
    expect(written.info.gridSettings.dy).toBe(60)
    expect(written.info.gridSettings.size).toBe(900)
    expect(written.info.gridSettings.centerSquareSize).toBeCloseTo((900 / 3) * 0.3)
    expect(written.info.useSkeletonGrid).toBe(true)
    expect(formatContainerGlyphComponents).not.toHaveBeenCalled()
    expect(formatGridComponents).not.toHaveBeenCalled()
    // 应用后重置为默认
    expect(store.freeLayoutCurrentGrid).toEqual(defaultGridItem())
    expect(store.freeLayoutInitialGrid).toEqual(defaultGridItem())
  })

  it('planWholeStyleReplaceForSamples 对样例字符按名称+关键点匹配聚合并跳过不匹配', async () => {
    const projectStore = useProjectStore()
    const file = projectStore.selectedFile as any
    // 风格池：横（关键点 a,b）、点（关键点 a）
    file.stroke_glyphs = [
      {
        uuid: 'pool-heng',
        name: '横',
        style: 'S',
        skeleton: { type: 'plain', a: { x: 0, y: 0 }, b: { x: 100, y: 0 } },
        parameters: [],
        components: [],
      },
      {
        uuid: 'pool-dian',
        name: '点',
        style: 'S',
        skeleton: { type: 'plain', a: { x: 0, y: 0 } },
        parameters: [],
        components: [],
      },
    ]
    const store = useAdvancedEditStore()
    // 一键替换所有笔画只作用于样例字符
    store.originSampleCharactersList = [
      makeChar('char-a', [makeGlyphComp('横', ['a', 'b'])]), // 匹配
      makeChar('char-b', [makeGlyphComp('竖', ['a'])]), // 无同名 → 跳过
    ]

    const plan = await store.planWholeStyleReplaceForSamples('S')

    expect(plan).not.toBeNull()
    expect(plan!.totalPairs).toBe(1)
    expect(plan!.skippedNames).toContain('竖')
  })

  it('planWholeStyleReplaceForSamples 空风格池返回 null', async () => {
    const store = useAdvancedEditStore()
    store.originSampleCharactersList = [makeChar('char-a', [makeGlyphComp('横', ['a', 'b'])])]
    const plan = await store.planWholeStyleReplaceForSamples('不存在的风格')
    expect(plan).toBeNull()
  })

  it('跨风格复制兼容：源参数值为常量UUID字符串时保留目标数值默认值', () => {
    // 复现内置模板(黑体) → 宋体 的替换场景：黑体笔画参数值是常量 UUID 字符串，
    // 宋体脚本期望普通数值；直接复制会产生 NaN 导致画布空白
    const curValue: any = {
      uuid: 'glyph-heiti-heng',
      name: '横',
      style: '黑体',
      parameters: [
        { name: '水平延伸', type: 0, value: 912 },
        { name: '字重', type: 0, value: 'const-uuid-zw' },
        { name: '起笔风格', type: 3, value: 'const-uuid-qb' },
        { name: '起笔数值', type: 0, value: 2 },
      ],
      components: [],
    }
    const songTarget: any = {
      uuid: 'glyph-song-heng',
      name: '横',
      style: '字玩标准宋体',
      script: 'function script_glyph_song_heng(g, c, F) {}',
      parameters: [
        { name: '水平延伸', type: 0, value: 300 },
        { name: '字重', type: 0, value: 40 },
        { name: '起笔风格', type: 3, value: 1 },
        { name: '起笔数值', type: 0, value: 1 },
      ],
      components: [],
    }
    const ch = makeChar('char-a', [{ type: 'glyph', uuid: 'comp-song', ox: 0, oy: 0, usedInCharacter: true, value: curValue }])
    ch.components[0].orderedList = undefined

    const ok = replaceGlyphComponentValueWithTarget(ch, 'comp-song', songTarget)

    expect(ok).toBe(true)
    const params = (ch.components[0].value as any).parameters
    const get = (name: string) => params.find((p: any) => p.name === name)
    // 数字→数字: 照常复制(保留姿态)
    expect(get('水平延伸').value).toBe(912)
    // UUID字符串→数字: 保留目标默认值, 不复制
    expect(get('字重').value).toBe(40)
    expect(get('起笔风格').value).toBe(1)
    // 数字→数字
    expect(get('起笔数值').value).toBe(2)
  })

  it('ensureStrokeParamCompatibility 从源笔画按脚本需求补齐缺失参数(通用)', () => {
    // 任意风格: 目标脚本读取的参数名目标列表没有, 但源笔画有同名数值参数
    const target: any = {
      uuid: 'g-target',
      name: '自定义撇',
      style: '任意风格',
      script: "glyph.getParam('竖-长度'); glyph.getParam('撇-弯曲游标'); glyph.getParam('字重')",
      parameters: [{ name: '竖-竖直延伸', type: 0, value: 300, min: 0, max: 1000 }],
    }
    const source: any = {
      uuid: 'g-source',
      name: '自定义撇',
      parameters: [
        { name: '竖-长度', type: 0, value: 220, min: 0, max: 1000 },
        { name: '撇-弯曲度', type: 0, value: 1.8, min: 1, max: 2 },
        { name: '字重', type: 0, value: 'const-uuid-string' }, // UUID 字符串不补, 避免 NaN
      ],
    }
    ensureStrokeParamCompatibility(target, source)
    const get = (n: string) => target.parameters.find((p: any) => p.name === n)
    // 脚本需要且源有数值 → 补齐
    expect(get('竖-长度')?.value).toBe(220)
    expect(get('撇-弯曲游标')?.value).toBe(1.8)
    // 源值是 UUID 字符串 → 不补
    expect(get('字重')).toBeUndefined()
    // 幂等
    ensureStrokeParamCompatibility(target, source)
    expect(target.parameters.filter((p: any) => p.name === '竖-长度').length).toBe(1)
  })

  it('ensureStrokeParamCompatibility 解析常量 UUID 字符串值(治愈污染池)', () => {
    const target: any = {
      uuid: 'g-target2',
      name: '撇',
      style: '任意风格',
      script: "glyph.getParam('字重') * 2", // 不含 getByUUID/constantsMap → 需要数值
      parameters: [
        { name: '字重', type: 0, value: 'e30sGpGeiBtl-LXUFKKCg' }, // 被污染的 UUID 字符串
        { name: '起笔风格', type: 3, value: 1 },
      ],
    }
    const resolver = (uuid: string) => (uuid === 'e30sGpGeiBtl-LXUFKKCg' ? 50 : undefined)
    ensureStrokeParamCompatibility(target, undefined, resolver)
    const zw = target.parameters.find((p: any) => p.name === '字重')
    expect(zw.value).toBe(50)
    // 脚本自行解析常量的字形(含 getByUUID)不做解析
    const selfResolve: any = {
      uuid: 'g-self',
      name: '撇',
      style: '任意风格',
      script: "constantsMap.getByUUID(glyph.getParam('字重'))",
      parameters: [{ name: '字重', type: 0, value: 'e30sGpGeiBtl-LXUFKKCg' }],
    }
    ensureStrokeParamCompatibility(selfResolve, undefined, resolver)
    expect(selfResolve.parameters[0].value).toBe('e30sGpGeiBtl-LXUFKKCg')
  })

  it('ensureStrokeParamCompatibility 补齐 originParam 与弯曲游标别名参数', () => {
    // 复现宋体竖撇：数据参数名为 竖-竖直延伸（originParam=竖-长度）、撇-弯曲度，
    // 脚本读取 竖-长度 与 撇-弯曲游标
    const glyph: any = {
      uuid: 'g-1',
      name: '竖撇',
      style: '字玩标准宋体',
      parameters: [
        { name: '竖-竖直延伸', type: 0, value: 200, min: 0, max: 1000 },
        { name: '撇-弯曲度', type: 0, value: 1.5, min: 1, max: 2 },
      ],
    }
    ensureStrokeParamCompatibility(glyph)
    const names = glyph.parameters.map((p: any) => p.name)
    expect(names).toContain('竖-长度')
    expect(names).toContain('撇-弯曲游标')
    // 值/范围与源参数一致
    const shu = glyph.parameters.find((p: any) => p.name === '竖-长度')
    expect(shu.value).toBe(200)
    const cursor = glyph.parameters.find((p: any) => p.name === '撇-弯曲游标')
    expect(cursor.value).toBe(1.5)
    expect(cursor.max).toBe(2)
    // 幂等: 再次调用不重复添加
    ensureStrokeParamCompatibility(glyph)
    expect(glyph.parameters.filter((p: any) => p.name === '竖-长度').length).toBe(1)
  })

  it('样例预览使用专用组件 uuid，不污染真实字符实例池', async () => {
    const projectStore = useProjectStore()
    const file = projectStore.selectedFile as any
    file.stroke_glyphs = [
      {
        uuid: 'pool-heng',
        name: '横',
        style: 'S',
        skeleton: { type: 'plain', a: { x: 0, y: 0 }, b: { x: 100, y: 0 } },
        parameters: [],
        components: [],
      },
    ]
    const realChar = makeChar('char-a', [makeGlyphComp('横', ['a', 'b'])])
    realChar.character = { text: 'A', unicode: 1 }
    mocks.loadCharacter.mockResolvedValue(realChar)
    const store = useAdvancedEditStore()
    store.sampleCharacters = 'A'
    store.wholeReplaceStyle = 'S'

    await store.refreshMergedStyleStrokePreviews()

    const sample = store.sampleCharactersList[0]
    expect(sample).toBeDefined()
    // 预览克隆的组件 uuid 已改写为预览专用
    expect(sample.components[0].uuid).toMatch(/__advprev$/)
    expect(sample.orderedList[0].uuid).toBe(sample.components[0].uuid)
    // 真实字符数据不受影响
    expect(realChar.components[0].uuid).toBe('comp-横')
  })
})
