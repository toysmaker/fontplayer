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
import { getBound, transformPoints, getEllipsePoints } from '@/core/utils/math'

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

/** 钢笔点（锚点+控制点三元组）→ SVG path d */
function penPointsToSvgD(points: Array<{ x: number; y: number }>, closePath: boolean): string {
  let d = `M ${points[0].x},${points[0].y} `
  for (let j = 1; j + 2 < points.length; j += 3) {
    const p1 = points[j]
    const p2 = points[j + 1]
    const p3 = points[j + 2]
    d += `C ${p1.x},${p1.y},${p2.x},${p2.y},${p3.x},${p3.y} `
  }
  if (closePath) d += 'z'
  return d
}

/** 多边形点 → SVG path d */
function polygonPointsToSvgD(points: Array<{ x: number; y: number }>, closePath: boolean): string {
  let d = `M ${points[0].x},${points[0].y} `
  for (let j = 1; j < points.length; j++) {
    d += `L ${points[j].x},${points[j].y} `
  }
  if (closePath) d += 'z'
  return d
}

/**
 * 组件放置变换（仅轮廓模式输出 transform 属性用；对应旧版 translate·scale·rotate 列表）
 */
interface SvgPlaceTransform {
  tx: number
  ty: number
  sx: number
  sy: number
  rot: number
  cx: number
  cy: number
}

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
    /** 父字形组件向下继承的填充色（子组件未单独设色时使用） */
    inheritedFillColor?: string
  } = {},
): string => {
  const { isSub = false, getGlyphInstanceComponents } = options
  const isContour = renderStyle === 'contour'
  let svg = isSub ? '' : `<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ${width} ${height}\">`

  // 与图标数据集导出/预览渲染一致的取色规则：
  // comp.fillColor → value.fillColor → 父字形继承色 → '#000'
  const resolveFill = (comp: any): string => {
    if (isContour) return ''
    const own = comp?.fillColor || comp?.value?.fillColor
    return own || options.inheritedFillColor || '#000'
  }

  // 彩色填充语义与图标数据集导出（contourGroupsToSvgPaths）一致：
  // 本帧内同色轮廓合并为一条 <path> 统一 fill-rule="nonzero"（反方向轮廓形成镂空）、不带描边，
  // 实心元素（矩形/椭圆）最后单独输出、始终实心
  const mergeGroups: Array<{ fill: string; ds: string[] }> = []
  const groupIndexByFill = new Map<string, number>()
  const solidElements: string[] = []

  const addMergedPath = (fill: string, d: string): void => {
    let gi = groupIndexByFill.get(fill)
    if (gi === undefined) {
      gi = mergeGroups.length
      groupIndexByFill.set(fill, gi)
      mergeGroups.push({ fill, ds: [] })
    }
    mergeGroups[gi].ds.push(d)
  }

  const flushMergedPaths = (): void => {
    for (const g of mergeGroups) {
      svg += `<path fill="${g.fill}" fill-rule="nonzero" d="${g.ds.join(' ')}"/>`
    }
    mergeGroups.length = 0
    groupIndexByFill.clear()
  }

  /** 默认模式：同色合并输出（placedD 已按 transformPoints 烘焙放置、无描边）；轮廓模式：保持原有逐组件输出（localD + transform 属性 + 描边） */
  const emitMergeablePath = (
    fill: string,
    stroke: string,
    localD: string,
    placedD: string,
    place: SvgPlaceTransform | null,
  ): void => {
    if (isContour) {
      const transformAttr = place
        ? ` transform=\"translate(${place.tx}, ${place.ty}) scale(${place.sx}, ${place.sy}) rotate(${place.rot}, ${place.cx}, ${place.cy})\"`
        : ''
      svg += `<path fill=\"${fill}\" stroke=\"${stroke}\" d=\"${localD}\"${transformAttr} />`
    } else {
      addMergedPath(fill, placedD)
    }
  }

  /** 实心元素（矩形/椭圆）：默认模式收集到末尾统一输出（始终实心、覆盖在上）；轮廓模式保持原位输出 */
  const emitSolidElement = (el: string): void => {
    if (isContour) {
      svg += el
    } else {
      solidElements.push(el)
    }
  }

  // 防环：字形可包含字形，收集边界时按 uuid 去重（try/finally 保证兄弟分支互不影响）
  const collectVisited = new Set<string>()
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
    // 字形可包含字形：递归收集内部组件（含脚本生成组件）的边界
    if (c.type === ComponentType.CustomGlyph) {
      const glyphValue = c.value as ICustomGlyphComponent | undefined
      if (!glyphValue) return []
      const key = String(c.uuid ?? '') || String(glyphValue.uuid ?? '')
      if (collectVisited.has(key)) return []
      collectVisited.add(key)
      try {
        const dataComps = (glyphValue.components || []) as unknown as IComponent[]
        const scriptComps = getGlyphInstanceComponents
          ? ((getGlyphInstanceComponents(key, glyphValue) || []) as unknown as IComponent[])
          : []
        const pts: Array<{ x: number; y: number }> = []
        for (const sub of [...dataComps, ...scriptComps]) {
          pts.push(...collectPointsFromComponent(sub))
        }
        return pts
      } finally {
        collectVisited.delete(key)
      }
    }
    return []
  }

  for (const component of components) {
    const { x, y, w, h, rotation } = component

    if (component.type === ComponentType.Pen) {
      const { points, strokeColor, closePath } = component.value as IPenComponent
      if (!points || !points.length) continue
      const fill = resolveFill(component)
      const { x: origin_x, y: origin_y, w: origin_w, h: origin_h } = getBound(points)
      const place: SvgPlaceTransform = {
        tx: x - origin_x,
        ty: y - origin_y,
        sx: origin_w ? w / origin_w : 1,
        sy: origin_h ? h / origin_h : 1,
        rot: rotation,
        cx: x + w / 2,
        cy: y + h / 2,
      }
      const localD = penPointsToSvgD(points, closePath)
      // 与转换器/画布一致：绕原始包围盒中心旋转并缩放（transformPoints），而非放置后中心
      const placedPoints = transformPoints(points, {
        x,
        y,
        w,
        h,
        rotation,
        flipX: component.flipX,
        flipY: component.flipY,
      })
      const placedD = penPointsToSvgD(placedPoints, closePath)
      emitMergeablePath(fill, strokeColor, localD, placedD, place)
    } else if (component.type === ComponentType.Polygon) {
      const { points, strokeColor, closePath } = component.value as IPolygonComponent
      if (!points || !points.length) continue
      const fill = resolveFill(component)
      const { x: origin_x, y: origin_y, w: origin_w, h: origin_h } = getBound(points)
      const place: SvgPlaceTransform = {
        tx: x - origin_x,
        ty: y - origin_y,
        sx: origin_w ? w / origin_w : 1,
        sy: origin_h ? h / origin_h : 1,
        rot: rotation,
        cx: x + w / 2,
        cy: y + h / 2,
      }
      const localD = polygonPointsToSvgD(points, closePath)
      const placedPoints = transformPoints(points, {
        x,
        y,
        w,
        h,
        rotation,
        flipX: component.flipX,
        flipY: component.flipY,
      })
      const placedD = polygonPointsToSvgD(placedPoints, closePath)
      emitMergeablePath(fill, strokeColor, localD, placedD, place)
    } else if (component.type === ComponentType.Ellipse) {
      const { radiusX, radiusY, strokeColor } = component.value as IEllipseComponent
      const fill = resolveFill(component)
      // 与转换器一致：椭圆点绕中心生成，再经 transformPoints 放置（烘焙为 path，始终实心）
      const ellipsePoints = getEllipsePoints(radiusX, radiusY, 1000, x + radiusX, y + radiusY)
      const placedPoints = transformPoints(ellipsePoints, {
        x,
        y,
        w,
        h,
        rotation,
        flipX: component.flipX,
        flipY: component.flipY,
      })
      emitSolidElement(`<path fill=\"${fill}\"${isContour ? ` stroke=\"${strokeColor}\"` : ''} fill-rule="nonzero" d=\"${polygonPointsToSvgD(placedPoints, true)}\"/>`)
    } else if (component.type === ComponentType.Rectangle) {
      const { width: rw, height: rh, strokeColor } = component.value as IRectangleComponent
      const fill = resolveFill(component)
      const corners = [
        { x: 0, y: 0 },
        { x: rw, y: 0 },
        { x: rw, y: rh },
        { x: 0, y: rh },
      ]
      const placedPoints = transformPoints(corners, {
        x,
        y,
        w,
        h,
        rotation,
        flipX: component.flipX,
        flipY: component.flipY,
      })
      emitSolidElement(`<path fill=\"${fill}\"${isContour ? ` stroke=\"${strokeColor}\"` : ''} fill-rule="nonzero" d=\"${polygonPointsToSvgD(placedPoints, true)}\"/>`)
    } else if ((component as any).type === 'glyph-pen') {
      const points = (component as any).points as Array<{ x: number; y: number }>
      if (!points?.length) continue
      const strokeColor = (component as any).strokeColor ?? '#000'
      const closePath = (component as any).closePath ?? false
      const fill = resolveFill(component)
      // 脚本组件几何 = 脚本输出的原始点（updateData 不应用 x/y/w/h/rotation），
      // 字形帧的 ox/oy 偏移由外层 <g> 承担 —— 与画布/转换器一致
      const d = penPointsToSvgD(points, closePath)
      emitMergeablePath(fill, strokeColor, d, d, null)
    } else if ((component as any).type === 'glyph-polygon') {
      const points = (component as any).points as Array<{ x: number; y: number }>
      if (!points?.length) continue
      const strokeColor = (component as any).strokeColor ?? '#000'
      const fill = resolveFill(component)
      const d = polygonPointsToSvgD(points, true)
      emitMergeablePath(fill, strokeColor, d, d, null)
    } else if ((component as any).type === 'glyph-rectangle') {
      const gx = (component as any).x ?? 0
      const gy = (component as any).y ?? 0
      const rw = (component as any).width ?? 0
      const rh = (component as any).height ?? 0
      const strokeColor = (component as any).strokeColor ?? '#000'
      const fill = resolveFill(component)
      emitSolidElement(`<rect fill=\"${fill}\"${isContour ? ` stroke=\"${strokeColor}\"` : ''} x=\"${gx}\" y=\"${gy}\" width=\"${rw}\" height=\"${rh}\" />`)
    } else if ((component as any).type === 'glyph-ellipse') {
      const cx = (component as any).centerX ?? 0
      const cy = (component as any).centerY ?? 0
      const rx = (component as any).radiusX ?? 0
      const ry = (component as any).radiusY ?? 0
      const strokeColor = (component as any).strokeColor ?? '#000'
      const fill = resolveFill(component)
      emitSolidElement(`<ellipse fill=\"${fill}\"${isContour ? ` stroke=\"${strokeColor}\"` : ''} cx=\"${cx}\" cy=\"${cy}\" rx=\"${rx}\" ry=\"${ry}\" />`)
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

      // 计算内部组件的原始边界（仅用于跳过无法解析出几何内容的字形）
      const allPoints: Array<{ x: number; y: number }> = []
      innerComponents.forEach((c) => {
        allPoints.push(...collectPointsFromComponent(c))
      })
      if (!allPoints.length) {
        continue
      }

      // 与编辑画布（glyphInstance.render(canvas, …, {x: ox, y: oy})）和转换器一致：
      // 字形组件定位只使用 ox/oy 偏移，不缩放、不旋转、不考虑 x/y/w/h ——
      // 子组件自身的 x/y/w/h/rotation 已在各自分支烘焙进 path 坐标
      const comp = component as { ox?: number; oy?: number }
      const posX = comp.ox ?? 0
      const posY = comp.oy ?? 0

      // 子组件未单独设色时继承本字形组件的填充色（与转换器/预览渲染一致）
      const glyphFill =
        (component as any).fillColor || (glyphValue as any).fillColor || options.inheritedFillColor
      const innerSvg = componentsToSvg(innerComponents, width, height, renderStyle, {
        ...options,
        isSub: true,
        inheritedFillColor: glyphFill,
      })

      // 先输出本帧已收集的同色合并路径，保持与组件顺序一致的层叠关系
      flushMergedPaths()
      svg += `<g transform=\"translate(${posX}, ${posY})\">`
      svg += innerSvg
      svg += `</g>`
    }
  }

  // 输出本帧剩余的同色合并路径（fill-rule="nonzero" 镂空），实心元素最后绘制（始终实心、覆盖在上）
  flushMergedPaths()
  for (const el of solidElements) {
    svg += el
  }

  if (!isSub) {
    svg += '</svg>'
  }
  return svg
}

