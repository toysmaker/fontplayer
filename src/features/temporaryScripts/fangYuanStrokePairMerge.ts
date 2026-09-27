/**
 * 临时代码：打开 .fp 且 tag 为"字玩方圆黑体"的工程时，
 * 按规则将字符中相连的笔画对替换为组合笔画（直角捺+横→平捺 等 8 条规则）。
 * 仅 dev 模式生效；后续需整段移除。
 *
 * 使用方式（ProjectLoader.processCharactersFromFpz 内，替换脚本引用之后）：
 *   mergeFangYuanStrokePairsInCharacter(characterLite, strokeGlyphNameToUuid)
 */
import type { ICharacterFileLite, IComponent, ICustomGlyph, IGlyphComponent, IParameter } from '@/core/types'
import { genUUID } from '@/utils/uuid'
import { strokes } from '@/templates/private/v1/strokes'
import { buildFangYuanStrokeParameters } from '@/templates/private/v1/strokeParamBuilder'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'

// ===== 可调常量 =====

/** 连接判定容差 */
const DELTA = 50

/** 参与合并的笔画风格标签 */
const STYLE_TAGS = new Set(['字玩方圆黑体', '测试笔画模板'])

/** 起笔风格：弯笔起笔（平捺脚本 start_style_type === 1） */
const START_STYLE_WAN = 1

/** 收笔风格：弯笔收笔（横折钩脚本 end_style_type === 6） */
const END_STYLE_WAN = 6

/** 目标字形脚本的骨架原点（各脚本内的 x0/y0） */
const TARGET_ORIGIN: Record<string, { x: number; y: number }> = {
  平捺: { x: 250, y: 500 },
  横折钩: { x: 250, y: 350 },
  可倾斜横折钩: { x: 250, y: 350 },
  横弯钩: { x: 300, y: 250 },
  竖折折钩: { x: 250, y: 250 },
}

// ===== 候选笔画 =====

interface StrokeCandidate {
  /** 字符中的 glyph 组件 */
  comp: IGlyphComponent
  /** 在 character.components 中的索引 */
  index: number
  /** 组件参数来源（comp.value） */
  glyph: ICustomGlyph
  /** 关节名 → 局部坐标（脚本执行结果） */
  joints: Map<string, { x: number; y: number }>
  /** 组件偏移 ox/oy */
  position: { x: number; y: number }
  /** 本趟扫描是否已参与合并 */
  consumed: boolean
}

// ===== 工具函数 =====

/** 读取组件参数值（兼容 parameters 数组与嵌套格式） */
function getParamValue(glyph: ICustomGlyph, name: string): number | undefined {
  const raw = glyph.parameters as unknown
  let arr: IParameter[] | undefined
  if (Array.isArray(raw)) {
    arr = raw as IParameter[]
  } else if (raw && typeof raw === 'object') {
    arr = (raw as { parameters?: IParameter[] }).parameters
  }
  const v = arr?.find(p => p.name === name)?.value
  return typeof v === 'number' ? v : undefined
}

function valueOf(c: StrokeCandidate, name: string, fallback = 0): number {
  return getParamValue(c.glyph, name) ?? fallback
}

/** 字重 * 字重比率（旧组件可能缺字重比率，按 1 计） */
function weightOf(c: StrokeCandidate): number {
  return valueOf(c, '字重', 50) * valueOf(c, '字重比率', 1)
}

function setParamValue(params: IParameter[], name: string, value: number): void {
  const p = params.find(p => p.name === name)
  if (p) p.value = value
}

/** 绝对值差 */
function absDiff(a: { x: number; y: number }, b: { x: number; y: number }): { dx: number; dy: number } {
  return { dx: Math.abs(a.x - b.x), dy: Math.abs(a.y - b.y) }
}

/**
 * 执行字符中所有 glyph 组件的脚本，收集关节局部坐标。
 * 与 fangYuanRules.collectCharacterJointData 逻辑一致，但不打日志（加载时逐字符调用，避免刷屏）。
 */
