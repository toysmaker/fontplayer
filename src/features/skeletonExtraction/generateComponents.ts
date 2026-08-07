/**
 * 从骨架笔画生成字形组件
 * 将 ICharacterSkeletonStroke[] 转换为 ICustomGlyph 并添加到字符中
 *
 * 参数命名与 src/templates/kai/ 中各模板的 computeParamsByJoints/updateGlyphByParams 对齐
 */

import type { ICharacterSkeletonStroke } from '@/core/types'
import type { ICustomGlyph } from '@/core/types'
import { genUUID } from '@/utils/uuid'
import { useCharacterStore } from '@/stores/character'

/** 模板参数名 — 与 instanceBasicGlyph 中 glyph.getParam() 中文字符串一致 */
const TEMPLATE_PARAM_MAP: Record<string, string[]> = {
  '横':   ['水平延伸', '竖直延伸'],
  '竖':   ['水平延伸', '竖直延伸'],
  '撇':   ['水平延伸', '竖直延伸', '弯曲游标', '弯曲度'],
  '捺':   ['水平延伸', '竖直延伸', '弯曲游标', '弯曲度'],
  '点':   ['水平延伸', '竖直延伸', '弯曲游标', '弯曲度'],
  '挑':   ['水平延伸', '竖直延伸', '弯曲游标', '弯曲度'],
  '平捺': ['水平延伸', '竖直延伸', '弯曲游标', '弯曲度'],
  '弯钩': ['弯-长度', '弯-弯曲度', '钩-水平延伸', '钩-竖直延伸'],
  '斜钩': ['斜-水平延伸', '斜-竖直延伸', '钩-水平延伸', '钩-竖直延伸'],
  '横折': ['横-水平延伸', '横-竖直延伸', '折-水平延伸', '折-竖直延伸'],
  '竖折': ['竖-水平延伸', '竖-竖直延伸', '折-水平延伸', '折-竖直延伸'],
  '横钩': ['横-水平延伸', '横-竖直延伸', '钩-水平延伸', '钩-竖直延伸'],
  '竖钩': ['竖-水平延伸', '竖-竖直延伸', '钩-水平延伸', '钩-竖直延伸'],
  '横撇': ['横-水平延伸', '横-竖直延伸', '撇-水平延伸', '撇-竖直延伸'],
  '竖撇': ['竖-长度', '撇-水平延伸', '撇-竖直延伸'],
  '竖挑': ['竖-水平延伸', '竖-竖直延伸', '挑-水平延伸', '挑-竖直延伸'],
  '竖弯': ['竖-水平延伸', '竖-竖直延伸', '弯-长度'],
  '横折2': ['横-水平延伸', '横-竖直延伸', '折-水平延伸', '折-竖直延伸'],
  '横折钩': ['横-水平延伸', '横-竖直延伸', '折-水平延伸', '折-竖直延伸', '钩-水平延伸', '钩-竖直延伸'],
  '横折弯': ['横-水平延伸', '横-竖直延伸', '折-水平延伸', '折-竖直延伸', '弯-长度'],
  '横折挑': ['横-水平延伸', '横-竖直延伸', '折-水平延伸', '折-竖直延伸', '挑-水平延伸', '挑-竖直延伸'],
  '竖弯钩': ['竖-水平延伸', '竖-竖直延伸', '弯-长度', '钩-水平延伸', '钩-竖直延伸'],
  '竖折折钩': ['竖-水平延伸', '竖-竖直延伸', '折-水平延伸', '折-竖直延伸', '钩-水平延伸', '钩-竖直延伸'],
  '横折弯钩': ['横-水平延伸', '横-竖直延伸', '折-水平延伸', '折-竖直延伸', '钩-水平延伸', '钩-竖直延伸'],
  '横折折撇': ['横-水平延伸', '横-竖直延伸', '折1-水平延伸', '折1-竖直延伸', '撇-水平延伸', '撇-竖直延伸'],
  '横撇弯钩': ['横-水平延伸', '横-竖直延伸', '撇-水平延伸', '撇-竖直延伸', '钩-水平延伸', '钩-竖直延伸'],
  '横折折弯钩': ['横-水平延伸', '横-竖直延伸', '折1-水平延伸', '折1-竖直延伸', '折2-水平延伸', '折2-竖直延伸', '钩-水平延伸', '钩-竖直延伸'],
  '二横折': ['横1-水平延伸', '横1-竖直延伸', '折1-水平延伸', '折1-竖直延伸', '横2-水平延伸', '横2-竖直延伸'],
  '横弯钩': ['横-水平延伸', '横-竖直延伸', '弯-水平延伸', '弯-竖直延伸', '钩-水平延伸', '钩-竖直延伸'],
  '撇挑': ['撇-水平延伸', '撇-竖直延伸', '挑-水平延伸', '挑-竖直延伸'],
  '撇点': ['撇-水平延伸', '撇-竖直延伸', '点-水平延伸', '点-竖直延伸'],
  '挑捺': ['挑-水平延伸', '挑-竖直延伸', '捺-水平延伸', '捺-竖直延伸'],
}

