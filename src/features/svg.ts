/**
 * SVG 导入 / 导出相关方法
 * 基于原工程 src/features/svg.ts，适配重构工程的组件数据结构。
 */

import type {
  IComponent,
  IEllipseComponent,
  IPenComponent,
  IPolygonComponent,
  IRectangleComponent,
  ICustomGlyphComponent,
  IGlyphComponent,
} from '@/core/types'
import { ComponentType } from '@/core/types'
import { genUUID } from '@/utils/uuid'
import * as R from 'ramda'
import { getBound } from '@/core/utils/math'

interface IPoint {
  uuid: string
  x: number
  y: number
}

/**
 * 解析 SVG path 字符串为命令数组
 */
const parseSvgPath = (path: string) => {
  const length: Record<string, number> = { a: 7, c: 6, h: 1, l: 2, m: 2, q: 4, s: 4, t: 2, v: 1, z: 0 }
  const segment = /([astvzqmhlc])([^astvzqmhlc]*)/ig

  function parse(pathStr: string) {
    const data: any[] = []
    const number = /-?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/ig

    pathStr.replace(segment, (substring: string, command: string, args: string) => {
      let type = command.toLowerCase()
      const nums = args.match(number)
      let values: number[] = nums ? nums.map(Number) : []

      if (type === 'm' && values.length > 2) {
        const first = values.splice(0, 2)
        data.push([command, ...first])
        type = 'l'
        command = command === 'm' ? 'l' : 'L'
      }

      while (true) {
        if (values.length === length[type]) {
          data.push([command, ...values])
          return substring
        }
        if (values.length < length[type]) throw new Error('malformed path data')
        const chunk = values.splice(0, length[type])
        data.push([command, ...chunk])
      }
    })
    return data
  }

  return parse(path)
}

export const parseStrToSvg = (sourceStr: string): Document => {
  const parser = new DOMParser()
  return parser.parseFromString(sourceStr, 'image/svg+xml')
}

/**
 * 根据点列表生成基础组件框
 */
function createBaseComponent(
  type: ComponentType,
  name: string,
  points: Array<{ x: number; y: number }>,
): Pick<IComponent, 'x' | 'y' | 'w' | 'h'> {
  if (!points.length) {
    return { x: 0, y: 0, w: 0, h: 0 }
  }
  const { x, y, w, h } = getBound(points)
  return { x, y, w, h }
}

/**
 * 解析 SVG DOM 为组件列表
 */
