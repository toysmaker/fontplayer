import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type GlyphComponentsTab = 'stroke_glyphs' | 'radical_glyphs' | 'glyphs' | 'comp_glyphs'

export const useDialogsStore = defineStore('dialogs', () => {
  // Glyph components dialog
  const glyphComponentsDialogVisible = ref(false)
  const glyphComponentsActiveTab = ref<GlyphComponentsTab>('stroke_glyphs')
  const glyphComponentsMultiSelect = ref(false)
  const glyphComponentsSelectedUUIDs = ref<string[]>([])

  const glyphComponentsSelectedCount = computed(() => glyphComponentsSelectedUUIDs.value.length)

  function openGlyphComponentsDialog() {
    glyphComponentsDialogVisible.value = true
  }

  function closeGlyphComponentsDialog() {
    glyphComponentsDialogVisible.value = false
    // 保持与原工程一致：关闭后清空多选与已选
    glyphComponentsMultiSelect.value = false
    glyphComponentsSelectedUUIDs.value = []
  }

  function setGlyphComponentsActiveTab(tab: GlyphComponentsTab) {
    glyphComponentsActiveTab.value = tab
  }

  function toggleGlyphComponentsMultiSelect(v: boolean) {
    glyphComponentsMultiSelect.value = v
    if (!v) {
      glyphComponentsSelectedUUIDs.value = []
    }
  }

  function selectGlyphComponentUUID(uuid: string) {
    if (!glyphComponentsSelectedUUIDs.value.includes(uuid)) {
      glyphComponentsSelectedUUIDs.value.push(uuid)
    }
  }

  function unselectGlyphComponentUUID(uuid: string) {
    glyphComponentsSelectedUUIDs.value = glyphComponentsSelectedUUIDs.value.filter((x) => x !== uuid)
  }

  function clearGlyphComponentsSelection() {
    glyphComponentsSelectedUUIDs.value = []
  }

  return {
    glyphComponentsDialogVisible,
    glyphComponentsActiveTab,
    glyphComponentsMultiSelect,
    glyphComponentsSelectedUUIDs,
    glyphComponentsSelectedCount,
    openGlyphComponentsDialog,
    closeGlyphComponentsDialog,
    setGlyphComponentsActiveTab,
    toggleGlyphComponentsMultiSelect,
    selectGlyphComponentUUID,
    unselectGlyphComponentUUID,
    clearGlyphComponentsSelection,
  }
})

