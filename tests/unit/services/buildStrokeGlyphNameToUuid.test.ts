/**
 * 回归测试：buildStrokeGlyphNameToUuid 优先选择带脚本的定义。
 * 背景：旧工程中同名 stroke_glyphs 可能存在"空脚本"残留条目（如"测试笔画模板1"骨架绑定条目），
 * 若映射指向它们，字符组件替换脚本引用后无法解析脚本 → 画布上消失。
 */
import { describe, it, expect } from 'vitest'
import { buildStrokeGlyphNameToUuid } from '@/features/temporaryScripts/fileProcessing'
import type { ICustomGlyph } from '@/core/types'

function defGlyph(name: string, uuid: string, script: string): ICustomGlyph {
  return {
    uuid, name, type: 'system', components: [], groups: [], orderedList: [],
    selectedComponentsUUIDs: [], view: { zoom: 100, translateX: 0, translateY: 0 },
    parameters: [], joints: [], script, style: '字玩方圆黑体',
  }
}

describe('buildStrokeGlyphNameToUuid', () => {
  it('同名存在带脚本与空脚本定义时，优先选择带脚本的定义', () => {
    const glyphs = [
      defGlyph('横', 'def-with-script', 'function script_x() {}'),
      defGlyph('横', 'def-zombie', ''),
    ]
    const map = buildStrokeGlyphNameToUuid(glyphs)
    expect(map.get('横')).toBe('def-with-script')
  })

  it('同名多个带脚本定义时，保留最后一个带脚本的（维持原"后者优先"语义）', () => {
    const glyphs = [
      defGlyph('直角捺', 'def-a', 'function script_a() {}'),
      defGlyph('直角捺', 'def-b', ''),
      defGlyph('直角捺', 'def-c', 'function script_c() {}'),
    ]
    const map = buildStrokeGlyphNameToUuid(glyphs)
    expect(map.get('直角捺')).toBe('def-c')
  })

  it('只有空脚本定义时，回退到该定义（不丢失引用）', () => {
    const glyphs = [defGlyph('竖撇', 'def-only-zombie', '')]
    const map = buildStrokeGlyphNameToUuid(glyphs)
    expect(map.get('竖撇')).toBe('def-only-zombie')
  })

  it('空白名称跳过', () => {
    const glyphs = [
      defGlyph('横', 'def-ok', 'function script_ok() {}'),
      defGlyph('  ', 'def-space', 'function script_space() {}'),
    ]
    const map = buildStrokeGlyphNameToUuid(glyphs)
    expect(map.size).toBe(1)
  })
})