export const parseSvgToComponents = (root: HTMLElement): Array<IComponent> => {
  const length = root.childNodes.length
  let components: Array<IComponent> = []

  for (let i = 0; i < length; i++) {
    const node = root.childNodes[i] as HTMLElement
    if (!(node as any).tagName) continue
    const type = (node as any).tagName as string

    if (type === 'path') {
      const d = node.getAttribute('d')
      if (!d) continue
      const commands = parseSvgPath(d)

      // 如果 path 只包含直线命令（M/L/H/V/Z），按多边形处理，避免曲线近似导致形状畸变
      const isLinearPath = commands.every((cmd: any[]) => {
        const c = String(cmd[0])
        return 'MmLlHhVvZz'.includes(c)
      })

      if (isLinearPath) {
        const points: IPoint[] = []
        let x = commands[0][1]
        let y = commands[0][2]
        points.push({ uuid: genUUID(), x, y })

        for (let i = 1; i < commands.length; i++) {
          const cmd = commands[i]
          const c = cmd[0]
          if (c === 'L' || c === 'l') {
            const nx = c === 'l' ? x + cmd[1] : cmd[1]
            const ny = c === 'l' ? y + cmd[2] : cmd[2]
            x = nx
            y = ny
            points.push({ uuid: genUUID(), x, y })
          } else if (c === 'H' || c === 'h') {
            const nx = c === 'h' ? x + cmd[1] : cmd[1]
            x = nx
            points.push({ uuid: genUUID(), x, y })
          } else if (c === 'V' || c === 'v') {
            const ny = c === 'v' ? y + cmd[1] : cmd[1]
            y = ny
            points.push({ uuid: genUUID(), x, y })
          } else if (c === 'Z' || c === 'z') {
            break
          }
        }

        const base = createBaseComponent(ComponentType.Polygon, 'polygon', points)
        const polygonComp: IComponent = {
          uuid: genUUID(),
          type: ComponentType.Polygon,
          name: 'polygon',
          lock: false,
          visible: true,
          rotation: 0,
          flipX: false,
          flipY: false,
          usedInCharacter: true,
          ...base,
          value: {
            points,
            strokeColor: node.getAttribute('stroke') || '#000',
            fillColor: node.getAttribute('fill') || '#000',
            closePath: true,
          } as IPolygonComponent,
        }
        components.push(polygonComp)
      } else {
        const _components = parsePathCommandsToComponents(commands) as unknown as IComponent[]
        components = components.concat(_components)
      }
    }

    if (type === 'g') {
      // 处理分组的位移，将 translate(...) 映射到子组件的坐标上
      const transform = node.getAttribute('transform') || ''
      let tx = 0
      let ty = 0
      const translateRegex = /translate\(([^)]+)\)/g
      let match: RegExpExecArray | null
      // 累加所有 translate 的位移；忽略 scale/rotate（当前导出为 scale(1,1)、rotate(0,...)）
      while ((match = translateRegex.exec(transform)) !== null) {
        const parts = match[1].split(/[ ,]+/).map((v) => v.trim()).filter(Boolean)
        const dx = Number(parts[0] || 0)
        const dy = Number(parts[1] || 0)
        tx += dx
        ty += dy
      }
      const groupComponents = parseSvgToComponents(node)
      groupComponents.forEach((gc) => {
        // 平移组件自身的包围盒
        gc.x += tx
        gc.y += ty
        // 平移点集
        if (gc.type === ComponentType.Pen) {
          const val = gc.value as IPenComponent
          if (val.points) {
            val.points.forEach((p: any) => {
              p.x += tx
              p.y += ty
            })
          }
        } else if (gc.type === ComponentType.Polygon) {
          const val = gc.value as IPolygonComponent
          if (val.points) {
            val.points.forEach((p: any) => {
              p.x += tx
              p.y += ty
            })
          }
        } else if (gc.type === ComponentType.Ellipse) {
          // 椭圆使用 x/y 作为中心，半径不受平移影响
          gc.x += 0
          gc.y += 0
        } else if (gc.type === ComponentType.Rectangle) {
          // 矩形只需平移 x/y；宽高不变
          gc.x += 0
          gc.y += 0
        }
        components.push(gc)
      })
    }

    if (type === 'ellipse') {
      const ellipseX = Number(node.getAttribute('cx'))
      const ellipseY = Number(node.getAttribute('cy'))
      const radiusX = Number(node.getAttribute('rx'))
      const radiusY = Number(node.getAttribute('ry'))
      const component: IComponent = {
        uuid: genUUID(),
        type: ComponentType.Ellipse,
        name: 'ellipse',
        lock: false,
        visible: true,
        rotation: 0,
        flipX: false,
        flipY: false,
        usedInCharacter: true,
        x: ellipseX,
        y: ellipseY,
        w: radiusX * 2,
        h: radiusY * 2,
        value: {
          radiusX,
          radiusY,
          fillColor: node.getAttribute('fill') || '#000',
          strokeColor: node.getAttribute('stroke') || '#000',
          closePath: true,
        } as IEllipseComponent,
      }
      components.push(component)
    }

    if (type === 'rect') {
      const rectX = Number(node.getAttribute('x')) || 0
      const rectY = Number(node.getAttribute('y')) || 0
      const rectWidth = Number(node.getAttribute('width'))
      const rectHeight = Number(node.getAttribute('height'))
      const component: IComponent = {
        uuid: genUUID(),
        type: ComponentType.Rectangle,
        name: 'rectangle',
        lock: false,
        visible: true,
        rotation: 0,
        flipX: false,
        flipY: false,
        usedInCharacter: true,
        x: rectX,
        y: rectY,
        w: rectWidth,
        h: rectHeight,
        value: {
          width: rectWidth,
          height: rectHeight,
          fillColor: node.getAttribute('fill') || '#000',
          strokeColor: node.getAttribute('stroke') || '#000',
          closePath: true,
        } as IRectangleComponent,
      }
      components.push(component)
    }

    if (type === 'line') {
      const x1 = Number(node.getAttribute('x1'))
      const y1 = Number(node.getAttribute('y1'))
      const x2 = Number(node.getAttribute('x2'))
      const y2 = Number(node.getAttribute('y2'))
      const points = [
        { x: x1, y: y1, uuid: genUUID() },
        { x: x2, y: y2, uuid: genUUID() },
      ]
      const base = createBaseComponent(ComponentType.Polygon, 'line', points)
      const component: IComponent = {
        uuid: genUUID(),
        type: ComponentType.Polygon,
        name: 'polygon',
        lock: false,
        visible: true,
        rotation: 0,
        flipX: false,
        flipY: false,
        usedInCharacter: true,
        ...base,
        value: {
          points,
          strokeColor: node.getAttribute('stroke') || '#000',
          fillColor: 'none',
          closePath: false,
        } as IPolygonComponent,
      }
      components.push(component)
    }

    if (type === 'polygon' || type === 'polyline') {
      const rawPoints = (node.getAttribute('points') || '').trim()
      if (!rawPoints) continue
      const points: Array<IPoint> = rawPoints.split(' ').map((point: string) => {
        const [px, py] = point.split(',')
        return { uuid: genUUID(), x: Number(px), y: Number(py) }
      })
      let closePath = type === 'polygon'
      if (type === 'polyline') {
        closePath = node.getAttribute('fill') === 'none' ? false : true
      }
      if (closePath && points.length > 0) {
        points.push(R.clone(points[0]))
      }
      const base = createBaseComponent(ComponentType.Polygon, 'polygon', points)
      const component: IComponent = {
        uuid: genUUID(),
        type: ComponentType.Polygon,
        name: 'polygon',
        lock: false,
        visible: true,
        rotation: 0,
        flipX: false,
        flipY: false,
        usedInCharacter: true,
        ...base,
        value: {
          points,
          strokeColor: node.getAttribute('stroke') || '#000',
          fillColor: node.getAttribute('fill') || '#000',
          closePath,
        } as IPolygonComponent,
      }
      components.push(component)
    }

    if (type === 'circle') {
      const ellipseX = Number(node.getAttribute('cx'))
      const ellipseY = Number(node.getAttribute('cy'))
      const radiusX = Number(node.getAttribute('r'))
      const radiusY = radiusX
      const component: IComponent = {
        uuid: genUUID(),
        type: ComponentType.Ellipse,
        name: 'ellipse',
        lock: false,
        visible: true,
        rotation: 0,
        flipX: false,
        flipY: false,
        usedInCharacter: true,
        x: ellipseX,
        y: ellipseY,
        w: radiusX * 2,
        h: radiusY * 2,
        value: {
          radiusX,
          radiusY,
          fillColor: node.getAttribute('fill') || '#000',
          strokeColor: node.getAttribute('stroke') || '#000',
          closePath: true,
        } as IEllipseComponent,
      }
      components.push(component)
    }
  }

  return components
}

