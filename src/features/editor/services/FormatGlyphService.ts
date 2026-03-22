import * as R from 'ramda'
import { genUUID } from '@/utils/uuid'
import { roundToPrecision } from '@/utils/number'
import type {
  IComponent,
  IGlyphComponent,
  ICustomGlyphComponent,
  ICustomGlyph,
  ICharacterFileLite,
  IPenComponent,
  IPolygonComponent,
  IRectangleComponent,
  IEllipseComponent,
} from '@/core/types'
import { ComponentType } from '@/core/types'
import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { selectedItemByUUID } from '@/core/utils/component'
import { computeCoords, type ILayoutTransformGrid } from '@/core/utils/grid'
import { transformPoints, getBound, getEllipsePoints, type IPoint } from '@/core/utils/math'

type OrderedItem = {
  type: string
  uuid: string
}

const deepClone = <T>(data: T): T => R.clone(data as any)

const applyOffsetToPoints = (points: Array<any>, ox: number, oy: number) => {
  if (!points) return points
  return points.map((point) => ({
    ...point,
    x: roundToPrecision(point.x + ox, 1),
    y: roundToPrecision(point.y + oy, 1),
  }))
}

const getBoundingBox = (points: Array<any>) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  points.forEach((point) => {
    if (point.x < minX) minX = point.x
    if (point.x > maxX) maxX = point.x
    if (point.y < minY) minY = point.y
    if (point.y > maxY) maxY = point.y
  })
  return {
    x: roundToPrecision(isFinite(minX) ? minX : 0, 1),
    y: roundToPrecision(isFinite(minY) ? minY : 0, 1),
    w: roundToPrecision(
      isFinite(maxX) && isFinite(minX) ? maxX - minX : 0,
      1,
    ),
    h: roundToPrecision(
      isFinite(maxY) && isFinite(minY) ? maxY - minY : 0,
      1,
    ),
  }
}

const convertGeneratedComponent = (
  generatedComponent: any,
  glyphComponent: IGlyphComponent,
): IComponent => {
  const baseOx = glyphComponent.ox || 0
  const baseOy = glyphComponent.oy || 0
  const componentData = generatedComponent.getData
    ? generatedComponent.getData()
    : generatedComponent

  const typeMap: Record<string, ComponentType> = {
    'glyph-pen': ComponentType.Pen,
    'glyph-polygon': ComponentType.Polygon,
    'glyph-rectangle': ComponentType.Rectangle,
    'glyph-ellipse': ComponentType.Ellipse,
  }
  const componentType =
    typeMap[componentData.type as string] || ComponentType.Pen

  const transformedPoints = componentData.points
    ? applyOffsetToPoints(componentData.points, baseOx, baseOy)
    : []

  let bounds = getBoundingBox(transformedPoints)

  if (!transformedPoints.length && componentType === ComponentType.Rectangle) {
    bounds = {
      x: roundToPrecision(baseOx + (componentData.x || 0), 1),
      y: roundToPrecision(baseOy + (componentData.y || 0), 1),
      w: roundToPrecision(componentData.width || 0, 1),
      h: roundToPrecision(componentData.height || 0, 1),
    }
  }

  if (!transformedPoints.length && componentType === ComponentType.Ellipse) {
    bounds = {
      x: roundToPrecision(
        baseOx +
          (componentData.centerX || 0) -
          (componentData.radiusX || 0),
        1,
      ),
      y: roundToPrecision(
        baseOy +
          (componentData.centerY || 0) -
          (componentData.radiusY || 0),
        1,
      ),
      w: roundToPrecision((componentData.radiusX || 0) * 2, 1),
      h: roundToPrecision((componentData.radiusY || 0) * 2, 1),
    }
  }

  const baseProps: IComponent = {
    uuid: genUUID(),
    type: componentType,
    name: glyphComponent.name,
    lock: glyphComponent.lock,
    visible: glyphComponent.visible,
    // 展开后的组件无论在字符还是字形中，都是实际参与渲染的轮廓组件
    // 这里统一标记为 true，避免在预览渲染时被 ContourConverter 过滤掉
    usedInCharacter: true,
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    rotation: 0,
    flipX: false,
    flipY: false,
    value: glyphComponent.value, // placeholder, will be overridden below
  }

  if (componentType === ComponentType.Pen) {
    return {
      ...baseProps,
      type: ComponentType.Pen,
      value: {
        points: transformedPoints,
        fillColor: (glyphComponent.value as any).fillColor || '',
        strokeColor: '#000',
        closePath: true,
        editMode: false,
        preview: componentData.preview,
        contour: componentData.contour,
      },
    }
  }

  if (componentType === ComponentType.Polygon) {
    return {
      ...baseProps,
      type: ComponentType.Polygon,
      value: {
        points: transformedPoints,
        fillColor: (glyphComponent.value as any).fillColor || '',
        strokeColor: '#000',
        closePath: true,
        preview: componentData.preview,
        contour: componentData.contour,
      },
    }
  }

  if (componentType === ComponentType.Rectangle) {
    return {
      ...baseProps,
      type: ComponentType.Rectangle,
      value: {
        width: componentData.width,
        height: componentData.height,
        fillColor: (glyphComponent.value as any).fillColor || '',
        strokeColor: '#000',
        preview: componentData.preview,
        contour: componentData.contour,
        closePath: true,
      },
    }
  }

  if (componentType === ComponentType.Ellipse) {
    return {
      ...baseProps,
      type: ComponentType.Ellipse,
      value: {
        radiusX: componentData.radiusX,
        radiusY: componentData.radiusY,
        fillColor: (glyphComponent.value as any).fillColor || '',
        strokeColor: '#000',
        preview: componentData.preview,
        contour: componentData.contour,
        closePath: true,
      },
    }
  }

  return {
    ...baseProps,
    value: componentData,
  }
}

