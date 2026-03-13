/**
 * 编辑器画布渲染器
 * 用于字符编辑界面和字形编辑界面的画布渲染
 */

import type { IComponent, ICharacterFileLite, ICustomGlyph, IPenComponent, IPolygonComponent, IRectangleComponent, IEllipseComponent, IPictureComponent, IGlyphComponent } from '../types'
import type { IBackground, IGrid, IRenderOptions } from './types'
import { BackgroundType, GridType } from './types'
import { mapCanvasX, mapCanvasY, mapCanvasWidth, mapCanvasHeight, mapCanvasCoords } from '@/utils/canvas'
import { transformPoints, getBound } from '../utils/math'
import { getStrokeWidth } from '@/utils/canvas-utils'
import { mesh } from './background/mesh'
import { transparent } from './background/transparent'
import { layoutGrid } from './background/layoutGrid'
import { executeGlyphScript } from '../script/ScriptExecutor'
import { CustomGlyph } from '../instance/CustomGlyph'
import { fontRenderStyle } from '../script/globals'
import { orderedListWithItemsForGlyph } from '../utils/glyph'
import { instanceManager } from '../instance/InstanceManager'
import { editModeFixedBounds } from '@/features/tools/select/PenSelectTool'

/**
 * 清空画布
 */
function clearCanvas(canvas: HTMLCanvasElement): void {
  // 使用 willReadFrequently 选项来优化频繁的 getImageData 调用
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

/**
 * 填充背景
 */
export function fillBackground(canvas: HTMLCanvasElement, background: IBackground, grid: IGrid): void {
  const width = canvas.width
  const height = canvas.height
  // 使用 willReadFrequently 选项来优化频繁的 getImageData 调用
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  
  if (background.type === BackgroundType.Color) {
    ctx.fillStyle = background.color
    ctx.fillRect(0, 0, width, height)
  }
  if (background.type === BackgroundType.Transparent) {
    transparent(canvas)
  }

  if (grid.type === GridType.Mesh) {
    mesh(canvas, grid.precision)
  } else if (grid.type === GridType.LayoutGrid) {
    layoutGrid(canvas)
  }
}

/**
 * 渲染画布
 * 注意：原工程中这个函数是同步的，但由于我们需要执行字形脚本（async），所以这里保持 async
 */
export function renderCanvas(
  components: Array<IComponent>,
  canvas: HTMLCanvasElement,
  options: IRenderOptions = {
    fill: false,
    offset: { x: 0, y: 0 },
    scale: 1,
    forceUpdate: false,
  }
): Promise<void> {
  const scale = options.scale || 1
  // 使用 willReadFrequently 选项来优化频繁的 getImageData 调用
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  
  let currentPathStarted = false
  
  if (import.meta.env.DEV) {
    console.log('[EditorCanvasRenderer.renderCanvas] Starting render:', {
      componentsCount: components.length,
      canvasSize: { width: canvas.width, height: canvas.height },
      scale,
      offset: options.offset
    })
  }
  
  // 按组件列表顺序渲染所有组件
  for (const component of components) {
    // 如果组件不可见则跳过
    if (!component || component.visible === null || component.visible === undefined || !component.visible) {
      if (import.meta.env.DEV) {
        console.log('[EditorCanvasRenderer.renderCanvas] Skipping invisible component:', component.type, component.uuid)
      }
      continue
    }
    
    if (import.meta.env.DEV) {
      console.log('[EditorCanvasRenderer.renderCanvas] Rendering component:', {
        type: component.type,
        uuid: component.uuid,
        visible: component.visible
      })
    }

    // 渲染图片组件
    if (component.type === 'picture') {
      // 如果有未完成的路径，先绘制它
      if (currentPathStarted) {
        ctx.closePath()
        if (fontRenderStyle.value === 'color') {
          ctx.fillStyle = (component.value as unknown as IGlyphComponent).fillColor || '#000'
          ctx.strokeStyle = (component.value as unknown as IGlyphComponent).fillColor || '#000'
          ctx.fill("nonzero")
        } else if (fontRenderStyle.value === 'black' || options.fill) {
          ctx.fillStyle = '#000'
          ctx.strokeStyle = '#000'
          ctx.fill("nonzero")
        } else {
          ctx.strokeStyle = '#000'
        }
        ctx.stroke()
        currentPathStarted = false
      }
      
      const { x, y, w, h, rotation } = component
      const _x = mapCanvasX(x) * scale
      const _y = mapCanvasY(y) * scale
      const _w = mapCanvasWidth(w) * scale
      const _h = mapCanvasHeight(h) * scale
      const {
        img,
        pixelMode,
        pixels,
      } = component.value as IPictureComponent
      
      if (!pixelMode) {
        if (component.opacity) {
          ctx.globalAlpha = component.opacity
        }
        ctx.translate(mapCanvasX(options.offset?.x || 0), mapCanvasY(options.offset?.y || 0))
        ctx.translate(_x + _w / 2, _y + _h / 2)
        ctx.rotate(rotation * Math.PI / 180)
        ctx.translate(-(_x + _w / 2), -(_y + _h / 2))
        ctx.drawImage(img, _x, _y, _w, _h)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        if (component.opacity) {
          ctx.globalAlpha = 1.0
        }
      } else {
        if (component.opacity) {
          ctx.globalAlpha = component.opacity
        }
        ctx.translate(mapCanvasX(options.offset?.x || 0), mapCanvasY(options.offset?.y || 0))
        ctx.translate(_x + _w / 2, _y + _h / 2)
        ctx.rotate(rotation * Math.PI / 180)
        ctx.translate(-(_x + _w / 2), -(_y + _h / 2))
        for (let i = 0; i < _w; i++) {
          for (let j = 0; j < _h; j++) {
            const originWidth = img.width
            const originHeight = img.height
            const col = Math.floor(i * originWidth / _w) 
            const row = Math.floor(j * originHeight / _h)
            const index = (row * originWidth + col) * 4
            ctx.fillStyle = `rgba(${pixels[index]}, ${pixels[index + 1]}, ${pixels[index + 2]}, ${pixels[index + 3]})`
            ctx.fillRect(i, j, 1, 1)
          }
        }
        if (component.opacity) {
          ctx.globalAlpha = 1.0
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      }
      continue
    }

    // 渲染字形组件
    if (component.type === 'glyph') {
      // 如果有未完成的路径，先绘制它
      if (currentPathStarted) {
        ctx.closePath()
        if (fontRenderStyle.value === 'color') {
          ctx.fillStyle = (component.value as unknown as IGlyphComponent).fillColor || '#000'
          ctx.strokeStyle = (component.value as unknown as IGlyphComponent).fillColor || '#000'
          ctx.fill("nonzero")
        } else if (fontRenderStyle.value === 'black' || options.fill) {
          ctx.fillStyle = '#000'
          ctx.strokeStyle = '#000'
          ctx.fill("nonzero")
        } else {
          ctx.strokeStyle = '#000'
        }
        ctx.stroke()
        currentPathStarted = false
      }
      
      const glyphValue = component.value as unknown as ICustomGlyph
      
      // 执行字形脚本（如果需要）
      // 使用 component.uuid 作为实例 key，确保与 ScriptExecutor 使用相同的 key
      // 注意：字符编辑界面使用 component.uuid，字形编辑界面使用 glyph.uuid
      // 这样可以确保同一个字形在不同场景下使用不同的实例，避免冲突
      const instanceKey = component.uuid
      
      if (import.meta.env.DEV) {
        console.log('[EditorCanvasRenderer.renderCanvas] Rendering glyph component:', {
          componentUUID: component.uuid,
          glyphUUID: glyphValue.uuid,
          glyphName: glyphValue.name,
          instanceKey,
          usingComponentUUID: true, // 明确标识使用 component.uuid
          isEditing: instanceManager.isEditing(instanceKey),
          isTemporary: instanceManager.isTemporary(instanceKey),
          glyphIsEditing: instanceManager.isEditing(glyphValue.uuid),
          glyphIsTemporary: instanceManager.isTemporary(glyphValue.uuid)
        })
      }
      
      // 检查实例是否已有脚本生成的组件
      let glyphInstance: CustomGlyph | null = null
      if (instanceManager.isTemporary(instanceKey)) {
        // 如果实例已存在（可能是之前脚本执行创建的），直接获取
        glyphInstance = instanceManager.acquireTemporaryInstance(
          instanceKey,
          () => new CustomGlyph(glyphValue),
          'glyph'
        ) as CustomGlyph
        
        if (import.meta.env.DEV) {
          const hasTempData = !!glyphInstance.tempData
          const componentsCount = glyphInstance._components?.length || 0
          console.log('[EditorCanvasRenderer] Instance exists:', {
            instanceKey,
            hasTempData,
            componentsCount,
            forceUpdate: options.forceUpdate
          })
        }
      } else {
        // 如果实例不存在，先执行脚本创建实例
        if (import.meta.env.DEV) {
          console.log('[EditorCanvasRenderer] Instance not exists, creating:', instanceKey)
        }
        executeGlyphScript(glyphValue, instanceKey)
        // 脚本执行后，获取实例
        glyphInstance = instanceManager.acquireTemporaryInstance(
          instanceKey,
          () => new CustomGlyph(glyphValue),
          'glyph'
        ) as CustomGlyph
      }
      
      // 如果实例没有脚本生成的组件，执行脚本
      // 但是，如果实例有 tempData（正在拖拽中），不应该执行脚本（避免重置拖拽修改）
      const hasTempData = !!glyphInstance.tempData
      const needsScriptExecution = (!glyphInstance._components ||
        !glyphInstance._components.length ||
        options.forceUpdate) && !hasTempData
      
      if (import.meta.env.DEV) {
        console.log('[EditorCanvasRenderer] Checking script execution:', {
          instanceKey,
          hasComponents: !!glyphInstance._components?.length,
          componentsCount: glyphInstance._components?.length || 0,
          hasTempData,
          needsScriptExecution,
          forceUpdate: options.forceUpdate,
          willSkipDueToTempData: hasTempData && (!glyphInstance._components || !glyphInstance._components.length || options.forceUpdate)
        })
      }
      
      if (needsScriptExecution) {
        console.log('[EditorCanvasRenderer] ✅ Calling executeGlyphScript during render (no tempData):', {
          instanceKey,
          hasTempData: false,
          needsScriptExecution,
          forceUpdate: options.forceUpdate
        })
        executeGlyphScript(glyphValue, instanceKey)
      } else if (hasTempData && (!glyphInstance._components || !glyphInstance._components.length || options.forceUpdate)) {
        console.log('[EditorCanvasRenderer] ⚠️ SKIPPING executeGlyphScript due to tempData (drag in progress):', {
          instanceKey,
          hasTempData: true,
          tempDataKeys: glyphInstance.tempData ? Object.keys(glyphInstance.tempData) : [],
          wouldNeedExecution: !glyphInstance._components || !glyphInstance._components.length || options.forceUpdate
        })
        // 脚本执行后，重新获取实例
        glyphInstance = instanceManager.acquireTemporaryInstance(
          instanceKey,
          () => new CustomGlyph(glyphValue),
          'glyph'
        ) as CustomGlyph
        
        if (import.meta.env.DEV) {
          console.log('[EditorCanvasRenderer] After script execution:', {
            instanceKey,
            componentsCount: glyphInstance._components?.length || 0,
            hasTempData: !!glyphInstance.tempData
          })
        }
      }
      
      // 直接调用字形实例的 render 方法（与原工程一致）
      if (options.forceUpdate) {
        glyphInstance.render_forceUpdate(canvas, true, {
          x: (options.offset?.x || 0) + (component as IGlyphComponent).ox,
          y: (options.offset?.y || 0) + (component as IGlyphComponent).oy,
        }, false, scale, (glyphValue as any).fillColor || '#000')
      } else {
        glyphInstance.render(canvas, true, {
          x: (options.offset?.x || 0) + (component as IGlyphComponent).ox,
          y: (options.offset?.y || 0) + (component as IGlyphComponent).oy,
        }, false, scale, (glyphValue as any).fillColor || '#000')
      }
      continue
    }

    // 对于路径组件，需要检查是否需要开始新的路径
    if (component.type === 'pen' || component.type === 'polygon' || component.type === 'ellipse' || component.type === 'rectangle') {
      // 如果还没有开始路径，开始新路径
      if (!currentPathStarted && fontRenderStyle.value !== 'color') {
        ctx.beginPath()
        currentPathStarted = true
      }
    }

    // 渲染钢笔组件
    if (component.type === 'pen') {
      const { x, y, w, h, rotation, flipX, flipY } = component
      const _x = mapCanvasX(x) * scale
      const _y = mapCanvasY(y) * scale
      const _w = mapCanvasWidth(w) * scale
      const _h = mapCanvasHeight(h) * scale
      const {
        fillColor,
        points,
        closePath,
        editMode,
      } = component.value as IPenComponent
      ctx.lineWidth = getStrokeWidth()

      if (fontRenderStyle.value === 'color') {
        ctx.beginPath()
      }

      // 在编辑模式下，使用固定的初始边界框；否则使用当前点的边界框
      const fixedBounds = editMode ? editModeFixedBounds.get(component.uuid) : undefined
      let _points = transformPoints(points, {
        x, y, w, h, rotation: 0, flipX, flipY,
      }, fixedBounds)
      _points = _points.map((point) => {
        return mapCanvasCoords({
          x: point.x * scale,
          y: point.y * scale,
        })
      })
      ctx.translate(mapCanvasX(options.offset?.x || 0), mapCanvasY(options.offset?.y || 0))
      ctx.translate(_x + _w / 2, _y + _h / 2)
      ctx.rotate(rotation * Math.PI / 180)
      ctx.translate(-(_x + _w / 2), -(_y + _h / 2))
      
      if (_points.length >= 1) {
        ctx.moveTo(_points[0].x, _points[0].y)
        for (let i = 1; i < _points.length - 2; i += 3) {
          if (i + 2 < _points.length) {
            ctx.bezierCurveTo(_points[i].x, _points[i].y, _points[i + 1].x, _points[i + 1].y, _points[i + 2].x, _points[i + 2].y)
          }
        }
        if (closePath) {
          ctx.closePath()
        }
      }

      if (fontRenderStyle.value === 'color') {
        ctx.fillStyle = fillColor || '#000'
        ctx.strokeStyle = fillColor || '#000'
        ctx.fill()
        ctx.stroke()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      } else {
        // 非 color 模式下，不立即绘制，累积到路径中
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      }
    }

    // 渲染多边形组件
    if (component.type === 'polygon') {
      const { x, y, w, h, rotation, flipX, flipY } = component
      const _x = mapCanvasX(x) * scale
      const _y = mapCanvasY(y) * scale
      const _w = mapCanvasWidth(w) * scale
      const _h = mapCanvasHeight(h) * scale
      const {
        fillColor,
        points,
      } = component.value as IPolygonComponent
      ctx.lineWidth = getStrokeWidth()
      let _points = transformPoints(points, {
        x, y, w, h, rotation: 0, flipX, flipY,
      })
      _points = _points.map((point) => {
        return mapCanvasCoords({
          x: point.x * scale,
          y: point.y * scale,
        })
      })

      if (fontRenderStyle.value === 'color') {
        ctx.beginPath()
      }
      ctx.translate(mapCanvasX(options.offset?.x || 0), mapCanvasY(options.offset?.y || 0))
      ctx.translate(_x + _w / 2, _y + _h / 2)
      ctx.rotate(rotation * Math.PI / 180)
      ctx.translate(-(_x + _w / 2), -(_y + _h / 2))
      
      if (_points.length >= 1) {
        ctx.moveTo(_points[0].x, _points[0].y)
        for (let i = 1; i < _points.length; i++) {
          ctx.lineTo(_points[i].x, _points[i].y)
        }
        ctx.closePath()
      }
      
      if (fontRenderStyle.value === 'color') {
        ctx.fillStyle = fillColor || '#000'
        ctx.strokeStyle = fillColor || '#000'
        ctx.fill()
        ctx.stroke()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      } else {
        // 非 color 模式下，不立即绘制，累积到路径中
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      }
    }

    // 渲染椭圆组件
    if (component.type === 'ellipse') {
      const { x, y, w, h, rotation } = component
      const _x = mapCanvasX(x) * scale
      const _y = mapCanvasY(y) * scale
      const _w = mapCanvasWidth(w) * scale
      const _h = mapCanvasHeight(h) * scale
      const {
        fillColor,
      } = component.value as IEllipseComponent
      const radiusX = _w / 2
      const radiusY = _h / 2
      const centerX = _x + radiusX
      const centerY = _y + radiusY
      ctx.lineWidth = getStrokeWidth()

      if (fontRenderStyle.value === 'color') {
        ctx.beginPath()
      }

      ctx.translate(mapCanvasX(options.offset?.x || 0), mapCanvasY(options.offset?.y || 0))
      ctx.translate(_x + _w / 2, _y + _h / 2)
      ctx.rotate(rotation * Math.PI / 180)
      ctx.translate(-(_x + _w / 2), -(_y + _h / 2))
      ctx.moveTo(centerX + radiusX, centerY)
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI)
      ctx.closePath()
      
      if (fontRenderStyle.value === 'color') {
        ctx.fillStyle = fillColor || '#000'
        ctx.strokeStyle = fillColor || '#000'
        ctx.fill()
        ctx.stroke()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      } else {
        // 非 color 模式下，不立即绘制，累积到路径中
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      }
    }

    // 渲染长方形组件
    if (component.type === 'rectangle') {
      const { x, y, w, h, rotation } = component
      const _x = mapCanvasX(x) * scale
      const _y = mapCanvasY(y) * scale
      const _w = mapCanvasWidth(w) * scale
      const _h = mapCanvasHeight(h) * scale
      const {
        fillColor,
      } = component.value as IRectangleComponent
      const rectWidth = _w
      const rectHeight = _h
      const rectX = _x
      const rectY = _y
      ctx.lineWidth = getStrokeWidth()

      if (fontRenderStyle.value === 'color') {
        ctx.beginPath()
      }

      ctx.translate(mapCanvasX(options.offset?.x || 0), mapCanvasY(options.offset?.y || 0))
      ctx.translate(_x + _w / 2, _y + _h / 2)
      ctx.rotate(rotation * Math.PI / 180)
      ctx.translate(-(_x + _w / 2), -(_y + _h / 2))
      ctx.rect(rectX, rectY, rectWidth, rectHeight)
      ctx.closePath()

      if (fontRenderStyle.value === 'color') {
        ctx.fillStyle = fillColor || '#000'
        ctx.strokeStyle = fillColor || '#000'
        ctx.fill()
        ctx.stroke()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      } else {
        // 非 color 模式下，不立即绘制，累积到路径中
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      }
    }
  }
  
  // 绘制最后的路径
  if (currentPathStarted && fontRenderStyle.value !== 'color') {
    ctx.closePath()
    ctx.strokeStyle = '#000'
    if (fontRenderStyle.value === 'black' || options.fill) {
      ctx.fillStyle = '#000'
      ctx.fill("nonzero")
    } else if (fontRenderStyle.value === 'contour') {
      // contour 模式下只绘制轮廓，不填充
      ctx.stroke()
    }
  }
}

/**
 * 渲染字形
 */
function renderGlyph(
  glyph: CustomGlyph,
  canvas: HTMLCanvasElement,
  renderBackground: boolean,
  fill: boolean,
  useSkeletonGrid: boolean
): void {
  // 调用字形实例的 render 方法
  glyph.render(canvas, renderBackground, { x: 0, y: 0 }, fill, 1, '#000')
}

/**
 * 主渲染函数
 * 用于字符编辑界面和字形编辑界面
 */
export function render(
  canvas: HTMLCanvasElement,
  renderBackground: boolean = true,
  forceUpdate: boolean = false,
  options: {
    mode: 'character' | 'glyph'
    character?: ICharacterFileLite
    glyph?: ICustomGlyph
    components?: IComponent[]
    background?: IBackground
    grid?: IGrid
  } = { mode: 'character' }
): void {
  if (import.meta.env.DEV) {
    const computedStyle = window.getComputedStyle(canvas)
    const displayWidth = parseFloat(computedStyle.width) || 0
    const displayHeight = parseFloat(computedStyle.height) || 0
    console.log('[EditorCanvasRenderer.render] Starting render:', {
      mode: options.mode,
      canvasActualSize: { width: canvas.width, height: canvas.height },
      canvasDisplaySize: { width: displayWidth, height: displayHeight },
      canvasSizeRatio: { 
        widthRatio: canvas.width / (displayWidth || 1), 
        heightRatio: canvas.height / (displayHeight || 1) 
      },
      hasCharacter: !!options.character,
      hasGlyph: !!options.glyph,
      glyphUUID: options.glyph?.uuid,
      glyphName: options.glyph?.name,
      componentsCount: options.components?.length || 0,
      forceUpdate
    })
  }
  clearCanvas(canvas)
  
  // 默认背景和网格配置
  const defaultBackground: IBackground = {
    type: BackgroundType.Transparent,
    color: '#FFFFFF'
  }
  const defaultGrid: IGrid = {
    type: GridType.None,
    precision: 20
  }
  
  const background = options.background || defaultBackground
  const grid = options.grid || defaultGrid
  
  if (renderBackground) {
    fillBackground(canvas, background, grid)
  } else if (background.color) {
    // 使用 willReadFrequently 选项来优化频繁的 getImageData 调用
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (ctx) {
      ctx.fillStyle = background.color
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
  }
  
  if (options.mode === 'character') {
    if (options.components && options.components.length > 0) {
      if (import.meta.env.DEV) {
        console.log('[EditorCanvasRenderer] Rendering character components:', {
          componentsCount: options.components.length,
          componentTypes: options.components.map(c => c.type)
        })
      }
      // 计算 scale：canvas 显示尺寸 / canvas 实际尺寸
      // 如果 canvas 实际尺寸是 2000，显示尺寸是 500，scale 应该是 1（因为坐标已经通过 mapCanvasX/Y 映射了）
      // 但为了确保组件渲染到整个 canvas，我们需要确保坐标映射正确
      renderCanvas(options.components, canvas, {
        forceUpdate,
        fill: false,
        offset: { x: 0, y: 0 },
        scale: 1, // scale 保持为 1，坐标映射由 mapCanvasX/Y 处理
      })
    } else {
      if (import.meta.env.DEV) {
        console.warn('[EditorCanvasRenderer] No components to render for character mode')
      }
    }
  } else if (options.mode === 'glyph') {
    // 如果传入了 components，优先使用 components 渲染（字形编辑界面）
    if (options.components && options.components.length > 0) {
      if (import.meta.env.DEV) {
        console.log('[EditorCanvasRenderer] Rendering glyph components:', {
          componentsCount: options.components.length,
          componentTypes: options.components.map(c => c.type)
        })
      }
      // 1. 先渲染外部组件（editingGlyph.value.components）
      renderCanvas(options.components, canvas, {
        forceUpdate,
        fill: false,
        offset: { x: 0, y: 0 },
        scale: 1, // scale 保持为 1，坐标映射由 mapCanvasX/Y 处理
      })
      
      // 2. 然后渲染内部组件（字形实例的 _components，即脚本生成的组件）
    if (options.glyph) {
        const instanceKey = options.glyph.uuid
        
        // 先检查实例是否存在，以及是否有 tempData（正在拖拽中）
        // 注意：优先检查编辑状态，因为编辑状态的实例应该优先使用
        // 如果实例既在编辑状态又在临时状态（比如脚本执行后），应该使用编辑状态的实例
        let existingInstance: CustomGlyph | null = null
        if (instanceManager.isEditing(instanceKey)) {
          existingInstance = instanceManager.getInstance(
            instanceKey,
            () => new CustomGlyph(options.glyph!),
            'glyph'
          ) as CustomGlyph
        } else if (instanceManager.isTemporary(instanceKey)) {
          existingInstance = instanceManager.acquireTemporaryInstance(
            instanceKey,
            () => new CustomGlyph(options.glyph!),
            'glyph'
          ) as CustomGlyph
        }
        
        if (import.meta.env.DEV) {
          console.log('[EditorCanvasRenderer] Checking instance for internal components:', {
            instanceKey,
            hasExistingInstance: !!existingInstance,
            isEditing: instanceManager.isEditing(instanceKey),
            isTemporary: instanceManager.isTemporary(instanceKey),
            hasTempData: !!existingInstance?.tempData,
            componentsCount: existingInstance?._components?.length || 0,
            forceUpdate
          })
        }
        
        // 如果实例有 tempData（正在拖拽中），不应该执行脚本（避免重置拖拽修改）
        const hasTempData = !!existingInstance?.tempData
        
        // 检查是否需要执行脚本
        // 注意：如果实例存在但 _components 为空，需要执行脚本
        // 但如果实例不存在，可能是第一次进入，需要先获取实例再判断
        let needsScriptExecution = false
        if (!existingInstance) {
          // 如果实例不存在，需要执行脚本
          needsScriptExecution = true
        } else if (!existingInstance._components || !existingInstance._components.length) {
          // 如果实例存在但 _components 为空，需要执行脚本
          needsScriptExecution = true
        } else if (forceUpdate) {
          // 如果强制更新，需要执行脚本
          needsScriptExecution = true
        }
        
        // 如果有 tempData，不应该执行脚本
        if (hasTempData) {
          needsScriptExecution = false
        }
        
        if (needsScriptExecution) {
          if (import.meta.env.DEV) {
            console.log('[EditorCanvasRenderer] ✅ Executing script for internal components:', {
              instanceKey,
              hasExistingInstance: !!existingInstance,
              hasTempData: false,
              needsScriptExecution,
              reason: !existingInstance ? 'no instance' : 
                      (!existingInstance._components || !existingInstance._components.length) ? 'no components' : 
                      forceUpdate ? 'forceUpdate' : 'unknown'
            })
          }
          // 执行脚本（脚本内部会获取或创建实例）
          executeGlyphScript(options.glyph, instanceKey)
          
          // 脚本执行后，立即重新获取实例，确保获取到最新的 _components
          if (instanceManager.isEditing(instanceKey)) {
            existingInstance = instanceManager.getInstance(
              instanceKey,
              () => new CustomGlyph(options.glyph!),
              'glyph'
            ) as CustomGlyph
          } else if (instanceManager.isTemporary(instanceKey)) {
            existingInstance = instanceManager.acquireTemporaryInstance(
              instanceKey,
              () => new CustomGlyph(options.glyph!),
              'glyph'
            ) as CustomGlyph
          }
          
          if (import.meta.env.DEV) {
            console.log('[EditorCanvasRenderer] After script execution:', {
              instanceKey,
              hasInstance: !!existingInstance,
              componentsCount: existingInstance?._components?.length || 0
            })
          }
        } else {
          if (import.meta.env.DEV) {
            console.log('[EditorCanvasRenderer] ⚠️ Skipping script execution:', {
              instanceKey,
              hasExistingInstance: !!existingInstance,
              hasTempData,
              hasComponents: !!existingInstance?._components?.length,
              componentsCount: existingInstance?._components?.length || 0,
              forceUpdate
            })
          }
        }
        
        // 使用 existingInstance（如果脚本已执行，existingInstance 已经是最新的）
        // 否则重新获取实例（确保获取到最新的实例）
        let glyphInstance: CustomGlyph | null = existingInstance
        
        if (!glyphInstance) {
          // 如果 existingInstance 不存在，重新获取实例
          if (instanceManager.isEditing(instanceKey)) {
            // 字形编辑界面，使用 getInstance（编辑状态）
            glyphInstance = instanceManager.getInstance(
              instanceKey,
              () => new CustomGlyph(options.glyph!),
              'glyph'
            ) as CustomGlyph
          } else if (instanceManager.isTemporary(instanceKey)) {
            // 临时实例（可能是从其他场景创建的）
            glyphInstance = instanceManager.acquireTemporaryInstance(
              instanceKey,
              () => new CustomGlyph(options.glyph!),
              'glyph'
            ) as CustomGlyph
          } else {
            // 其他情况，使用 getOrCreateGlyphInstance
            glyphInstance = instanceManager.getOrCreateGlyphInstance(
              options.glyph,
              () => new CustomGlyph(options.glyph!)
            ) as CustomGlyph
          }
        }
        
        if (!glyphInstance) {
          if (import.meta.env.DEV) {
            console.warn('[EditorCanvasRenderer] Failed to get glyph instance:', {
              instanceKey,
              isEditing: instanceManager.isEditing(instanceKey),
              isTemporary: instanceManager.isTemporary(instanceKey)
            })
          }
          return
        }
        
        if (import.meta.env.DEV) {
          console.log('[EditorCanvasRenderer] Final instance for rendering:', {
            instanceKey,
            hasInstance: !!glyphInstance,
            componentsCount: glyphInstance._components?.length || 0,
            componentTypes: glyphInstance._components?.map((c: any) => c.type || 'unknown') || []
          })
        }
        
        // 渲染内部组件（_components）
        if (glyphInstance && glyphInstance._components && glyphInstance._components.length > 0) {
          if (import.meta.env.DEV) {
            console.log('[EditorCanvasRenderer] Rendering internal components (_components):', {
              instanceKey,
              internalComponentsCount: glyphInstance._components.length,
              componentTypes: glyphInstance._components.map((c: any) => c.type || 'unknown')
            })
          }
          
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (ctx) {
            // 确保清除之前可能留下的路径状态
            ctx.beginPath()
            
            // 调用每个内部组件的 render 方法
            glyphInstance._components.forEach((component: any, index: number) => {
              if (component.render) {
                if (import.meta.env.DEV) {
                  console.log(`[EditorCanvasRenderer] Rendering internal component ${index}:`, {
                    type: component.type,
                    hasRender: !!component.render
                  })
                }
                component.render(canvas, {
                  offset: { x: 0, y: 0 },
                  scale: 1,
                  fillColor: '#000',
                })
              } else {
                if (import.meta.env.DEV) {
                  console.warn(`[EditorCanvasRenderer] Internal component ${index} has no render method:`, {
                    type: component.type,
                    component: component
                  })
                }
              }
            })
            
            // 根据渲染样式填充
            if (fontRenderStyle.value === 'black' || forceUpdate) {
              ctx.fillStyle = '#000'
              ctx.fill("nonzero")
              ctx.closePath()
            } else if (fontRenderStyle.value === 'color') {
              ctx.fillStyle = '#000'
              ctx.fill("nonzero")
              ctx.closePath()
            } else {
              // 线框模式下，确保路径被清除，避免残留
              ctx.closePath()
            }
          }
        } else {
          if (import.meta.env.DEV) {
            console.log('[EditorCanvasRenderer] No internal components to render:', {
              instanceKey,
              hasInstance: !!glyphInstance,
              hasComponents: !!glyphInstance?._components,
              componentsCount: glyphInstance?._components?.length || 0,
              hasTempData: !!glyphInstance?.tempData
            })
          }
        }
      }
    } else if (options.glyph) {
      // 如果没有传入 components，使用字形实例的 render 方法（用于预览等场景）
      if (import.meta.env.DEV) {
        console.log('[EditorCanvasRenderer] Using renderGlyph path (no components):', {
          glyphUUID: options.glyph.uuid,
          glyphName: options.glyph.name,
          canvasActualSize: { width: canvas.width, height: canvas.height },
          computedStyle: window.getComputedStyle(canvas)
        })
      }
      const glyphInstance = instanceManager.getOrCreateGlyphInstance(
        options.glyph,
        () => new CustomGlyph(options.glyph!)
      ) as CustomGlyph
      if (import.meta.env.DEV) {
        console.log('[EditorCanvasRenderer] Glyph instance before renderGlyph:', {
          instanceKey: options.glyph.uuid,
          hasInstance: !!glyphInstance,
          _componentsCount: glyphInstance._components?.length || 0,
          isEditing: instanceManager.isEditing(options.glyph.uuid),
          isTemporary: instanceManager.isTemporary(options.glyph.uuid)
        })
      }
      renderGlyph(glyphInstance, canvas, renderBackground, false, false)
    } else {
      if (import.meta.env.DEV) {
        console.warn('[EditorCanvasRenderer] No components or glyph to render for glyph mode')
      }
    }
  }
}
