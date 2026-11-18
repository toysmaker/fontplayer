import { computed, ref } from 'vue'
import { genUUID } from '@/utils/uuid'
import type {
  IAppComponent,
  ICardAppData,
  ICharGridComponent,
  IFreeTextComponent,
  IImageComponent,
} from '../types'
import { BUILTIN_PATTERNS } from './patterns'

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const MIN_SIZE = 10

/**
 * 卡片画布编辑状态：选择 / 拖动 / 缩放 / z 序 / 增删组件。
 * 数据直接写入 doc draft（组件数组顺序 = z 序）。
 */
export function useAppCanvasEditor(getData: () => ICardAppData | undefined) {
  const selectedId = ref<string | null>(null)

  const components = computed(() => getData()?.components ?? [])
  const selected = computed(() => components.value.find((c) => c.id === selectedId.value) ?? null)

  function select(id: string | null) {
    selectedId.value = id
  }

  /** 命中测试：设计空间坐标，顶层优先（数组倒序） */
  function hitTest(x: number, y: number): IAppComponent | null {
    for (let i = components.value.length - 1; i >= 0; i--) {
      const c = components.value[i]
      if (x >= c.x && x <= c.x + c.width && y >= c.y && y <= c.y + c.height) {
        return c
      }
    }
    return null
  }

  function moveComponent(id: string, dx: number, dy: number) {
    const c = components.value.find((item) => item.id === id)
    if (!c) return
    c.x += dx
    c.y += dy
  }

  function resizeComponent(id: string, handle: ResizeHandle, dx: number, dy: number) {
    const c = components.value.find((item) => item.id === id)
    if (!c) return
    let { x, y, width: w, height: h } = c
    if (handle.includes('e')) w += dx
    if (handle.includes('s')) h += dy
    if (handle.includes('w')) {
      x += dx
      w -= dx
    }
    if (handle.includes('n')) {
      y += dy
      h -= dy
    }
    if (w < MIN_SIZE) {
      if (handle.includes('w')) x -= MIN_SIZE - w
      w = MIN_SIZE
    }
    if (h < MIN_SIZE) {
      if (handle.includes('n')) y -= MIN_SIZE - h
      h = MIN_SIZE
    }
    c.x = x
    c.y = y
    c.width = w
    c.height = h
  }

  function moveLayer(id: string, delta: -1 | 1) {
    const list = getData()?.components
    if (!list) return
    const index = list.findIndex((c) => c.id === id)
    const target = index + delta
    if (index < 0 || target < 0 || target >= list.length) return
    const [item] = list.splice(index, 1)
    list.splice(target, 0, item)
  }

  /** 拖拽排序：把组件移动到目标下标 */
  function moveComponentToIndex(id: string, targetIndex: number) {
    const list = getData()?.components
    if (!list) return
    const index = list.findIndex((c) => c.id === id)
    if (index < 0 || targetIndex < 0 || targetIndex >= list.length || index === targetIndex) return
    const [item] = list.splice(index, 1)
    list.splice(targetIndex, 0, item)
  }

  /**
   * 拖拽排序（显示位置）：面板列表按 z 序倒序显示（顶行 = 最上层）。
   * displayIndex → 数组下标 = len - 1 - displayIndex（先移除再插入，双向语义一致）。
   */
  function moveComponentToDisplayIndex(id: string, displayIndex: number) {
    const list = getData()?.components
    if (!list) return
    const to = list.length - 1 - displayIndex
    moveComponentToIndex(id, to)
  }

  function addComponent(comp: IAppComponent) {
    const data = getData()
    if (!data) return
    data.components.push(comp)
    selectedId.value = comp.id
  }

  function removeComponent(id: string) {
    const data = getData()
    if (!data) return
    const index = data.components.findIndex((c) => c.id === id)
    if (index < 0) return
    data.components.splice(index, 1)
    if (selectedId.value === id) selectedId.value = null
  }

  // ---- 组件工厂 ----

  function createImageComponent(partial?: Partial<IImageComponent>): IImageComponent {
    return {
      kind: 'image',
      id: genUUID(),
      x: 60,
      y: 60,
      width: 300,
      height: 300,
      source: partial?.source ?? { kind: 'pattern', patternId: BUILTIN_PATTERNS[0]?.id ?? 'dots' },
      opacity: 1,
      ...partial,
    }
  }

  function createFreeTextComponent(partial?: Partial<IFreeTextComponent>): IFreeTextComponent {
    return {
      kind: 'freeText',
      id: genUUID(),
      x: 80,
      y: 80,
      width: 500,
      height: 200,
      text: '文字',
      fontSize: 96,
      direction: 'horizontal',
      color: '#000000',
      align: 'left',
      lineHeight: 1.2,
      ...partial,
    }
  }

  function createCharGridComponent(partial?: Partial<ICharGridComponent>): ICharGridComponent {
    return {
      kind: 'charGrid',
      id: genUUID(),
      x: 80,
      y: 80,
      width: 500,
      height: 500,
      cols: 3,
      rows: 3,
      gapX: 20,
      gapY: 20,
      content: '字玩字体',
      fontSize: 80,
      color: '#000000',
      ...partial,
    }
  }

  return {
    selectedId,
    selected,
    components,
    select,
    hitTest,
    moveComponent,
    resizeComponent,
    moveLayer,
    moveComponentToIndex,
    moveComponentToDisplayIndex,
    addComponent,
    removeComponent,
    createImageComponent,
    createFreeTextComponent,
    createCharGridComponent,
  }
}
