/**
 * 字玩方圆黑体 — 风格规则实现
 *
 * 每个规则对应一种设计约束。
 * 规则通过 fangYuanStyleRules 注册，在 applyStyleToGlyphParameter 中被调用。
 *
 * 添加新规则：
 * 1. 在本文件中实现 StyleRule 对象
 * 2. 在 fangYuanStyleConfig.ts 的 fangYuanStyleRules 数组中注册
 * 3. 如需额外上下文数据，扩展 FangYuanRuleExtra 并在 store 中传入
 */

import type { ICharacterFileLite, ICustomGlyph, IGlyphComponent } from '@/core/types'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { fangYuanStyleRules, type StyleRule } from './fangYuanStyleConfig'

// ========== 类型定义 ==========

/** 从脚本执行后提取的组件关节和辅助线数据 */
export interface ComponentJointData {
  /** 组件 UUID */
  uuid: string
  /** 关节名 → 坐标 */
  joints: Map<string, { x: number; y: number }>
  /** 辅助线列表（来自 glyph.addRefLine） */
  reflines: Array<{ name: string; start: string; end: string; type?: string }>
  /** 组件在字符中的偏移 */
  position: { x: number; y: number }
  /** 字形名称 */
  glyphName: string
}

/** 传给 StyleRuleContext.extra 的规则上下文数据 */
export interface FangYuanRuleExtra {
  /** 字符中所有组件的关节/辅助线数据 */
  allComponents: ComponentJointData[]
  /** 当前正在检查的组件数据 */
  currentComponent: ComponentJointData
  /** 判定"相连"的垂直距离阈值 */
  verticalThreshold: number
}

// ========== 常量 ==========

/** 横起笔组件中表示起点关节的命名模式（按优先级排列） */
const HENG_START_JOINT_PATTERNS = ['heng1_start', 'heng_start', 'start']

/** 判定辅助线为纵向（垂直）的 x 坐标差阈值 */
const VERTICAL_DX_THRESHOLD = 5

/** 默认垂直距离阈值 */
const DEFAULT_DISTANCE_THRESHOLD = 20

// ========== 工具函数 ==========

/**
 * 在组件的关节中按优先级查找横起笔起点关节
 */
function findHengStartJoint(
  joints: Map<string, { x: number; y: number }>,
): { x: number; y: number } | null {
  for (const pattern of HENG_START_JOINT_PATTERNS) {
    const pos = joints.get(pattern)
    if (pos) return pos
  }
  return null
}

/**
 * 通过几何特征判断辅助线是否为纵向（起点和终点的 x 坐标差很小）
 */
function isVerticalRefLine(
  refline: { start: string; end: string },
  joints: Map<string, { x: number; y: number }>,
): boolean {
  const s = joints.get(refline.start)
  const e = joints.get(refline.end)
  if (!s || !e) return false
  return Math.abs(e.x - s.x) < VERTICAL_DX_THRESHOLD
}

/**
 * 计算点到线段的最短距离
 */
function pointToSegmentDistance(
  point: { x: number; y: number },
  segStart: { x: number; y: number },
  segEnd: { x: number; y: number },
): number {
  const dx = segEnd.x - segStart.x
  const dy = segEnd.y - segStart.y
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - segStart.x, point.y - segStart.y)
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / (dx * dx + dy * dy)),
  )
  return Math.hypot(point.x - (segStart.x + t * dx), point.y - (segStart.y + t * dy))
}

// ========== 数据采集 ==========

/**
 * 执行字符中所有字形组件的脚本，采集关节和辅助线数据。
 * 数据用于规则检查（如判断横起笔是否与纵向笔画相连）。
 *
 * 注意：调用后 CustomGlyph 实例会保留在 InstanceManager 中，
 * 后续的 executeGlyphScript 调用会 clear() 并重新执行。
 */
export function collectCharacterJointData(char: ICharacterFileLite): ComponentJointData[] {
  const result: ComponentJointData[] = []

  for (const comp of char.components) {
    if (comp.type !== 'glyph') continue
    const gc = comp as IGlyphComponent
    const glyph = gc.value as ICustomGlyph

    try {
      executeGlyphScript(glyph, gc.uuid)
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn(`[FangYuanRules] executeGlyphScript failed for ${glyph.name} (${gc.uuid.slice(-8)}):`, e)
      }
      continue
    }

    const instance = instanceManager.getPooledInstance(gc.uuid) as CustomGlyph | undefined
    if (!instance) {
      if (import.meta.env.DEV) {
        console.warn(`[FangYuanRules] no pooled instance for ${glyph.name} (${gc.uuid.slice(-8)})`)
      }
      continue
    }

    const joints = instance.getJoints()
    const reflines = instance.getRefLines()

    const jointMap = new Map<string, { x: number; y: number }>()
    for (const joint of joints) {
      const jx = typeof joint.x === 'function' ? joint.x() : joint.x
      const jy = typeof joint.y === 'function' ? joint.y() : joint.y
      jointMap.set(joint.name, { x: jx, y: jy })
    }

    const entry: ComponentJointData = {
      uuid: gc.uuid,
      joints: jointMap,
      reflines: reflines.map((r: any) => ({
        name: r.name,
        start: r.start,
        end: r.end,
        type: r.type,
      })),
      position: { x: gc.ox ?? 0, y: gc.oy ?? 0 },
      glyphName: glyph.name,
    }

    if (import.meta.env.DEV) {
      console.log(
        `[FangYuanRules] collected ${glyph.name} ox=${gc.ox} oy=${gc.oy} ` +
        `joints=[${[...jointMap.keys()].join(',')}] ` +
        `reflines=[${entry.reflines.map((r) => r.name + (r.type ? `(${r.type})` : '')).join(',')}]`,
      )
    }

    result.push(entry)
  }

  if (import.meta.env.DEV) {
    console.log(`[FangYuanRules] total collected: ${result.length} components`)
  }
  return result
}