function collectJoints(character: ICharacterFileLite): Map<string, Map<string, { x: number; y: number }>> {
  const result = new Map<string, Map<string, { x: number; y: number }>>()
  for (const comp of character.components) {
    if (comp?.type !== 'glyph') continue
    const gc = comp as IGlyphComponent
    const glyph = gc.value as ICustomGlyph | undefined
    if (!glyph) continue
    try {
      executeGlyphScript(glyph, gc.uuid)
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn(`[FangYuanStrokeMerge] 脚本执行失败 ${glyph.name}:`, e)
      }
      continue
    }
    const inst = instanceManager.getPooledInstance(gc.uuid) as CustomGlyph | undefined
    if (!inst) continue
    const jointMap = new Map<string, { x: number; y: number }>()
    for (const joint of inst.getJoints()) {
      const jx = typeof joint.x === 'function' ? joint.x() : joint.x
      const jy = typeof joint.y === 'function' ? joint.y() : joint.y
      jointMap.set(joint.name, { x: jx, y: jy })
    }
    result.set(gc.uuid, jointMap)
  }
  return result
}

// ===== 规则定义 =====

interface PairRule {
  id: string
  /** 第一个笔画名称（连接点取其 firstJoint，如 end） */
  firstName: string
  /** 第二个笔画名称（连接点取其 secondJoint，如 start） */
  secondName: string
  firstJoint: string
  secondJoint: string
  /** none: x/y 均需在 DELTA 内；weightX: x 相隔 ≈ 字重*字重比率（y 在 DELTA 内）；weightY: y 相隔 ≈ 字重*字重比率（x 在 DELTA 内）；weightYRange: y 方向间隔在 [0, 字重*字重比率] ± DELTA 内（x 在 DELTA 内） */
  gapMode: 'none' | 'weightX' | 'weightY' | 'weightYRange'
  /** gapMode 为 weightX/weightY 时，取哪个笔画的字重*字重比率作为期望间隔 */
  weightSource: 'first' | 'second'
  /** 合并后字形原点对齐的第一个笔画关节（缺省 'start'） */
  originJoint?: string
  /** 合并后的笔画名称（对应 strokes.ts 与 private/v1 脚本） */
  targetName: string
  /** 在 canonical 参数基础上应用值映射 */
  applyParams: (params: IParameter[], first: StrokeCandidate, second: StrokeCandidate) => void
}

