import type { ICustomGlyph, IRefLine } from '../types'
import { ParameterType } from '../types'
import { renderCanvas, renderGridCanvas, fontRenderStyle, getStrokeWidth, computeCoords } from './adapters'
import { PenComponent } from './PenComponent'
import { PolygonComponent } from './PolygonComponent'
import { EllipseComponent } from './EllipseComponent'
import { RectangleComponent } from './RectangleComponent'
import { Joint } from './Joint'
import { orderedListWithItemsForGlyph } from '../utils/glyph'
import { mapCanvasX, mapCanvasY } from './adapters'

// TODO: 这些函数需要从原代码迁移或实现
// import { clearCanvas, computeCoords, fillBackground, renderCanvas, renderGridCanvas } from '../canvas/canvas'
// import { fontRenderStyle, background, grid, getStrokeWidth } from '../stores/global'
// import { getRatioLayout2 } from '../stores/glyph'
// import { executeScript } from '../stores/glyph'

type Component = PenComponent | PolygonComponent | EllipseComponent | RectangleComponent

class CustomGlyph {
	public _glyph: ICustomGlyph
	private _joints: Array<Joint> = []
	private _reflines: Array<IRefLine> = []
	public _components: Array<Component> = []
	public onSkeletonDrag: Function = null
	public onSkeletonDragEnd: Function = null
	public onSkeletonDragStart: Function = null
	public getSkeleton: Function = null
	public getComponentsBySkeleton: Function = null
	public computeParamsByJoints: Function = null
	public updateParamsByJoints: Function = null
	public tempData: any = null

	constructor (glyph: ICustomGlyph) {
		this._glyph = glyph
		glyph._o = this as any
	}

	public getJoints () {
		if (this._glyph.joints) {
			return [...this._glyph.joints, ...this._joints]
		} else {
			return this._joints
		}
		//return this._glyph.joints ? this._glyph.joints.concat(this._joints) : [].concat(this._joints)
	}

	public getNonRefJoints () {
		if (this._glyph.joints) {
			return [
				...this._glyph.joints.filter((joint) => !joint.name.includes('ref')),
				...this._joints.filter((joint) => !joint.name.includes('ref')),
			]
		} else {
			return this._joints.filter((joint) => !joint.name.includes('ref'))
		}
		//return this._glyph.joints ? this._glyph.joints.concat(this._joints) : [].concat(this._joints)
	}

	public getRefLines () {
		return this._glyph.reflines ? this._glyph.reflines.concat(this._reflines) : [].concat(this._reflines)
	}

	public addJoint (joint: Joint) {
		this._joints.push(joint)
	}

	public addComponent (component: Component) {
		this._components.push(component)
		if (import.meta.env.DEV) {
			const pointsCount = (component as any).points?.length || 0
			const hasPathBegan = (component as any).hasPathBegan || false
			console.log(`[CustomGlyph] addComponent called: type=${component.type}, points=${pointsCount}, hasPathBegan=${hasPathBegan}, total components=${this._components.length}`)
		}
	}

	public clear () {
		this._joints = []
		this._components = []
		this._reflines = []
	}

	public render (canvas: HTMLCanvasElement, renderBackground: Boolean = true, offset: {
		x: number,
		y: number,
	} = { x: 0, y: 0 }, fill: boolean = false, scale: number = 1, fillColor: string = '#000') {
		const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
		renderCanvas(orderedListWithItemsForGlyph(this._glyph), canvas, {
			offset,
			scale: scale,
			fill: false,
			forceUpdate: false,
		})
		// 确保清除renderCanvas可能留下的路径状态
		ctx.beginPath()
		this._components.forEach((component) => {
			component.render(canvas, {
				offset,
				scale: scale,
				fillColor: fillColor,
			})
		})
		if (fontRenderStyle.value === 'black' || fill) {
			ctx.fillStyle = '#000'
			ctx.fill("nonzero")
			ctx.closePath()
		} else if (fontRenderStyle.value === 'color') {
			ctx.fillStyle = fillColor || '#000'
			ctx.fill("nonzero")
			ctx.closePath()
		} else {
			// 线框模式下，确保路径被清除，避免残留
			ctx.closePath()
		}
	}

