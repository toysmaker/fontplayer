import { computed, ref } from "vue"
import { useGlyphStore } from "@/stores/glyph"

/**
 * Mirror of original skeleton dragger state.
 * Used by glyph params panel + skeleton/weight canvas tools.
 */

// whether on editing (dragging joints / hover state)
const editing = ref(false)
const setEditing = (status: boolean) => {
  editing.value = status
}

const draggingJoint = ref<any>(null)
const putAtCoord = ref<any>(null)
const movingJoint = ref<any>(null)

// clone used during dragging
const editGlyphOnDragging = ref<any>(null)

// skeleton flow flags
const onSkeletonSelect = ref(false)

const onSkeletonBind = computed(() => {
  const glyphStore = useGlyphStore()
  return !!(glyphStore as any).editingGlyph?.skeleton?.onSkeletonBind
})

const onSkeletonDragging = ref(false)

// weight painting flow
const onSelectBone = ref(false)
const selectedBone = ref<any>(null)
const onWeightSetting = ref(false)
const weightValue = ref(0.5)
const brushSize = ref(100)

export {
  editing,
  setEditing,
  draggingJoint,
  putAtCoord,
  movingJoint,
  editGlyphOnDragging,
  onSkeletonSelect,
  onSkeletonBind,
  onSkeletonDragging,
  onSelectBone,
  selectedBone,
  onWeightSetting,
  weightValue,
  brushSize,
}

