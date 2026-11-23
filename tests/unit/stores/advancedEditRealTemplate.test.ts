/**
 * 用真实内置模板数据(.fpz)复现 Tauri 端的笔画风格替换流程:
 * 黑体系统字形(常量UUID字符串参数) → 宋体池(历史污染: 常量UUID字符串) → 一键更新 → 治愈验证
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'

const mocks = vi.hoisted(() => ({
  loadCharacter: vi.fn(),
  updateCharacter: vi.fn(),
  saved: new Map<string, any>(),
}))

vi.mock('@/core/storage/CharacterDataManager', () => ({
  characterDataManager: {
    loadCharacter: mocks.loadCharacter,
    updateCharacter: vi.fn(async (_f: string, ch: any) => {
      mocks.saved.set(ch.uuid, JSON.parse(JSON.stringify(ch)))
    }),
  },
}))

// 使用真实 instanceManager 以验证真实渲染路径

import { useAdvancedEditStore } from '@/stores/advancedEdit'
import { useProjectStore } from '@/stores/project'
import { paramsFromStroke } from '@/templates/private/v1/strokeParamBuilder'
import { strokes } from '@/templates/private/v1/strokes'

const FPZ = join(process.cwd(), 'src-tauri/resources/default-template.fpz')

function parseFpz(): { project: any; characters: Map<number, any> } {
  const buf = readFileSync(FPZ)
  const headerLen = buf.readUInt32LE(8)
  const project = JSON.parse(buf.subarray(12, 12 + headerLen).toString('utf8')).project
  const tocCount = buf.readUInt32LE(12 + headerLen)
  let o = 12 + headerLen + 4
  const toc: Array<{ unicode: number; offset: number; len: number }> = []
  for (let i = 0; i < tocCount; i++) {
    const uuidLen = buf.readUInt16LE(o); o += 2
    o += uuidLen
    const unicode = buf.readUInt32LE(o); o += 4
    const offset = Number(buf.readBigUInt64LE(o)); o += 8
    const len = buf.readUInt32LE(o); o += 4
    toc.push({ unicode, offset, len })
  }
  const payloadBase = o
  const characters = new Map<number, any>()
  for (const e of toc) {
    if (e.unicode === 0x4f5a) {
      characters.set(e.unicode, JSON.parse(gunzipSync(buf.subarray(payloadBase + e.offset, payloadBase + e.offset + e.len)).toString('utf8')))
    }
  }
  return { project, characters }
}

function makeSongPool(): any[] {
  // 模拟用户历史导入的宋体池: paramsFromStroke + 通用参数, 无别名, 且被历史复制污染(常量UUID字符串)
  const names = ['撇', '竖', '横', '竖撇', '捺']
  const pool: any[] = []
  for (const name of names) {
    const data = (strokes as any[]).find((s) => s.name === name)
    const scriptText = readFileSync(join(process.cwd(), `public/templates/stroke_template_song/${name}.js`), 'utf8')
    const uuid = `song-pool-${name}`
    const parameters: any[] = paramsFromStroke(data)
    parameters.push({ uuid: 'p-sb-1', name: '竖横比', type: 0, value: 3, min: 1, max: 5 })
    parameters.push({ uuid: 'p-sb-2', name: '参考位置', type: 3, value: 0 })
    parameters.push(
      { uuid: 'p-sb-3', name: '起笔风格', type: 3, value: 1 },
      { uuid: 'p-sb-4', name: '起笔数值', type: 0, value: 2 },
      { uuid: 'p-sb-5', name: '收笔风格', type: 3, value: 1 },
      { uuid: 'p-sb-6', name: '收笔数值', type: 0, value: 2 },
      { uuid: 'p-sb-7', name: '转角风格', type: 3, value: 1 },
      { uuid: 'p-sb-8', name: '转角数值', type: 0, value: 2 },
      { uuid: 'p-sb-9', name: '字重变化', type: 0, value: 0 },
      { uuid: 'p-sb-10', name: '弯曲程度', type: 0, value: 1 },
    )
    // 历史污染: 常量引用的参数被旧复制逻辑写成了 UUID 字符串
    for (const p of parameters) {
      if (['字重', '起笔风格', '起笔数值', '转角风格', '转角数值', '字重变化', '弯曲程度'].includes(p.name)) {
        p.value = 'poison-uuid-string-' + p.name + '-xxxxxxxx'
      }
    }
    pool.push({
      uuid,
      name,
      style: '字玩标准宋体',
      script: `function script_${uuid.replaceAll('-', '_')}(glyph, constants, FP) {\n${scriptText}\n}`,
      parameters,
      components: [],
    })
  }
  return pool
}

describe('真实模板数据替换治愈', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.saved.clear()
    const { project, characters } = parseFpz()
    const yi = characters.get(0x4f5a)!
    const songPool = makeSongPool()
    const file: any = {
      uuid: 'file-real',
      name: 'real',
      width: 1000,
      height: 1000,
      saved: true,
      fontSettings: { unitsPerEm: 1000, ascender: 800, descender: -200, tables: { name: [] } },
      characterList: [{ uuid: yi.uuid, type: 'character', character: yi.character }],
      glyphs: [],
      stroke_glyphs: songPool,
      radical_glyphs: [],
      comp_glyphs: [],
      constants: project.constants,
    }
    const projectStore = useProjectStore()
    projectStore.addFile(file)
    projectStore.selectFile(file.uuid)
    mocks.loadCharacter.mockImplementation(async (_f: string, uuid: string) => {
      // 模拟 IDB: 已写入的字符从"存储"读回(与真实应用一致, updateCharacter 后 load 返回新数据)
      if (mocks.saved.has(uuid)) return JSON.parse(JSON.stringify(mocks.saved.get(uuid)))
      if (uuid === yi.uuid) return JSON.parse(JSON.stringify(yi))
      return null
    })
  })

  it('一键更新后保存字符笔画参数被治愈且可渲染轮廓', async () => {
    const store = useAdvancedEditStore()
    store.wholeReplaceStyle = '字玩标准宋体'
    const pool = store.getStrokeGlyphsByStyle('字玩标准宋体')
    console.log('[DEBUG] pool size =', pool.length, '| styles =', pool.map((g: any) => g.style).slice(0, 3))
    const { project, characters } = parseFpz()
    const yi = characters.get(0x4f5a)!
    const { planWholeStyleReplace } = await import('@/features/strokeStyleReplace')
    const plan = planWholeStyleReplace(yi, '字玩标准宋体', pool)
    console.log('[DEBUG] direct plan pairs =', plan.pairs.length, '| skipped =', plan.skipped.map((s: any) => s.name + ':' + s.reason).join(','))
    await store.applyMergedStrokeReplacementsToEntireProject()

    const saved = mocks.saved.get('char-yi')
    // 佚 的真实 uuid 从 fpz 解析而来, 直接取 saved 的第一个 key
    const anySaved = Array.from(mocks.saved.values())[0]
    expect(anySaved).toBeDefined()
    const v0 = anySaved.components[0].value
    const zw0 = (v0.parameters || []).find((p: any) => p.name === '字重')
    console.log('[DEBUG] saved style =', v0.style, '| 字重 =', zw0 ? `${typeof zw0.value}:${String(zw0.value).slice(0, 16)}` : '无', '| 参数类型 =', zw0?.type, '| script长度 =', (v0.script || '').length, '| 参数总数 =', (v0.parameters || []).length)
    expect(v0.style).toBe('字玩标准宋体')
    // 字重参数要么是数值, 要么是 Constant 类型引用常量(渲染时 getParam 解析为数值)——两者都正确
    for (const comp of anySaved.components) {
      const v = comp.value
      const zw = (v.parameters || []).find((p: any) => p.name === '字重')
      const ok = typeof zw?.value === 'number' || zw?.type === 1 /* Constant */
      expect(ok, `${v.name} 字重参数形态异常: ${JSON.stringify(zw)}`).toBe(true)
    }
    // 调试: 保存后撇的完整参数
    const pie = anySaved.components.find((c: any) => c.value?.name === '撇')
    console.log('[DEBUG] 撇 params:', JSON.stringify((pie.value.parameters || []).map((p: any) => `${p.name}:${p.type}:${String(p.value).slice(0, 12)}`)))

    // 调试: 常量解析链
    const { getGlobalConstantsMap } = await import('@/core/script/ParametersMap')
    const gcm = getGlobalConstantsMap() as any
    const ps = useProjectStore()
    console.log('[DEBUG] globalMap type =', gcm?.constructor?.name, '| getByUUID(字重UUID) =', gcm?.getByUUID?.('e30sGpGeiBtl-LXUFKKCg'))
    console.log('[DEBUG] projectStore.constantsMap =', (ps.constantsMap as any)?.getByUUID?.('e30sGpGeiBtl-LXUFKKCg'), '| file.constants 数 =', (ps.selectedFile as any)?.constants?.length)

    // 真实渲染路径: 每个笔画都能算出非空轮廓
    const { ContourConverter } = await import('@/core/font/converter')
    for (const comp of anySaved.components) {
      const contours = ContourConverter.componentsToContours(
        [comp],
        { unitsPerEm: 1000, descender: -200, advanceWidth: 1000, preview: true, forceUpdate: true },
        { x: 0, y: 0 },
      )
      const points = contours.reduce((n, co) => n + co.length, 0)
      expect(points, `${comp.value.name} 轮廓为空`).toBeGreaterThan(0)
    }
  })
})