/** 统一参数后缀 */
const SHARED_PARAMS = ['参考位置', '字重']

/**
 * 从骨架笔画生成 ICustomGlyph 数组
 * skeleton.type = 笔画名, skeleton.ox/oy = 偏移量
 * parameters = 模板参数 + 参考位置 + 字重
 * joints = 骨架提取的关键点（与模板 skeletonToBones 命名一致）
 */
export function strokesToGlyphs(strokes: ICharacterSkeletonStroke[]): ICustomGlyph[] {
  return strokes.map((stroke, i) => {
    const uuid = genUUID()
    const paramNames = TEMPLATE_PARAM_MAP[stroke.name] || ['水平延伸', '竖直延伸']

    const parameters = [
      ...paramNames.map(name => ({
        uuid: genUUID(), name, type: 0, value: stroke.params[name] ?? 0,
      })),
      ...SHARED_PARAMS.map(name => ({
        uuid: genUUID(), name, type: 0, value: stroke.params[name] ?? (name === '字重' ? 40 : 0),
      })),
    ]

    // 弯曲程度（弯曲度 = 弯曲度_raw + 30 * 弯曲程度）
    if (paramNames.includes('弯曲度')) {
      parameters.push({
        uuid: genUUID(), name: '弯曲程度', type: 0, value: stroke.params['弯曲程度'] ?? 1,
      })
    }

    return {
      uuid,
      name: `${stroke.name}_${i + 1}`,
      type: 'glyph',
      components: [],
      parameters,
      skeleton: {
        type: stroke.name,
        ox: stroke.ox,
        oy: stroke.oy,
      },
      joints: Object.entries(stroke.joints).map(([name, j]) => ({
        name,
        x: j.x,
        y: j.y,
      })),
    } as ICustomGlyph
  })
}

/** 生成并添加为字形组件 */
export function generateAndAddGlyphComponents() {
  const characterStore = useCharacterStore()
  const ch = characterStore.editingCharacter
  if (!ch?.skeleton?.strokes?.length) {
    if (import.meta.env.DEV) console.warn('[SkeletonGen] No skeleton strokes')
    return
  }

  const glyphs = strokesToGlyphs(ch.skeleton.strokes)

  for (const glyph of glyphs) {
    const uuid = genUUID()
    const component: any = {
      uuid,
      type: 'glyph',
      name: glyph.name,
      lock: false, visible: true,
      x: 0, y: 0, w: 0, h: 0,
      rotation: 0, flipX: false, flipY: false,
      ox: glyph.skeleton?.ox ?? 0,
      oy: glyph.skeleton?.oy ?? 0,
      value: JSON.parse(JSON.stringify(glyph)),
    }
    ch.components.push(component)
    ch.orderedList.push({ type: 'component', uuid })
  }

  characterStore.editingCharacter = { ...ch }
  window.dispatchEvent(new CustomEvent('editor-skeleton-render'))

  if (import.meta.env.DEV) {
    console.log(`[SkeletonGen] Generated ${glyphs.length} glyph components`)
  }
}