const PAIR_RULES: PairRule[] = [
  {
    // 规则一：直角捺 + 横 → 平捺（弯笔起笔）
    id: '直角捺+横→平捺',
    firstName: '直角捺',
    secondName: '横',
    firstJoint: 'end',
    secondJoint: 'start',
    gapMode: 'weightX',
    weightSource: 'first',
    targetName: '平捺',
    applyParams(params, first, second) {
      const w = weightOf(first)
      setParamValue(params, '起笔风格', START_STYLE_WAN)
      // 平捺的"水平延伸"是捺尾的横向部分（脚本 horizontalSpan），对应原横
      setParamValue(params, '水平延伸', valueOf(second, '水平延伸') + w * 0.5)
      // 注意：平捺数据/脚本中弯笔参数名为 em dash（弯—）
      setParamValue(params, '弯—水平延伸', valueOf(first, '水平延伸') + w * 0.5)
      setParamValue(params, '弯—竖直延伸', valueOf(first, '竖直延伸'))
      setParamValue(params, '弯—弯曲度', valueOf(first, '弯曲度', 1.5))
      setParamValue(params, '字重', valueOf(first, '字重', 50))
      setParamValue(params, '字重比率', valueOf(first, '字重比率', 1))
    },
  },
  {
    // 规则二：横 + 竖撇 → 横折钩（弯笔收笔）
    id: '横+竖撇→横折钩',
    firstName: '横',
    secondName: '竖撇',
    firstJoint: 'end',
    secondJoint: 'shu_start',
    gapMode: 'none',
    weightSource: 'first',
    targetName: '横折钩',
    applyParams(params, first, second) {
      setParamValue(params, '收笔风格', END_STYLE_WAN)
      setParamValue(params, '横-水平延伸', valueOf(first, '水平延伸'))
      setParamValue(params, '折-竖直延伸', valueOf(second, '竖-竖直延伸'))
      setParamValue(params, '钩-水平延伸', valueOf(second, '撇-水平延伸'))
      setParamValue(params, '钩-竖直延伸', valueOf(second, '撇-竖直延伸'))
      setParamValue(params, '钩-弯曲度', valueOf(second, '撇-弯曲度', 1.5))
      setParamValue(params, '字重', valueOf(first, '字重', 50))
      setParamValue(params, '字重比率', valueOf(first, '字重比率', 1))
    },
  },
  {
    // 规则三：横 + 直角撇 → 横折钩（弯笔收笔）
    // 相连判定：x 相同，y 相隔 字重*字重比率（收笔/起笔各有 originalWeight*0.5 凸出）
    id: '横+直角撇→横折钩',
    firstName: '横',
    secondName: '直角撇',
    firstJoint: 'end',
    secondJoint: 'start',
    gapMode: 'weightY',
    weightSource: 'second',
    targetName: '横折钩',
    applyParams(params, first, second) {
      setParamValue(params, '收笔风格', END_STYLE_WAN)
      setParamValue(params, '横-水平延伸', valueOf(first, '水平延伸'))
      setParamValue(params, '折-竖直延伸', weightOf(second) * 0.5)
      setParamValue(params, '钩-水平延伸', valueOf(second, '水平延伸'))
      setParamValue(params, '钩-竖直延伸', valueOf(second, '竖直延伸'))
      setParamValue(params, '钩-弯曲度', valueOf(second, '弯曲度', 1.5))
      setParamValue(params, '字重', valueOf(first, '字重', 50))
      setParamValue(params, '字重比率', valueOf(first, '字重比率', 1))
    },
  },
  {
    // 规则四：可倾斜横 + 竖撇 → 可倾斜横折钩（弯笔收笔）
    id: '可倾斜横+竖撇→可倾斜横折钩',
    firstName: '可倾斜横',
    secondName: '竖撇',
    firstJoint: 'end',
    secondJoint: 'shu_start',
    gapMode: 'none',
    weightSource: 'first',
    targetName: '可倾斜横折钩',
    applyParams(params, first, second) {
      setParamValue(params, '收笔风格', END_STYLE_WAN)
      setParamValue(params, '横-水平延伸', valueOf(first, '水平延伸'))
      setParamValue(params, '横-竖直延伸', valueOf(first, '竖直延伸'))
      setParamValue(params, '折-竖直延伸', valueOf(second, '竖-竖直延伸'))
      setParamValue(params, '钩-水平延伸', valueOf(second, '撇-水平延伸'))
      setParamValue(params, '钩-竖直延伸', valueOf(second, '撇-竖直延伸'))
      setParamValue(params, '钩-弯曲度', valueOf(second, '撇-弯曲度', 1.5))
      setParamValue(params, '字重', valueOf(first, '字重', 50))
      setParamValue(params, '字重比率', valueOf(first, '字重比率', 1))
    },
  },
  {
    // 规则五：可倾斜横 + 直角撇 → 可倾斜横折钩（弯笔收笔）
    id: '可倾斜横+直角撇→可倾斜横折钩',
    firstName: '可倾斜横',
    secondName: '直角撇',
    firstJoint: 'end',
    secondJoint: 'start',
    gapMode: 'none',
    weightSource: 'first',
    targetName: '可倾斜横折钩',
    applyParams(params, first, second) {
      setParamValue(params, '收笔风格', END_STYLE_WAN)
      setParamValue(params, '横-水平延伸', valueOf(first, '水平延伸'))
      setParamValue(params, '横-竖直延伸', valueOf(first, '竖直延伸'))
      setParamValue(params, '折-竖直延伸', weightOf(second) * 0.5)
      setParamValue(params, '钩-水平延伸', valueOf(second, '水平延伸'))
      setParamValue(params, '钩-竖直延伸', valueOf(second, '竖直延伸'))
      setParamValue(params, '钩-弯曲度', valueOf(second, '弯曲度', 1.5))
      setParamValue(params, '字重', valueOf(first, '字重', 50))
      setParamValue(params, '字重比率', valueOf(first, '字重比率', 1))
    },
  },
  {
    // 规则六：横 + 竖弯钩 → 横弯钩（收笔风格沿用竖弯钩）
    id: '横+竖弯钩→横弯钩',
    firstName: '横',
    secondName: '竖弯钩',
    firstJoint: 'end',
    secondJoint: 'shu_start',
    gapMode: 'none',
    weightSource: 'first',
    targetName: '横弯钩',
    applyParams(params, first, second) {
      const endStyle = getParamValue(second.glyph, '收笔风格')
      if (endStyle !== undefined) {
        setParamValue(params, '收笔风格', endStyle)
      }
      setParamValue(params, '横-水平延伸', valueOf(first, '水平延伸'))
      setParamValue(params, '弯-水平延伸', valueOf(second, '弯-长度'))
      setParamValue(params, '弯-竖直延伸', valueOf(second, '竖-竖直延伸'))
      setParamValue(params, '钩-竖直延伸', valueOf(second, '钩-竖直延伸'))
      setParamValue(params, '字重', valueOf(first, '字重', 50))
      setParamValue(params, '字重比率', valueOf(first, '字重比率', 1))
    },
  },
  {
    // 规则七：竖折 + 竖撇 → 竖折折钩（弯笔收笔）
    // 相连判定：竖折 zhe_end 与竖撇 shu_start x 相同、y 方向间隔在 [0, 字重*字重比率] ± DELTA 内
    id: '竖折+竖撇→竖折折钩',
    firstName: '竖折',
    secondName: '竖撇',
    firstJoint: 'zhe_end',
    secondJoint: 'shu_start',
    gapMode: 'weightYRange',
    weightSource: 'second',
    originJoint: 'shu_start',
    targetName: '竖折折钩',
    applyParams(params, first, second) {
      setParamValue(params, '收笔风格', END_STYLE_WAN)
      // 竖折对应部分：竖、折1
      setParamValue(params, '竖-竖直延伸', valueOf(first, '竖-竖直延伸'))
      setParamValue(params, '折1-水平延伸', valueOf(first, '折-水平延伸'))
      // 折2 与原竖撇的竖对应；钩与原竖撇的撇对应
      setParamValue(params, '折2-竖直延伸', valueOf(second, '竖-竖直延伸'))
      setParamValue(params, '钩-水平延伸', valueOf(second, '撇-水平延伸'))
      setParamValue(params, '钩-竖直延伸', valueOf(second, '撇-竖直延伸'))
      setParamValue(params, '钩-弯曲度', valueOf(second, '撇-弯曲度', 1.5))
      setParamValue(params, '字重', valueOf(first, '字重', 50))
      setParamValue(params, '字重比率', valueOf(first, '字重比率', 1))
    },
  },
  {
    // 规则八：竖折 + 直角撇 → 竖折折钩（弯笔收笔）
    // 相连判定：竖折 zhe_end 与直角撇 start x 相同、y 相隔 字重*字重比率（容差 DELTA）
    id: '竖折+直角撇→竖折折钩',
    firstName: '竖折',
    secondName: '直角撇',
    firstJoint: 'zhe_end',
    secondJoint: 'start',
    gapMode: 'weightY',
    weightSource: 'second',
    originJoint: 'shu_start',
    targetName: '竖折折钩',
    applyParams(params, first, second) {
      setParamValue(params, '收笔风格', END_STYLE_WAN)
      // 竖折对应部分：竖、折1
      setParamValue(params, '竖-竖直延伸', valueOf(first, '竖-竖直延伸'))
      setParamValue(params, '折1-水平延伸', valueOf(first, '折-水平延伸'))
      // 折2 与直角撇的整体下落对应；钩与直角撇的撇对应
      setParamValue(params, '折2-竖直延伸', weightOf(second) * 0.5)
      setParamValue(params, '钩-水平延伸', valueOf(second, '水平延伸'))
      setParamValue(params, '钩-竖直延伸', valueOf(second, '竖直延伸'))
      setParamValue(params, '钩-弯曲度', valueOf(second, '弯曲度', 1.5))
      setParamValue(params, '字重', valueOf(first, '字重', 50))
      setParamValue(params, '字重比率', valueOf(first, '字重比率', 1))
    },
  },
]

