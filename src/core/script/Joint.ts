import { mapCanvasX, mapCanvasY } from '@/utils/canvas'
import { genUUID } from '@/utils/uuid'
import { getStrokeWidth } from '@/utils/canvas-utils'
import type { IGlyphComponent } from '../types'
import { instanceManager } from '../instance/InstanceManager'
import { CustomGlyph } from '../instance/CustomGlyph'
import { executeGlyphScript } from '../script/ScriptExecutor'

export interface IJoint {
  name: string
  x: number | (() => number)
  y: number | (() => number)
  uuid?: string
}

interface IPoint {
	x: number;
	y: number;
}

class Joint {
	public _x: number
	public _y: number
	public uuid: string
	public name: string

  public constructor (name: string, point: IPoint) {
		this._x = point.x
		this._y = point.y
		this.name = name
		this.uuid = genUUID()
	}

	public render (canvas: HTMLCanvasElement) {
		const d = getStrokeWidth() * 2
		const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
		ctx.beginPath()
		ctx.fillStyle = 'blue'
		ctx.fillRect(mapCanvasX(this.x) - d, mapCanvasY(this.y) - d, d * 2, d * 2)
		ctx.closePath()
		ctx.setTransform(1, 0, 0, 1, 0, 0)
	}

	public getCoords () {
		return {
			x: this.x,
			y: this.y,
		}
	}

	public getPlainCoords () {
		return {
			x: this.x,
			y: this.y,
		}
	}

	get x () {
		return this._x
	}

	get y () {
		return this._y
	}

	public getData = () => {
		return {
			_x: this._x,
			_y: this._y,
			uuid: this.uuid,
			name: this.name,
		}
	}

	public setData = (data) => {
		this._x = data._x
		this._y = data._y
		this.uuid = data.uuid
		this.name = data.name
	}
}

const renderJoint = (canvas, joint) => {
	const d = getStrokeWidth() * 2
	const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
	ctx.beginPath()
	ctx.fillStyle = 'blue'
	ctx.fillRect(mapCanvasX(joint.x) - d, mapCanvasY(joint.y) - d, d * 2, d * 2)
	ctx.closePath()
	ctx.setTransform(1, 0, 0, 1, 0, 0)
}

const renderFisrtJoint = (canvas, joint) => {
	const d = getStrokeWidth() * 2
	const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
	ctx.beginPath()
	ctx.fillStyle = 'green'
	ctx.ellipse(mapCanvasX(joint.x), mapCanvasY(joint.y), d * 2, d * 2, 0, 0, Math.PI * 2)
	ctx.fill()
	ctx.closePath()
	ctx.setTransform(1, 0, 0, 1, 0, 0)
}

const renderRefLine = (canvas, refline) => {
	const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
	const p1 = refline.start
	const p2 = refline.end
	ctx.strokeStyle = refline.type === 'ref' ? 'red' : 'blue'
	ctx.lineWidth = getStrokeWidth()
	ctx.beginPath()
	ctx.moveTo(mapCanvasX(p1.x), mapCanvasY(p1.y))
	ctx.lineTo(mapCanvasX(p2.x), mapCanvasY(p2.y))
	ctx.stroke()
}

