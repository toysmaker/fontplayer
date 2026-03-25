/**
 * 性能工具函数
 */

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options?: { leading?: boolean; trailing?: boolean }
): T & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let previous = 0
  /** 挂起 trailing 时使用「最后一次」调用的参数（旧实现闭包固定首次参数，拖拽会间歇用旧位移渲染，造成闪烁） */
  let lastArgs: Parameters<T> | undefined
  let lastThis: any
  const { leading = true, trailing = true } = options || {}

  const throttled = function (this: any, ...args: Parameters<T>) {
    const now = Date.now()
    if (!previous && !leading) previous = now
    const remaining = wait - (now - previous)

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      lastArgs = undefined
      previous = now
      func.apply(this, args)
    } else if (trailing) {
      lastArgs = args
      lastThis = this
      if (!timeout) {
        timeout = setTimeout(() => {
          previous = leading ? Date.now() : 0
          timeout = null
          if (lastArgs) {
            func.apply(lastThis, lastArgs)
            lastArgs = undefined
          }
        }, remaining)
      }
    }
  } as T & { cancel: () => void }

  throttled.cancel = function () {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    previous = 0
    lastArgs = undefined
  }

  return throttled
}