// ===== 连接判定 =====

/** 判断 first 与 second 是否按规则相连（绝对坐标 = 局部 + ox/oy） */
function checkConnection(
  rule: PairRule,
  first: StrokeCandidate,
  second: StrokeCandidate,
): boolean {
  const p1 = first.joints.get(rule.firstJoint)
  const p2 = second.joints.get(rule.secondJoint)
  if (!p1 || !p2) return false

  const a1 = { x: p1.x + first.position.x, y: p1.y + first.position.y }
  const a2 = { x: p2.x + second.position.x, y: p2.y + second.position.y }
  const { dx, dy } = absDiff(a1, a2)

  if (rule.gapMode === 'weightX') {
    // 两个笔画收笔/起笔各有 originalWeight*0.5 的轮廓凸出，骨架点相隔 字重*字重比率（水平方向）
    const expectedGap = rule.weightSource === 'first' ? weightOf(first) : weightOf(second)
    return dy <= DELTA && Math.abs(dx - expectedGap) <= DELTA
  }
  if (rule.gapMode === 'weightY') {
    // 同上（垂直方向）
    const expectedGap = rule.weightSource === 'first' ? weightOf(first) : weightOf(second)
    return dx <= DELTA && Math.abs(dy - expectedGap) <= DELTA
  }
  if (rule.gapMode === 'weightYRange') {
    // y 方向间隔允许 [0, 字重*字重比率]（两端各放宽 DELTA）：
    // 第二个笔画在第一个下方，允许刚好相连（间隔 0），最远不超过一个字重
    const expectedGap = rule.weightSource === 'first' ? weightOf(first) : weightOf(second)
    const dySigned = a2.y - a1.y
    return dx <= DELTA && dySigned >= -DELTA && dySigned <= expectedGap + DELTA
  }
  return dx <= DELTA && dy <= DELTA
}

