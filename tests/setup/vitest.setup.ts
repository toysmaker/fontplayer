/**
 * Vitest 测试环境设置
 */

import './mocks/tauri'
import { vi } from 'vitest'
import { config } from '@vue/test-utils'

// Mock Canvas API
global.HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
  if (contextType === '2d') {
    return {
      canvas: document.createElement('canvas'),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      ellipse: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      clip: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      transform: vi.fn(),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      createImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
      })),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
      })),
      putImageData: vi.fn(),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      createPattern: vi.fn(),
      getLineDash: vi.fn(() => []),
      setLineDash: vi.fn(),
      lineDashOffset: 0,
      font: '',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      direction: 'ltr',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      miterLimit: 10,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowBlur: 0,
      shadowColor: 'rgba(0, 0, 0, 0)',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'low',
    } as any
  }
  return null
})

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
  return setTimeout(cb, 16) as any
})

global.cancelAnimationFrame = vi.fn((id: number) => {
  clearTimeout(id)
})

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock FileReader
global.FileReader = class FileReader {
  result: string | ArrayBuffer | null = null
  error: DOMException | null = null
  readyState: number = 0
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null
  onerror: ((event: ProgressEvent<FileReader>) => void) | null = null
  onloadend: ((event: ProgressEvent<FileReader>) => void) | null = null

  readAsText() {
    this.readyState = 2
    this.result = ''
    if (this.onload) {
      this.onload({} as any)
    }
    if (this.onloadend) {
      this.onloadend({} as any)
    }
  }

  readAsArrayBuffer() {
    this.readyState = 2
    this.result = new ArrayBuffer(0)
    if (this.onload) {
      this.onload({} as any)
    }
    if (this.onloadend) {
      this.onloadend({} as any)
    }
  }

  readAsDataURL() {
    this.readyState = 2
    this.result = 'data:text/plain;base64,'
    if (this.onload) {
      this.onload({} as any)
    }
    if (this.onloadend) {
      this.onloadend({} as any)
    }
  }

  abort() {
    this.readyState = 2
  }

  static readonly EMPTY = 0
  static readonly LOADING = 1
  static readonly DONE = 2
} as any

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
} as any

// Configure Vue Test Utils
config.global.stubs = {
  transition: false,
  'transition-group': false,
}
