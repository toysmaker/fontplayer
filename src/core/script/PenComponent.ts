import type { IPoint, ILine, IQuadraticBezierCurve, ICubicBezierCurve } from './types'
import { genUUID } from '@/utils/uuid'
import { mapCanvasX, mapCanvasY } from '@/utils/canvas'
import { formatPoints, genPenContour } from '../utils/contour'
import { translate } from '../utils/math'
import { computeCoords } from '../utils/grid'
import { fontRenderStyle, selectedFile } from './globals'
import { getStrokeWidth } from '@/utils/canvas-utils'
import * as R from 'ramda'

interface IOption {
	offset?: {
    x: number,
    y: number,
  };
	scale?: number;
	grid?: any;
	fillColor?: string;
}

class PenComponent {
	public points: Array<IPoint>
	private hasPathBegan: boolean = false
	public type: string = 'glyph-pen'
	public usedInCharacter: boolean = true
	public contour: Array<ILine | IQuadraticBezierCurve | ICubicBezierCurve> = []
	public contour2: Array<ILine | IQuadraticBezierCurve | ICubicBezierCurve> = []
	public preview: Array<ILine | IQuadraticBezierCurve | ICubicBezierCurve> = []

	public constructor () {

	}

	public beginPath () {
		this.hasPathBegan = true
		this.points = []
		if (import.meta.env.DEV) {
			console.log(`[PenComponent] beginPath called, hasPathBegan=${this.hasPathBegan}, points cleared`)
		}
	}

	public closePath () {
		this.hasPathBegan = false
		if (import.meta.env.DEV) {
			console.log(`[PenComponent] closePath called, hasPathBegan=${this.hasPathBegan}, final points.length=${this.points.length}`)
		}
	}

	public moveTo (x: number, y: number) {
		if (import.meta.env.DEV) {
			console.log(`[PenComponent] moveTo called: x=${x}, y=${y}, hasPathBegan=${this.hasPathBegan}, current points.length=${this.points.length}`)
		}
		if (this.hasPathBegan && !this.points.length) {
			this.points[0] = {
				uuid: genUUID(),
        type: 'anchor',
        x,
        y,
        origin: null,
			}
			if (import.meta.env.DEV) {
				console.log(`[PenComponent] moveTo executed: added point, points.length=${this.points.length}`)
			}
		} else {
			if (import.meta.env.DEV) {
				console.warn(`[PenComponent] moveTo called but ignored: hasPathBegan=${this.hasPathBegan}, points.length=${this.points.length}`)
			}
		}
	}

	public bezierTo (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
		if (this.hasPathBegan && !!this.points.length) {
			const uuid1 = this.points[this.points.length - 1].uuid
			const uuid2 = genUUID()
			this.points.push({
				uuid: genUUID(),
        type: 'control',
        x: x1,
        y: y1,
        origin: uuid1,
			})
			this.points.push({
				uuid: genUUID(),
        type: 'control',
        x: x2,
        y: y2,
        origin: uuid2,
			})
			this.points.push({
				uuid: uuid2,
        type: 'anchor',
        x: x3,
        y: y3,
        origin: null,
			})
		}
	}

	public quadraticBezierTo (x1: number, y1: number, x2: number, y2: number) {
		if (this.hasPathBegan && !!this.points.length) {
			const uuid1 = this.points[this.points.length - 1].uuid
			const uuid2 = genUUID()
			this.points.push({
				uuid: genUUID(),
        type: 'control',
        x: this.points[this.points.length - 1].x + 2 / 3 * (x1 - this.points[this.points.length - 1].x),
				y: this.points[this.points.length - 1].y + 2 / 3 * (y1 - this.points[this.points.length - 1].y),
        origin: uuid1,
			})
			this.points.push({
				uuid: genUUID(),
        type: 'control',
				x: x2 + 2 / 3 * (x1 - x2),
				y: y2 + 2 / 3 * (y1 - y2),
        origin: uuid2,
			})
			this.points.push({
				uuid: uuid2,
        type: 'anchor',
        x: x2,
        y: y2,
        origin: null,
			})
		}
	}

	public lineTo (x: number, y: number) {
		if (this.hasPathBegan && !!this.points.length) {
			const uuid1 = this.points[this.points.length - 1].uuid
			const uuid2 = genUUID()
			this.points.push({
				uuid: genUUID(),
        type: 'control',
        x: this.points[this.points.length - 1].x,
        y: this.points[this.points.length - 1].y,
        origin: uuid1,
			})
			this.points.push({
				uuid: genUUID(),
        type: 'control',
        x,
        y,
        origin: uuid2,
			})
			this.points.push({
				uuid: uuid2,
        type: 'anchor',
        x,
        y,
        origin: null,
			})
			if (import.meta.env.DEV && this.points.length % 10 === 0) {
				console.log(`[PenComponent] lineTo called: x=${x}, y=${y}, points.length=${this.points.length}`)
			}
		} else {
			if (import.meta.env.DEV) {
				console.warn(`[PenComponent] lineTo called but ignored: hasPathBegan=${this.hasPathBegan}, points.length=${this.points.length}`)
			}
		}
	}