	public render_forceUpdate (canvas: HTMLCanvasElement, renderBackground: Boolean = true, offset: {
		x: number,
		y: number,
	} = { x: 0, y: 0 }, fill: boolean = false, scale: number = 1, fillColor: string = '#000') {
		const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
		renderCanvas(orderedListWithItemsForGlyph(this._glyph), canvas, {
			offset,
			scale: scale,
			fill: false,
			forceUpdate: true,
		})
		// 确保清除renderCanvas可能留下的路径状态
		ctx.beginPath()
		this._components.forEach((component) => {
			component.render(canvas, {
				offset,
				scale: scale,
				fillColor: fillColor,
			})
		})
		if (fontRenderStyle.value === 'black' || fill) {
			ctx.fillStyle = '#000'
			ctx.fill("nonzero")
			ctx.closePath()
		} else if (fontRenderStyle.value === 'color') {
			ctx.fillStyle = fillColor || '#000'
			ctx.fill("nonzero")
			ctx.closePath()
		} else {
			// 线框模式下，确保路径被清除，避免残留
			ctx.closePath()
		}
	}

	public render_grid (canvas: HTMLCanvasElement, renderBackground: Boolean = true, offset: {
		x: number,
		y: number,
	} = { x: 0, y: 0 }, fill: boolean = false, scale: number = 1, grid: any, useSkeletonGrid: boolean = false) {
		const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
		renderGridCanvas(orderedListWithItemsForGlyph(this._glyph), canvas, {
			offset,
			scale: scale,
			fill: false,
			forceUpdate: false,
			grid,
			useSkeletonGrid,
		})
		if (!useSkeletonGrid) {
			// 不使用骨架布局的情况下，默认用组件数据计算布局调整
			this._components.forEach((component) => {
				component.render_grid(canvas, {
					offset,
					scale: scale,
					grid,
				})
			})
		} else if (this.getSkeleton && this.getComponentsBySkeleton) {
			// 使用骨架布局，首先对骨架计算布局调整，然后使用调整过的骨架渲染新的组件
			const _skeleton = this.getSkeleton()
			const skeleton = {}
			const keys = Object.keys(_skeleton)
			for (let i = 0; i < keys.length; i++) {
				const key = keys[i]
				const _joint = _skeleton[key]
				const joint = {
					x: _joint.x + offset.x,
					y: _joint.y + offset.y,
				}
				skeleton[key] = computeCoords(grid, joint)
			}
			const components = this.getComponentsBySkeleton(skeleton)
			for (let i = 0; i < components.length; i++) {
				const component = components[i]
				component.render(canvas, {
					offset: { x: 0, y: 0 },
					scale: 0.5,
				})
			}
		}
		if (fontRenderStyle.value === 'color' || fill) {
			ctx.fillStyle = '#000'
			ctx.fill()
		}
	}

	public render_grid_forceUpdate (canvas: HTMLCanvasElement, renderBackground: Boolean = true, offset: {
		x: number,
		y: number,
	} = { x: 0, y: 0 }, fill: boolean = false, scale: number = 1, grid: any, useSkeletonGrid: boolean = false) {
		const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
		renderCanvas(orderedListWithItemsForGlyph(this._glyph), canvas, {
			offset,
			scale: scale,
			fill: false,
			forceUpdate: true,
			grid,
			useSkeletonGrid,
		})
		this._components.forEach((component) => {
			component.render_grid(canvas, {
				offset,
				scale: scale,
				grid,
			})
		})
		if (fontRenderStyle.value === 'color' || fill) {
			ctx.fillStyle = '#000'
			ctx.fill()
		}
	}

	public renderJoints (canvas: HTMLCanvasElement, options: {
		type: string,
		joints?: Array<string>
	} = {
		type: 'all',
	}) {
		if (options.type === 'all') {
			this.getJoints().forEach((joint) => {
				if ((joint as any).render) {
					(joint as any).render(canvas)
				}
			})
		} else if (options.type === 'selected' && options.joints && options.joints.length) {
			this.getJoints().forEach((joint) => {
				if (options.joints!.indexOf((joint as any).name) !== -1 && (joint as any).render) {
					(joint as any).render(canvas)
				}
			})
		}
	}