const renderJoints = (rootComponent, canvas) => {
	const traverse = (_component, _ox, _oy) => {
		const ox = _component.ox + _ox
		const oy = _component.oy + _oy
		// 从 InstanceManager 获取字形实例
		// 使用 component.uuid 作为 instanceKey，与 EditorCanvasRenderer 保持一致
		const instanceKey = _component.uuid
		let glyphInstance: CustomGlyph | null = null
		
		// 如果临时实例已存在，直接获取（说明脚本已执行）
		if (instanceManager.isTemporary(instanceKey)) {
			glyphInstance = instanceManager.acquireTemporaryInstance(
				instanceKey,
				() => new CustomGlyph(_component.value),
				'glyph'
			) as CustomGlyph
		} else {
			// 如果实例不存在，尝试从实例池获取（可能已执行过脚本）
			glyphInstance = instanceManager.getOrCreateGlyphInstance(_component.value, () => {
				return new CustomGlyph(_component.value)
			}) as CustomGlyph
		}
		
		if (!glyphInstance) {
			if (import.meta.env.DEV) {
				console.warn('[renderJoints] Failed to get glyph instance for component:', _component.uuid)
			}
			return
		}
		
		const joints = glyphInstance.getJoints()
		if (import.meta.env.DEV) {
			console.log('[renderJoints] Glyph instance info:', {
				componentUUID: _component.uuid,
				glyphUUID: _component.value.uuid,
				instanceKey,
				isTemporary: instanceManager.isTemporary(instanceKey),
				jointsCount: joints?.length || 0,
				hasGlyphJoints: !!_component.value.joints,
				glyphJointsCount: _component.value.joints?.length || 0,
				instanceJointsCount: joints?.length || 0,
			})
		}
		if (!joints || joints.length === 0) {
			// glyphSkeleton：首次渲染时脚本可能未执行，尝试执行一次生成关节
			const skeletonObj = (_component.value?.skeleton as any)
			if (skeletonObj?.type === 'glyphSkeleton' && skeletonObj?.referenceGlyphData?.adaptedScript) {
				const savedScript = _component.value.script
				_component.value.script = skeletonObj.referenceGlyphData.adaptedScript
				_component.value.script_reference = undefined
				try {
					executeGlyphScript(_component.value, instanceKey, { ignoreTempDataGuard: true })
					if (instanceManager.isTemporary(instanceKey)) {
						glyphInstance = instanceManager.acquireTemporaryInstance(instanceKey, () => new CustomGlyph(_component.value), 'glyph') as CustomGlyph
					} else {
						glyphInstance = instanceManager.getOrCreateGlyphInstance(_component.value, () => new CustomGlyph(_component.value)) as CustomGlyph
					}
					const retryJoints = glyphInstance?.getJoints?.()
					if (retryJoints && retryJoints.length > 0) {
						renderJoints(_component, canvas)
						return
					}
				} catch (e) {
					console.warn('[renderJoints] glyphSkeleton script execution failed:', e)
				} finally {
					_component.value.script = savedScript
				}
			}
			return
		}
		
		const firstJointIndex = joints.findIndex(joint => !joint.name?.includes('_ref')) || 0
		joints.map((joint, index) => {
			// 处理两种情况：Joint 类实例（有 getCoords 方法）或普通对象（有 x, y 属性）
			let x: number, y: number
			if (typeof joint.getCoords === 'function') {
				const coords = joint.getCoords()
				x = coords.x
				y = coords.y
			} else {
				// 普通对象，直接使用 x, y 属性
				x = joint.x ?? joint._x ?? 0
				y = joint.y ?? joint._y ?? 0
			}
			
			if (index === firstJointIndex) {
				renderFisrtJoint(canvas, {
					x: x + ox,
					y: y + oy,
				})
			} else {
				renderJoint(canvas, {
					x: x + ox,
					y: y + oy,
				})
			}
		})
		if (_component.type === 'glyph' && _component.value.components && _component.value.components.length) {
			_component.value.components.map((comp) => {
				traverse(comp, ox, oy)
			})
		}
	}
	traverse(rootComponent, 0, 0)
}