const cloneNormalComponent = (
  component: IComponent,
  glyphComponent: IGlyphComponent,
): IComponent => {
  const clone: any = deepClone(component)
  clone.uuid = genUUID()
  const baseOx = glyphComponent.ox || 0
  const baseOy = glyphComponent.oy || 0
  if (typeof clone.x === 'number') clone.x += baseOx
  if (typeof clone.y === 'number') clone.y += baseOy
  if (typeof clone.ox === 'number') clone.ox += baseOx
  if (typeof clone.oy === 'number') clone.oy += baseOy
  // 克隆到外层后，这些组件也应该参与字符/字形渲染
  clone.usedInCharacter = true
  return clone as IComponent
}

export const expandGlyphComponent = (
  glyphComponent: IGlyphComponent,
): { components: IComponent[]; orderedItems: OrderedItem[] } => {
  const glyphValue = glyphComponent.value as ICustomGlyphComponent
  const glyph: ICustomGlyph = glyphValue as unknown as ICustomGlyph

  // 使用独立的 instanceKey，避免与编辑/拖拽共用同一个实例导致 _components 累积
  const instanceKey = `${glyphComponent.uuid}__format`

  // 如果之前已有同名临时实例，先释放，确保这次格式化使用全新的实例
  if (instanceManager.isTemporary(instanceKey)) {
    instanceManager.releaseTemporaryInstance(instanceKey)
  }

  // 执行脚本，生成 _components
  executeGlyphScript(glyph, instanceKey)
  const glyphInstance = instanceManager.acquireTemporaryInstance(
    instanceKey,
    () => new CustomGlyph(glyph),
    'glyph',
  ) as CustomGlyph

  const glyphGeneratedComponents: any[] = (glyphInstance as any)._components || []

  // 同原工程：脚本生成的组件 + 字形内非 glyph 普通组件，一并展开
  const convertedComponents = glyphGeneratedComponents.map((comp: any) =>
    convertGeneratedComponent(comp, glyphComponent),
  )

  const glyphNormalComponents: IComponent[] = (glyph.components || [])
    .filter((c: any) => c && c.type !== ComponentType.CustomGlyph) as any

  const copiedComponents = glyphNormalComponents.map((comp) =>
    cloneNormalComponent(comp as any as IComponent, glyphComponent),
  )

  // 用完立即释放格式化用的临时实例，交由后续按需重新创建
  if (instanceManager.isTemporary(instanceKey)) {
    instanceManager.releaseTemporaryInstance(instanceKey)
  }

  const allComponents = [...convertedComponents, ...copiedComponents]
  const orderedItems = allComponents.map((comp) => ({
    type: 'component',
    uuid: comp.uuid,
  }))

  return {
    components: allComponents,
    orderedItems,
  }
}

