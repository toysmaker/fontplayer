/**
 * 背景字体提示状态 Store（纯内存，不持久化）
 *
 * 「是否渲染背景文本」不写入工程文件，每次打开工程默认不渲染。
 * 设置分两级作用域：
 * - applyToAll = true：使用全局 enabled/fontFamily，所有字符生效
 * - applyToAll = false：仅当前字符生效，按字符 uuid 存 perChar Map
 *
 * 打开工程（projectStore.files 从 0 → 非 0）时重置渲染状态。
 */

import { defineStore } from 'pinia'
import { ref, computed, reactive, watch } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { useProjectStore } from '@/stores/project'
import type { ICharacterFileLite } from '@/core/types'

interface PerCharConfig {
  enabled: boolean
  fontFamily: string
  fontSizeRatio: number
}

export interface BackgroundFontConfig {
  enabled: boolean
  fontFamily: string
  fontSizeRatio: number
}

/** 默认文字大小：占画布高度的百分比（基本占满画布） */
export const DEFAULT_FONT_SIZE_RATIO = 85

export const useBackgroundFontStore = defineStore('backgroundFont', () => {
  const characterStore = useCharacterStore()
  const projectStore = useProjectStore()

  // ---- 全局状态（applyToAll 时生效；纯内存） ----
  const enabled = ref(false)
  const applyToAll = ref(false)
  const fontFamily = ref('')
  const fontSizeRatio = ref(DEFAULT_FONT_SIZE_RATIO)

  // ---- 每字符状态（仅当前字符作用域时使用；纯内存） ----
  const perChar = reactive(new Map<string, PerCharConfig>())

  // ---- Getters ----

  /** 当前编辑字符的生效配置（面板显示用） */
  const effective = computed<BackgroundFontConfig>(() => {
    if (applyToAll.value) {
      return { enabled: enabled.value, fontFamily: fontFamily.value, fontSizeRatio: fontSizeRatio.value }
    }
    const uuid = characterStore.editingCharacter?.uuid
    const per = uuid ? perChar.get(uuid) : undefined
    return per
      ? { enabled: per.enabled, fontFamily: per.fontFamily, fontSizeRatio: per.fontSizeRatio }
      : { enabled: false, fontFamily: '', fontSizeRatio: fontSizeRatio.value }
  })

  /** 重绘签名：编辑器 watch 此值，变化时重绘画布 */
  const renderSignature = computed(() => {
    const eff = effective.value
    return `${eff.enabled}|${eff.fontFamily}|${eff.fontSizeRatio}`
  })

  // ---- Actions ----

  /** 指定字符的生效配置（画布渲染用，与面板当前字符解耦） */
  function effectiveConfigFor(character: ICharacterFileLite | undefined): BackgroundFontConfig {
    if (applyToAll.value) {
      return { enabled: enabled.value, fontFamily: fontFamily.value, fontSizeRatio: fontSizeRatio.value }
    }
    const per = character ? perChar.get(character.uuid) : undefined
    return per
      ? { enabled: per.enabled, fontFamily: per.fontFamily, fontSizeRatio: per.fontSizeRatio }
      : { enabled: false, fontFamily: '', fontSizeRatio: fontSizeRatio.value }
  }

  /** 写入当前字符的每字符配置（不存在则创建；字体默认空，不预设，大小沿用全局值） */
  function writePerChar(patch: Partial<PerCharConfig>): void {
    const uuid = characterStore.editingCharacter?.uuid
    if (!uuid) return
    const current = perChar.get(uuid) ?? {
      enabled: false,
      fontFamily: '',
      fontSizeRatio: fontSizeRatio.value,
    }
    perChar.set(uuid, { ...current, ...patch })
  }

  /** 设置显示开关：按作用域路由写入 */
  function setEnabled(v: boolean): void {
    if (applyToAll.value) {
      enabled.value = v
    } else {
      writePerChar({ enabled: v })
    }
  }

  /** 设置字体：按作用域路由写入 */
  function setFontFamily(v: string): void {
    if (applyToAll.value) {
      fontFamily.value = v
    } else {
      writePerChar({ fontFamily: v })
    }
  }

  /** 设置文字大小（占画布高度百分比）：按作用域路由写入 */
  function setFontSizeRatio(v: number): void {
    if (applyToAll.value) {
      fontSizeRatio.value = v
    } else {
      writePerChar({ fontSizeRatio: v })
    }
  }

  /** 切换作用域：先把当前生效值复制到新目标存储，避免视觉跳变 */
  function setApplyToAll(v: boolean): void {
    if (v === applyToAll.value) return
    const eff = effective.value
    if (v) {
      // 切换为「全部字符」：把当前生效值提升为全局值
      enabled.value = eff.enabled
      fontFamily.value = eff.fontFamily || fontFamily.value
      fontSizeRatio.value = eff.fontSizeRatio
      applyToAll.value = true
    } else {
      // 切换为「当前字符」：把当前生效值写入当前字符
      writePerChar({
        enabled: eff.enabled,
        fontFamily: eff.fontFamily || fontFamily.value,
        fontSizeRatio: eff.fontSizeRatio,
      })
      applyToAll.value = false
    }
  }

  /** 打开工程时重置渲染状态（不渲染；保留作用域与字体选择作为会话内偏好） */
  function resetRenderState(): void {
    enabled.value = false
    perChar.clear()
  }

  // 打开工程（files 0 → 非 0）时默认不渲染背景文本
  watch(
    () => projectStore.files.length,
    (len, oldLen) => {
      if (oldLen === 0 && len > 0) {
        resetRenderState()
      }
    },
  )

  return {
    enabled,
    applyToAll,
    fontFamily,
    fontSizeRatio,
    effective,
    renderSignature,
    effectiveConfigFor,
    setEnabled,
    setFontFamily,
    setFontSizeRatio,
    setApplyToAll,
    resetRenderState,
  }
})
