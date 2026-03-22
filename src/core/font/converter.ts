/**
 * 轮廓转换器
 * 将组件转换为轮廓数据用于渲染
 * 从原代码迁移的完整实现
 */

import type { IContours, IContour } from './types'
import { PathType } from './types'
import type { IComponent, ICharacterFileLite, ContourSegment, IPenComponent, IPolygonComponent, IRectangleComponent, IEllipseComponent, ICustomGlyph, IGlyphComponent } from '../types'
import { transformPoints, getRectanglePoints, getEllipsePoints, translate, getBound } from '../utils/math'
import { formatPoints, genPenContour, genPolygonContour, genRectangleContour, genEllipseContour } from '../utils/contour'
import { computeCoords } from '../utils/grid'
import { executeGlyphScript } from '../script/ScriptExecutor'
import { instanceManager } from '../instance/InstanceManager'
import { CustomGlyph } from '../instance/CustomGlyph'
import { orderedListWithItemsForGlyph } from '../utils/glyph'
import { genUUID } from '@/utils/uuid'

/**
 * 转换选项
 */
export interface IConvertOptions {
  unitsPerEm: number
  descender: number
  advanceWidth?: number
  grid?: any
  useSkeletonGrid?: boolean
  preview?: boolean
  forceUpdate?: boolean
  /**
   * 传给 glyph-* 脚本组件 `updateData` 的首参：true 时用固定 1000/-200（如高级编辑笔画预览），
   * false/省略时用当前文件字体的 metrics。对齐原 `font.ts` 的 `isGlyph`。
   */
  isGlyph?: boolean
  /**
   * 与原版 `componentsToContours(..., { advancedEdit: true })` 对应。
   * 调用方应在转换前将 `setGlobalConstantsMap` 指向高级编辑用的 ConstantsMap（面板常量）。
   */
  advancedEdit?: boolean
}

/**
 * 轮廓转换器
 */
export class ContourConverter {
  /**
   * 从字符文件获取组件列表（简化版）
   * 实际应该根据 orderedList 和 components 构建完整的组件树
   */
  static getComponentsForCharacter(
    characterFile: ICharacterFileLite
  ): IComponent[] {
    if (!characterFile.components) return []
    
    // 如果有 orderedList，按顺序返回组件
    if (characterFile.orderedList && characterFile.orderedList.length > 0) {
      const result: IComponent[] = []
      for (const item of characterFile.orderedList) {
        const component = characterFile.components.find(
          (c) => c.uuid === item.uuid
        )
        if (component) {
          result.push(component)
        }
      }
      return result
    }
    
    // 否则返回所有组件
    return characterFile.components
  }

