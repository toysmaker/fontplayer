import { orderedListWithItemsForGlyph, type ICustomGlyph, IRefLine, getRatioLayout2, executeScript } from '../stores/glyph'
import { PenComponent } from './PenComponent'
import { PolygonComponent } from './PolygonComponent'
import { EllipseComponent } from './EllipseComponent'
import { RectangleComponent } from './RectangleComponent'
import { clearCanvas, computeCoords, fillBackground, renderCanvas, renderGridCanvas } from '../canvas/canvas'
import { fontRenderStyle, background, grid } from '../stores/global'
import { Joint } from './Joint'
import { mapCanvasX, mapCanvasY } from '../../utils/canvas'

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
	public tempData: any = null

	constructor (glyph: ICustomGlyph) {
		this._glyph = glyph
		glyph._o = this
	}

	public getJoints () {
		if (this._glyph.joints) {
			return [...this._glyph.joints, ...this._joints]
		} else {
			return this._joints
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
	}

	public clear () {
		this._joints = []
		this._components = []
		this._reflines = []
	}

	public render (canvas: HTMLCanvasElement, renderBackground: Boolean = true, offset: {
		x: number,
		y: number,
	} = { x: 0, y: 0 }, fill: boolean = false, scale: number = 1) {
		const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
		renderCanvas(orderedListWithItemsForGlyph(this._glyph), canvas, {
			offset,
			scale: scale,
			fill: false,
			forceUpdate: false,
		})
		this._components.forEach((component) => {
			component.render(canvas, {
				offset,
				scale: scale,
			})
		})
		if (fontRenderStyle.value === 'color' || fill) {
			ctx.fillStyle = '#000'
			ctx.fill()
		}
	}

	public render_forceUpdate (canvas: HTMLCanvasElement, renderBackground: Boolean = true, offset: {
		x: number,
		y: number,
	} = { x: 0, y: 0 }, fill: boolean = false, scale: number = 1) {
		const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
		renderCanvas(orderedListWithItemsForGlyph(this._glyph), canvas, {
			offset,
			scale: scale,
			fill: false,
			forceUpdate: true,
		})
		this._components.forEach((component) => {
			component.render(canvas, {
				offset,
				scale: scale,
			})
		})
		if (fontRenderStyle.value === 'color' || fill) {
			ctx.fillStyle = '#000'
			ctx.fill()
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
				joint.render(canvas)
			})
		} else if (options.type === 'selected' && options.joints.length) {
			this.getJoints().forEach((joint) => {
				if (options.joints.indexOf(joint.name) !== -1) {
					joint.render(canvas)
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
				const p1 = this.getJoint(refline.start).getCoords()
				const p2 = this.getJoint(refline.end).getCoords()
				ctx.strokeStyle = refline.type === 'ref' ? 'red' : 'blue'
				ctx.beginPath()
				ctx.moveTo(mapCanvasX(p1.x), mapCanvasY(p1.y))
				ctx.lineTo(mapCanvasX(p2.x), mapCanvasY(p2.y))
				ctx.stroke()
			})
		} else if (options.type === 'selected' && options.reflines.length) {
			this.getRefLines().forEach((refline) => {
				if (options.reflines.indexOf(refline.name) !== -1) {
					const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
					const p1 = this.getJoint(refline.start).getCoords()
					const p2 = this.getJoint(refline.end).getCoords()
					ctx.strokeStyle = refline.type === 'ref' ? 'red' : 'blue'
					ctx.beginPath()
					ctx.moveTo(mapCanvasX(p1.x), mapCanvasY(p1.y))
					ctx.lineTo(mapCanvasX(p2.x), mapCanvasY(p2.y))
					ctx.stroke()
				}
			})
		}
	}

	public addRefLine (refline) {
		this._reflines.push(refline)
	}

	public getParam (name: string) {
		return this._glyph.parameters.get(name)
	}

	public getParamRange (name: string) {
		return this._glyph.parameters.getRange(name)
	}

	public setParam (name: string, value: number) {
		this._glyph.parameters.set(name, value)
	}

	public getJoint (name) {
		const arr = this.getJoints().filter((joint) => joint.name === name)
		return arr.length ? arr[0] : null
	}

	get components () {
		return orderedListWithItemsForGlyph(this._glyph).concat(this._components as Array<any>)
	}

	public getRatioLayout (value) {
		return getRatioLayout2(this._glyph, value)
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