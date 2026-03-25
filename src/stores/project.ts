/**
 * 工程文件 Store
 * 管理工程文件的打开、保存、切换等
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import * as R from 'ramda'
import type { IFile, ICharacterFileLite } from '@/core/types'
import { indexedDBManager } from '@/core/storage/IndexedDBManager'
import { ConstantsMap } from '@/core/script/ConstantsMap'

export const useProjectStore = defineStore('project', () => {
  // 状态
  const files = ref<IFile[]>([])
  const selectedFileUUID = ref<string>('')
  const loading = ref(false)
  const loadingProgress = ref(0)
  const loadingTotal = ref(0)
  const loadingMessage = ref<string>('')
  
  // ConstantsMap 实例（统一维护）
  const constantsMap = ref<ConstantsMap | null>(null)

  // 预览渲染模式（字符/字形列表）
  const fontPreviewStyle = ref<'black' | 'color'>('black')

  // Getters
  const selectedFile = computed(() => {
    return files.value.find(f => f.uuid === selectedFileUUID.value) || null
  })

  const hasFiles = computed(() => files.value.length > 0)
  
  // 当 selectedFile 或 constants 变化时，更新 constantsMap（使用单例模式）
  watch(
    () => selectedFile.value?.constants,
    (constants) => {
      if (constants && constants.length > 0) {
        constantsMap.value = ConstantsMap.getInstance(constants)
      } else {
        constantsMap.value = ConstantsMap.getInstance([])
      }
    },
    { immediate: true }
  )

  // Actions
  /**
   * 添加工程文件
   */
  function addFile(file: IFile) {
    // 检查是否已存在
    const exists = files.value.find(f => f.uuid === file.uuid)
    if (exists) {
      console.warn(`File ${file.uuid} already exists`)
      return false
    }

    files.value.push(file)
    if (!selectedFileUUID.value) {
      selectedFileUUID.value = file.uuid
    }
    return true
  }

  /**
   * 移除工程文件
   */
  function removeFile(uuid: string) {
    const index = files.value.findIndex(f => f.uuid === uuid)
    if (index !== -1) {
      files.value.splice(index, 1)
      
      // 如果删除的是当前选中的文件，切换到其他文件
      if (selectedFileUUID.value === uuid) {
        selectedFileUUID.value = files.value.length > 0 ? files.value[0].uuid : ''
      }
      
      return true
    }
    return false
  }

  /**
   * 选择工程文件
   */
  function selectFile(uuid: string) {
    const file = files.value.find(f => f.uuid === uuid)
    if (file) {
      selectedFileUUID.value = uuid
      return true
    }
    return false
  }

  /**
   * 更新工程文件
   */
  function updateFile(uuid: string, updates: Partial<IFile>) {
    const file = files.value.find(f => f.uuid === uuid)
    if (file) {
      Object.assign(file, updates)
      return true
    }
    return false
  }

  /**
   * 标记文件为已保存
   */
  function markFileSaved(uuid: string) {
    return updateFile(uuid, { saved: true })
  }

  /**
   * 标记文件为未保存
   */
  function markFileUnsaved(uuid: string) {
    return updateFile(uuid, { saved: false })
  }

  /**
   * 清空所有文件
   */
  function clearFiles() {
    files.value = []
    selectedFileUUID.value = ''
  }

  /**
   * 用当前工程已保存的 file.constants 重建 ConstantsMap 单例（深拷贝数组，避免与草稿会话共享引用）。
   * 退出字符/字形编辑时调用，确保脚本与列表预览在 getGlobalConstantsMap() 已为 null 后只读已提交常量。
   */
  function resyncConstantsMapFromCommittedFile() {
    const file = selectedFile.value
    ConstantsMap.resetInstance()
    const committed = file?.constants?.length ? R.clone(file.constants) : []
    constantsMap.value = ConstantsMap.getInstance(committed)
  }

  return {
    // State
    files,
    selectedFileUUID,
    loading,
    loadingProgress,
    loadingTotal,
    loadingMessage,
    constantsMap,
    fontPreviewStyle,
    
    // Getters
    selectedFile,
    hasFiles,
    
    // Actions
    addFile,
    removeFile,
    selectFile,
    updateFile,
    markFileSaved,
    markFileUnsaved,
    clearFiles,
    resyncConstantsMapFromCommittedFile,
  }
})
