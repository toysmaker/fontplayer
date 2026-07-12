/**
 * 效果滤镜状态管理 Store
 * 管理当前激活的效果、参数、原始组件备份，以及预览和应用逻辑
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { EffectType } from './types'
import { getEffectDefinition } from './types'
import type { IComponent } from '@/core/types'
import { useCharacterStore } from '@/stores/character'
import { useProjectStore } from '@/stores/project'
import { useToolStore } from '@/stores/tool'
import { applyEffect } from './effectRegistry'
import { useMessage, useDialog } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { CanvasManager } from '@/core/canvas/CanvasManager'

/** 原始组件备份结构 */
interface OriginalState {
  components: IComponent[]
  orderedList: Array<{ type: string; uuid: string }>
}

export const useEffectStore = defineStore('effect', () => {
  // ---- State ----
  const effectType = ref<string>('')
  const params = ref<Record<string, number>>({})
  const isActive = ref(false)
  const previewVersion = ref(0)

  /** 原始组件状态的深拷贝备份（用于取消恢复） */
  const originalState = ref<OriginalState | null>(null)

  /** 应用全部字符的进度 */
  const applyToAllProgress = ref({ current: 0, total: 0 })

  // ---- Getters ----

  const currentEffectDefinition = computed(() => {
    if (!effectType.value) return null
    return getEffectDefinition(effectType.value as EffectType) || null
  })

  const isApplyingToAll = computed(() => {
    return applyToAllProgress.value.total > 0
  })

  // ---- Actions ----

  /**
   * 启动效果
   * 保存当前 pen 组件和 orderedList 的深拷贝，设置参数默认值，激活效果面板
   */
  function startEffect(type: string): boolean {
    const characterStore = useCharacterStore()
    const editing = characterStore.editingCharacter
    if (!editing || !editing.components) return false

    const def = getEffectDefinition(type as EffectType)
    if (!def) return false

    // 检查是否有 pen 组件
    const penComps = editing.components.filter((c) => c.type === 'pen')
    if (penComps.length === 0) {
      const message = useMessage()
      const { t } = useI18n()
      message.info(t('effects.noPenComponents'))
      return false
    }

    // 深拷贝保存原始状态
    originalState.value = {
      components: JSON.parse(JSON.stringify(editing.components)),
      orderedList: JSON.parse(JSON.stringify(editing.orderedList || [])),
    }

    // 设置参数默认值
    params.value = { ...def.defaultParams }
    effectType.value = type
    isActive.value = true
    previewVersion.value = 0

    // 清空当前工具，触发属性栏切换
    const toolStore = useToolStore()
    toolStore.setTool('')

    // 立即应用初始预览
    applyPreview()

    return true
  }

  /**
   * 更新单个参数并触发预览
   */
  function updateParam(key: string, value: number): void {
    params.value = { ...params.value, [key]: value }
    previewVersion.value++
    applyPreview()
  }

  /**
   * 应用当前效果到编辑中的字符（预览）
   * 始终从 originalState 开始计算，保证每次预览都是干净的
   */
  function applyPreview(): void {
    const characterStore = useCharacterStore()
    if (!originalState.value || !effectType.value || !characterStore.editingCharacter) return

    try {
      const penComps = originalState.value.components.filter((c) => c.type === 'pen')
      const nonPenComps = originalState.value.components.filter((c) => c.type !== 'pen')

      if (penComps.length === 0) return

      // 应用效果到 pen 组件
      const newPenComps = applyEffect(
        JSON.parse(JSON.stringify(penComps)),
        effectType.value as EffectType,
        params.value,
      )

      // 重建组件列表和 orderedList
      const newComponents = [...nonPenComps, ...newPenComps]
      const newOrderedList = [
        ...originalState.value.orderedList.filter(
          (item) => !penComps.some((pc) => pc.uuid === item.uuid),
        ),
        ...newPenComps.map((c) => ({ type: 'component', uuid: c.uuid })),
      ]

      if (characterStore.editingCharacter) {
        characterStore.editingCharacter.components = newComponents
        characterStore.editingCharacter.orderedList = newOrderedList
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('[effectStore] applyPreview failed:', e)
      }
    }
  }

  /**
   * 取消效果
   * 恢复原始组件状态，关闭效果面板，切换到选择工具
   */
  function cancelEffect(): void {
    const characterStore = useCharacterStore()

    if (originalState.value && characterStore.editingCharacter) {
      characterStore.editingCharacter.components = originalState.value.components
      characterStore.editingCharacter.orderedList = originalState.value.orderedList
    }

    // 重置状态
    effectType.value = ''
    params.value = {}
    isActive.value = false
    previewVersion.value = 0
    originalState.value = null

    // 切换到选择工具
    const toolStore = useToolStore()
    toolStore.setTool('select')
  }

  /**
   * 应用效果到全部字符
   * 遍历项目中的所有字符，加载、应用效果、保存
   */
  async function applyToAllCharacters(): Promise<void> {
    const projectStore = useProjectStore()
    const file = projectStore.selectedFile
    if (!file || !effectType.value) return

    const { t } = useI18n()
    const message = useMessage()

    const doApply = async () => {
      const { characterDataManager } = await import('@/core/storage/CharacterDataManager')

      projectStore.loadingMessage = t('effects.applyingToAll')
      projectStore.loadingProgress = 0
      projectStore.loadingTotal = file.characterList.length
      projectStore.loading = true

      let changed = 0
      try {
        for (let i = 0; i < file.characterList.length; i++) {
          const metadata = file.characterList[i]
          const ch = await characterDataManager.loadCharacter(file.uuid, metadata.uuid)

          if (ch && ch.components && ch.components.length > 0) {
            const penComps = ch.components.filter((c: IComponent) => c.type === 'pen')
            if (penComps.length > 0) {
              const newPenComps = applyEffect(
                JSON.parse(JSON.stringify(penComps)),
                effectType.value as EffectType,
                params.value,
              )
              const nonPen = ch.components.filter((c: IComponent) => c.type !== 'pen')
              ch.components = [...nonPen, ...newPenComps]
              ch.orderedList = [
                ...(ch.orderedList || []).filter(
                  (item: any) => !penComps.some((pc: IComponent) => pc.uuid === item.uuid),
                ),
                ...newPenComps.map((c: IComponent) => ({ type: 'component', uuid: c.uuid })),
              ]
              ch.previewRef = undefined
              ch.contourRef = undefined
              await characterDataManager.updateCharacter(file.uuid, ch)
              changed++
            }
          }

          projectStore.loadingProgress = i + 1
        }
      } finally {
        projectStore.loading = false
        projectStore.loadingProgress = 0
        projectStore.loadingTotal = 0
        projectStore.loadingMessage = ''
      }

      if (changed > 0) {
        CanvasManager.forceCleanupAllCache()
        window.dispatchEvent(new CustomEvent('force-character-list-refresh'))
        projectStore.markFileUnsaved(file.uuid)
        message.success(t('effects.applyToAllSuccess', { count: changed }))
      } else {
        message.info(t('effects.applyToAllNoChange'))
      }
    }

    doApply()
  }

  /**
   * 重置所有状态
   */
  function reset(): void {
    effectType.value = ''
    params.value = {}
    isActive.value = false
    previewVersion.value = 0
    originalState.value = null
    applyToAllProgress.value = { current: 0, total: 0 }
  }

  return {
    // State
    effectType,
    params,
    isActive,
    previewVersion,
    applyToAllProgress,

    // Getters
    currentEffectDefinition,
    isApplyingToAll,

    // Actions
    startEffect,
    updateParam,
    cancelEffect,
    applyToAllCharacters,
    reset,
  }
})
