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

// 区域指派刷 (细节迁移路径) 状态
/** 当前选中的骨架段 (辅助线 main 下标), 仅由面板下拉设置 */
const selectedRefLineIdx = ref<number | null>(null)
/** 悬停高亮的骨架段 (仅视觉提示, 不改变选中) */
const hoveredRefLineIdx = ref<number | null>(null)
/** 左键刷模式: 指派(段上最近点) / 清除 (右键刷始终为清除) */
const bindEditMode = ref<'assign' | 'clear'>('assign')
/** 悬停查看: 最近采样点的绑定明细 */
const hoveredBindInfo = ref<any>(null)

// --- Skeleton Free Edit State ---
// 骨架绑定字形组件的钢笔轮廓自由编辑模式
const skeletonFreeEdit = ref(false)
const skeletonFreeEditPenUUID = ref('')
const skeletonFreeEditGlyphUUID = ref('')

function enterSkeletonFreeEdit(penUUID: string, glyphUUID: string) {
  skeletonFreeEdit.value = true
  skeletonFreeEditPenUUID.value = penUUID
  skeletonFreeEditGlyphUUID.value = glyphUUID
}

function exitSkeletonFreeEdit() {
  skeletonFreeEdit.value = false
  skeletonFreeEditPenUUID.value = ''
  skeletonFreeEditGlyphUUID.value = ''
}

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
  selectedRefLineIdx,
  hoveredRefLineIdx,
  bindEditMode,
  hoveredBindInfo,
  skeletonFreeEdit,
  skeletonFreeEditPenUUID,
  skeletonFreeEditGlyphUUID,
  enterSkeletonFreeEdit,
  exitSkeletonFreeEdit,
}

