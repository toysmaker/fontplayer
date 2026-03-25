/**
 * 字符/字形编辑会话：全局常量工作副本 + 注入 getGlobalConstantsMap，避免未提交修改污染 file.constants。
 */

import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import * as R from 'ramda'
import type { DialogApi } from 'naive-ui'
import type { IConstant, IFile } from '@/core/types'
import { ConstantsMap } from '@/core/script/ConstantsMap'
import { setGlobalConstantsMap } from '@/core/script/ParametersMap'
import { useProjectStore } from '@/stores/project'

export const useEditorConstantsSessionStore = defineStore('editorConstantsSession', () => {
  const active = ref(false)
  /** 仅用于触发依赖 working 的 UI 刷新 */
  const draftVersion = ref(0)
  const workingConstants = ref<IConstant[]>([])
  const draftConstantsMap = ConstantsMap.createLocal([])
  const editingGlobalUuids = shallowRef(new Set<string>())

  function bumpDraft() {
    draftVersion.value++
  }

  function rebindDraftMap() {
    draftConstantsMap.update(workingConstants.value)
    bumpDraft()
  }

  function endSession() {
    editingGlobalUuids.value = new Set()
    workingConstants.value = []
    draftConstantsMap.update([])
    setGlobalConstantsMap(null)
    active.value = false
    bumpDraft()
  }

  function startSession(file: IFile | null) {
    endSession()
    if (!file) return
    workingConstants.value = R.clone(file.constants ?? [])
    rebindDraftMap()
    setGlobalConstantsMap(draftConstantsMap)
    active.value = true
  }

  function getConstantMeta(uuid: string): IConstant | null {
    return workingConstants.value.find((c) => c.uuid === uuid) ?? null
  }

  function isEditingGlobal(uuid: string): boolean {
    return editingGlobalUuids.value.has(uuid)
  }

  function beginEditGlobal(uuid: string) {
    const next = new Set(editingGlobalUuids.value)
    next.add(uuid)
    editingGlobalUuids.value = next
    bumpDraft()
  }

  function clearEditingModeForUuid(uuid: string) {
    const next = new Set(editingGlobalUuids.value)
    next.delete(uuid)
    editingGlobalUuids.value = next
    bumpDraft()
  }

  function cancelEditGlobalForUuid(uuid: string, file: IFile | null) {
    const committed = file?.constants?.find((c) => c.uuid === uuid)
    if (!committed) {
      clearEditingModeForUuid(uuid)
      return
    }
    const idx = workingConstants.value.findIndex((c) => c.uuid === uuid)
    if (idx >= 0) {
      workingConstants.value[idx] = R.clone(committed)
      rebindDraftMap()
    }
    clearEditingModeForUuid(uuid)
    if (active.value) {
      setGlobalConstantsMap(draftConstantsMap)
    }
  }

  function updateWorkingConstant(constantUuid: string, roundedValue: number) {
    draftConstantsMap.updateConstantValue(constantUuid, roundedValue)
    const row = workingConstants.value.find((c) => c.uuid === constantUuid)
    if (row) row.value = roundedValue
    bumpDraft()
  }

  /** 将 working 中某一常量合并到工程对象（提交前调用，供全库扫描使用） */
  function mergeConstantToFile(constantUuid: string, file: IFile) {
    const w = workingConstants.value.find((c) => c.uuid === constantUuid)
    if (!w) return
    if (!file.constants) file.constants = []
    const f = file.constants.find((c) => c.uuid === constantUuid)
    if (f) {
      f.value = w.value
    }
  }

  function hasUncommittedDraft(file: IFile | null): boolean {
    if (!active.value || !file?.constants) return false
    const fileByUuid = new Map(file.constants.map((c) => [c.uuid, c]))
    for (const w of workingConstants.value) {
      const f = fileByUuid.get(w.uuid)
      if (!f) continue
      if (Number(w.value) !== Number(f.value)) return true
    }
    return false
  }

  function syncWorkingFromFile(file: IFile | null) {
    if (!file) return
    workingConstants.value = R.clone(file.constants ?? [])
    rebindDraftMap()
    if (active.value) {
      setGlobalConstantsMap(draftConstantsMap)
    }
  }

  /** 新建全局常量并写入 file.constants 后调用，保持 working 与全局注入一致 */
  function onNewConstantAppended(constant: IConstant) {
    workingConstants.value.push(R.clone(constant))
    rebindDraftMap()
    if (active.value) {
      setGlobalConstantsMap(draftConstantsMap)
    }
  }

  return {
    active,
    draftVersion,
    workingConstants,
    draftConstantsMap,
    startSession,
    endSession,
    getConstantMeta,
    isEditingGlobal,
    beginEditGlobal,
    clearEditingModeForUuid,
    cancelEditGlobalForUuid,
    updateWorkingConstant,
    mergeConstantToFile,
    hasUncommittedDraft,
    syncWorkingFromFile,
    onNewConstantAppended,
  }
})

/**
 * 放弃未提交的全局常量草稿：结束会话、清除 ParametersMap 注入，
 * 并用当前 file.constants 重建工程侧 ConstantsMap 单例（避免仍按草稿值跑脚本/缩略图）。
 */
export function discardGlobalConstantsDraftOnLeave() {
  const session = useEditorConstantsSessionStore()
  const projectStore = useProjectStore()
  session.endSession()
  projectStore.resyncConstantsMapFromCommittedFile()
}

/** 离开字符/字形编辑前：若有未提交的全局常量草稿则确认 */
export function confirmLeaveGlyphEditIfDirty(options: {
  dialog: DialogApi
  t: (key: string) => string
}): Promise<boolean> {
  const projectStore = useProjectStore()
  const session = useEditorConstantsSessionStore()
  const file = projectStore.selectedFile
  if (!session.hasUncommittedDraft(file)) return Promise.resolve(true)

  return new Promise((resolve) => {
    options.dialog.warning({
      title: options.t('panels.paramsPanel.params.unsavedGlobalConstantsLeaveTitle'),
      content: options.t('panels.paramsPanel.params.unsavedGlobalConstantsLeave'),
      positiveText: options.t('panels.paramsPanel.params.leaveDialogConfirm'),
      negativeText: options.t('panels.paramsPanel.params.leaveDialogCancel'),
      onPositiveClick: () => {
        discardGlobalConstantsDraftOnLeave()
        resolve(true)
      },
      onNegativeClick: () => {
        resolve(false)
      },
    })
  })
}
