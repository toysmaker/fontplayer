/**
 * 测试工具函数
 */

import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, afterEach } from 'vitest'

/**
 * 创建独立的Pinia实例用于测试
 */
export function setupPinia() {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    setActivePinia(createPinia())
  })
}

/**
 * 等待下一个tick
 */
export function nextTick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

/**
 * 等待requestAnimationFrame
 */
export function waitForRAF(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve)
    })
  })
}

/**
 * 创建Mock Canvas元素
 */
export function createMockCanvas(width: number = 100, height: number = 100): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

/**
 * 创建Mock Image元素
 */
export function createMockImage(width: number = 100, height: number = 100): HTMLImageElement {
  const img = document.createElement('img')
  img.width = width
  img.height = height
  return img
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