export const formatContainerGlyphComponents = (
  container: { components: IComponent[]; orderedList?: OrderedItem[] },
): boolean => {
  const orderedList = container.orderedList || []
  const componentMap = new Map<string, IComponent>()
  const formattedComponents: IComponent[] = []
  const formattedOrder: OrderedItem[] = []
  const processed = new Set<string>()
  let changed = false

  container.components.forEach((comp: IComponent) => {
    componentMap.set(comp.uuid, comp)
  })

  orderedList.forEach((item) => {
    if (item.type !== 'component') {
      formattedOrder.push(item as OrderedItem)
      return
    }
    const component = componentMap.get(item.uuid)
    if (!component) {
      return
    }
    processed.add(component.uuid)
    if (component.type === ComponentType.CustomGlyph) {
      const { components, orderedItems } = expandGlyphComponent(
        component as IGlyphComponent,
      )
      if (components.length) {
        changed = true
        components.forEach((converted, index) => {
          formattedComponents.push(converted)
          formattedOrder.push(orderedItems[index])
        })
      } else {
        changed = true
      }
    } else {
      const cloned = deepClone(component)
      formattedComponents.push(cloned as IComponent)
      formattedOrder.push({ type: 'component', uuid: (cloned as IComponent).uuid })
    }
  })

  container.components.forEach((component) => {
    if (processed.has(component.uuid)) {
      return
    }
    if (component.type === ComponentType.CustomGlyph) {
      const { components, orderedItems } = expandGlyphComponent(
        component as IGlyphComponent,
      )
      if (components.length) {
        changed = true
        components.forEach((converted, index) => {
          formattedComponents.push(converted)
          formattedOrder.push(orderedItems[index])
        })
      } else {
        changed = true
      }
    } else {
      const cloned = deepClone(component)
      formattedComponents.push(cloned as IComponent)
      formattedOrder.push({ type: 'component', uuid: (cloned as IComponent).uuid })
    }
  })

  if (!changed) {
    return false
  }

  container.components = formattedComponents
  ;(container as any).orderedList = formattedOrder
  return true
}

/**
 * 与 character store 的 orderedListWithItemsForCurrentCharacterFile 一致（用于应用布局后就地改坐标）
 */
export function orderedListWithItemsForCharacterFile(
  character: ICharacterFileLite,
): IComponent[] {
  if (!character.components?.length) {
    return []
  }
  if (!character.orderedList?.length) {
    return character.components
  }
  return character.orderedList
    .map((item: { type: string; uuid: string }) => {
      if (item.type === 'group') {
        return null
      }
      if (item.type !== 'component') {
        return null
      }
      return selectedItemByUUID(character.components, item.uuid)
    })
    .filter((item): item is IComponent => item != null)
}

export interface IFormatGridComponentsOptions {
  grid: ILayoutTransformGrid | null
  offset?: { x: number; y: number }
  /** 为 true 时跳过笔划类（对齐旧版 canvas.formatGridComponents） */
  useSkeletonGrid?: boolean
}

/**
 * 将九宫格 initialGrid→currentGrid 的变换写入各组件数据（对齐原 fontplayer canvas.formatGridComponents）
 * 须在 formatContainerGlyphComponents 之后、重置 gridSettings 之前调用。
 */
