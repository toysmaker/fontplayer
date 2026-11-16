/**
 * 动效与视频 store
 *
 * 数据存储：动效视频（参数关键帧动画）与微交互（状态机）都存放在
 * editingCharacter.animations / editingCharacter.microInteractions 上，
 * 随字符数据一起由 CharacterDataManager 持久化（IndexedDB）。
 * 关键帧只存参数数值快照，不持有字形/轮廓数据，内存占用极小。
 *
 * 编辑对话框使用深拷贝草稿，保存时写回；store 不保留编辑中间态，
 * 对话框关闭即释放，避免内存泄漏。
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as R from 'ramda'
import { genUUID } from '@/utils/uuid'
import type { IAnimationClip, IMicroInteraction } from '@/core/types'
import { useCharacterStore } from '@/stores/character'
import { useProjectStore } from '@/stores/project'

export const useAnimationStore = defineStore('animation', () => {
  const characterStore = useCharacterStore()
  const projectStore = useProjectStore()

  /** 当前字符的动效视频列表 */
  const clips = computed<IAnimationClip[]>(() => characterStore.editingCharacter?.animations ?? [])

  /** 当前字符的微交互列表 */
  const microInteractions = computed<IMicroInteraction[]>(
    () => characterStore.editingCharacter?.microInteractions ?? [],
  )

  /** 动效视频编辑对话框 */
  const editorVisible = ref(false)
  /** 正在编辑的片段 id（null = 新建） */
  const editingClipId = ref<string | null>(null)

  /** 微交互编辑对话框 */
  const microEditorVisible = ref(false)
  const editingMicroId = ref<string | null>(null)

  /** 导出小对话框（列表点击导出时只显示它，不打开编辑对话框） */
  const exportVisible = ref(false)
  const exportClipId = ref<string | null>(null)
  const exportClip = computed<IAnimationClip | null>(() =>
    exportClipId.value ? getClip(exportClipId.value) ?? null : null,
  )

  function ensureFields() {
    const ch = characterStore.editingCharacter
    if (!ch) return false
    if (!Array.isArray(ch.animations)) ch.animations = []
    if (!Array.isArray(ch.microInteractions)) ch.microInteractions = []
    return true
  }

  function markDirty() {
    const f = projectStore.selectedFile
    if (f) projectStore.markFileUnsaved(f.uuid)
  }

  // ---------------- 动效视频 ----------------

  function getClip(id: string): IAnimationClip | undefined {
    return clips.value.find((c) => c.id === id)
  }

  /** 新建片段（含一个 0 时刻关键帧，参数为空 = 使用字符当前数值） */
  function createClip(name: string, fps = 30): string {
    if (!ensureFields()) return ''
    const now = Date.now()
    const clip: IAnimationClip = {
      id: genUUID(),
      name,
      fps,
      keyframes: [{ id: genUUID(), time: 0, hidden: false, params: {} }],
      createdAt: now,
      updatedAt: now,
    }
    characterStore.editingCharacter!.animations!.push(clip)
    markDirty()
    return clip.id
  }

  /** 保存（新增或更新）片段：深拷贝后写入，不保留外部引用 */
  function saveClip(clip: IAnimationClip) {
    if (!ensureFields()) return
    const clone = R.clone(clip) as IAnimationClip
    clone.updatedAt = Date.now()
    const list = characterStore.editingCharacter!.animations!
    const idx = list.findIndex((c) => c.id === clone.id)
    if (idx >= 0) list[idx] = clone
    else list.push(clone)
    markDirty()
  }

  function openNewClipEditor() {
    editorVisible.value = true
    editingClipId.value = null
  }

  function openClipEditor(id: string) {
    editorVisible.value = true
    editingClipId.value = id
  }

  function closeClipEditor() {
    editorVisible.value = false
    editingClipId.value = null
  }

  /** 从列表点击导出：只显示导出小对话框，不打开编辑对话框 */
  function openClipExport(id: string) {
    exportClipId.value = id
    exportVisible.value = true
  }

  function closeClipExport() {
    exportVisible.value = false
    exportClipId.value = null
  }

  // ---------------- 微交互 ----------------

  function getMicro(id: string): IMicroInteraction | undefined {
    return microInteractions.value.find((m) => m.id === id)
  }

  function createMicro(name: string): string {
    if (!ensureFields()) return ''
    const micro: IMicroInteraction = {
      id: genUUID(),
      name,
      states: [],
      inputs: [],
      transitions: [],
    }
    characterStore.editingCharacter!.microInteractions!.push(micro)
    markDirty()
    return micro.id
  }

  /** 保存微交互：深拷贝后写入 */
  function saveMicro(micro: IMicroInteraction) {
    if (!ensureFields()) return
    const clone = R.clone(micro) as IMicroInteraction
    const list = characterStore.editingCharacter!.microInteractions!
    const idx = list.findIndex((m) => m.id === clone.id)
    if (idx >= 0) list[idx] = clone
    else list.push(clone)
    markDirty()
  }

  function openNewMicroEditor() {
    microEditorVisible.value = true
    editingMicroId.value = null
  }

  function openMicroEditor(id: string) {
    microEditorVisible.value = true
    editingMicroId.value = id
  }

  function closeMicroEditor() {
    microEditorVisible.value = false
    editingMicroId.value = null
  }

  return {
    clips,
    microInteractions,
    editorVisible,
    editingClipId,
    microEditorVisible,
    editingMicroId,
    exportVisible,
    exportClipId,
    exportClip,
    openClipExport,
    closeClipExport,
    getClip,
    createClip,
    saveClip,
    openNewClipEditor,
    openClipEditor,
    closeClipEditor,
    getMicro,
    createMicro,
    saveMicro,
    openNewMicroEditor,
    openMicroEditor,
    closeMicroEditor,
  }
})
