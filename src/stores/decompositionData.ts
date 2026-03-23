import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DECOMPOSITION_CHARACTER_LIST_IDB_KEY } from '@/features/decomposition/constants'

/**
 * 部件分解字典（character_list_final_v8）在 IndexedDB 中的 key 与加载状态
 */
export const useDecompositionDataStore = defineStore('decompositionData', () => {
  const decompositionListIdbKey = ref(DECOMPOSITION_CHARACTER_LIST_IDB_KEY)
  const isReady = ref(false)
  const loadedAt = ref<number | null>(null)

  function markReady() {
    isReady.value = true
    loadedAt.value = Date.now()
  }

  function reset() {
    isReady.value = false
    loadedAt.value = null
  }

  return {
    decompositionListIdbKey,
    isReady,
    loadedAt,
    markReady,
    reset,
  }
})
