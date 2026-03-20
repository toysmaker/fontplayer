import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { genUUID } from '@/utils/uuid'

export type GlyphComponentsTab = 'stroke_glyphs' | 'radical_glyphs' | 'glyphs' | 'comp_glyphs'

/** 多选队列中每一项：同一模板字形可多次入队，用 pickId 区分 */
export type GlyphComponentDialogPick = {
  pickId: string
  templateUuid: string
}

export const useDialogsStore = defineStore('dialogs', () => {
  // Glyph components dialog
  const glyphComponentsDialogVisible = ref(false)
  const glyphComponentsActiveTab = ref<GlyphComponentsTab>('stroke_glyphs')
  const glyphComponentsMultiSelect = ref(false)
  const glyphComponentsSelectedPicks = ref<GlyphComponentDialogPick[]>([])

  const glyphComponentsSelectedCount = computed(() => glyphComponentsSelectedPicks.value.length)

  function openGlyphComponentsDialog() {
    glyphComponentsDialogVisible.value = true
  }

  function closeGlyphComponentsDialog() {
    glyphComponentsDialogVisible.value = false
    // 保持与原工程一致：关闭后清空多选与已选
    glyphComponentsMultiSelect.value = false
    glyphComponentsSelectedPicks.value = []
  }

  function setGlyphComponentsActiveTab(tab: GlyphComponentsTab) {
    glyphComponentsActiveTab.value = tab
  }

  function toggleGlyphComponentsMultiSelect(v: boolean) {
    glyphComponentsMultiSelect.value = v
    if (!v) {
      glyphComponentsSelectedPicks.value = []
    }
  }

  /** 多选：同一 templateUuid 可重复加入，每次生成独立 pickId */
  function selectGlyphComponentUUID(templateUuid: string) {
    glyphComponentsSelectedPicks.value.push({
      pickId: genUUID(),
      templateUuid,
    })
  }

  function unselectGlyphComponentPick(pickId: string) {
    glyphComponentsSelectedPicks.value = glyphComponentsSelectedPicks.value.filter((p) => p.pickId !== pickId)
  }

  function clearGlyphComponentsSelection() {
    glyphComponentsSelectedPicks.value = []
  }

  const exportFontDialogVisible = ref(false)

  function openExportFontDialog() {
    exportFontDialogVisible.value = true
  }

  function closeExportFontDialog() {
    exportFontDialogVisible.value = false
  }

  const exportVarFontDialogVisible = ref(false)

  function openExportVarFontDialog() {
    exportVarFontDialogVisible.value = true
  }

  function closeExportVarFontDialog() {
    exportVarFontDialogVisible.value = false
  }

  return {
    glyphComponentsDialogVisible,
    glyphComponentsActiveTab,
    glyphComponentsMultiSelect,
    glyphComponentsSelectedPicks,
    glyphComponentsSelectedCount,
    openGlyphComponentsDialog,
    closeGlyphComponentsDialog,
    setGlyphComponentsActiveTab,
    toggleGlyphComponentsMultiSelect,
    selectGlyphComponentUUID,
    unselectGlyphComponentPick,
    clearGlyphComponentsSelection,

    exportFontDialogVisible,
    openExportFontDialog,
    closeExportFontDialog,

    exportVarFontDialogVisible,
    openExportVarFontDialog,
    closeExportVarFontDialog,
  }
})

