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

  /** 高级编辑「笔画替换」：选模板后回调 uuid，不插入到当前编辑字符 */
  const glyphComponentsStrokeReplaceHandler = ref<((templateUuid: string) => void) | null>(null)

  function openGlyphComponentsDialogForStrokeReplace(onPicked: (templateUuid: string) => void) {
    glyphComponentsStrokeReplaceHandler.value = onPicked
    glyphComponentsMultiSelect.value = false
    glyphComponentsSelectedPicks.value = []
    glyphComponentsDialogVisible.value = true
  }

  function clearGlyphComponentsStrokeReplaceHandler() {
    glyphComponentsStrokeReplaceHandler.value = null
  }

  /** 字形骨架：选择参考字形后回调完整字形数据 */
  const glyphSkeletonPickHandler = ref<((glyph: any) => void) | null>(null)

  function openGlyphComponentsDialogForSkeletonPick(onPicked: (glyph: any) => void) {
    glyphSkeletonPickHandler.value = onPicked
    glyphComponentsMultiSelect.value = false
    glyphComponentsSelectedPicks.value = []
    glyphComponentsDialogVisible.value = true
  }

  function clearGlyphSkeletonPickHandler() {
    glyphSkeletonPickHandler.value = null
  }

  function openGlyphComponentsDialog() {
    glyphComponentsDialogVisible.value = true
  }

  function closeGlyphComponentsDialog() {
    glyphComponentsDialogVisible.value = false
    glyphComponentsStrokeReplaceHandler.value = null
    glyphSkeletonPickHandler.value = null
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

  const exportColorFontDialogVisible = ref(false)

  function openExportColorFontDialog() {
    exportColorFontDialogVisible.value = true
  }

  function closeExportColorFontDialog() {
    exportColorFontDialogVisible.value = false
  }

  /** 保存/导出工程前：填写 tag */
  const projectTagPromptVisible = ref(false)
  const projectTagDraft = ref('')
  let projectTagResolve: ((value: string | null) => void) | null = null

  function openProjectTagPrompt(defaultTag: string): Promise<string | null> {
    return new Promise((resolve) => {
      projectTagDraft.value = defaultTag ?? ''
      projectTagResolve = resolve
      projectTagPromptVisible.value = true
    })
  }

  function confirmProjectTagPrompt() {
    projectTagPromptVisible.value = false
    const v = projectTagDraft.value.trim()
    projectTagResolve?.(v)
    projectTagResolve = null
  }

  function cancelProjectTagPrompt() {
    projectTagPromptVisible.value = false
    projectTagResolve?.(null)
    projectTagResolve = null
  }

  return {
    glyphComponentsDialogVisible,
    glyphComponentsActiveTab,
    glyphComponentsMultiSelect,
    glyphComponentsSelectedPicks,
    glyphComponentsSelectedCount,
    glyphComponentsStrokeReplaceHandler,
    openGlyphComponentsDialogForStrokeReplace,
    clearGlyphComponentsStrokeReplaceHandler,
    glyphSkeletonPickHandler,
    openGlyphComponentsDialogForSkeletonPick,
    clearGlyphSkeletonPickHandler,
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

    exportColorFontDialogVisible,
    openExportColorFontDialog,
    closeExportColorFontDialog,

    projectTagPromptVisible,
    projectTagDraft,
    openProjectTagPrompt,
    confirmProjectTagPrompt,
    cancelProjectTagPrompt,
  }
})