  /**
   * 将组件转换为编辑时轮廓（仅几何变换，不做 formatPoints / unitsPerEm 等字体坐标转换）。
   * 用于菜单「去除重叠」等需要编辑空间轮廓的场景。等价于原工程 componentsToContours2(..., contour_type=1)。
   */
  static componentsToContoursEditing(
    components: (IComponent | IGlyphComponent)[],
    offset: { x: number; y: number } = { x: 0, y: 0 }
  ): IContours {
    const contours: IContours = []
    const scriptTypes = ['glyph-pen', 'glyph-polygon', 'glyph-rectangle', 'glyph-ellipse']
    for (const component of components) {
      if (component.usedInCharacter === false) continue
      const { x, y, w, h, rotation, flipX, flipY } = component
      const value = (component as any).value
      const isScriptComponent = scriptTypes.includes(component.type)
      if (!value && !isScriptComponent) continue

      try {
        switch (component.type) {
          case 'pen': {
            const penValue = value as IPenComponent
            let pts = transformPoints(penValue.points, { x, y, w, h, rotation, flipX, flipY })
            pts = pts.map((p) => translate(p, offset))
            if (pts.length >= 4) contours.push(genPenContour(pts, true))
            break
          }
          case 'polygon': {
            const polygonValue = value as IPolygonComponent
            let pts = transformPoints(polygonValue.points, { x, y, w, h, rotation, flipX, flipY })
            pts = pts.map((p) => translate(p, offset))
            if (pts.length >= 2) contours.push(genPolygonContour(pts, true))
            break
          }
          case 'rectangle': {
            const rectValue = value as IRectangleComponent
            let pts = transformPoints(
              getRectanglePoints(rectValue.width, rectValue.height, x, y),
              { x, y, w, h, rotation, flipX, flipY }
            )
            pts = pts.map((p) => translate(p, offset))
            if (pts.length >= 2) contours.push(genRectangleContour(pts, true))
            break
          }
          case 'ellipse': {
            const ellipseValue = value as IEllipseComponent
            let pts = getEllipsePoints(
              ellipseValue.radiusX,
              ellipseValue.radiusY,
              1000,
              x + ellipseValue.radiusX,
              y + ellipseValue.radiusY
            )
            pts = transformPoints(pts, { x, y, w, h, rotation, flipX, flipY })
            pts = pts.map((p) => translate(p, offset))
            if (pts.length >= 2) contours.push(genEllipseContour(pts, true))
            break
          }
          case 'glyph-pen':
          case 'glyph-polygon':
          case 'glyph-rectangle':
          case 'glyph-ellipse': {
            const scriptComp = component as any
            const ptsForBound = scriptComp.points && scriptComp.points.length > 0 ? scriptComp.points : null
            const bound = ptsForBound ? getBound(ptsForBound) : null
            const sx = scriptComp.x ?? bound?.x ?? x ?? 0
            const sy = scriptComp.y ?? bound?.y ?? y ?? 0
            const sw = scriptComp.w ?? scriptComp.width ?? bound?.w ?? w ?? 0
            const sh = scriptComp.h ?? scriptComp.height ?? bound?.h ?? h ?? 0
            const srot = scriptComp.rotation ?? rotation ?? 0
            const sflipX = scriptComp.flipX ?? flipX ?? false
            const sflipY = scriptComp.flipY ?? flipY ?? false
            const t = { x: sx, y: sy, w: sw, h: sh, rotation: srot, flipX: sflipX, flipY: sflipY }
            if (scriptComp.type === 'glyph-pen' && scriptComp.points?.length >= 4) {
              let pts = transformPoints(scriptComp.points, t)
              pts = pts.map((p) => translate(p, offset))
              contours.push(genPenContour(pts, true))
            } else if (scriptComp.type === 'glyph-polygon' && scriptComp.points?.length >= 2) {
              let pts = transformPoints(scriptComp.points, t)
              pts = pts.map((p) => translate(p, offset))
              contours.push(genPolygonContour(pts, true))
            } else if (scriptComp.type === 'glyph-rectangle' && (scriptComp.width != null || scriptComp.w != null) && (scriptComp.height != null || scriptComp.h != null)) {
              const rw = scriptComp.width ?? scriptComp.w ?? 0
              const rh = scriptComp.height ?? scriptComp.h ?? 0
              let pts = transformPoints(
                getRectanglePoints(rw, rh, sx, sy),
                t
              )
              pts = pts.map((p) => translate(p, offset))
              contours.push(genRectangleContour(pts, true))
            } else if (scriptComp.type === 'glyph-ellipse' && (scriptComp.radiusX != null || scriptComp.radiusY != null)) {
              const rx = scriptComp.radiusX ?? 0
              const ry = scriptComp.radiusY ?? 0
              let pts = getEllipsePoints(rx, ry, 1000, sx + rx, sy + ry)
              pts = transformPoints(pts, t)
              pts = pts.map((p) => translate(p, offset))
              contours.push(genEllipseContour(pts, true))
            }
            break
          }
          case 'glyph': {
            const glyphValue = value as ICustomGlyph
            const glyphComponent = component as IGlyphComponent
            const ox = glyphComponent.ox ?? 0
            const oy = glyphComponent.oy ?? 0
            const childOffset = { x: offset.x + ox, y: offset.y + oy }
            let scriptExecuted = false
            try {
              executeGlyphScript(glyphValue, component.uuid)
              scriptExecuted = true
            } catch {
              scriptExecuted = false
            }
            const instanceKey = component.uuid
            let glyphInstance: any = null
            if (scriptExecuted) {
              glyphInstance = instanceManager.acquireTemporaryInstance(
                instanceKey,
                () => new CustomGlyph(glyphValue),
                'glyph'
              )
            }
            const glyphComponents = glyphInstance?.components ?? glyphValue.components ?? []
            if (glyphComponents.length > 0) {
              const childContours = this.componentsToContoursEditing(
                glyphComponents as (IComponent | IGlyphComponent)[],
                childOffset
              )
              contours.push(...childContours)
            }
            if (glyphInstance && instanceManager.isTemporary(instanceKey)) {
              instanceManager.releaseTemporaryInstance(instanceKey)
            }
            break
          }
          default:
            break
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[ContourConverter] componentsToContoursEditing component error:', component.type, err)
        }
      }
    }
    return contours
  }