/**
 * 将 path 命令转换为钢笔组件列表
 * 逻辑来源于原工程 parsePathCommandsToComponents，简化 contour/preview 计算。
 */
const parsePathCommandsToComponents = (commands: Array<any>): Array<IComponent> => {
  const contours: Array<Array<IPoint>> = [[]]
  const components: Array<IComponent> = []
  if (!commands.length) return components
  if (commands[0][0] !== 'M') return components

  const pointAt = {
    x: commands[0][1],
    y: commands[0][2],
  }
  const pointTo = {
    x: commands[0][1],
    y: commands[0][2],
  }
  contours[0].push({
    uuid: genUUID(),
    x: pointAt.x,
    y: pointAt.y,
  })
  let closePath = false
  let length = commands.length
  let contourIndex = 0

  for (let i = 1; i < length; i++) {
    const command = commands[i]
    const type = command[0]
    if (type === 'M' || type === 'm') {
      // 结束上一段
      const contourPoints = contours[contourIndex]
      if (contourPoints.length > 1) {
        const base = createBaseComponent(
          ComponentType.Pen,
          'pen',
          contourPoints.map((p) => ({ x: p.x, y: p.y })),
        )
        const comp: IComponent = {
          uuid: genUUID(),
          type: ComponentType.Pen,
          name: 'pen',
          lock: false,
          visible: true,
          rotation: 0,
          flipX: false,
          flipY: false,
          usedInCharacter: true,
          ...base,
          value: {
            points: contourPoints,
            fillColor: '',
            strokeColor: '#000',
            closePath,
            editMode: false,
          } as IPenComponent,
        }
        components.push(comp)
      }

      closePath = false
      pointTo.x = type === 'm' ? pointAt.x + command[1] : command[1]
      pointTo.y = type === 'm' ? pointAt.y + command[2] : command[2]
      contourIndex += 1
      contours[contourIndex] = [
        {
          uuid: genUUID(),
          x: pointTo.x,
          y: pointTo.y,
        },
      ]
      continue
    }

    if (type === 'L' || type === 'l') {
      pointTo.x = type === 'l' ? pointAt.x + command[1] : command[1]
      pointTo.y = type === 'l' ? pointAt.y + command[2] : command[2]
      contours[contourIndex].push({
        uuid: genUUID(),
        x: pointTo.x,
        y: pointTo.y,
      })
      pointAt.x = pointTo.x
      pointAt.y = pointTo.y
      continue
    }

    if (type === 'H' || type === 'h') {
      pointTo.x = type === 'h' ? pointAt.x + command[1] : command[1]
      pointTo.y = pointAt.y
      contours[contourIndex].push({
        uuid: genUUID(),
        x: pointTo.x,
        y: pointTo.y,
      })
      pointAt.x = pointTo.x
      pointAt.y = pointTo.y
      continue
    }

    if (type === 'V' || type === 'v') {
      pointTo.x = pointAt.x
      pointTo.y = type === 'v' ? pointAt.y + command[1] : command[1]
      contours[contourIndex].push({
        uuid: genUUID(),
        x: pointTo.x,
        y: pointTo.y,
      })
      pointAt.x = pointTo.x
      pointAt.y = pointTo.y
      continue
    }

    if (type === 'C' || type === 'c') {
      // 三次贝塞尔，取控制点和终点
      const cx1 = type === 'c' ? pointAt.x + command[1] : command[1]
      const cy1 = type === 'c' ? pointAt.y + command[2] : command[2]
      const cx2 = type === 'c' ? pointAt.x + command[3] : command[3]
      const cy2 = type === 'c' ? pointAt.y + command[4] : command[4]
      const ex = type === 'c' ? pointAt.x + command[5] : command[5]
      const ey = type === 'c' ? pointAt.y + command[6] : command[6]

      contours[contourIndex].push(
        { uuid: genUUID(), x: cx1, y: cy1 },
        { uuid: genUUID(), x: cx2, y: cy2 },
        { uuid: genUUID(), x: ex, y: ey },
      )
      pointAt.x = ex
      pointAt.y = ey
      continue
    }

    if (type === 'Z' || type === 'z') {
      closePath = true
      // 闭合轮廓
      const contourPoints = contours[contourIndex]
      if (contourPoints.length > 1) {
        const base = createBaseComponent(
          ComponentType.Pen,
          'pen',
          contourPoints.map((p) => ({ x: p.x, y: p.y })),
        )
        const comp: IComponent = {
          uuid: genUUID(),
          type: ComponentType.Pen,
          name: 'pen',
          lock: false,
          visible: true,
          rotation: 0,
          flipX: false,
          flipY: false,
          usedInCharacter: true,
          ...base,
          value: {
            points: contourPoints,
            fillColor: '',
            strokeColor: '#000',
            closePath: true,
            editMode: false,
          } as IPenComponent,
        }
        components.push(comp)
      }
    }
  }

  return components
}

