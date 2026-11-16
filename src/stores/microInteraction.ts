/**
 * 微交互编辑器 store
 *
 * 管理状态机草稿、选中对象、预览模式与输入模拟值。
 * 草稿在编辑器对话框打开时从字符数据深拷贝加载，保存时写回并清空，
 * 避免长期持有大对象引用。
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as R from 'ramda'
import { genUUID } from '@/utils/uuid'
import type {
  IMicroInteraction,
  IMicroInteractionCondition,
  IMicroInteractionInput,
  IMicroInteractionState,
  IMicroInteractionTransition,
} from '@/core/types'

export type MicroSelection =
  | { kind: 'state'; id: string }
  | { kind: 'transition'; id: string }
  | { kind: 'input'; id: string }
  | null

export const useMicroInteractionStore = defineStore('microInteraction', () => {
  /** 工作草稿（深拷贝，编辑器持有） */
  const draft = ref<IMicroInteraction | null>(null)

  const selected = ref<MicroSelection>(null)
  const previewMode = ref(false)
  /** 预览模式下输入变量的当前值 */
  const previewValues = ref<Record<string, boolean | number>>({})
  /** 预览模式当前状态 */
  const currentStateId = ref<string | null>(null)
  /** 片段播放重启令牌（状态切换时递增以触发重新播放） */
  const playNonce = ref(0)

  const selectedState = computed<IMicroInteractionState | null>(() => {
    if (selected.value?.kind !== 'state' || !draft.value) return null
    return draft.value.states.find((s) => s.id === selected.value!.id) ?? null
  })
  const selectedTransition = computed<IMicroInteractionTransition | null>(() => {
    if (selected.value?.kind !== 'transition' || !draft.value) return null
    return draft.value.transitions.find((t) => t.id === selected.value!.id) ?? null
  })
  const selectedInput = computed<IMicroInteractionInput | null>(() => {
    if (selected.value?.kind !== 'input' || !draft.value) return null
    return draft.value.inputs.find((i) => i.id === selected.value!.id) ?? null
  })

  /** 加载草稿（深拷贝），并迁移旧数据：缺失 source 的输入按类型推导默认来源 */
  function load(micro: IMicroInteraction) {
    draft.value = R.clone(micro) as IMicroInteraction
    for (const input of draft.value.inputs) {
      if (!input.source) {
        input.source = input.type === 'trigger' ? 'click' : 'custom'
      }
    }
    selected.value = null
    previewMode.value = false
    previewValues.value = {}
    currentStateId.value = null
  }

  /** 重置（对话框关闭时释放草稿） */
  function reset() {
    draft.value = null
    selected.value = null
    previewMode.value = false
    previewValues.value = {}
    currentStateId.value = null
  }

  function select(sel: MicroSelection) {
    selected.value = sel
  }

  function clearSelection() {
    selected.value = null
  }

  // ---------------- 状态 ----------------

  function addState(name: string, segmentId: string, position: { x: number; y: number }): string {
    if (!draft.value) return ''
    const state: IMicroInteractionState = {
      id: genUUID(),
      name,
      segmentId,
      loop: false,
      position: { ...position },
    }
    draft.value.states.push(state)
    selected.value = { kind: 'state', id: state.id }
    return state.id
  }

  function updateState(id: string, patch: Partial<IMicroInteractionState>) {
    if (!draft.value) return
    const st = draft.value.states.find((s) => s.id === id)
    if (!st) return
    Object.assign(st, patch)
  }

  function removeState(id: string) {
    if (!draft.value) return
    draft.value.states = draft.value.states.filter((s) => s.id !== id)
    draft.value.transitions = draft.value.transitions.filter((t) => t.from !== id && t.to !== id)
    if (selected.value?.kind === 'state' && selected.value.id === id) selected.value = null
    if (currentStateId.value === id) currentStateId.value = null
  }

  // ---------------- 输入 ----------------

  function addInput(
    name: string,
    type: IMicroInteractionInput['type'],
    source: IMicroInteractionInput['source'],
  ): string {
    if (!draft.value) return ''
    const input: IMicroInteractionInput = {
      id: genUUID(),
      name,
      type,
      source,
      defaultValue: type === 'number' ? 0 : false,
    }
    draft.value.inputs.push(input)
    selected.value = { kind: 'input', id: input.id }
    return input.id
  }

  function updateInput(id: string, patch: Partial<IMicroInteractionInput>) {
    if (!draft.value) return
    const input = draft.value.inputs.find((i) => i.id === id)
    if (!input) return
    Object.assign(input, patch)
  }

  function removeInput(id: string) {
    if (!draft.value) return
    draft.value.inputs = draft.value.inputs.filter((i) => i.id !== id)
    for (const t of draft.value.transitions) {
      t.conditions = t.conditions.filter((c) => c.inputId !== id)
    }
    if (selected.value?.kind === 'input' && selected.value.id === id) selected.value = null
    delete previewValues.value[id]
  }

  // ---------------- 转换 ----------------

  function addTransition(from: string, to: string): string {
    if (!draft.value) return ''
    const tr: IMicroInteractionTransition = {
      id: genUUID(),
      from,
      to,
      conditions: [],
    }
    draft.value.transitions.push(tr)
    selected.value = { kind: 'transition', id: tr.id }
    return tr.id
  }

  function updateTransition(id: string, patch: Partial<IMicroInteractionTransition>) {
    if (!draft.value) return
    const tr = draft.value.transitions.find((t) => t.id === id)
    if (!tr) return
    Object.assign(tr, patch)
  }

  function removeTransition(id: string) {
    if (!draft.value) return
    draft.value.transitions = draft.value.transitions.filter((t) => t.id !== id)
    if (selected.value?.kind === 'transition' && selected.value.id === id) selected.value = null
  }

  function addCondition(transitionId: string): string {
    if (!draft.value) return ''
    const tr = draft.value.transitions.find((t) => t.id === transitionId)
    if (!tr) return ''
    const input = draft.value.inputs[0]
    if (!input) return ''
    const condition: IMicroInteractionCondition = {
      inputId: input.id,
      operator: 'eq',
      value: input.type === 'number' ? 0 : true,
    }
    tr.conditions.push(condition)
    return condition.inputId
  }

  function updateCondition(transitionId: string, index: number, patch: Partial<IMicroInteractionCondition>) {
    if (!draft.value) return
    const tr = draft.value.transitions.find((t) => t.id === transitionId)
    const c = tr?.conditions[index]
    if (!c) return
    Object.assign(c, patch)
    // 输入类型变化时收敛默认值类型
    const input = draft.value.inputs.find((i) => i.id === c.inputId)
    if (input && patch.inputId) {
      c.value = input.type === 'number' ? Number(c.value ?? 0) : Boolean(c.value)
    }
  }

  function removeCondition(transitionId: string, index: number) {
    if (!draft.value) return
    const tr = draft.value.transitions.find((t) => t.id === transitionId)
    if (!tr) return
    tr.conditions.splice(index, 1)
  }

  // ---------------- 预览 ----------------

  function togglePreviewMode() {
    previewMode.value = !previewMode.value
    if (previewMode.value && draft.value) {
      // 初始化输入模拟值
      const vals: Record<string, boolean | number> = {}
      for (const input of draft.value.inputs) vals[input.id] = input.defaultValue
      previewValues.value = vals
      // 初始状态：第一个状态
      if (draft.value.states.length > 0 && !currentStateId.value) {
        currentStateId.value = draft.value.states[0].id
        playNonce.value++
      }
    }
  }

  function setPreviewValue(inputId: string, value: boolean | number) {
    previewValues.value[inputId] = value
    evaluateTransitions()
  }

  /** 触发器：置 true 后短暂恢复 false */
  function triggerPreviewInput(inputId: string) {
    previewValues.value[inputId] = true
    evaluateTransitions()
    setTimeout(() => {
      previewValues.value[inputId] = false
    }, 350)
  }

  /** 条件判断（条件之间为"与"关系） */
  function conditionPassed(c: IMicroInteractionCondition): boolean {
    const actual = previewValues.value[c.inputId]
    const expected = c.value
    switch (c.operator) {
      case 'eq':
        return actual === expected
      case 'neq':
        return actual !== expected
      case 'gt':
        return Number(actual) > Number(expected)
      case 'lt':
        return Number(actual) < Number(expected)
      default:
        return false
    }
  }

  /** 从当前状态出发寻找满足全部条件的转换并切换状态 */
  function evaluateTransitions(): string | null {
    if (!draft.value || !currentStateId.value) return null
    for (const tr of draft.value.transitions) {
      if (tr.from !== currentStateId.value) continue
      if (tr.conditions.length === 0) continue
      if (tr.conditions.every((c) => conditionPassed(c))) {
        currentStateId.value = tr.to
        playNonce.value++
        return tr.to
      }
    }
    return null
  }

  return {
    draft,
    selected,
    selectedState,
    selectedTransition,
    selectedInput,
    previewMode,
    previewValues,
    currentStateId,
    playNonce,
    load,
    reset,
    select,
    clearSelection,
    addState,
    updateState,
    removeState,
    addInput,
    updateInput,
    removeInput,
    addTransition,
    updateTransition,
    removeTransition,
    addCondition,
    updateCondition,
    removeCondition,
    togglePreviewMode,
    setPreviewValue,
    triggerPreviewInput,
    evaluateTransitions,
  }
})