// ===== 合并组件构建 =====

/** 构建合并后的 glyph 组件；失败返回 null */
function buildMergedComponent(
  rule: PairRule,
  first: StrokeCandidate,
  second: StrokeCandidate,
  strokeNameToUuid: Map<string, string>,
): IComponent | null {
  const targetStroke = strokes.find(s => s.name === rule.targetName)
  if (!targetStroke) {
    if (import.meta.env.DEV) {
      console.warn(`[FangYuanStrokeMerge] 笔画数据中缺少目标笔画: ${rule.targetName}`)
    }
    return null
  }

  const scriptReference = strokeNameToUuid.get(rule.targetName)
  if (!scriptReference) {
    if (import.meta.env.DEV) {
      console.warn(`[FangYuanStrokeMerge] stroke_glyphs 中缺少 ${rule.targetName} 的 uuid，跳过合并`)
    }
    return null
  }

  // canonical 参数 + 规则值映射
  const params = buildFangYuanStrokeParameters(targetStroke)
  rule.applyParams(params, first, second)

  // 位置：让合并字形的骨架起点（x0/y0）对齐第一个笔画的起始关节（绝对坐标）
  const origin = TARGET_ORIGIN[rule.targetName]
  const startLocal = first.joints.get(rule.originJoint ?? 'start')
  const ox = (first.comp.ox ?? 0) + (startLocal?.x ?? origin.x) - origin.x
  const oy = (first.comp.oy ?? 0) + (startLocal?.y ?? origin.y) - origin.y

  const mergedUuid = genUUID()
  // value 沿用 stroke_glyphs 定义（uuid 指向定义，与 testHandlers 导入字形组件的结构一致）
  const mergedValue: ICustomGlyph = {
    uuid: scriptReference,
    name: rule.targetName,
    type: 'system',
    components: [],
    groups: [],
    orderedList: [],
    selectedComponentsUUIDs: [],
    view: { zoom: 100, translateX: 0, translateY: 0 },
    parameters: params,
    joints: [],
    script_reference: scriptReference,
    style: '字玩方圆黑体',
  }

  const mergedComp: IGlyphComponent = {
    uuid: mergedUuid,
    type: 'glyph',
    name: rule.targetName,
    lock: false,
    visible: true,
    usedInCharacter: true,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    rotation: 0,
    flipX: false,
    flipY: false,
    ox,
    oy,
    value: mergedValue,
  }
  return mergedComp
}

