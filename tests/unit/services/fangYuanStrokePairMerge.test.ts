/**
 * 临时代码验证：fangYuanStrokePairMerge 的 8 条笔画组合替换规则。
 * 使用 public/templates/private/v1 真实脚本执行，构造相连/不相连的笔画对验证合并结果。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import type { ICharacterFileLite, ICustomGlyph } from '@/core/types'
import { mergeFangYuanStrokePairsInCharacter } from '@/features/temporaryScripts/fangYuanStrokePairMerge'

beforeAll(() => {
  setActivePinia(createPinia())
})

const TEMPLATE_DIR = resolve(__dirname, '../../../public/templates/private/v1')

function loadScript(name: string): string {
  return readFileSync(resolve(TEMPLATE_DIR, `${name}.js`), 'utf-8')
}

const STYLE = '字玩方圆黑体'

function strokeComp(
  name: string,
  ox: number,
  oy: number,
  paramOverrides: Record<string, number>,
): any {
  const params = Object.entries(paramOverrides).map(([pname, value]) => ({
    uuid: `${name}-${pname}`,
    name: pname,
    type: 0,
    value,
    min: 0,
    max: 1000,
  }))
  // 字重比率缺省给 1，避免脚本 weight 计算 NaN
  if (!params.some((p: any) => p.name === '字重比率')) {
    params.push({ uuid: `${name}-字重比率`, name: '字重比率', type: 0, value: 1, min: 0.1, max: 2 })
  }
  if (!params.some((p: any) => p.name === '字重')) {
    params.push({ uuid: `${name}-字重`, name: '字重', type: 0, value: 50, min: 0, max: 200 })
  }
  const valueUuid = `value-${name}-${ox}-${oy}`
  // 与 createBaseGlyph 一致：模板正文包装为 script_<uuid> 函数（ScriptExecutor 按 glyph.uuid 推导函数名）
  const body = loadScript(name)
  const fnName = `script_${valueUuid.replaceAll('-', '_')}`
  const value: ICustomGlyph = {
    uuid: valueUuid,
    name,
    type: 'system',
    components: [],
    groups: [],
    orderedList: [],
    selectedComponentsUUIDs: [],
    view: { zoom: 100, translateX: 0, translateY: 0 },
    parameters: params as any,
    joints: [],
    script: `function ${fnName} (glyph, constants, FP) {\n\t${body}\n}`,
    style: STYLE,
  }
  return {
    uuid: `comp-${name}-${ox}-${oy}`,
    type: 'glyph',
    name,
    lock: false,
    visible: true,
    usedInCharacter: true,
    x: 0, y: 0, w: 0, h: 0, rotation: 0, flipX: false, flipY: false,
    ox, oy,
    value,
  }
}

function makeCharacter(components: any[]): ICharacterFileLite {
  return {
    uuid: 'char-test',
    type: 'text',
    character: { text: '测' },
    components: components as any,
    groups: [],
    orderedList: components.map((c) => ({ type: 'component', uuid: c.uuid })),
    view: { zoom: 100, translateX: 0, translateY: 0 },
  } as any
}

const nameToUuid = new Map<string, string>(
  ['平捺', '横折钩', '可倾斜横折钩', '横弯钩', '竖折折钩'].map((n) => [n, `uuid-${n}`]),
)

function mergedParamsOf(char: ICharacterFileLite): Record<string, number> {
  const glyphComps = char.components.filter((c: any) => c.type === 'glyph')
  expect(glyphComps.length).toBe(1)
  const params = (glyphComps[0].value as ICustomGlyph).parameters as any[]
  const map: Record<string, number> = {}
  for (const p of params) map[p.name] = p.value
  return map
}

describe('fangYuanStrokePairMerge 八条规则', () => {
  it('规则一：直角捺 + 横（end 与 start y 相同、x 相隔字重*比率）→ 平捺（弯笔起笔）', () => {
    // 直角捺 start(400,400) 水平延伸300 竖直延伸200 字重50 → end 局部(700,600)
    // 横 start(250,500)：oy2+500 = oy1+600 → oy2=oy1+100；ox2+250 = ox1+700+50 → ox2=ox1+500
    const na = strokeComp('直角捺', 100, 100, { 水平延伸: 300, 竖直延伸: 200, 弯曲度: 1.5 })
    const heng = strokeComp('横', 600, 200, { 水平延伸: 400 })
    const char = makeCharacter([na, heng])

    mergeFangYuanStrokePairsInCharacter(char, nameToUuid)

    const comps = char.components.filter((c: any) => c.type === 'glyph')
    expect(comps.length).toBe(1)
    const merged = comps[0] as any
    expect((merged.value as ICustomGlyph).name).toBe('平捺')
    // 锚点：平捺原点(250,500) 对齐直角捺 start 绝对坐标(500,500)
    expect(merged.ox).toBe(100 + 400 - 250)
    expect(merged.oy).toBe(100 + 400 - 500)
    const p = mergedParamsOf(char)
    expect(p['起笔风格']).toBe(1)
    expect(p['水平延伸']).toBeCloseTo(400 + 25)
    expect(p['弯—水平延伸']).toBeCloseTo(300 + 25)
    expect(p['弯—竖直延伸']).toBe(200)
    expect(p['弯—弯曲度']).toBeCloseTo(1.5)
    expect(p['字重']).toBe(50)
  })

  it('规则二：横 + 竖撇（end 与 shu_start 重合）→ 横折钩（弯笔收笔）', () => {
    // 横 start(250,500) 水平延伸400 → end(650,500)；竖撇 shu_start(500,200)
    // ox2+500 = 650 → ox2=150；oy2+200 = 500 → oy2=300
    const heng = strokeComp('横', 0, 0, { 水平延伸: 400 })
    const shupie = strokeComp('竖撇', 150, 300, {
      '竖-竖直延伸': 300, '撇-水平延伸': 200, '撇-竖直延伸': 250, '撇-弯曲度': 1.2,
    })
    const char = makeCharacter([heng, shupie])

    mergeFangYuanStrokePairsInCharacter(char, nameToUuid)

    const comps = char.components.filter((c: any) => c.type === 'glyph')
    expect(comps.length).toBe(1)
    const merged = comps[0] as any
    expect((merged.value as ICustomGlyph).name).toBe('横折钩')
    expect(merged.ox).toBe(0 + 250 - 250)
    expect(merged.oy).toBe(0 + 500 - 350)
    const p = mergedParamsOf(char)
    expect(p['收笔风格']).toBe(6)
    expect(p['横-水平延伸']).toBe(400)
    expect(p['折-竖直延伸']).toBe(300)
    expect(p['钩-水平延伸']).toBe(200)
    expect(p['钩-竖直延伸']).toBe(250)
    expect(p['钩-弯曲度']).toBeCloseTo(1.2)
  })

  it('规则三：横 + 直角撇 → 横折钩（x 相同、y 相隔字重*比率；折-竖直延伸 = 直角撇字重*比率*0.5）', () => {
    // 横 end(650,500)；直角撇 start(500,400)：x 相同 → ox2+500=650 → ox2=150
    // y 相隔 字重*比率=60：oy2+400-500=60 → oy2=160
    const heng = strokeComp('横', 0, 0, { 水平延伸: 400 })
    const zjp = strokeComp('直角撇', 150, 160, { 水平延伸: 200, 竖直延伸: 250, 弯曲度: 1.4, 字重: 60 })
    const char = makeCharacter([heng, zjp])

    mergeFangYuanStrokePairsInCharacter(char, nameToUuid)

    const comps = char.components.filter((c: any) => c.type === 'glyph')
    expect(comps.length).toBe(1)
    const merged = comps[0] as any
    expect((merged.value as ICustomGlyph).name).toBe('横折钩')
    expect(merged.ox).toBe(0 + 250 - 250)
    expect(merged.oy).toBe(0 + 500 - 350)
    const p = mergedParamsOf(char)
    expect(p['收笔风格']).toBe(6)
    expect(p['折-竖直延伸']).toBeCloseTo(30)
    expect(p['钩-水平延伸']).toBe(200)
    expect(p['钩-竖直延伸']).toBe(250)
    expect(p['钩-弯曲度']).toBeCloseTo(1.4)
  })

  it('规则四：可倾斜横 + 竖撇 → 可倾斜横折钩', () => {
    // 可倾斜横 start(200,400) 水平延伸350 竖直延伸-50 → end(550,350)
    // 竖撇 shu_start(500,200)：ox2=50, oy2=150
    const qingxie = strokeComp('可倾斜横', 0, 0, { 水平延伸: 350, 竖直延伸: -50 })
    const shupie = strokeComp('竖撇', 50, 150, {
      '竖-竖直延伸': 300, '撇-水平延伸': 200, '撇-竖直延伸': 250, '撇-弯曲度': 1.2,
    })
    const char = makeCharacter([qingxie, shupie])

    mergeFangYuanStrokePairsInCharacter(char, nameToUuid)

    const comps = char.components.filter((c: any) => c.type === 'glyph')
    expect(comps.length).toBe(1)
    const merged = comps[0] as any
    expect((merged.value as ICustomGlyph).name).toBe('可倾斜横折钩')
    expect(merged.ox).toBe(0 + 200 - 250)
    expect(merged.oy).toBe(0 + 400 - 350)
    const p = mergedParamsOf(char)
    expect(p['收笔风格']).toBe(6)
    expect(p['横-水平延伸']).toBe(350)
    expect(p['横-竖直延伸']).toBe(-50)
    expect(p['折-竖直延伸']).toBe(300)
    expect(p['钩-水平延伸']).toBe(200)
    expect(p['钩-竖直延伸']).toBe(250)
    expect(p['钩-弯曲度']).toBeCloseTo(1.2)
  })

  it('规则五：可倾斜横 + 直角撇 → 可倾斜横折钩', () => {
    // 可倾斜横 end(550,350)；直角撇 start(500,400)：ox2=50, oy2=-50
    const qingxie = strokeComp('可倾斜横', 0, 0, { 水平延伸: 350, 竖直延伸: -50 })
    const zjp = strokeComp('直角撇', 50, -50, { 水平延伸: 180, 竖直延伸: 220, 弯曲度: 1.3, 字重: 80 })
    const char = makeCharacter([qingxie, zjp])

    mergeFangYuanStrokePairsInCharacter(char, nameToUuid)

    const comps = char.components.filter((c: any) => c.type === 'glyph')
    expect(comps.length).toBe(1)
    expect((comps[0].value as ICustomGlyph).name).toBe('可倾斜横折钩')
    const p = mergedParamsOf(char)
    expect(p['收笔风格']).toBe(6)
    expect(p['横-水平延伸']).toBe(350)
    expect(p['横-竖直延伸']).toBe(-50)
    expect(p['折-竖直延伸']).toBeCloseTo(40)
    expect(p['钩-水平延伸']).toBe(180)
    expect(p['钩-竖直延伸']).toBe(220)
    expect(p['钩-弯曲度']).toBeCloseTo(1.3)
  })

  it('规则六：横 + 竖弯钩 → 横弯钩（收笔风格沿用竖弯钩）', () => {
    // 横 end(650,500)；竖弯钩 shu_start(370,250)：ox2=280, oy2=250
    const heng = strokeComp('横', 0, 0, { 水平延伸: 400 })
    const swg = strokeComp('竖弯钩', 280, 250, {
      '竖-竖直延伸': 250, '弯-长度': 180, '钩-竖直延伸': 120, 收笔风格: 1,
    })
    const char = makeCharacter([heng, swg])

    mergeFangYuanStrokePairsInCharacter(char, nameToUuid)

    const comps = char.components.filter((c: any) => c.type === 'glyph')
    expect(comps.length).toBe(1)
    const merged = comps[0] as any
    expect((merged.value as ICustomGlyph).name).toBe('横弯钩')
    expect(merged.ox).toBe(0 + 250 - 300)
    expect(merged.oy).toBe(0 + 500 - 250)
    const p = mergedParamsOf(char)
    expect(p['收笔风格']).toBe(1)
    expect(p['横-水平延伸']).toBe(400)
    expect(p['弯-水平延伸']).toBe(180)
    expect(p['弯-竖直延伸']).toBe(250)
    expect(p['钩-竖直延伸']).toBe(120)
  })

  it('规则七：竖折 + 竖撇（zhe_end 与 shu_start x 相同、y 间隔在 [0, 字重*比率] ± delta）→ 竖折折钩（弯笔收笔）', () => {
    // 竖折 start(250,250) 竖-竖直延伸200 折-水平延伸300 → zhe_end 局部(550,450)
    // 竖撇 shu_start(500,200)：x 相同 → ox2+500=550 → ox2=50
    // y 间隔 = oy2 + 200 - 450 = oy2 - 250
    const shuzhe = strokeComp('竖折', 0, 0, { '竖-竖直延伸': 200, '折-水平延伸': 300 })
    const shupie = (oy2: number) => strokeComp('竖撇', 50, oy2, {
      '竖-竖直延伸': 180, '撇-水平延伸': 150, '撇-竖直延伸': 120, '撇-弯曲度': 1.3,
    })

    // y 间隔 = 字重*比率 = 50 → 合并
    const char = makeCharacter([shuzhe, shupie(300)])
    mergeFangYuanStrokePairsInCharacter(char, nameToUuid)
    const comps = char.components.filter((c: any) => c.type === 'glyph')
    expect(comps.length).toBe(1)
    const merged = comps[0] as any
    expect((merged.value as ICustomGlyph).name).toBe('竖折折钩')
    // 锚点：竖折折钩原点(250,250) 对齐竖折 shu_start 绝对坐标(250,250)
    expect(merged.ox).toBe(0)
    expect(merged.oy).toBe(0)
    const p = mergedParamsOf(char)
    expect(p['收笔风格']).toBe(6)
    expect(p['竖-竖直延伸']).toBe(200)
    expect(p['折1-水平延伸']).toBe(300)
    expect(p['折2-竖直延伸']).toBe(180)
    expect(p['钩-水平延伸']).toBe(150)
    expect(p['钩-竖直延伸']).toBe(120)
    expect(p['钩-弯曲度']).toBeCloseTo(1.3)

    // y 间隔 = 0（刚好相连）→ 也合并
    const charTouch = makeCharacter([shuzhe, shupie(250)])
    mergeFangYuanStrokePairsInCharacter(charTouch, nameToUuid)
    expect(charTouch.components.filter((c: any) => c.type === 'glyph').length).toBe(1)

    // y 间隔 = 150（超过 字重*比率 + delta = 100）→ 不合并
    const charFar = makeCharacter([shuzhe, shupie(400)])
    mergeFangYuanStrokePairsInCharacter(charFar, nameToUuid)
    expect(charFar.components.filter((c: any) => c.type === 'glyph').length).toBe(2)
  })

  it('规则八：竖折 + 直角撇 → 竖折折钩（折2-竖直延伸 = 直角撇字重*比率*0.5）', () => {
    // 竖折 zhe_end 局部(550,450)；直角撇 start(500,400)：x 相同 → ox2=50
    // y 相隔 字重*比率=60：oy2+400-450=60 → oy2=110
    const shuzhe = strokeComp('竖折', 0, 0, { '竖-竖直延伸': 200, '折-水平延伸': 300 })
    const zjp = strokeComp('直角撇', 50, 110, { 水平延伸: 150, 竖直延伸: 120, 弯曲度: 1.4, 字重: 60 })
    const char = makeCharacter([shuzhe, zjp])

    mergeFangYuanStrokePairsInCharacter(char, nameToUuid)

    const comps = char.components.filter((c: any) => c.type === 'glyph')
    expect(comps.length).toBe(1)
    expect((comps[0].value as ICustomGlyph).name).toBe('竖折折钩')
    expect(comps[0].ox).toBe(0)
    expect(comps[0].oy).toBe(0)
    const p = mergedParamsOf(char)
    expect(p['收笔风格']).toBe(6)
    expect(p['竖-竖直延伸']).toBe(200)
    expect(p['折1-水平延伸']).toBe(300)
    expect(p['折2-竖直延伸']).toBeCloseTo(30)
    expect(p['钩-水平延伸']).toBe(150)
    expect(p['钩-竖直延伸']).toBe(120)
    expect(p['钩-弯曲度']).toBeCloseTo(1.4)
  })

  it('不相连的笔画对不合并', () => {
    const na = strokeComp('直角捺', 100, 100, { 水平延伸: 300, 竖直延伸: 200, 弯曲度: 1.5 })
    const heng = strokeComp('横', 0, 0, { 水平延伸: 400 }) // 距离远，不相连
    const char = makeCharacter([na, heng])

    mergeFangYuanStrokePairsInCharacter(char, nameToUuid)

    const comps = char.components.filter((c: any) => c.type === 'glyph')
    expect(comps.length).toBe(2)
  })

  it('非方圆黑体风格组件不参与合并', () => {
    const na = strokeComp('直角捺', 100, 100, { 水平延伸: 300, 竖直延伸: 200, 弯曲度: 1.5 })
    ;(na.value as ICustomGlyph).style = '字玩标准黑体'
    const heng = strokeComp('横', 600, 200, { 水平延伸: 400 })
    const char = makeCharacter([na, heng])

    mergeFangYuanStrokePairsInCharacter(char, nameToUuid)

    expect(char.components.filter((c: any) => c.type === 'glyph').length).toBe(2)
  })
})
