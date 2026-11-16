/**
 * 高级编辑面板「笔画风格替换」section 状态与操作
 *
 * 针对当前正在编辑的字符：整体/单个笔画风格替换。
 * 提示（通用对话框/消息）在面板组件中完成，store 只负责计划与执行。
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ICharacterFileLite, ICustomGlyph, IGlyphComponent } from '@/core/types'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { getEditCanvasContext } from '@/features/editor/editCanvas'
import {
  planWholeStyleReplace,
  replaceGlyphComponentValueWithTarget,
  strokeKeyPointsMatch,
  type StrokeReplacePair,
  type WholeStyleReplacePlan,
} from '@/features/strokeStyleReplace'

export type StrokeListItem = {
  /** 字符中字形组件的 uuid（component uuid） */
  uuid: string
  name: string
  /** 当前风格（未命名为空字符串） */
  style: string
}

export const useStrokeStyleReplaceStore = defineStore('strokeStyleReplace', () => {
  const projectStore = useProjectStore()
  const characterStore = useCharacterStore()

  /** 单个笔画风格替换的笔画列表是否展开 */
  const singleListExpanded = ref(false)
  /** 单个笔画风格替换：待替换的笔画组件 uuid */
  const pendingStrokeUUID = ref<string | null>(null)

  /**
   * 当前字符的笔画列表（全部字形组件）。
   * 脚本生成的字形组件或绑定骨架的字形组件通常带有骨架信息，
   * 但没有骨架信息的笔画同样展示（替换时的关键点匹配会兜底校验）。
   */
  const strokeItems = computed<StrokeListItem[]>(() => {
    const ch = characterStore.editingCharacter
    if (!ch) return []
    const list: StrokeListItem[] = []
    for (const comp of ch.components || []) {
      if (comp.type !== 'glyph') continue
      const g = (comp as IGlyphComponent).value as ICustomGlyph | undefined
      if (!g || typeof g !== 'object') continue
      list.push({
        uuid: comp.uuid,
        name: g.name || '',
        style: (g.style || '').trim(),
      })
    }
    return list
  })

  function expandSingleList() {
    singleListExpanded.value = true
  }

  function collapseSingleList() {
    singleListExpanded.value = false
    pendingStrokeUUID.value = null
  }

  /** 目标风格笔画池（stroke_glyphs 中 style 匹配的字形） */
  function getStrokesByStyle(style: string): ICustomGlyph[] {
    const f = projectStore.selectedFile
    if (!f?.stroke_glyphs?.length) return []
    return f.stroke_glyphs.filter((g) => (g.style || '').trim() === style.trim())
  }

  /** 在当前字符中按组件 uuid 查找字形组件 */
  function findGlyphComponentInEditingCharacter(uuid: string): IGlyphComponent | null {
    const ch = characterStore.editingCharacter
    if (!ch) return null
    const comp = (ch.components || []).find((c) => c.uuid === uuid)
    if (!comp || comp.type !== 'glyph') return null
    return comp as IGlyphComponent
  }

  /** 在当前工程各字形池中按模板 uuid 查找字形 */
  function getGlyphByUUID(uuid: string): ICustomGlyph | undefined {
    const f = projectStore.selectedFile
    if (!f) return undefined
    const pools = [f.stroke_glyphs, f.glyphs, f.radical_glyphs, f.comp_glyphs]
    for (const pool of pools) {
      const g = pool?.find((x) => x.uuid === uuid)
      if (g) return g
    }
    return undefined
  }

  /**
   * 规划整体笔画风格替换。
   * 返回 null 表示当前没有正在编辑的字符。
   */
  function planWhole(style: string): WholeStyleReplacePlan | null {
    const ch = characterStore.editingCharacter
    if (!ch) return null
    return planWholeStyleReplace(ch, style, getStrokesByStyle(style))
  }

  /**
   * 执行整体笔画风格替换（按已规划的可替换笔画对）。
   * 返回实际替换数量。
   */
  function executeWhole(ch: ICharacterFileLite, pairs: StrokeReplacePair[]): number {
    let replaced = 0
    for (const pair of pairs) {
      if (replaceGlyphComponentValueWithTarget(ch, pair.componentUuid, pair.targetGlyph)) {
        replaced++
      }
    }
    afterCharacterMutated()
    return replaced
  }

  /**
   * 规划单个笔画风格替换。
   * 返回 { error } 表示无法替换（提示文案由面板组件生成），否则返回 { component, targetGlyph }。
   */
  function planSingle(
    strokeUuid: string,
    templateUuid: string,
  ): { error: 'notFound' | 'nameMismatch' | 'keyPointsMismatch' | 'noSkeleton' } | { component: IGlyphComponent; targetGlyph: ICustomGlyph } {
    const comp = findGlyphComponentInEditingCharacter(strokeUuid)
    const target = getGlyphByUUID(templateUuid)
    if (!comp || !target) return { error: 'notFound' }
    const cur = comp.value as ICustomGlyph | undefined
    if (!cur || typeof cur !== 'object') return { error: 'notFound' }
    if (cur.name !== target.name) return { error: 'nameMismatch' }
    // 当前笔画带骨架信息而目标没有：无法校验关键点，拒绝替换
    if (cur.skeleton && !target.skeleton) return { error: 'noSkeleton' }
    if (!strokeKeyPointsMatch(cur, target)) return { error: 'keyPointsMismatch' }
    return { component: comp, targetGlyph: target }
  }

  /** 执行单个笔画风格替换 */
  function executeSingle(component: IGlyphComponent, targetGlyph: ICustomGlyph): boolean {
    const ch = characterStore.editingCharacter
    if (!ch) return false
    const ok = replaceGlyphComponentValueWithTarget(ch, component.uuid, targetGlyph)
    if (ok) afterCharacterMutated()
    return ok
  }

  /** 字符数据被修改后：刷新画布并标记工程未保存 */
  function afterCharacterMutated() {
    const f = projectStore.selectedFile
    if (f) projectStore.markFileUnsaved(f.uuid)
    // 编辑画布深 watcher 会自动重绘；这里显式触发一次以保证实例数据已刷新
    getEditCanvasContext()?.onRender()
  }

  function reset() {
    singleListExpanded.value = false
    pendingStrokeUUID.value = null
  }

  return {
    singleListExpanded,
    pendingStrokeUUID,
    strokeItems,
    expandSingleList,
    collapseSingleList,
    getStrokesByStyle,
    getGlyphByUUID,
    planWhole,
    executeWhole,
    planSingle,
    executeSingle,
    reset,
  }
})