// ===== 主入口 =====

/**
 * 遍历字符中所有笔画组合（不要求按顺序相邻），按 8 条规则将相连的笔画对替换为组合笔画。
 * 每个笔画在本趟扫描中最多参与一次合并（合并产物不再参与本趟规则匹配）。
 */
export function mergeFangYuanStrokePairsInCharacter(
  character: ICharacterFileLite,
  strokeNameToUuid: Map<string, string>,
): void {
  if (!import.meta.env.DEV) return
  const components = character.components as IComponent[] | undefined
  if (!components?.length) return

  // 1. 采集关节数据
  const jointsByUuid = collectJoints(character)
  if (jointsByUuid.size === 0) return

  // 2. 候选列表（仅 glyph 组件，且风格为方圆黑体）
  const candidates: StrokeCandidate[] = []
  components.forEach((comp, index) => {
    if (comp?.type !== 'glyph') return
    const gc = comp as IGlyphComponent
    const glyph = gc.value as ICustomGlyph | undefined
    if (!glyph || !STYLE_TAGS.has(String(glyph.style))) return
    const joints = jointsByUuid.get(gc.uuid)
    if (!joints) return
    candidates.push({
      comp: gc,
      index,
      glyph,
      joints,
      position: { x: gc.ox ?? 0, y: gc.oy ?? 0 },
      consumed: false,
    })
  })
  if (candidates.length < 2) return

  // 3. 遍历所有笔画组合（i ≠ j），按规则顺序尝试匹配
  interface MergeOp {
    first: StrokeCandidate
    second: StrokeCandidate
    merged: IComponent
  }
  const ops: MergeOp[] = []

  for (let i = 0; i < candidates.length; i++) {
    const first = candidates[i]
    if (first.consumed) continue
    for (let j = 0; j < candidates.length; j++) {
      if (i === j) continue
      const second = candidates[j]
      if (second.consumed) continue

      for (const rule of PAIR_RULES) {
        if (first.glyph.name !== rule.firstName || second.glyph.name !== rule.secondName) continue
        if (!checkConnection(rule, first, second)) continue
        const merged = buildMergedComponent(rule, first, second, strokeNameToUuid)
        if (!merged) continue

        ops.push({ first, second, merged })
        first.consumed = true
        second.consumed = true
        if (import.meta.env.DEV) {
          console.log(
            `[FangYuanStrokeMerge] ${rule.id}: ` +
            `${character.character?.text || character.uuid} 中 ${first.comp.uuid.slice(-8)} 与 ${second.comp.uuid.slice(-8)} 合并为 ${rule.targetName}`,
          )
        }
        break
      }
    }
  }

  if (ops.length === 0) return

  // 4. 应用替换：在第一个笔画位置插入合并组件，移除两个原组件
  const removedUuids = new Set<string>()
  const insertAtFirst = new Map<string, IComponent>()
  for (const op of ops) {
    removedUuids.add(op.first.comp.uuid)
    removedUuids.add(op.second.comp.uuid)
    insertAtFirst.set(op.first.comp.uuid, op.merged)
  }

  const nextComponents: IComponent[] = []
  for (const comp of components) {
    const merged = insertAtFirst.get(comp.uuid)
    if (merged) {
      nextComponents.push(merged)
      continue
    }
    if (removedUuids.has(comp.uuid)) continue
    nextComponents.push(comp)
  }
  character.components = nextComponents

  // orderedList 同步（如有条目引用被移除组件）
  const ordered = character.orderedList as Array<{ type?: string; uuid?: string }> | undefined
  if (ordered?.length) {
    const nextOrdered: Array<{ type?: string; uuid?: string }> = []
    for (const entry of ordered) {
      if (!entry?.uuid) {
        nextOrdered.push(entry)
        continue
      }
      const merged = insertAtFirst.get(entry.uuid)
      if (merged) {
        nextOrdered.push({ type: 'component', uuid: merged.uuid })
        continue
      }
      if (removedUuids.has(entry.uuid)) continue
      nextOrdered.push(entry)
    }
    character.orderedList = nextOrdered as ICharacterFileLite['orderedList']
  }
}
