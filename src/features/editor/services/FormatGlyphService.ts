import * as R from 'ramda'
import { genUUID } from '@/utils/uuid'
import { roundToPrecision } from '@/utils/number'
import type {
  IComponent,
  IGlyphComponent,
  ICustomGlyphComponent,
  ICustomGlyph,
} from '@/core/types'
import { ComponentType } from '@/core/types'
import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'

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
    usedInCharacter: glyphComponent.usedInCharacter,
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