/**
 * 组件列表转 SVG 字符串
 * 基本逻辑参考原工程 componentsToSvg，适配当前组件结构。
 */
/** 用于在导出嵌套字形时解析字形实例并返回脚本生成的 _components。instanceKey 与画布一致，用 component.uuid。 */
export type GetGlyphInstanceComponents = (
  instanceKey: string,
  glyphData: ICustomGlyphComponent,
) => Array<unknown>

export const componentsToSvg = (
  components: Array<IComponent>,
  width: number,
  height: number,
  renderStyle: string = 'default',
  options: {
    isSub?: boolean
    ox?: number
    oy?: number
    getGlyphInstanceComponents?: GetGlyphInstanceComponents
  } = {},
): string => {
  const { isSub = false, getGlyphInstanceComponents } = options
  let svg = isSub ? '' : `<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ${width} ${height}\">`
  let fillColor = renderStyle === 'contour' ? '' : '#000000'

  const collectPointsFromComponent = (comp: IComponent | Record<string, unknown>): Array<{ x: number; y: number }> => {
    const c = comp as any
    if (c.type === ComponentType.Pen) {
      const val = c.value as IPenComponent
      return (val?.points || []).map((p: any) => ({ x: p.x, y: p.y }))
    }
    if (c.type === ComponentType.Polygon) {
      const val = c.value as IPolygonComponent
      return (val?.points || []).map((p: any) => ({ x: p.x, y: p.y }))
    }
    if (c.type === ComponentType.Ellipse) {
      const val = c.value as IEllipseComponent
      const rx = val?.radiusX ?? 0
      const ry = val?.radiusY ?? 0
      const cx = c.x ?? 0
      const cy = c.y ?? 0
      return [
        { x: cx - rx, y: cy - ry },
        { x: cx + rx, y: cy + ry },
      ]
    }
    if (c.type === ComponentType.Rectangle) {
      const val = c.value as IRectangleComponent
      const x = c.x ?? 0
      const y = c.y ?? 0
      const w = val?.width ?? 0
      const h = val?.height ?? 0
      return [
        { x, y },
        { x: x + w, y: y + h },
      ]
    }
    // 脚本内置组件（executeScript 生成的实例）
    if (c.type === 'glyph-pen' && Array.isArray(c.points)) {
      return c.points.map((p: any) => ({ x: p.x, y: p.y }))
    }
    if (c.type === 'glyph-polygon' && Array.isArray(c.points)) {
      return c.points.map((p: any) => ({ x: p.x, y: p.y }))
    }
    if (c.type === 'glyph-rectangle' && typeof c.x === 'number' && typeof c.width === 'number') {
      return [
        { x: c.x, y: c.y },
        { x: c.x + c.width, y: c.y + c.height },
      ]
    }
    if (c.type === 'glyph-ellipse' && typeof c.centerX === 'number' && typeof c.radiusX === 'number') {
      return [
        { x: c.centerX - c.radiusX, y: c.centerY - c.radiusY },
        { x: c.centerX + c.radiusX, y: c.centerY + c.radiusY },
      ]
    }
    return []
  }

  for (const component of components) {
    const { x, y, w, h, rotation } = component

    if (component.type === ComponentType.Pen) {
      const { points, strokeColor, closePath } = component.value as IPenComponent
      if (!points || !points.length) continue
      if (renderStyle === 'default') {
        fillColor = (component.value as IPenComponent).fillColor || '#000'
      }
      const { x: origin_x, y: origin_y, w: origin_w, h: origin_h } = getBound(points)
      const translateX = x - origin_x
      const translateY = y - origin_y
      const scaleX = origin_w ? w / origin_w : 1
      const scaleY = origin_h ? h / origin_h : 1
      const rotateCenterX = x + w / 2
      const rotateCenterY = y + h / 2

      svg += `<path fill=\"${fillColor}\" stroke=\"${strokeColor}\" d=\"M ${points[0].x},${points[0].y} `
      for (let j = 1; j + 2 < points.length; j += 3) {
        const p1 = points[j]
        const p2 = points[j + 1]
        const p3 = points[j + 2]
        svg += `C ${p1.x},${p1.y},${p2.x},${p2.y},${p3.x},${p3.y} `
      }
      if (closePath) {
        svg += 'z'
      }
      svg += `\" transform=\"translate(${translateX}, ${translateY}) scale(${scaleX}, ${scaleY}) rotate(${rotation}, ${rotateCenterX}, ${rotateCenterY})\" />`
    } else if (component.type === ComponentType.Polygon) {
      const { points, strokeColor, closePath } = component.value as IPolygonComponent
      if (!points || !points.length) continue
      if (renderStyle === 'default') {
        fillColor = (component.value as IPolygonComponent).fillColor || '#000'
      }
      const { x: origin_x, y: origin_y, w: origin_w, h: origin_h } = getBound(points)
      const translateX = x - origin_x
      const translateY = y - origin_y
      const scaleX = origin_w ? w / origin_w : 1
      const scaleY = origin_h ? h / origin_h : 1
      const rotateCenterX = x + w / 2
      const rotateCenterY = y + h / 2

      svg += `<path fill=\"${fillColor}\" stroke=\"${strokeColor}\" d=\"M ${points[0].x},${points[0].y} `
      for (let j = 1; j < points.length; j++) {
        svg += `L ${points[j].x},${points[j].y} `
      }
      if (closePath) {
        svg += 'z'
      }
      svg += `\" transform=\"translate(${translateX}, ${translateY}) scale(${scaleX}, ${scaleY}) rotate(${rotation}, ${rotateCenterX}, ${rotateCenterY})\" />`
    } else if (component.type === ComponentType.Ellipse) {
      const { radiusX, radiusY, strokeColor } = component.value as IEllipseComponent
      if (renderStyle === 'default') {
        fillColor = (component.value as IEllipseComponent).fillColor || '#000'
      }
      const translateX = radiusX
      const translateY = radiusY
      const scaleX = radiusX ? w / (radiusX * 2) : 1
      const scaleY = radiusY ? h / (radiusY * 2) : 1
      const rotateCenterX = x + w / 2
      const rotateCenterY = y + h / 2

      svg += `<ellipse fill=\"${fillColor}\" stroke=\"${strokeColor}\" cx=\"${x}\" cy=\"${y}\" rx=\"${radiusX}\" ry=\"${radiusY}\" transform=\"translate(${translateX}, ${translateY}) scale(${scaleX}, ${scaleY}) rotate(${rotation}, ${rotateCenterX}, ${rotateCenterY})\" />`
    } else if (component.type === ComponentType.Rectangle) {
      const { width: rw, height: rh, strokeColor } = component.value as IRectangleComponent
      if (renderStyle === 'default') {
        fillColor = (component.value as IRectangleComponent).fillColor || '#000'
      }
      const scaleX = rw ? w / rw : 1
      const scaleY = rh ? h / rh : 1
      const rotateCenterX = x + w / 2
      const rotateCenterY = y + h / 2

      svg += `<rect fill=\"${fillColor}\" stroke=\"${strokeColor}\" x=\"${x}\" y=\"${y}\" width=\"${rw}\" height=\"${rh}\" transform=\"scale(${scaleX}, ${scaleY}) rotate(${rotation}, ${rotateCenterX}, ${rotateCenterY})\" />`
    } else if ((component as any).type === 'glyph-pen') {
      const points = (component as any).points as Array<{ x: number; y: number }>
      if (!points?.length) continue
      const strokeColor = (component as any).strokeColor ?? '#000'
      const closePath = (component as any).closePath ?? false
      const pts = points.map((p: any) => ({ x: p.x, y: p.y }))
      const { x: origin_x, y: origin_y, w: origin_w, h: origin_h } = getBound(pts)
      const x = (component as any).x ?? origin_x
      const y = (component as any).y ?? origin_y
      const w = (component as any).w ?? origin_w
      const h = (component as any).h ?? origin_h
      const rotation = (component as any).rotation ?? 0
      const translateX = x - origin_x
      const translateY = y - origin_y
      const scaleX = origin_w ? w / origin_w : 1
      const scaleY = origin_h ? h / origin_h : 1
      const rotateCenterX = x + w / 2
      const rotateCenterY = y + h / 2
      svg += `<path fill=\"${fillColor}\" stroke=\"${strokeColor}\" d=\"M ${points[0].x},${points[0].y} `
      for (let j = 1; j + 2 < points.length; j += 3) {
        const p1 = points[j]
        const p2 = points[j + 1]
        const p3 = points[j + 2]
        svg += `C ${p1.x},${p1.y},${p2.x},${p2.y},${p3.x},${p3.y} `
      }
      if (closePath) svg += 'z'
      svg += `\" transform=\"translate(${translateX}, ${translateY}) scale(${scaleX}, ${scaleY}) rotate(${rotation}, ${rotateCenterX}, ${rotateCenterY})\" />`
    } else if ((component as any).type === 'glyph-polygon') {
      const points = (component as any).points as Array<{ x: number; y: number }>
      if (!points?.length) continue
      const strokeColor = (component as any).strokeColor ?? '#000'
      const pts = points.map((p: any) => ({ x: p.x, y: p.y }))
      const { x: origin_x, y: origin_y, w: origin_w, h: origin_h } = getBound(pts)
      const x = (component as any).x ?? origin_x
      const y = (component as any).y ?? origin_y
      const w = (component as any).w ?? origin_w
      const h = (component as any).h ?? origin_h
      const rotation = (component as any).rotation ?? 0
      const translateX = x - origin_x
      const translateY = y - origin_y
      const scaleX = origin_w ? w / origin_w : 1
      const scaleY = origin_h ? h / origin_h : 1
      const rotateCenterX = x + w / 2
      const rotateCenterY = y + h / 2
      svg += `<path fill=\"${fillColor}\" stroke=\"${strokeColor}\" d=\"M ${points[0].x},${points[0].y} `
      for (let j = 1; j < points.length; j++) {
        svg += `L ${points[j].x},${points[j].y} `
      }
      svg += `z\" transform=\"translate(${translateX}, ${translateY}) scale(${scaleX}, ${scaleY}) rotate(${rotation}, ${rotateCenterX}, ${rotateCenterY})\" />`
    } else if ((component as any).type === 'glyph-rectangle') {
      const x = (component as any).x ?? 0
      const y = (component as any).y ?? 0
      const rw = (component as any).width ?? 0
      const rh = (component as any).height ?? 0
      const strokeColor = (component as any).strokeColor ?? '#000'
      const rotation = (component as any).rotation ?? 0
      const rotateCenterX = x + rw / 2
      const rotateCenterY = y + rh / 2
      svg += `<rect fill=\"${fillColor}\" stroke=\"${strokeColor}\" x=\"${x}\" y=\"${y}\" width=\"${rw}\" height=\"${rh}\" transform=\"rotate(${rotation}, ${rotateCenterX}, ${rotateCenterY})\" />`
    } else if ((component as any).type === 'glyph-ellipse') {
      const cx = (component as any).centerX ?? 0
      const cy = (component as any).centerY ?? 0
      const rx = (component as any).radiusX ?? 0
      const ry = (component as any).radiusY ?? 0
      const strokeColor = (component as any).strokeColor ?? '#000'
      const rotation = (component as any).rotation ?? 0
      const rotateCenterX = cx
      const rotateCenterY = cy
      svg += `<ellipse fill=\"${fillColor}\" stroke=\"${strokeColor}\" cx=\"${cx}\" cy=\"${cy}\" rx=\"${rx}\" ry=\"${ry}\" transform=\"rotate(${rotation}, ${rotateCenterX}, ${rotateCenterY})\" />`
    } else if (component.type === ComponentType.CustomGlyph) {
      const glyphValue = component.value as ICustomGlyphComponent
      const dataComponents = (glyphValue.components || []) as unknown as IComponent[]
      const scriptComponents = getGlyphInstanceComponents
        ? (getGlyphInstanceComponents(component.uuid, glyphValue) || []) as unknown as IComponent[]
        : []
      const innerComponents = [...dataComponents, ...scriptComponents]
      if (!innerComponents.length) {
        continue
      }

      // 计算内部组件的原始边界
      const allPoints: Array<{ x: number; y: number }> = []
      innerComponents.forEach((c) => {
        allPoints.push(...collectPointsFromComponent(c))
      })
      if (!allPoints.length) {
        continue
      }
      const { x: origin_x, y: origin_y, w: origin_w, h: origin_h } = getBound(allPoints)

      // 与画布一致：字形 offset (ox,oy) 表示本地原点位置，故内容左上 (origin_x, origin_y) 应落在 (ox+origin_x, oy+origin_y)
      const comp = component as { x?: number; y?: number; w?: number; h?: number; ox?: number; oy?: number; rotation?: number }
      const posX = comp.ox ?? comp.x ?? 0
      const posY = comp.oy ?? comp.y ?? 0
      const compW = comp.w ?? origin_w ?? 0
      const compH = comp.h ?? origin_h ?? 0
      // 避免 scale(0,0) 导致整组不可见：目标宽高为 0 或缺失时用 1
      const scaleX = origin_w && compW ? compW / origin_w : 1
      const scaleY = origin_h && compH ? compH / origin_h : 1
      // 先平移到目标左上 (posX+origin_x, posY+origin_y)，再缩放（以内容原点为中心），再平移回：使内容左上落在 (posX+origin_x, posY+origin_y)
      const placeX = posX + origin_x
      const placeY = posY + origin_y
      const rotateCenterX = placeX + compW / 2
      const rotateCenterY = placeY + compH / 2

      const innerSvg = componentsToSvg(innerComponents, width, height, renderStyle, {
        ...options,
        isSub: true,
      })

      svg += `<g transform=\"translate(${placeX}, ${placeY}) scale(${scaleX}, ${scaleY}) translate(${-origin_x}, ${-origin_y}) rotate(${component.rotation ?? 0}, ${rotateCenterX}, ${rotateCenterY})\">`
      svg += innerSvg
      svg += `</g>`
    }
  }

  if (!isSub) {
    svg += '</svg>'
  }
  return svg
}