  /**
   * 将组件转换为轮廓（完整实现）
   * 如果组件已有轮廓数据，直接使用；否则计算轮廓
   */
  static componentsToContours(
    components: IComponent[],
    options: IConvertOptions,
    offset: { x: number; y: number } = { x: 0, y: 0 },
    solidFlagsOut?: boolean[]
  ): IContours {
    const contours: IContours = []
    const { preview = true, forceUpdate = false, grid, useSkeletonGrid = false } = options
    const scriptIsGlyph = options.isGlyph === true

    // 确保 advanceWidth 有默认值
    if (!options.advanceWidth) {
      options.advanceWidth = options.unitsPerEm
    }

    for (const component of components) {
      if (component.usedInCharacter === false) continue

      try {
      const { x, y, w, h, rotation, flipX, flipY } = component
      const value = component.value as any

      switch (component.type) {
        case 'pen': {
          const penValue = value as IPenComponent
          // 如果没有轮廓或强制更新，计算轮廓
          // 注意：脚本组件的 contour/preview 初始化为 []（空数组），空数组在 JS 中是 truthy，
          // 需要额外检查 length 以确保未计算时也触发重新计算
          if (!penValue.contour || !penValue.contour.length || forceUpdate) {
            let transformed_points = transformPoints(penValue.points, {
              x, y, w, h, rotation, flipX, flipY,
            })
            transformed_points = transformed_points.map((point) => {
              const p = translate(point, offset)
              if (grid && !useSkeletonGrid) {
                return computeCoords(grid, p)
              } else {
                return p
              }
            })
            const contour_points = formatPoints(transformed_points, {
              unitsPerEm: options.unitsPerEm,
              descender: options.descender,
              advanceWidth: options.advanceWidth || options.unitsPerEm,
            }, 1)
            const contour = genPenContour(contour_points)

            const scale = 100 / options.unitsPerEm
            const preview_points = transformed_points.map((point) => ({
              ...point,
              x: point.x * scale,
              y: point.y * scale,
            }))
            const preview_contour = genPenContour(preview_points, true)

            // 缓存计算结果到组件中
            penValue.preview = preview_contour as any
            penValue.contour = contour as any
          }
          // 根据 preview 选项返回对应的轮廓
          if (!preview) {
            contours.push(penValue.contour as IContour)
          } else {
            contours.push(penValue.preview as IContour)
          }
          solidFlagsOut?.push(false)
          break
        }

        case 'polygon': {
          const polygonValue = value as IPolygonComponent
          if (!polygonValue.contour || !polygonValue.contour.length || forceUpdate) {
            let transformed_points = transformPoints(polygonValue.points, {
              x, y, w, h, rotation, flipX, flipY,
            })
            transformed_points = transformed_points.map((point) => {
              const p = translate(point, offset)
              if (grid && !useSkeletonGrid) {
                return computeCoords(grid, p)
              } else {
                return p
              }
            })
            const contour_points = formatPoints(transformed_points, {
              unitsPerEm: options.unitsPerEm,
              descender: options.descender,
              advanceWidth: options.advanceWidth || options.unitsPerEm,
            }, 1)
            const contour = genPolygonContour(contour_points)

            const scale = 100 / options.unitsPerEm
            const preview_points = transformed_points.map((point) => ({
              ...point,
              x: point.x * scale,
              y: point.y * scale,
            }))
            const preview_contour = genPolygonContour(preview_points, true)

            polygonValue.preview = preview_contour as any
            polygonValue.contour = contour as any
          }
          if (!preview) {
            contours.push(polygonValue.contour as IContour)
          } else {
            contours.push(polygonValue.preview as IContour)
          }
          solidFlagsOut?.push(false)
          break
        }

        case 'rectangle': {
          const rectValue = value as IRectangleComponent
          if (!rectValue.contour || !rectValue.contour.length || forceUpdate) {
            let transformed_points = transformPoints(
              getRectanglePoints(rectValue.width, rectValue.height, x, y),
              { x, y, w, h, rotation, flipX, flipY }
            )
            transformed_points = transformed_points.map((point) => {
              const p = translate(point, offset)
              if (grid && !useSkeletonGrid) {
                return computeCoords(grid, p)
              } else {
                return p
              }
            })
            const contour_points = formatPoints(transformed_points, {
              unitsPerEm: options.unitsPerEm,
              descender: options.descender,
              advanceWidth: options.advanceWidth || options.unitsPerEm,
            }, 1)
            const contour = genRectangleContour(contour_points)

            const scale = 100 / options.unitsPerEm
            const preview_points = transformed_points.map((point) => ({
              ...point,
              x: point.x * scale,
              y: point.y * scale,
            }))
            const preview_contour = genRectangleContour(preview_points, true)

            rectValue.preview = preview_contour as any
            rectValue.contour = contour as any
          }
          if (!preview) {
            contours.push(rectValue.contour as IContour)
          } else {
            contours.push(rectValue.preview as IContour)
          }
          solidFlagsOut?.push(true)
          break
        }

        case 'ellipse': {
          const ellipseValue = value as IEllipseComponent
          if (!ellipseValue.contour || !ellipseValue.contour.length || forceUpdate) {
            let points = getEllipsePoints(
              ellipseValue.radiusX,
              ellipseValue.radiusY,
              1000,
              x + ellipseValue.radiusX,
              y + ellipseValue.radiusY
            )
            let transformed_points = transformPoints(points, {
              x, y, w, h, rotation, flipX, flipY,
            })
            transformed_points = transformed_points.map((point) => {
              const p = translate(point, offset)
              if (grid && !useSkeletonGrid) {
                return computeCoords(grid, p)
              } else {
                return p
              }
            })
            const contour_points = formatPoints(transformed_points, {
              unitsPerEm: options.unitsPerEm,
              descender: options.descender,
              advanceWidth: options.advanceWidth || options.unitsPerEm,
            }, 1)
            const contour = genEllipseContour(contour_points)

            const scale = 100 / options.unitsPerEm
            const preview_points = transformed_points.map((point) => ({
              ...point,
              x: point.x * scale,
              y: point.y * scale,
            }))
            const preview_contour = genEllipseContour(preview_points, true)

            ellipseValue.preview = preview_contour as any
            ellipseValue.contour = contour as any
          }
          if (!preview) {
            contours.push(ellipseValue.contour as IContour)
          } else {
            contours.push(ellipseValue.preview as IContour)
          }
          solidFlagsOut?.push(true)
          break
        }

        // 内置脚本组件类型（glyph-pen, glyph-polygon, glyph-rectangle, glyph-ellipse）
        case 'glyph-pen': {
          const scriptComp = component as any
          // 如果没有轮廓或强制更新，调用 updateData 生成
          if (!scriptComp.contour || !scriptComp.contour.length || forceUpdate) {
            if (!grid || useSkeletonGrid) {
              // 不使用布局调整或使用骨架布局调整的情况下，使用给定组件本身的数据
              if (typeof scriptComp.updateData === 'function') {
                scriptComp.updateData(scriptIsGlyph, offset)
              }
            } else {
              // 使用布局调整
              if (typeof scriptComp.updateData === 'function') {
                scriptComp.updateData(scriptIsGlyph, offset, grid)
              }
            }
          }
          // 根据 preview 选项返回对应的轮廓
          if (!preview) {
            if (scriptComp.contour && scriptComp.contour.length > 0) {
              contours.push(scriptComp.contour as IContour)
              solidFlagsOut?.push(false)
            }
          } else {
            if (scriptComp.preview && scriptComp.preview.length > 0) {
              contours.push(scriptComp.preview as IContour)
              solidFlagsOut?.push(false)
            }
          }
          break
        }

        case 'glyph-polygon': {
          const scriptComp = component as any
          // 如果没有轮廓或强制更新，调用 updateData 生成
          if (!scriptComp.contour || !scriptComp.contour.length || forceUpdate) {
            if (!grid || useSkeletonGrid) {
              if (typeof scriptComp.updateData === 'function') {
                scriptComp.updateData(scriptIsGlyph, offset)
              }
            } else {
              if (typeof scriptComp.updateData === 'function') {
                scriptComp.updateData(scriptIsGlyph, offset, grid)
              }
            }
          }
          if (!preview) {
            if (scriptComp.contour && scriptComp.contour.length > 0) {
              contours.push(scriptComp.contour as IContour)
              solidFlagsOut?.push(false)
            }
          } else {
            if (scriptComp.preview && scriptComp.preview.length > 0) {
              contours.push(scriptComp.preview as IContour)
              solidFlagsOut?.push(false)
            }
          }
          break
        }

        case 'glyph-rectangle': {
          const scriptComp = component as any
          // 如果没有轮廓或强制更新，调用 updateData 生成
          if (!scriptComp.contour || !scriptComp.contour.length || forceUpdate) {
            if (!grid || useSkeletonGrid) {
              if (typeof scriptComp.updateData === 'function') {
                scriptComp.updateData(scriptIsGlyph, offset)
              }
            } else {
              if (typeof scriptComp.updateData === 'function') {
                scriptComp.updateData(scriptIsGlyph, offset, grid)
              }
            }
          }
          if (!preview) {
            if (scriptComp.contour && scriptComp.contour.length > 0) {
              contours.push(scriptComp.contour as IContour)
              solidFlagsOut?.push(true)
            }
          } else {
            if (scriptComp.preview && scriptComp.preview.length > 0) {
              contours.push(scriptComp.preview as IContour)
              solidFlagsOut?.push(true)
            }
          }
          break
        }

        case 'glyph-ellipse': {
          const scriptComp = component as any
          // 如果没有轮廓或强制更新，调用 updateData 生成
          if (!scriptComp.contour || !scriptComp.contour.length || forceUpdate) {
            if (!grid || useSkeletonGrid) {
              if (typeof scriptComp.updateData === 'function') {
                scriptComp.updateData(scriptIsGlyph, offset)
              }
            } else {
              if (typeof scriptComp.updateData === 'function') {
                scriptComp.updateData(scriptIsGlyph, offset, grid)
              }
            }
          }
          if (!preview) {
            if (scriptComp.contour && scriptComp.contour.length > 0) {
              contours.push(scriptComp.contour as IContour)
              solidFlagsOut?.push(true)
            }
          } else {
            if (scriptComp.preview && scriptComp.preview.length > 0) {
              contours.push(scriptComp.preview as IContour)
              solidFlagsOut?.push(true)
            }
          }
          break
        }

        case 'glyph': {
          const glyphValue = value as ICustomGlyph
          const glyphComponent = component as IGlyphComponent
          const ox = glyphComponent.ox ?? 0
          const oy = glyphComponent.oy ?? 0
          const childOffset = { x: offset.x + ox, y: offset.y + oy }
          const instanceKey = component.uuid

          const releaseIfTemporary = () => {
            try {
              if (instanceManager.isTemporary(instanceKey)) {
                instanceManager.releaseTemporaryInstance(instanceKey)
              }
            } catch {
              /* ignore */
            }
          }

          try {
            try {
              executeGlyphScript(glyphValue, instanceKey)
            } catch (scriptError) {
              console.error(`Error executing glyph script for ${component.uuid}:`, scriptError)
            }

            const glyphInstance = instanceManager.acquireTemporaryInstance(
              instanceKey,
              () => new CustomGlyph(glyphValue),
              'glyph'
            ) as CustomGlyph | null

            const subSolidFlags: boolean[] | undefined = solidFlagsOut ? [] : undefined
            const childOptions = { ...options, forceUpdate: true }

            const useSkeleton =
              useSkeletonGrid &&
              grid &&
              glyphInstance &&
              typeof glyphInstance.getSkeleton === 'function' &&
              typeof glyphInstance.getComponentsBySkeleton === 'function'

            if (useSkeleton) {
              const _skeleton = glyphInstance!.getSkeleton!()
              const skeleton: Record<string, { x: number; y: number }> = {}
              for (const sk of Object.keys(_skeleton)) {
                const _joint = _skeleton[sk]
                const j = { x: _joint.x + childOffset.x, y: _joint.y + childOffset.y }
                skeleton[sk] = computeCoords(grid, j)
              }
              const components1 = glyphInstance!.getComponentsBySkeleton!(skeleton)
              const components2 = orderedListWithItemsForGlyph(glyphValue)
              const merged = components1.concat(components2 as IComponent[])
              const subContours = this.componentsToContours(
                merged,
                childOptions,
                { x: 0, y: 0 },
                subSolidFlags
              )
              contours.push(...subContours)
              if (subSolidFlags && solidFlagsOut) solidFlagsOut.push(...subSolidFlags)
            } else {
              const childList = (glyphInstance?.components ?? []) as IComponent[]
              if (childList.length > 0) {
                const subContours = this.componentsToContours(
                  childList,
                  childOptions,
                  childOffset,
                  subSolidFlags
                )
                contours.push(...subContours)
                if (subSolidFlags && solidFlagsOut) solidFlagsOut.push(...subSolidFlags)
              }
            }

            releaseIfTemporary()
          } catch (error) {
            console.error(`Error processing glyph component ${component.uuid}:`, error)
            releaseIfTemporary()
            if (glyphValue.components && glyphValue.components.length > 0) {
              const fb: boolean[] | undefined = solidFlagsOut ? [] : undefined
              const subContours = this.componentsToContours(
                glyphValue.components,
                { ...options, forceUpdate: true },
                childOffset,
                fb
              )
              contours.push(...subContours)
              if (fb && solidFlagsOut) solidFlagsOut.push(...fb)
            }
          }
          break
        }


        default: {
          // 未知类型的组件，返回空轮廓
          const emptyContour: IContour = []
          contours.push(emptyContour)
          solidFlagsOut?.push(false)
          break
        }
      }
      } catch (componentError) {
        // 单个组件转换失败，记录错误但继续处理其他组件
        console.error(`Error processing component ${component.uuid} (type: ${component.type}):`, componentError)
        // 跳过这个组件，不添加轮廓
      }
    }

    return contours
  }