// ========== 规则：横起笔与纵向笔画相连时保留原始值 ==========

/**
 * 检查横起笔左侧起点是否与纵向笔画相连。
 *
 * 逻辑：
 * 1. 找到当前组件的横起笔起点关节（heng1_start / heng_start / start）
 * 2. 遍历字符中所有其他组件的纵向辅助线
 * 3. 计算起点到每条纵向辅助线的距离
 * 4. 如果任一距离小于阈值，判定为"相连"，跳过风格修改
 */
export const hengStartVerticalConnectionRule: StyleRule = {
  name: '横起笔-纵向相连检查',
  glyphNames: [
    '横', '横钩', '横撇', '横撇弯钩', '横弯钩', '横折', '横折2',
    '横折钩', '横折弯', '横折弯钩', '横折折撇', '横折折弯钩', '二横折',
  ],
  paramName: '起笔风格',

  shouldApply(context) {
    const extra = context.extra as unknown as FangYuanRuleExtra | undefined

    if (!extra?.allComponents?.length) {
      if (import.meta.env.DEV) {
        console.log('[FangYuanRules:hengStartVertical] no extra data, allowing')
      }
      return true
    }

    const threshold = extra.verticalThreshold ?? DEFAULT_DISTANCE_THRESHOLD
    const currentData = extra.currentComponent
    if (!currentData) {
      if (import.meta.env.DEV) {
        console.log(`[FangYuanRules:hengStartVertical] ${context.glyphName}: currentComponent not found, allowing`)
      }
      return true
    }

    const startPoint = findHengStartJoint(currentData.joints)
    if (!startPoint) {
      if (import.meta.env.DEV) {
        console.log(`[FangYuanRules:hengStartVertical] ${context.glyphName}: no heng start joint, allowing`)
      }
      return true
    }

    const absStart = {
      x: startPoint.x + currentData.position.x,
      y: startPoint.y + currentData.position.y,
    }

    if (import.meta.env.DEV) {
      console.log(
        `[FangYuanRules:hengStartVertical] ${context.glyphName}: ` +
        `startLocal=(${startPoint.x.toFixed(0)},${startPoint.y.toFixed(0)}) ` +
        `compPos=(${currentData.position.x},${currentData.position.y}) ` +
        `absStart=(${absStart.x.toFixed(0)},${absStart.y.toFixed(0)})`,
      )
    }

    for (const compData of extra.allComponents) {
      if (compData.uuid === currentData.uuid) continue

      for (const refline of compData.reflines) {
        if (!isVerticalRefLine(refline, compData.joints)) continue

        const s = compData.joints.get(refline.start)!
        const e = compData.joints.get(refline.end)!
        const absS = { x: s.x + compData.position.x, y: s.y + compData.position.y }
        const absE = { x: e.x + compData.position.x, y: e.y + compData.position.y }

        const dist = pointToSegmentDistance(absStart, absS, absE)
        if (import.meta.env.DEV) {
          console.log(
            `[FangYuanRules:hengStartVertical] ${context.glyphName} → ${compData.glyphName}.${refline.name}: ` +
            `dist=${dist.toFixed(1)} threshold=${threshold}`,
          )
        }
        if (dist < threshold) {
          if (import.meta.env.DEV) {
            console.log(
              `[FangYuanRules:hengStartVertical] ${context.glyphName}: ` +
              `BLOCKED (connected to ${compData.glyphName}.${refline.name})`,
            )
          }
          return false
        }
      }
    }

    if (import.meta.env.DEV) {
      console.log(`[FangYuanRules:hengStartVertical] ${context.glyphName}: no connection found, allowing`)
    }
    return true
  },
}

// ========== 规则注册 ==========

/**
 * 将本模块定义的所有规则注册到全局规则表。
 * 在模块加载时自动执行，确保规则在任何 store 操作前已就绪。
 */
export function initFangYuanRules(): void {
  if (fangYuanStyleRules.includes(hengStartVerticalConnectionRule)) return
  fangYuanStyleRules.push(hengStartVerticalConnectionRule)
}

// 模块加载时自动注册
initFangYuanRules()
