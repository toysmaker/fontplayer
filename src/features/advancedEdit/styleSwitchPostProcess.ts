/**
 * 高级编辑「风格切换」中宋/仿宋/楷/隶的额外处理（对齐原 advancedEdit process_character_*）
 * 适配扁平 / 嵌套 parameters、Constant / AdvancedEditConstant。
 */

import { genUUID } from '@/utils/uuid'
import type { ICharacterFileLite, IConstant, ICustomGlyph, IGlyphComponent } from '@/core/types'
import { ParameterType } from '@/core/types'
import { parameterRowsForGlyph } from '@/core/utils/glyph'

export function isSerifStylePreset(preset: { uuid: string } | undefined): boolean {
  if (!preset) return false
  return (
    preset.uuid === 'ss-song' ||
    preset.uuid === 'ss-fangsong' ||
    preset.uuid === 'ss-kai' ||
    preset.uuid === 'ss-li'
  )
}

/** 原 process_characters_song / fangsong / kai / li 中相同的四项全局常量补丁 */
export function applySharedSerifConstantsPatch(list: IConstant[]): void {
  const patches: [string, number][] = [
    ['起笔风格', 1],
    ['起笔数值', 2],
    ['转角风格', 1],
    ['转角数值', 2],
  ]
  for (const [name, value] of patches) {
    const c = list.find((x) => x.name === name)
    if (c) c.value = value
  }
}

function resolveParamLiteral(
  param: { type: ParameterType; name: string; value: unknown },
  constantsList: IConstant[],
): unknown {
  if (param.type === ParameterType.Constant || param.type === ParameterType.AdvancedEditConstant) {
    const uuid = String(param.value)
    const hit = constantsList.find((x) => x.uuid === uuid)
    if (hit) return hit.value
  }
  return param.value
}

/** 返回可变的参数字典行数组（必要时初始化字形 parameters） */
function getOrCreateParameterRows(glyph: ICustomGlyph): any[] {
  const raw = glyph.parameters as unknown
  if (raw === undefined || raw === null) {
    ;(glyph as any).parameters = []
    return (glyph as any).parameters
  }
  if (Array.isArray(raw)) return raw as any[]
  const wrap = raw as { parameters?: any[] }
  if (!Array.isArray(wrap.parameters)) wrap.parameters = []
  return wrap.parameters
}

function addOrSetGlyphParam(
  glyph: ICustomGlyph,
  name: string,
  value: number | string,
  type: ParameterType,
): void {
  const rows = getOrCreateParameterRows(glyph)
  const existing = rows.find((p: any) => p.name === name)
  if (existing) {
    existing.value = value
    return
  }
  rows.push({ uuid: genUUID(), name, value, type })
}

/**
 * 仿宋 / 楷体 / 隶书：在替换笔画模板之前执行（原工程在 switchStyle 之前）。
 * 隶书：「横」且水平延伸≥500 时改名为「横波」以匹配隶书笔画库。
 */
export function processCharacterBeforeSerifStyleSwitch(
  character: ICharacterFileLite,
  constantsList: IConstant[],
  variant: 'fangsong' | 'kai' | 'li',
): void {
  for (const comp of character.components || []) {
    if (comp.type !== 'glyph') continue
    const glyph = (comp as IGlyphComponent).value as ICustomGlyph
    if (!glyph) continue

    const rows = getOrCreateParameterRows(glyph)
    for (const parameter of rows) {
      if (parameter.name === '起笔风格') {
        const value = resolveParamLiteral(parameter as any, constantsList)
        if (value === 0) {
          addOrSetGlyphParam(glyph, '收笔风格', 0, ParameterType.Enum)
        }
      }
    }

    if (variant === 'li' && glyph.name === '横') {
      const hz = rows.find((p: any) => p.name === '水平延伸')
      if (hz) {
        const val = Number(resolveParamLiteral(hz as any, constantsList))
        if (!Number.isNaN(val) && val >= 500) {
          glyph.name = '横波'
        }
      }
    }
  }
}

/** 字玩标准宋体：在替换笔画模板之后执行（原工程在 switchStyle 之后） */
export function processCharacterAfterSongStyleSwitch(
  character: ICharacterFileLite,
  constantsList: IConstant[],
): void {
  for (const comp of character.components || []) {
    if (comp.type !== 'glyph') continue
    const glyph = (comp as IGlyphComponent).value as ICustomGlyph
    if (!glyph) continue

    const rows = parameterRowsForGlyph(glyph) ?? getOrCreateParameterRows(glyph)
    for (const parameter of rows) {
      if (parameter.name === '起笔风格') {
        const value = resolveParamLiteral(parameter as any, constantsList)
        if (value === 0) {
          addOrSetGlyphParam(glyph, '收笔风格', 0, ParameterType.Enum)
        }
      }
    }
  }
}