  /**
   * 获取组件的填充颜色
   */
  static getFillColors(components: IComponent[]): string[] {
    const fillColors: string[] = []

    for (const component of components) {
      if (component.usedInCharacter === false) continue

      const raw = component as any
      const value = raw.value
      const fill =
        (value && value.fillColor) ||
        raw.fillColor ||
        '#000'
      fillColors.push(fill)
    }

    return fillColors
  }

  /**
   * 将轮廓转换为组件
   * 参考原工程实现，将轮廓数据转换为 pen 组件
   */
  static contoursToComponents(
    contours: IContours,
    options: {
      unitsPerEm: number
      descender: number
      advanceWidth: number
    }
  ): IComponent[] {
    // 轻量级 ID 生成器（简化版，使用计数器）
    let lightIdCounter = 0
    const genLightId = () => {
      lightIdCounter++
      return `light_${Date.now()}_${lightIdCounter}`
    }

    // 生成 pen 组件的辅助函数
    const genPenComponent = (points: any[], closePath: boolean = true): IComponent => {
      // 计算边界框
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const point of points) {
        minX = Math.min(minX, point.x)
        minY = Math.min(minY, point.y)
        maxX = Math.max(maxX, point.x)
        maxY = Math.max(maxY, point.y)
      }
      const x = minX
      const y = minY
      const w = maxX - minX
      const h = maxY - minY

      // 格式化点（从字体坐标转换为编辑坐标）
      const formattedPoints = formatPoints(points, options, 0)

      // 生成轮廓和预览
      const contour_points = formatPoints(formattedPoints, options, 1)
      const contour = genPenContour(contour_points)

      const scale = 100 / options.unitsPerEm
      const preview_points = formattedPoints.map((point: any) => ({
        ...point,
        x: point.x * scale,
        y: point.y * scale,
      }))
      const preview_contour = genPenContour(preview_points, true)

      return {
        uuid: genUUID(),
        type: 'pen',
        name: 'pen',
        lock: false,
        visible: true,
        x,
        y,
        w,
        h,
        rotation: 0,
        flipX: false,
        flipY: false,
        usedInCharacter: true,
        value: {
          points: formattedPoints,
          fillColor: '',
          strokeColor: '#000',
          closePath,
          editMode: false,
          preview: preview_contour,
          contour: contour,
        } as IPenComponent,
      }
    }

