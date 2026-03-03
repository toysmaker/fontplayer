/**
 * Tauri 输入框焦点修复工具
 * 
 * 在 Tauri 环境中，当 input 组件有焦点时，点击按钮可能不会立即触发 click 事件，
 * 因为按钮的 mousedown 事件可能会先触发 input 的 blur 事件，但值可能还没有同步到响应式数据中。
 * 
 * 这个工具函数用于在按钮点击处理函数开始时，手动触发 input 的 blur 事件，
 * 并等待响应式更新完成，确保值已同步。
 */

import { nextTick } from 'vue'
import { isTauri } from './env'

/**
 * 确保当前活动的 input 元素失去焦点，并等待响应式更新完成
 * 这应该在按钮点击处理函数的开始处调用
 * 
 * @param formData 表单数据对象，用于直接同步 DOM 值
 * @param formRef 表单引用，用于查找所有 input 元素
 * @returns Promise<void> 当 blur 事件和响应式更新完成后 resolve
 */
export async function ensureInputBlur(formData?: any, formRef?: any): Promise<void> {
  if (!isTauri()) {
    // 在浏览器环境中不需要这个修复
    return
  }

  // 方法1: 处理当前活动的元素
  const activeElement = document.activeElement as HTMLInputElement | HTMLTextAreaElement
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
    // 手动触发 blur 事件
    activeElement.blur()
  }

  // 方法2: 如果提供了 formData 和 formRef，直接查找所有 input 并同步值
  if (formData && formRef?.value) {
    try {
      // 查找表单内的所有 input 元素
      const formElement = formRef.value.$el || formRef.value
      if (formElement) {
        const inputs = formElement.querySelectorAll('input, textarea')
        inputs.forEach((input: HTMLInputElement) => {
          // 尝试从 input 的父元素或属性中获取字段路径
          // Naive UI 的 form-item 通常会有 data-path 属性
          const formItem = input.closest('[data-path]')
          if (formItem) {
            const path = formItem.getAttribute('data-path')
            if (path) {
              const fieldName = path.split('.').pop() || ''
              if (fieldName && fieldName in formData) {
                // 根据 input 类型处理值
                if (input.type === 'number' || input.classList.contains('n-input-number-input')) {
                  const numValue = parseFloat(input.value)
                  if (!isNaN(numValue)) {
                    (formData as any)[fieldName] = numValue
                  }
                } else {
                  (formData as any)[fieldName] = input.value
                }
              }
            }
          } else {
            // 如果没有 data-path，尝试从 input 的 name 属性
            const name = input.name
            if (name && name in formData) {
              if (input.type === 'number' || input.classList.contains('n-input-number-input')) {
                const numValue = parseFloat(input.value)
                if (!isNaN(numValue)) {
                  (formData as any)[name] = numValue
                }
              } else {
                (formData as any)[name] = input.value
              }
            }
          }
        })
      }
    } catch (error) {
      console.warn('Failed to sync input values:', error)
    }
  }

  // 等待 blur 事件完成，确保响应式更新
  // 使用 setTimeout 而不是 nextTick，因为 Tauri 可能需要更多时间
  await new Promise(resolve => setTimeout(resolve, 20))
  await nextTick()
}