export function formatGridComponents(
  components: IComponent[],
  options: IFormatGridComponentsOptions,
): void {
  if (!options.grid?.initialGrid || !options.grid?.currentGrid) {
    return
  }
  const grid = options.grid
  const useSkeletonGrid = options.useSkeletonGrid ?? false
  const offset = options.offset ?? { x: 0, y: 0 }
  const translate = (point: IPoint) => ({
    x: offset.x + point.x,
    y: offset.y + point.y,
  })

  for (const component of components) {
    if (!component || component.visible === false) {
      continue
    }

    if (component.type === ComponentType.Pen) {
      if (useSkeletonGrid) {
        continue
      }
      const { x, y, w, h, rotation, flipX, flipY } = component
      const { points } = component.value as IPenComponent
      let _points = transformPoints(points, {
        x,
        y,
        w,
        h,
        rotation,
        flipX,
        flipY,
      })
      _points = _points.map((point: IPoint) => {
        const mapped = computeCoords(grid, translate(point))
        point.x = mapped.x
        point.y = mapped.y
        return point
      })
      const bound = getBound(_points)
      component.x = bound.x
      component.y = bound.y
      component.w = bound.w
      component.h = bound.h
      component.rotation = 0
      component.flipX = false
      component.flipY = false
      const pv = component.value as IPenComponent
      pv.points = _points
      pv.contour = undefined
      pv.preview = undefined
    }

    if (component.type === ComponentType.Polygon) {
      if (useSkeletonGrid) {
        continue
      }
      const { x, y, w, h, rotation, flipX, flipY } = component
      const { points } = component.value as IPolygonComponent
      let _points = transformPoints(points, {
        x,
        y,
        w,
        h,
        rotation,
        flipX,
        flipY,
      })
      _points = _points.map((point: IPoint) => {
        const mapped = computeCoords(grid, translate(point))
        point.x = mapped.x
        point.y = mapped.y
        return point
      })
      const bound = getBound(_points)
      component.x = bound.x
      component.y = bound.y
      component.w = bound.w
      component.h = bound.h
      component.rotation = 0
      component.flipX = false
      component.flipY = false
      const pv = component.value as IPolygonComponent
      pv.points = _points
      pv.contour = undefined
      pv.preview = undefined
    }

    if (component.type === ComponentType.Ellipse) {
      if (useSkeletonGrid) {
        continue
      }
      const comp = component
      const { x, y, w, h, rotation, flipX, flipY } = comp
      const ellipseValue = component.value as IEllipseComponent
      const radiusX = ellipseValue.radiusX || w / 2
      const radiusY = ellipseValue.radiusY || h / 2
      const ellipseX = x
      const ellipseY = y
      let points = getEllipsePoints(
        radiusX,
        radiusY,
        1000,
        ellipseX + radiusX,
        ellipseY + radiusY,
      )
      let _points = transformPoints(points, {
        x,
        y,
        w,
        h,
        rotation,
        flipX,
        flipY,
      })
      _points = _points.map((point: IPoint) => {
        const coords = computeCoords(grid, translate(point))
        point.x = coords.x
        point.y = coords.y
        return point
      })
      const bound = getBound(_points)
      const newRadiusX = bound.w / 2
      const newRadiusY = bound.h / 2
      comp.x = bound.x
      comp.y = bound.y
      comp.w = bound.w
      comp.h = bound.h
      comp.rotation = 0
      comp.flipX = false
      comp.flipY = false
      ellipseValue.radiusX = newRadiusX
      ellipseValue.radiusY = newRadiusY
      ellipseValue.contour = undefined
      ellipseValue.preview = undefined
    }

    if (component.type === ComponentType.Rectangle) {
      if (useSkeletonGrid) {
        continue
      }
      const { x, y, w, h, rotation } = component
      const p0 = { x, y }
      const p1 = { x: x + w, y: y + h }
      let _points = transformPoints([p0, p1], {
        x,
        y,
        w,
        h,
        rotation,
        flipX: component.flipX,
        flipY: component.flipY,
      })
      _points = _points.map((point: IPoint) => {
        const mapped = computeCoords(grid, translate(point))
        return { x: mapped.x, y: mapped.y }
      })
      const width = _points[1].x - _points[0].x
      const height = _points[1].y - _points[0].y
      component.x = x
      component.y = y
      component.w = w
      component.h = h
      component.rotation = 0
      component.flipX = false
      component.flipY = false
      const rv = component.value as IRectangleComponent
      rv.width = width
      rv.height = height
      rv.contour = undefined
      rv.preview = undefined
    }
  }
}

