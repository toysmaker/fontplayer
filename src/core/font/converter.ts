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
  static async componentsToContoursEditing(
    components: (IComponent | IGlyphComponent)[],
    offset: { x: number; y: number } = { x: 0, y: 0 }
  ): Promise<IContours> {
    const contours: IContours = []
    const scriptTypes = ['glyph-pen', 'glyph-polygon', 'glyph-rectangle', 'glyph-ellipse']
    for (const component of components) {
      if (!component.usedInCharacter) continue
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
            const { executeGlyphScript } = await import('../script/ScriptExecutor')
            const { instanceManager } = await import('../instance/InstanceManager')
            const { CustomGlyph } = await import('../instance/CustomGlyph')
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
              const childContours = await this.componentsToContoursEditing(
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
  static async componentsToContours(
    components: IComponent[],
    options: IConvertOptions,
    offset: { x: number; y: number } = { x: 0, y: 0 },
    solidFlagsOut?: boolean[]
  ): Promise<IContours> {
    const contours: IContours = []
    const { preview = true, forceUpdate = false, grid, useSkeletonGrid = false } = options
    
    // 确保 advanceWidth 有默认值
    if (!options.advanceWidth) {
      options.advanceWidth = options.unitsPerEm
    }

    for (const component of components) {
      if (!component.usedInCharacter) continue

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
                scriptComp.updateData(true, offset)
              }
            } else {
              // 使用布局调整
              if (typeof scriptComp.updateData === 'function') {
                scriptComp.updateData(true, offset, grid)
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
                scriptComp.updateData(true, offset)
              }
            } else {
              if (typeof scriptComp.updateData === 'function') {
                scriptComp.updateData(true, offset, grid)
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
                scriptComp.updateData(true, offset)
              }
            } else {
              if (typeof scriptComp.updateData === 'function') {
                scriptComp.updateData(true, offset, grid)
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
                scriptComp.updateData(true, offset)
              }
            } else {
              if (typeof scriptComp.updateData === 'function') {
                scriptComp.updateData(true, offset, grid)
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
          // 字形组件需要执行脚本生成子组件，然后递归处理
          const glyphValue = value as ICustomGlyph
          const glyphComponent = component as IGlyphComponent
          
          // 调试：检查字形组件的参数
          if (import.meta.env.DEV) {
            console.log(`[ContourConverter] Processing glyph component ${component.uuid}:`, {
              glyphUUID: glyphValue.uuid,
              glyphName: glyphValue.name,
              hasParameters: !!glyphValue.parameters,
              parametersCount: glyphValue.parameters?.length || 0,
              parameters: glyphValue.parameters?.map((p: any) => ({ name: p.name, value: p.value })) || [],
              scriptReference: glyphValue.script_reference,
            })
          }
          
          // 注意：如果 preview=true，轮廓坐标已经是缩放后的，所以 ox 和 oy 也需要缩放
          const previewScale = preview ? 100 / options.unitsPerEm : 1
          const ox = (glyphComponent.ox || 0) * previewScale
          const oy = (glyphComponent.oy || 0) * previewScale
          const instanceKeyForRelease = component.uuid

          try {
            // 导入脚本执行器和实例管理器（动态导入避免循环依赖）
            const { executeGlyphScript } = await import('../script/ScriptExecutor')
            const { instanceManager } = await import('../instance/InstanceManager')
            const { CustomGlyph } = await import('../instance/CustomGlyph')
            
            // 执行脚本生成子组件（捕获错误，避免中断整个转换过程）
            // 使用 component.uuid 作为实例key，确保每个组件有独立的 glyph 实例
            // 这样即使多个组件引用同一个 glyph 模板，它们也会有独立的参数
            let scriptExecuted = false
            try {
              executeGlyphScript(glyphValue, component.uuid)
              scriptExecuted = true
            } catch (scriptError) {
              console.error(`Error executing glyph script for ${component.uuid}:`, scriptError)
              // 脚本执行失败，继续尝试使用数据中的组件
              scriptExecuted = false
            }
            
            // 获取字形实例（脚本执行后实例应该还在，因为 ScriptExecutor 不会立即释放）
            // 使用 component.uuid 作为实例key，确保每个组件有独立的实例
            const instanceKey = component.uuid
            let glyphInstance: any = null
            let wasInstanceCreatedHere = false
            
            // 从实例池获取（脚本执行后实例应该在池中）
            if (scriptExecuted) {
              // 检查实例池中是否已有实例（脚本执行时创建的）
              const hadInstanceBefore = instanceManager.isTemporary(instanceKey)
              // 尝试从实例池获取（acquireTemporaryInstance 会返回已存在的实例）
              glyphInstance = instanceManager.acquireTemporaryInstance(
                instanceKey,
                () => new CustomGlyph(glyphValue),
                'glyph'
              )
              // 如果实例池中原本没有实例，说明是新创建的
              wasInstanceCreatedHere = !hadInstanceBefore
            }
            
            // 检查实例是否有脚本生成的组件
            const _componentsCount = (glyphInstance as any)?._components?.length || 0
            const componentsCount = (glyphInstance as any)?.components?.length || 0
            const hasScriptComponents = glyphInstance && scriptExecuted &&
              (_componentsCount > 0 || componentsCount > 0)
            
            console.log(`Checking glyph ${component.uuid}: scriptExecuted=${scriptExecuted}, hasInstance=${!!glyphInstance}, _components=${_componentsCount}, components=${componentsCount}, hasScriptComponents=${hasScriptComponents}`)
            
            if (hasScriptComponents) {
              // 有脚本生成的组件，使用脚本组件
              // 获取脚本生成的组件（从字形实例中获取）
              const glyphComponents = (glyphInstance as any).components || []
              
              console.log(`Processing ${glyphComponents.length} script components for glyph ${component.uuid}`)
              
              if (glyphComponents.length > 0) {
                // 有脚本生成的组件，处理这些组件
                for (let i = 0; i < glyphComponents.length; i++) {
                  const scriptComp = glyphComponents[i]
                  // 详细检查组件的数据结构
                  console.log(`Component ${i}: type=${scriptComp.type}, hasContour=${!!scriptComp.contour}, hasPreview=${!!scriptComp.preview}`)
                  console.log(`  Full component data:`, {
                    type: scriptComp.type,
                    points: scriptComp.points?.length || 0,
                    preview: scriptComp.preview?.length || 0,
                    contour: scriptComp.contour?.length || 0,
                    hasPathBegan: scriptComp.hasPathBegan,
                    // 检查其他可能的属性
                    x: scriptComp.x,
                    y: scriptComp.y,
                    width: scriptComp.width,
                    height: scriptComp.height,
                    centerX: scriptComp.centerX,
                    centerY: scriptComp.centerY,
                    radiusX: scriptComp.radiusX,
                    radiusY: scriptComp.radiusY,
                  })
                  
                  // 检查是否是脚本生成的组件（PenComponent, PolygonComponent 等）
                  if (scriptComp.type && scriptComp.type.startsWith('glyph-')) {
                    // 检查组件是否有 points 数据
                    const hasPoints = scriptComp.points && Array.isArray(scriptComp.points) && scriptComp.points.length >= 4
                    const hasPreview = scriptComp.preview && Array.isArray(scriptComp.preview) && scriptComp.preview.length > 0
                    const hasContour = scriptComp.contour && Array.isArray(scriptComp.contour) && scriptComp.contour.length > 0
                    
                    console.log(`  Component ${i}: points=${scriptComp.points?.length || 0}, preview=${scriptComp.preview?.length || 0}, contour=${scriptComp.contour?.length || 0}`)
                    
                    // 如果组件没有 preview 或 contour，但有点数据，尝试调用 updateData 生成
                    if (hasPoints && !hasPreview && !hasContour) {
                      if (typeof scriptComp.updateData === 'function') {
                        console.log(`  Calling updateData for component ${i} with ${scriptComp.points.length} points`)
                        try {
                          scriptComp.updateData(true, { x: 0, y: 0 })
                          console.log(`  After updateData: preview=${scriptComp.preview?.length || 0}, contour=${scriptComp.contour?.length || 0}`)
                        } catch (error) {
                          console.error(`  Error calling updateData for component ${i}:`, error)
                        }
                      } else {
                        console.warn(`  Component ${i} has no updateData method`)
                      }
                    } else if (!hasPoints) {
                      // 如果没有 points，检查组件是否有其他数据可以用来生成轮廓
                      // 例如：RectangleComponent 有 x, y, width, height
                      // EllipseComponent 有 centerX, centerY, radiusX, radiusY
                      if (scriptComp.type === 'glyph-rectangle' && 
                          scriptComp.x !== undefined && scriptComp.y !== undefined &&
                          scriptComp.width !== undefined && scriptComp.height !== undefined) {
                        // RectangleComponent 有数据，尝试调用 updateData
                        if (typeof scriptComp.updateData === 'function') {
                          console.log(`  Calling updateData for rectangle component ${i}`)
                          try {
                            scriptComp.updateData(true, { x: 0, y: 0 })
                            console.log(`  After updateData: preview=${scriptComp.preview?.length || 0}, contour=${scriptComp.contour?.length || 0}`)
                          } catch (error) {
                            console.error(`  Error calling updateData for component ${i}:`, error)
                          }
                        }
                      } else if (scriptComp.type === 'glyph-ellipse' &&
                                 scriptComp.centerX !== undefined && scriptComp.centerY !== undefined &&
                                 scriptComp.radiusX !== undefined && scriptComp.radiusY !== undefined) {
                        // EllipseComponent 有数据，尝试调用 updateData
                        if (typeof scriptComp.updateData === 'function') {
                          console.log(`  Calling updateData for ellipse component ${i}`)
                          try {
                            scriptComp.updateData(true, { x: 0, y: 0 })
                            console.log(`  After updateData: preview=${scriptComp.preview?.length || 0}, contour=${scriptComp.contour?.length || 0}`)
                          } catch (error) {
                            console.error(`  Error calling updateData for component ${i}:`, error)
                          }
                        }
                      } else {
                        console.warn(`  Component ${i} (type: ${scriptComp.type}) has insufficient data, cannot generate contour`)
                      }
                    }
                    
                    // 脚本组件已经有轮廓数据（在脚本执行时计算）
                    if (scriptComp.contour || scriptComp.preview) {
                      const scriptContour = preview ? scriptComp.preview : scriptComp.contour
                      console.log(`  Using ${preview ? 'preview' : 'contour'}, segments: ${scriptContour?.length || 0}`)
                      if (scriptContour && Array.isArray(scriptContour) && scriptContour.length > 0) {
                        // 转换脚本组件的轮廓格式并应用偏移
                        const convertedContour: IContour = scriptContour.map((seg: any) => {
                          if (seg.type === PathType.LINE || seg.type === 'line' || seg.type === 'LINE') {
                            return {
                              type: PathType.LINE,
                              start: { x: seg.start.x + ox, y: seg.start.y + oy },
                              end: { x: seg.end.x + ox, y: seg.end.y + oy },
                            }
                          } else if (seg.type === PathType.QUADRATIC_BEZIER || seg.type === 'quadratic' || seg.type === 'QUADRATIC_BEZIER') {
                            return {
                              type: PathType.QUADRATIC_BEZIER,
                              start: { x: seg.start.x + ox, y: seg.start.y + oy },
                              end: { x: seg.end.x + ox, y: seg.end.y + oy },
                              control: { x: seg.control.x + ox, y: seg.control.y + oy },
                            }
                          } else if (seg.type === PathType.CUBIC_BEZIER || seg.type === 'cubic' || seg.type === 'CUBIC_BEZIER') {
                            return {
                              type: PathType.CUBIC_BEZIER,
                              start: { x: seg.start.x + ox, y: seg.start.y + oy },
                              end: { x: seg.end.x + ox, y: seg.end.y + oy },
                              control1: { x: seg.control1.x + ox, y: seg.control1.y + oy },
                              control2: { x: seg.control2.x + ox, y: seg.control2.y + oy },
                            }
                          }
                          return null
                        }).filter((c): c is IContour[number] => c !== null)
                        console.log(`  Converted ${convertedContour.length} segments`)
                        if (convertedContour.length > 0) {
                          contours.push(convertedContour)
                          const isSolid = scriptComp.type === 'glyph-rectangle' || scriptComp.type === 'glyph-ellipse'
                          solidFlagsOut?.push(isSolid)
                        }
                      } else {
                        console.warn(`  Script contour is empty or invalid`)
                      }
                    } else {
                      console.warn(`  Component has no contour or preview`)
                    }
                  } else {
                    // 不是脚本组件，可能是子字形组件，递归处理
                    console.log(`  Not a script component (type: ${scriptComp.type}), checking if it's a glyph component`)
                    if (scriptComp.type === 'glyph' && scriptComp.value) {
                      const subGlyphValue = scriptComp.value as ICustomGlyph
                      const subSolidFlags: boolean[] | undefined = solidFlagsOut ? [] : undefined
                      const subContours = await this.componentsToContours(
                        subGlyphValue.components || [],
                        options,
                        { x: offset.x + ox + (scriptComp.ox || 0), y: offset.y + oy + (scriptComp.oy || 0) },
                        subSolidFlags
                      )
                      contours.push(...subContours)
                      if (subSolidFlags) solidFlagsOut!.push(...subSolidFlags)
                    }
                  }
                }
              }
              
              console.log(`Generated ${contours.length} contours from script components for glyph ${component.uuid}`)
              
              // 用完后立即释放，避免递归时实例数超过池容量导致 LRU 误删仍在用的父级实例
              if (glyphInstance && instanceManager.isTemporary(instanceKey)) {
                instanceManager.releaseTemporaryInstance(instanceKey)
              }
              break
            } else {
              // 没有脚本组件或脚本执行失败，使用数据中的组件
              if (glyphValue.components && glyphValue.components.length > 0) {
                console.log(`Using fallback components for glyph ${component.uuid}, count: ${glyphValue.components.length}`)
                const subSolidFlags1: boolean[] | undefined = solidFlagsOut ? [] : undefined
                const subContours = await this.componentsToContours(
                  glyphValue.components,
                  options,
                  { x: offset.x + ox, y: offset.y + oy },
                  subSolidFlags1
                )
                contours.push(...subContours)
                if (subSolidFlags1) solidFlagsOut!.push(...subSolidFlags1)
              } else {
                console.warn(`No components available for glyph ${component.uuid} (scriptExecuted: ${scriptExecuted}, hasInstance: ${!!glyphInstance})`)
              }
              if (glyphInstance && instanceManager.isTemporary(instanceKey)) {
                instanceManager.releaseTemporaryInstance(instanceKey)
              }
              break
            }
            
            // 获取脚本生成的组件（从字形实例中获取）
            // 注意：字形实例的 _components 是脚本执行时通过 addComponent 添加的组件
            // 而 glyphValue.components 是字形数据中存储的组件
            // 脚本执行后，应该使用 glyphInstance.components（包含两者）
            // CustomGlyph 的 components getter 会合并 orderedList 中的组件和 _components
            const glyphComponents = (glyphInstance as any).components || []
            
            if (glyphComponents.length > 0) {
              // 有脚本生成的组件，处理这些组件
              for (const scriptComp of glyphComponents) {
                // 检查是否是脚本生成的组件（PenComponent, PolygonComponent 等）
                if (scriptComp.type && scriptComp.type.startsWith('glyph-')) {
                  // 脚本组件已经有轮廓数据（在脚本执行时计算）
                  if (scriptComp.contour || scriptComp.preview) {
                    const scriptContour = preview ? scriptComp.preview : scriptComp.contour
                    if (scriptContour && Array.isArray(scriptContour) && scriptContour.length > 0) {
                      // 转换脚本组件的轮廓格式并应用偏移
                      const convertedContour: IContour = scriptContour.map((seg: any) => {
                        if (seg.type === PathType.LINE || seg.type === 'line' || seg.type === 'LINE') {
                          return {
                            type: PathType.LINE,
                            start: { x: seg.start.x + ox, y: seg.start.y + oy },
                            end: { x: seg.end.x + ox, y: seg.end.y + oy },
                          }
                        } else if (seg.type === PathType.QUADRATIC_BEZIER || seg.type === 'quadratic' || seg.type === 'QUADRATIC_BEZIER') {
                          return {
                            type: PathType.QUADRATIC_BEZIER,
                            start: { x: seg.start.x + ox, y: seg.start.y + oy },
                            end: { x: seg.end.x + ox, y: seg.end.y + oy },
                            control: { x: seg.control.x + ox, y: seg.control.y + oy },
                          }
                        } else if (seg.type === PathType.CUBIC_BEZIER || seg.type === 'cubic' || seg.type === 'CUBIC_BEZIER') {
                          return {
                            type: PathType.CUBIC_BEZIER,
                            start: { x: seg.start.x + ox, y: seg.start.y + oy },
                            end: { x: seg.end.x + ox, y: seg.end.y + oy },
                            control1: { x: seg.control1.x + ox, y: seg.control1.y + oy },
                            control2: { x: seg.control2.x + ox, y: seg.control2.y + oy },
                          }
                        }
                        return null
                      }).filter((c): c is IContour[number] => c !== null)
                      if (convertedContour.length > 0) {
                        contours.push(convertedContour)
                      }
                    }
                  }
                } else if (scriptComp.type === 'glyph') {
                  // 如果是字形组件，递归处理
                  const subContours = await this.componentsToContours(
                    [scriptComp],
                    options,
                    { x: offset.x + ox, y: offset.y + oy }
                  )
                  contours.push(...subContours)
                } else {
                  // 其他类型的组件，尝试作为普通组件处理
                  const subContours = await this.componentsToContours(
                    [scriptComp as IComponent],
                    options,
                    { x: offset.x + ox, y: offset.y + oy }
                  )
                  contours.push(...subContours)
                }
              }
            } else {
              // 没有脚本生成的组件，使用数据中的组件
              const dataComponents = glyphValue.components || []
              if (dataComponents.length > 0) {
                const subContours = await this.componentsToContours(
                  dataComponents,
                  options,
                  { x: offset.x + ox, y: offset.y + oy }
                )
                contours.push(...subContours)
              }
            }
            
            // 用完后立即释放，避免递归深度大时实例数超过池容量导致 LRU 误删仍在用的实例
            if (glyphInstance && instanceManager.isTemporary(instanceKey)) {
              instanceManager.releaseTemporaryInstance(instanceKey)
            }
          } catch (error) {
            console.error(`Error processing glyph component ${component.uuid}:`, error)
            try {
              const { instanceManager: im } = await import('../instance/InstanceManager')
              if (im.isTemporary(instanceKeyForRelease)) im.releaseTemporaryInstance(instanceKeyForRelease)
            } catch (_) { /* ignore */ }
            // 如果脚本执行失败，尝试使用已有的组件数据
            if (glyphValue.components && glyphValue.components.length > 0) {
              const subSolidFlags2: boolean[] | undefined = solidFlagsOut ? [] : undefined
              const subContours = await this.componentsToContours(
                glyphValue.components,
                options,
                { x: offset.x + ox, y: offset.y + oy },
                subSolidFlags2
              )
              contours.push(...subContours)
              if (subSolidFlags2) solidFlagsOut!.push(...subSolidFlags2)
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
      if (!component.usedInCharacter) continue

      const value = component.value as any

      if (component.type === 'glyph') {
        // 如果是字形组件，需要展开其子组件
        // TODO: 实现字形组件的展开逻辑
        fillColors.push(value.fillColor || '#000')
      } else {
        fillColors.push(value.fillColor || '#000')
      }
    }

    return fillColors
  }

  /**
   * 将轮廓转换为组件
   * 参考原工程实现，将轮廓数据转换为 pen 组件
   */
  static async contoursToComponents(
    contours: IContours,
    options: {
      unitsPerEm: number
      descender: number
      advanceWidth: number
    }
  ): Promise<IComponent[]> {
    // 导入必要的工具函数
    const { genUUID } = await import('@/utils/uuid')
    const { formatPoints, genPenContour } = await import('../utils/contour')
    
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