const renderRefLines = (rootComponent, canvas) => {
	const traverse = (_component, _ox, _oy) => {
		const ox = _component.ox + _ox
		const oy = _component.oy + _oy
		// 从 InstanceManager 获取字形实例
		// 使用 component.uuid 作为 instanceKey，与 EditorCanvasRenderer 保持一致
		const instanceKey = _component.uuid
		let glyphInstance: CustomGlyph | null = null
		
		// 如果临时实例已存在，直接获取（说明脚本已执行）
		if (instanceManager.isTemporary(instanceKey)) {
			glyphInstance = instanceManager.acquireTemporaryInstance(
				instanceKey,
				() => new CustomGlyph(_component.value),
				'glyph'
			) as CustomGlyph
		} else {
			// 如果实例不存在，尝试从实例池获取（可能已执行过脚本）
			glyphInstance = instanceManager.getOrCreateGlyphInstance(_component.value, () => {
				return new CustomGlyph(_component.value)
			}) as CustomGlyph
		}
		
		if (!glyphInstance) {
			if (import.meta.env.DEV) {
				console.warn('[renderRefLines] Failed to get glyph instance for component:', _component.uuid)
			}
			return
		}
		
		const reflines = glyphInstance.getRefLines()
		if (import.meta.env.DEV) {
			console.log('[renderRefLines] Glyph instance info:', {
				componentUUID: _component.uuid,
				glyphUUID: _component.value.uuid,
				instanceKey,
				isTemporary: instanceManager.isTemporary(instanceKey),
				reflinesCount: reflines?.length || 0,
				hasGlyphReflines: !!_component.value.reflines,
				glyphReflinesCount: _component.value.reflines?.length || 0,
				instanceReflinesCount: reflines?.length || 0,
			})
		}
		if (!reflines || reflines.length === 0) {
			if (import.meta.env.DEV) {
				console.log('[renderRefLines] No reflines found for component:', _component.uuid)
			}
			return
		}
		
		reflines.map((_refline) => {
			const start = glyphInstance.getJoint(_refline.start)
			const end = glyphInstance.getJoint(_refline.end)
			if (!start || !end) return
			
			// 处理两种情况：Joint 类实例（有 getCoords 方法）或普通对象（有 x, y 属性）
			let startX: number, startY: number, endX: number, endY: number
			if (typeof start.getCoords === 'function') {
				const startCoords = start.getCoords()
				startX = startCoords.x
				startY = startCoords.y
			} else {
				startX = start.x ?? start._x ?? 0
				startY = start.y ?? start._y ?? 0
			}
			
			if (typeof end.getCoords === 'function') {
				const endCoords = end.getCoords()
				endX = endCoords.x
				endY = endCoords.y
			} else {
				endX = end.x ?? end._x ?? 0
				endY = end.y ?? end._y ?? 0
			}
			
			const refline = {
				start: {
					x: startX + ox,
					y: startY + oy,
				},
				end: {
					x: endX + ox,
					y: endY + oy,
				},
				type: _refline.type,
			}
			renderRefLine(canvas, refline)
		})
		if (_component.type === 'glyph' && _component.value.components && _component.value.components.length) {
			_component.value.components.map((comp) => {
				traverse(comp, ox, oy)
			})
		}
	}
	traverse(rootComponent, 0, 0)
}

const getJoints = (rootComponent, subComponentUUID) => {
	let joints = []
	const traverse = (_component, _ox, _oy) => {
		const ox = _component.ox + _ox
		const oy = _component.oy + _oy
		if (subComponentUUID === _component.uuid) {
			// 从 InstanceManager 获取字形实例
			const glyphInstance = instanceManager.getOrCreateGlyphInstance(_component.value, () => {
				return new CustomGlyph(_component.value)
			}) as CustomGlyph
			if (!glyphInstance) return []
			
			// 获取该节点Joints数组
			const allJoints = glyphInstance.getJoints()
			joints = allJoints.map((joint) => {
				// 处理两种情况：Joint 类实例（有 getCoords 方法）或普通对象（有 x, y 属性）
				let x: number, y: number
				if (typeof joint.getCoords === 'function') {
					const coords = joint.getCoords()
					x = coords.x
					y = coords.y
				} else {
					// 普通对象，直接使用 x, y 属性
					x = joint.x ?? joint._x ?? 0
					y = joint.y ?? joint._y ?? 0
				}
				return {
					name: joint.name,
					x: x + ox,
					y: y + oy,
				}
			})
		}
		if (_component.type === 'glyph' && _component.value.components && _component.value.components.length) {
			_component.value.components.map((comp) => {
				traverse(comp, ox, oy)
			})
		}
	}
	traverse(rootComponent, 0, 0)
	return joints
}

export {
	Joint,
	renderJoints,
	renderRefLines,
	getJoints,
}