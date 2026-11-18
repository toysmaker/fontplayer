import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useMicroInteractionStore } from '@/stores/microInteraction'
import type { IApplicationDocument, ICardAppData } from '@/features/applications/types'

// mock 组合视频渲染（真实管线依赖脚本执行，太重）
const renderAppVideoFrameMock = vi.fn(async (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#123456'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
})
vi.mock('@/features/applications/video/compose', () => ({
  renderAppVideoFrame: (...args: unknown[]) => renderAppVideoFrameMock(...args),
}))

import AppMicroPreviewModal from '@/ui/components/applications/AppMicroPreviewModal.vue'
import { i18n } from '@/i18n'

const NModalStub = {
  props: ['show', 'preset', 'title', 'style', 'maskClosable'],
  emits: ['update:show'],
  template: '<div class="n-modal-stub"><slot /></div>',
}

function makeVideo() {
  return {
    id: 'video-1',
    name: '视频1',
    fps: 30,
    width: 320,
    height: 180,
    tracks: [],
    snapshots: [],
    createdAt: 1,
    updatedAt: 1,
  }
}

function makeDoc(): IApplicationDocument {
  return {
    schemaVersion: 1,
    type: 'card',
    id: 'app-1',
    name: '卡片',
    createdAt: 1,
    updatedAt: 1,
    fontBuffer: new ArrayBuffer(0),
    fontFamily: 'fp-app-card-app-1',
    videos: [makeVideo()],
    micros: [],
    data: { canvas: { width: 320, height: 180, background: '#fff' }, components: [] },
  }
}

function makeCardData(): ICardAppData {
  return { canvas: { width: 320, height: 180, background: '#fff' }, components: [] }
}

const libraryStub = { family: 'fp-test', buffer: new ArrayBuffer(0) } as never

async function mountModal() {
  const store = useMicroInteractionStore()
  store.loadWithSegments(
    {
      id: 'm1',
      name: '微交互',
      states: [{ id: 's1', name: '状态1', segmentId: 'video-1', loop: false, position: { x: 0, y: 0 } }],
      inputs: [
        { id: 'i1', name: '悬停', type: 'boolean', source: 'hover', defaultValue: false },
        { id: 'i2', name: '点击', type: 'trigger', source: 'click', defaultValue: false },
      ],
      transitions: [],
    },
    []
  )
  const wrapper = mount(AppMicroPreviewModal, {
    props: { doc: makeDoc(), cardData: makeCardData(), library: libraryStub },
    global: {
      plugins: [i18n],
      stubs: { Modal: NModalStub, Button: { template: '<button><slot /></button>' }, Empty: { template: '<div />' }, Switch: { template: '<div />' }, Slider: { template: '<div />' } },
    },
  })
  return { wrapper, store }
}

describe('AppMicroPreviewModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    renderAppVideoFrameMock.mockClear()
  })

  it('开启预览后初始状态立即渲染（无需切换输入）', async () => {
    const { wrapper, store } = await mountModal()
    // 模拟点击预览按钮
    store.togglePreviewMode()
    await nextTick()
    await new Promise((r) => setTimeout(r, 60))
    expect(renderAppVideoFrameMock).toHaveBeenCalled()
    // 画布尺寸来自视频分辨率
    const canvas = wrapper.find('canvas')
    expect(canvas.attributes('width')).toBe('320')
    expect(canvas.attributes('height')).toBe('180')
    wrapper.unmount()
  })

  it('hover 输入：指针进入/离开自动赋值', async () => {
    const { wrapper, store } = await mountModal()
    store.togglePreviewMode()
    await nextTick()
    await nextTick()
    const stage = wrapper.find('.preview-canvas-area')
    expect(stage.exists()).toBe(true)
    await stage.trigger('pointerenter')
    expect(store.previewValues['i1']).toBe(true)
    await stage.trigger('pointerleave')
    expect(store.previewValues['i1']).toBe(false)
    wrapper.unmount()
  })

  it('click 输入：点击自动触发（trigger 瞬时置 true）', async () => {
    const { wrapper, store } = await mountModal()
    store.togglePreviewMode()
    await nextTick()
    await nextTick()
    const stage = wrapper.find('.preview-canvas-area')
    await stage.trigger('click')
    expect(store.previewValues['i2']).toBe(true)
    wrapper.unmount()
  })
})
