/**
 * 防重复点击工具
 * 用于处理 @click 和 @pointerdown 同时触发时的重复调用问题
 */

// 统一管理的延迟时间（毫秒）
export const CLICK_DEBOUNCE_TIME = 300

// 记录每个函数的最后调用时间
const lastCallTimes = new Map<string, number>()
// 记录每个函数的最后调用参数（用于列表项等需要区分不同项的场景）
const lastCallParams = new Map<string, any>()

/**
 * 创建防重复调用的包装函数
 * @param fn 要包装的函数
 * @param key 唯一标识符，用于区分不同的函数调用
 * @param compareParams 可选，用于比较参数是否相同（如列表项的UUID）
 * @returns 包装后的函数
 */
export function createDebouncedHandler<T extends (...args: any[]) => any>(
  fn: T,
  key: string,
  compareParams?: (args: Parameters<T>) => any
): T {
  return ((...args: Parameters<T>) => {
    const now = Date.now()
    const lastTime = lastCallTimes.get(key) || 0
    
    // 如果距离上次调用时间太短，检查是否需要跳过
    if (now - lastTime < CLICK_DEBOUNCE_TIME) {
      // 如果提供了参数比较函数，检查参数是否相同
      if (compareParams) {
        const lastParams = lastCallParams.get(key)
        const currentParams = compareParams(args)
        // 如果参数相同，说明是同一个操作，跳过
        if (lastParams === currentParams) {
          return
        }
      } else {
        // 没有参数比较函数，直接跳过
        return
      }
    }
    
    // 更新调用时间和参数
    lastCallTimes.set(key, now)
    if (compareParams) {
      lastCallParams.set(key, compareParams(args))
    }
    
    // 执行原函数
    return fn(...args)
  }) as T
}

/**
 * 清理指定key的调用记录（可选，用于组件卸载时清理）
 * @param key 唯一标识符
 */
export function clearDebounceCache(key: string) {
  lastCallTimes.delete(key)
  lastCallParams.delete(key)
}

/**
 * 清理所有调用记录
 */
export function clearAllDebounceCache() {
  lastCallTimes.clear()
  lastCallParams.clear()
}