	public renderRefLines (canvas: HTMLCanvasElement, options: {
		type: string,
		reflines?: Array<string>
	} = {
		type: 'all',
	}) {
		if (options.type === 'all') {
			this.getRefLines().forEach((refline) => {
				const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
				const joint1 = this.getJoint(refline.start)
				const joint2 = this.getJoint(refline.end)
				if (joint1 && joint2 && (joint1 as any).getCoords && (joint2 as any).getCoords) {
					const p1 = (joint1 as any).getCoords()
					const p2 = (joint2 as any).getCoords()
				ctx.strokeStyle = refline.type === 'ref' ? 'red' : 'blue'
				ctx.lineWidth = getStrokeWidth()
				ctx.beginPath()
				ctx.moveTo(mapCanvasX(p1.x), mapCanvasY(p1.y))
				ctx.lineTo(mapCanvasX(p2.x), mapCanvasY(p2.y))
				ctx.stroke()
				}
			})
		} else if (options.type === 'selected' && options.reflines && options.reflines.length) {
			this.getRefLines().forEach((refline) => {
				if (options.reflines!.indexOf(refline.name) !== -1) {
					const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
					const joint1 = this.getJoint(refline.start)
					const joint2 = this.getJoint(refline.end)
					if (joint1 && joint2 && (joint1 as any).getCoords && (joint2 as any).getCoords) {
						const p1 = (joint1 as any).getCoords()
						const p2 = (joint2 as any).getCoords()
					ctx.strokeStyle = refline.type === 'ref' ? 'red' : 'blue'
					ctx.lineWidth = getStrokeWidth()
					ctx.beginPath()
					ctx.moveTo(mapCanvasX(p1.x), mapCanvasY(p1.y))
					ctx.lineTo(mapCanvasX(p2.x), mapCanvasY(p2.y))
					ctx.stroke()
					}
				}
			})
		}
	}

	public addRefLine (refline) {
		this._reflines.push(refline)
	}

	public getParam (name: string) {
		if (!this._glyph.parameters || !Array.isArray(this._glyph.parameters)) {
			return undefined
		}
		
		const param = this._glyph.parameters.find((p: any) => p.name === name)
		if (!param) {
			return undefined
		}
		
		// 调试：打印参数完整信息
		if (import.meta.env.DEV && (name === '起笔风格' || name === '字重')) {
			console.log(`[CustomGlyph.getParam] Parameter details for ${name}:`, {
				uuid: param.uuid,
				name: param.name,
				type: param.type,
				value: param.value,
				valueType: typeof param.value,
				isString: typeof param.value === 'string',
				isNumber: typeof param.value === 'number',
				fullParam: param
			})
		}
		
		// 处理不同类型的参数
		return this.getParameterValue(param, name)
	}

	/**
	 * 获取参数的实际值（处理 Constant 类型等）
	 */
	private getParameterValue(param: any, name: string): any {
		// Number 或 RingController 类型，直接返回 value
		if (param.type === ParameterType.Number || param.type === ParameterType.RingController) {
			return param.value
		}
		
		// Constant 类型，需要从 constantsMap 解析
		if (param.type === ParameterType.Constant) {
			const constantsMap = (window as any).constantsMap
			if (constantsMap && typeof constantsMap.getByUUID === 'function') {
				// 确保 value 是字符串类型
				const uuidValue = String(param.value)
				if (!uuidValue || uuidValue === '0' || uuidValue === '') {
					if (import.meta.env.DEV) {
						console.warn(`[CustomGlyph.getParam] ${name} (Constant): Invalid UUID value:`, param.value, 'returning as-is')
					}
					return param.value
				}
				
				const resolvedValue = constantsMap.getByUUID(uuidValue)
				if (resolvedValue !== undefined) {
					if (import.meta.env.DEV) {
						console.log(`[CustomGlyph.getParam] ${name} (Constant):`, {
							uuid: uuidValue,
							resolvedValue: resolvedValue,
							type: typeof resolvedValue
						})
					}
					return resolvedValue
				} else {
					if (import.meta.env.DEV) {
						console.warn(`[CustomGlyph.getParam] ${name}: constantsMap.getByUUID('${uuidValue}') returned undefined, returning UUID`)
					}
					return param.value
				}
			} else {
				if (import.meta.env.DEV) {
					console.warn(`[CustomGlyph.getParam] ${name} (Constant): constantsMap not available, returning UUID:`, param.value)
				}
				return param.value
			}
		}
		
		// 如果 value 看起来像 UUID（但不是 Constant 类型），也尝试解析
		// 注意：排除数字 0，因为 0 可能是有效的参数值
		if (typeof param.value === 'string' && 
				param.value.length > 20 && 
				param.value.includes('-') &&
				/^[a-zA-Z0-9_-]+$/.test(param.value) &&
				param.value !== '0') {
			const constantsMap = (window as any).constantsMap
			if (constantsMap && typeof constantsMap.getByUUID === 'function') {
				const resolvedValue = constantsMap.getByUUID(param.value)
				if (resolvedValue !== undefined) {
					if (import.meta.env.DEV) {
						console.log(`[CustomGlyph.getParam] ${name} (UUID-like):`, {
							uuid: param.value,
							resolvedValue: resolvedValue,
							type: typeof resolvedValue,
							paramType: param.type
						})
					}
					return resolvedValue
				}
			}
		}
		
		// Enum 或其他类型，直接返回 value
		return param.value
	}