    const components: IComponent[] = []

    for (const contour of contours) {
      const points: any[] = []

      for (let i = 0; i < contour.length; i++) {
        const path = contour[i]

        if (i === 0) {
          // 第一个点作为锚点
          points.push({
            uuid: genLightId(),
            x: path.start.x,
            y: path.start.y,
            type: 'anchor',
            origin: null,
            isShow: true,
          })
        }

        switch (path.type) {
          case PathType.LINE: {
            const control1 = {
              uuid: genLightId(),
              x: path.start.x,
              y: path.start.y,
              type: 'control',
              origin: points[points.length - 1].uuid,
              isShow: true,
            }
            const anchor2 = {
              uuid: genLightId(),
              x: path.end.x,
              y: path.end.y,
              type: 'anchor',
              origin: null,
              isShow: true,
            }
            const control2 = {
              uuid: genLightId(),
              x: path.end.x,
              y: path.end.y,
              type: 'control',
              origin: anchor2.uuid,
              isShow: true,
            }
            points.push(control1, control2, anchor2)
            break
          }

          case PathType.QUADRATIC_BEZIER: {
            const qPath = path as any
            const control1 = {
              uuid: genLightId(),
              x: qPath.start.x + (2 / 3) * (qPath.control.x - qPath.start.x),
              y: qPath.start.y + (2 / 3) * (qPath.control.y - qPath.start.y),
              type: 'control',
              origin: points[points.length - 1].uuid,
              isShow: true,
            }
            const anchor2 = {
              uuid: genLightId(),
              x: qPath.end.x,
              y: qPath.end.y,
              type: 'anchor',
              origin: null,
              isShow: true,
            }
            const control2 = {
              uuid: genLightId(),
              x: qPath.end.x + (2 / 3) * (qPath.control.x - qPath.end.x),
              y: qPath.end.y + (2 / 3) * (qPath.control.y - qPath.end.y),
              type: 'control',
              origin: anchor2.uuid,
              isShow: true,
            }
            points.push(control1, control2, anchor2)
            break
          }

          case PathType.CUBIC_BEZIER: {
            const cPath = path as any
            const control1 = {
              uuid: genLightId(),
              x: cPath.control1.x,
              y: cPath.control1.y,
              type: 'control',
              origin: points[points.length - 1].uuid,
              isShow: true,
            }
            const anchor2 = {
              uuid: genLightId(),
              x: cPath.end.x,
              y: cPath.end.y,
              type: 'anchor',
              origin: null,
              isShow: true,
            }
            const control2 = {
              uuid: genLightId(),
              x: cPath.control2.x,
              y: cPath.control2.y,
              type: 'control',
              origin: anchor2.uuid,
              isShow: true,
            }
            points.push(control1, control2, anchor2)
            break
          }
        }
      }

      // 如果路径未闭合，添加闭合点
      if (points.length > 0 && 
          (points[points.length - 1].x !== points[0].x || points[points.length - 1].y !== points[0].y)) {
        points.push({
          uuid: genLightId(),
          x: points[points.length - 1].x,
          y: points[points.length - 1].y,
          type: 'control',
          origin: points[points.length - 1].uuid,
          isShow: true,
        })
        points.push({
          uuid: genLightId(),
          x: points[0].x,
          y: points[0].y,
          type: 'control',
          origin: points[0].uuid,
          isShow: true,
        })
        points.push({
          uuid: genLightId(),
          x: points[0].x,
          y: points[0].y,
          type: 'anchor',
          origin: points[0].uuid,
          isShow: true,
        })
      }

      // 生成组件
      const component = genPenComponent(points, true)
      components.push(component)
    }

    return components
  }
}