	public render (canvas: HTMLCanvasElement, options: IOption = {
		offset: { x: 0, y: 0 },
		scale: 1,
	}) {
		const scale = options.scale
		if (this.points.length >= 4) {
			// 获取 Canvas 的显示尺寸（CSS style）
			const computedStyle = window.getComputedStyle(canvas)
			const displayWidth = parseFloat(computedStyle.width) || 0
			const displayHeight = parseFloat(computedStyle.height) || 0

			// 计算原始坐标范围
			let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
			this.points.forEach((p: any) => {
				if (p.x !== undefined) {
					minX = Math.min(minX, p.x)
					maxX = Math.max(maxX, p.x)
				}
				if (p.y !== undefined) {
					minY = Math.min(minY, p.y)
					maxY = Math.max(maxY, p.y)
				}
			})

			// 计算每个点映射后的坐标（用于详细调试）
			const mappedPoints = this.points.map((p: any, index: number) => ({
				index,
				original: { x: p.x, y: p.y },
				mapped: {
					x: mapCanvasX(p.x) * scale,
					y: mapCanvasY(p.y) * scale,
				},
				type: p.type,
			}))

			if (import.meta.env.DEV) {
				console.log('[PenComponent.render] Rendering pen component (full points):', {
					pointsCount: this.points.length,
					originalBounds: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY },
					canvasActualSize: { width: canvas.width, height: canvas.height },
					canvasDisplaySize: { width: displayWidth, height: displayHeight },
					canvasSizeRatio: {
						widthRatio: canvas.width / (displayWidth || 1),
						heightRatio: canvas.height / (displayHeight || 1),
					},
					renderOptions: { offset: options.offset, scale },
					offsetMapped: {
						x: mapCanvasX(options.offset.x) * scale,
						y: mapCanvasY(options.offset.y) * scale,
					},
					points: mappedPoints,
				})
			}

			const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
			ctx.strokeStyle = options.fillColor || '#000'
			ctx.lineWidth = getStrokeWidth()
			ctx.translate(mapCanvasX(options.offset.x) * scale, mapCanvasY(options.offset.y) * scale)
			ctx.moveTo(mapCanvasX(this.points[0].x) * scale, mapCanvasY(this.points[0].y) * scale)
			for (let i = 1; i < this.points.length; i += 3) {
				ctx.bezierCurveTo(
					mapCanvasX(this.points[i].x) * scale, mapCanvasY(this.points[i].y) * scale,
					mapCanvasX(this.points[i + 1].x) * scale, mapCanvasY(this.points[i + 1].y) * scale,
					mapCanvasX(this.points[i + 2].x) * scale, mapCanvasY(this.points[i + 2].y) * scale,
				)
			}
			ctx.stroke()
			if (import.meta.env.DEV) {
				console.log('[PenComponent.render] Stroke completed:', {
					strokeStyle: ctx.strokeStyle,
					lineWidth: ctx.lineWidth,
				})
			}
			ctx.setTransform(1, 0, 0, 1, 0, 0)
		}
	}

	public render_grid (canvas: HTMLCanvasElement, options: IOption = {
		offset: { x: 0, y: 0 },
		scale: 1,
		grid: null,
	}) {
		const translate = (point) => {
			return {
				x: options.offset.x + point.x,
				y: options.offset.y + point.y,
			}
		}
		const scale = options.scale
		if (this.points.length >= 4) {
			const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
			ctx.strokeStyle = '#000'
			ctx.lineWidth = getStrokeWidth()
			ctx.beginPath()
			const start = computeCoords(options.grid, translate(this.points[0]))
			ctx.moveTo(mapCanvasX(start.x) * scale, mapCanvasY(start.y) * scale)
			for (let i = 1; i < this.points.length; i += 3) {
				const control1 = computeCoords(options.grid, translate(this.points[i]))
				const control2 = computeCoords(options.grid, translate(this.points[i + 1]))
				const end = computeCoords(options.grid, translate(this.points[i + 2]))
				ctx.bezierCurveTo(
					mapCanvasX(control1.x) * scale, mapCanvasY(control1.y) * scale,
					mapCanvasX(control2.x) * scale, mapCanvasY(control2.y) * scale,
					mapCanvasX(end.x) * scale, mapCanvasY(end.y) * scale,
				)
			}
			ctx.stroke()
			ctx.closePath()
			ctx.setTransform(1, 0, 0, 1, 0, 0)
		}
	}

	public getData = () => {
		return {
			points: R.clone(this.points),
			type: this.type,
			hasPathBegan: this.hasPathBegan,
			usedInCharacter: this.usedInCharacter,
			contour: R.clone(this.contour),
			preview: R.clone(this.preview),
		}
	}

	public setData = (data) => {
		this.points = R.clone(data.points)
		this.type = data.type
		this.hasPathBegan = data.hasPathBegan
		this.usedInCharacter = data.usedInCharacter
		if (data.contour) {
			this.contour = R.clone(data.contour)
		}
		if (data.preview) {
			this.preview = R.clone(data.preview)
		}
	}

	public updateData = (isGlyph: boolean = true, offset: { x: number, y: number }, grid?: any) => {
		let points: any = this.points
		points = points.map((point) => {
			const p = translate(point, offset)
			if (grid) {
				return computeCoords(grid, p)
			} else {
				return p
			}
		})
		let options = {
			unitsPerEm: 1000,
			descender: -200,
			advanceWidth: 1000,
		}
		if (!isGlyph) {
			options.unitsPerEm = selectedFile.value?.fontSettings.unitsPerEm || 1000
			options.descender = selectedFile.value?.fontSettings.descender || -200
			options.advanceWidth = selectedFile.value?.fontSettings.unitsPerEm || 1000
		}
		const contour_points = formatPoints(points, options, 1)
		const contour = genPenContour(contour_points)
	
		const scale = 100 / (options.unitsPerEm as number)
		const preview_points = points.map((point) => {
			return Object.assign({}, point, {
				x: point.x * scale,
				y: point.y * scale,
			})
		})
		const preview_contour = genPenContour(preview_points, true)

		this.contour = contour as any
		this.preview = preview_contour as any
	}

	public updateData2 = () => {
		const points = this.points
		const contour = genPenContour(points)
		this.contour2 = contour as any
	}
}

export {
	PenComponent,
}