	public getParamRange (name: string) {
		if (!this._glyph.parameters || !Array.isArray(this._glyph.parameters)) {
			return undefined
		}
		
		const param = this._glyph.parameters.find((p: any) => p.name === name)
		if (!param) {
			return undefined
		}
		
		return {
			min: param.min || 0,
			max: param.max === 0 ? 0 : param.max || 1000,
		}
	}

	public setParam (name: string, value: number) {
		if (!this._glyph.parameters || !Array.isArray(this._glyph.parameters)) {
			return
		}
		
		const param = this._glyph.parameters.find((p: any) => p.name === name)
		if (param) {
			// 限制值在 min/max 范围内
			if (param.min !== undefined && value < param.min) {
				param.value = param.min
			} else if (param.max !== undefined && value > param.max) {
				param.value = param.max
			} else {
				param.value = value
			}
			// 如果原来是 Constant 类型，设置为 Number 类型
			if (param.type === ParameterType.Constant) {
				param.type = ParameterType.Number
			}
		}
	}

	public getJoint (name) {
		const arr = this.getJoints().filter((joint) => joint.name === name)
		return arr.length ? arr[0] : null
	}

	get components () {
		return orderedListWithItemsForGlyph(this._glyph).concat(this._components as Array<any>)
	}

	public getRatioLayout (value: string): number {
		// TODO: 实现 getRatioLayout2 函数
		// 简化版本：返回 0
		console.warn('getRatioLayout not fully implemented')
		return 0
	}

	public getComponent (name) {
		for (let i = 0; i < this._glyph.components.length; i++) {
			if (this._glyph.components[i].name === name) {
				return this._glyph.components[i]
			}
		}
		return null
	}

	public getGlyph (name) {
		for (let i = 0; i < this._glyph.components.length; i++) {
			if (this._glyph.components[i].name === name) {
				return (this._glyph.components[i].value as ICustomGlyph)._o
			}
		}
		return null
	}

	public getData = () => {
		return {
			_joints: this._joints.map((_joint) => {
				return _joint?.getData()
			}),
			_reflines: this._reflines,
	 		_components: this._components.map((_component) => {
				return _component.getData()
			})
		}
	}

	public setData = (data) => {
		this._joints = data._joints.map((data) => {
			const _joint = new Joint(data.name, {
				x: data._x,
				y: data._y,
			})
			_joint.setData(data)
			return _joint
		})
		this._reflines = data._reflines
		this._components = data._components.map((data) => {
			let component = null
			switch (data.type) {
				case 'glyph-pen': {
					component = new PenComponent()
					break
				}
				case 'glyph-ellipse': {
					component = new EllipseComponent(data.centerX, data.centerY, data.radiusX, data.radiusY)
					break
				}
				case 'glyph-polygon': {
					component = new PolygonComponent()
					break
				}
				case 'glyph-rectangle': {
					component = new RectangleComponent(data.x, data.y, data.width, data.height)
					break
				}
			}
			component.setData(data)
			return component
		})
	}
}

export {
	CustomGlyph,
}