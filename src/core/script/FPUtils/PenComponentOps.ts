import { PenComponent } from "../PenComponent";
import paper from 'paper'
import { genUUID } from '@/utils/uuid'
import type { IContour } from '@/core/font/types'
import { PathType } from '@/core/font/types'

/**
 * 关键帧关节数据：可以是 Joint 实例数组或 key-value 对象
 */
type JointData = { name: string; x: number; y: number }

/**
 * 关键帧接口
 * 每个关键帧包含一组参数值、一个钢笔组件和可选的关节数组
 */
interface IKeyframe {
	paramPairs: Array<{ name: string, value: number }>;
	component?: PenComponent;
	/** 关节数据，支持 Joint 实例数组或 { name: Joint } 对象两种形式 */
	joints?: Array<{ name: string; x: number; y: number }> | Record<string, { name: string; x: number; y: number }>;
}

/**
 * interpolateFromKeyframes 的返回值
 */
interface IInterpolationResult {
	component?: PenComponent;
	joints: Array<JointData>;
}

/**
 * 将 joints 统一规范化为数组形式
 * 支持 Joint 实例数组和 { name: Joint } 对象两种输入
 */
const normalizeJoints = (
	joints: IKeyframe['joints'],
): Array<JointData> | null => {
	if (!joints) return null

	// 数组形式：直接提取坐标
	if (Array.isArray(joints)) {
		return joints.map((j) => ({
			name: j.name,
			x: j.x,
			y: j.y,
		}))
	}

	// 对象形式：按插入顺序转为数组
	if (typeof joints === 'object') {
		return Object.values(joints).map((j: any) => ({
			name: j.name,
			x: j.x,
			y: j.y,
		}))
	}

	return null
}

/**
 * 根据参数值在关键帧之间进行线性插值，返回插值后的钢笔组件和关节数组
 *
 * 算法说明：
 * - 使用主参数（paramPairs 中的第一个参数）作为插值轴
 * - 在主参数轴上查找目标值两侧的关键帧
 * - 对两个关键帧组件中每个点的 x、y 坐标进行线性插值（lerp）
 * - 若关键帧提供了 joints，同样对关节坐标进行线性插值
 * - 若目标值超出关键帧范围，则 clamp 到最近的关键帧
 * - 若目标值精确匹配某个关键帧的参数值，则返回该关键帧的克隆
 *
 * 使用示例（参见 public/templates/private/icons/可变换脸型.js）：
 * ```js
 * const keyframes = [
 *   {
 *     component: pen1,
 *     joints: skeleton,
 *     paramPairs: [{ name: 'degree', value: 0 }],
 *   },
 *   {
 *     component: pen2,
 *     joints: [p0_45, p01_45, ...],
 *     paramPairs: [{ name: 'degree', value: 45 }],
 *   },
 * ]
 * const { component: pen, joints: newSkeleton } = FP.interpolateFromKeyframes(
 *   keyframes,
 *   [{ name: 'degree', value: degree }],
 * )
 * ```
 *
 * @param keyframes - 关键帧数组，每个关键帧包含参数值、钢笔组件和可选的关节数据
 * @param paramPairs - 目标参数值对，主插值轴为第一个参数
 * @returns 包含插值后组件和关节数组的结果对象，若关键帧为空则返回 null
 */
const interpolateFromKeyframes = (
	keyframes: Array<IKeyframe>,
	paramPairs: Array<{ name: string, value: number }>,
): IInterpolationResult | null => {
	// 边界检查：关键帧为空
	if (!keyframes || keyframes.length === 0) {
		if (import.meta.env.DEV) {
			console.warn('[interpolateFromKeyframes] No keyframes provided, returning null')
		}
		return null
	}

	// 单个关键帧：直接克隆返回
	if (keyframes.length === 1) {
		const kf = keyframes[0]
		let comp: PenComponent | undefined = undefined
		if (kf.component) {
			comp = new PenComponent()
			comp.setData(kf.component.getData())
		}
		const joints = normalizeJoints(kf.joints) || []
		return { component: comp, joints }
	}

	// 无目标参数：返回第一个关键帧的克隆
	if (!paramPairs || paramPairs.length === 0) {
		if (import.meta.env.DEV) {
			console.warn('[interpolateFromKeyframes] No paramPairs provided, returning first keyframe')
		}
		const kf = keyframes[0]
		let comp: PenComponent | undefined = undefined
		if (kf.component) {
			comp = new PenComponent()
			comp.setData(kf.component.getData())
		}
		const joints = normalizeJoints(kf.joints) || []
		return { component: comp, joints }
	}

	// 判断关键帧中可插值的数据类型
	const hasComponents = keyframes.every(kf => kf.component != null)
	const hasJoints = keyframes.some(kf => kf.joints != null)

	if (!hasComponents && !hasJoints) {
		if (import.meta.env.DEV) {
			console.warn('[interpolateFromKeyframes] No components or joints found in keyframes')
		}
		return null
	}

	// 验证所有关键帧组件具有相同的点结构（仅在有关键帧包含组件时）
	let pointCount = 0
	if (hasComponents) {
		pointCount = keyframes[0].component!.points.length
		for (let i = 1; i < keyframes.length; i++) {
			if (keyframes[i].component!.points.length !== pointCount) {
				if (import.meta.env.DEV) {
					console.error(
						`[interpolateFromKeyframes] Keyframe point count mismatch: ` +
						`keyframe[0] has ${pointCount} points, keyframe[${i}] has ${keyframes[i].component!.points.length} points`,
					)
				}
				return null
			}
		}
	}

	// 使用主参数（paramPairs 中的第一个参数）作为插值轴
	const primaryParam = paramPairs[0]
	const primaryName = primaryParam.name
	const targetValue = primaryParam.value

	// 为每个关键帧提取主参数值
	const sortedKeyframes = keyframes.map((kf) => {
		const param = kf.paramPairs.find((p) => p.name === primaryName)
		return {
			keyframe: kf,
			primaryValue: param ? param.value : 0,
		}
	})

	// 按主参数值升序排序
	sortedKeyframes.sort((a, b) => a.primaryValue - b.primaryValue)

	// 查找目标值所在区间的两个关键帧（支持外推）
	const lastIdx = sortedKeyframes.length - 1
	let lowKf = sortedKeyframes[0]
	let highKf = sortedKeyframes[lastIdx]

	if (targetValue <= sortedKeyframes[0].primaryValue) {
		// 外推：目标值在最小关键帧左侧，用前两个关键帧的趋势向外延伸
		lowKf = sortedKeyframes[0]
		highKf = sortedKeyframes.length > 1 ? sortedKeyframes[1] : sortedKeyframes[0]
	} else if (targetValue >= sortedKeyframes[lastIdx].primaryValue) {
		// 外推：目标值在最大关键帧右侧，用最后两个关键帧的趋势向外延伸
		lowKf = sortedKeyframes.length > 1 ? sortedKeyframes[lastIdx - 1] : sortedKeyframes[lastIdx]
		highKf = sortedKeyframes[lastIdx]
	} else {
		// 内插：在关键帧范围内，查找所在区间
		for (let i = 0; i < sortedKeyframes.length - 1; i++) {
			if (
				targetValue >= sortedKeyframes[i].primaryValue &&
				targetValue <= sortedKeyframes[i + 1].primaryValue
			) {
				lowKf = sortedKeyframes[i]
				highKf = sortedKeyframes[i + 1]
				break
			}
		}
	}

	// 计算插值权重 t（允许超出 [0, 1] 范围以支持外推）
	const range = highKf.primaryValue - lowKf.primaryValue
	const t = range === 0 ? 0 : (targetValue - lowKf.primaryValue) / range

	if (import.meta.env.DEV) {
		const mode = t < 0 ? 'extrapolate-left' : t > 1 ? 'extrapolate-right' : 'interpolate'
		console.log(
			`[interpolateFromKeyframes] ${mode} '${primaryName}': ` +
			`low=${lowKf.primaryValue}, high=${highKf.primaryValue}, target=${targetValue}, t=${t.toFixed(4)}`,
		)
	}

	// --- 组件点插值 ---

	let resultComp: PenComponent | undefined = undefined

	if (hasComponents) {
		// 基于 low 关键帧克隆创建结果组件
		resultComp = new PenComponent()
		resultComp.setData(lowKf.keyframe.component!.getData())

		// 对每个点进行线性插值：result = low + (high - low) * t
		const lowPoints = lowKf.keyframe.component!.points
		const highPoints = highKf.keyframe.component!.points

		for (let i = 0; i < pointCount; i++) {
			const lp = lowPoints[i]
			const hp = highPoints[i]
			resultComp.points[i] = {
				...resultComp.points[i],
				x: lp.x + (hp.x - lp.x) * t,
				y: lp.y + (hp.y - lp.y) * t,
			}
		}

		// 清除计算缓存（contour、preview 等将在后续渲染管线中重新计算）
		resultComp.contour = []
		resultComp.preview = []
	}

	// --- 关节插值 ---

	const lowJoints = normalizeJoints(lowKf.keyframe.joints)
	const highJoints = normalizeJoints(highKf.keyframe.joints)
	let resultJoints: Array<JointData> = []

	if (lowJoints && highJoints && lowJoints.length === highJoints.length) {
		resultJoints = lowJoints.map((lowJoint, i) => {
			const highJoint = highJoints[i]
			return {
				name: lowJoint.name,
				x: lowJoint.x + (highJoint.x - lowJoint.x) * t,
				y: lowJoint.y + (highJoint.y - lowJoint.y) * t,
			}
		})

		if (import.meta.env.DEV) {
			console.log(
				`[interpolateFromKeyframes] Joints interpolated: ${resultJoints.length} joints`,
			)
		}
	} else if (lowJoints || highJoints) {
		// 只有一个关键帧提供了 joints，或关节数量不一致
		if (import.meta.env.DEV) {
			console.warn(
				'[interpolateFromKeyframes] Joints mismatch between keyframes: ' +
				`low has ${lowJoints?.length ?? 0}, high has ${highJoints?.length ?? 0}. ` +
				'Returning joints from the closer keyframe.',
			)
		}
		// 返回更接近目标值的关键帧的关节
		resultJoints = t < 0.5 ? (lowJoints || []) : (highJoints || [])
	} else {
		// 两个关键帧都没有提供 joints
		resultJoints = []
	}

	return { component: resultComp, joints: resultJoints }
}

// ==================== 工具函数：PenComponent ↔ Contour ↔ Paper.Path ====================

/**
 * 将 PenComponent 的点数组转换为轮廓（IContour）
 * PenComponent 点格式：[anchor0, ctrl1, ctrl2, anchor1, ctrl1, ctrl2, ...]
 * 与 genPenContour 算法一致：每 3 个点组成一段三次贝塞尔曲线
 */
const penPointsToContour = (points: Array<{ x: number; y: number }>): IContour => {
	const contour: IContour = []
	for (let i = 0; i < points.length - 1; i += 3) {
		if (i + 3 >= points.length) break
		contour.push({
			type: PathType.CUBIC_BEZIER as const,
			start:  { x: points[i].x,     y: points[i].y },
			end:    { x: points[i + 3].x, y: points[i + 3].y },
			control1: { x: points[i + 1].x, y: points[i + 1].y },
			control2: { x: points[i + 2].x, y: points[i + 2].y },
		})
	}
	return contour
}

/**
 * 将轮廓转换为 Paper.js Path
 */
const contourToPaperPath = (contour: IContour): paper.Path => {
	const path = new paper.Path()
	if (contour.length === 0) return path

	const seg0 = contour[0]
	path.moveTo(new paper.Point(seg0.start.x, seg0.start.y))
	let lastX = seg0.start.x
	let lastY = seg0.start.y

	for (const segment of contour) {
		if (segment.type === PathType.LINE) {
			path.lineTo(new paper.Point(segment.end.x, segment.end.y))
			lastX = segment.end.x
			lastY = segment.end.y
		} else if (segment.type === PathType.CUBIC_BEZIER) {
			path.cubicCurveTo(
				new paper.Point(segment.control1.x, segment.control1.y),
				new paper.Point(segment.control2.x, segment.control2.y),
				new paper.Point(segment.end.x, segment.end.y),
			)
			lastX = segment.end.x
			lastY = segment.end.y
		} else if (segment.type === PathType.QUADRATIC_BEZIER) {
			const startPt = new paper.Point(lastX, lastY)
			const control = new paper.Point(segment.control.x, segment.control.y)
			const endPt = new paper.Point(segment.end.x, segment.end.y)
			const c1 = startPt.multiply(1 / 3).add(control.multiply(2 / 3))
			const c2 = endPt.multiply(1 / 3).add(control.multiply(2 / 3))
			path.cubicCurveTo(c1, c2, endPt)
			lastX = segment.end.x
			lastY = segment.end.y
		}
	}

	path.closePath()
	return path
}

/**
 * 将 Paper.js Path 转换为轮廓（IContour）
 */
const paperPathToContour = (path: paper.Path): IContour => {
	const contour: IContour = []
	if (!path.curves || path.curves.length === 0) return contour

	for (const curve of path.curves) {
		const p0 = curve.point1
		const p1 = p0.add(curve.handle1)
		const p2 = curve.point2.add(curve.handle2)
		const p3 = curve.point2

		contour.push({
			type: PathType.CUBIC_BEZIER as const,
			start: { x: p0.x, y: p0.y },
			control1: { x: p1.x, y: p1.y },
			control2: { x: p2.x, y: p2.y },
			end: { x: p3.x, y: p3.y },
		})
	}

	return contour
}

/**
 * 将轮廓转换回 PenComponent 的点数组
 * 轮廓格式：[{start, control1, control2, end}, ...]
 * 输出格式：[anchor0, ctrl1_0, ctrl2_0, anchor1, ctrl1_1, ctrl2_1, ...]
 * 对于闭合路径，最后一个 anchor 等于第一个 anchor
 */
const contourToPenPoints = (
	contour: IContour,
): Array<{ uuid: string; type: string; x: number; y: number; origin: string | null }> => {
	const points: Array<{ uuid: string; type: string; x: number; y: number; origin: string | null }> = []

	if (contour.length === 0) return points

	// 第一个锚点
	const firstAnchorUuid = genUUID()
	points.push({
		uuid: firstAnchorUuid,
		type: 'anchor',
		x: contour[0].start.x,
		y: contour[0].start.y,
		origin: null,
	})

	for (let i = 0; i < contour.length; i++) {
		const seg = contour[i]
		const anchorUuid = genUUID()

		// control1 — origin 指向前一个锚点
		points.push({
			uuid: genUUID(),
			type: 'control',
			x: ('control1' in seg ? seg.control1.x : seg.start.x),
			y: ('control1' in seg ? seg.control1.y : seg.start.y),
			origin: points[points.length - 1].uuid,
		})

		// control2 — origin 指向当前段的目标锚点
		points.push({
			uuid: genUUID(),
			type: 'control',
			x: ('control2' in seg ? seg.control2.x : seg.end.x),
			y: ('control2' in seg ? seg.control2.y : seg.end.y),
			origin: anchorUuid,
		})

		// 锚点
		points.push({
			uuid: anchorUuid,
			type: 'anchor',
			x: seg.end.x,
			y: seg.end.y,
			origin: null,
		})
	}

	// 对于闭合路径，最后一个锚点应与第一个锚点坐标一致
	if (points.length >= 4) {
		const first = points[0]
		const last = points[points.length - 1]
		if (Math.abs(last.x - first.x) < 0.001 && Math.abs(last.y - first.y) < 0.001) {
			// 移除最后一个重复的锚点及其前面的两个控制点
			// 因为 genPenContour 期望 [a0, c1, c2, a1, c1, c2, a2, ...] 最后锚点不应重复
			points.pop() // anchor
			points.pop() // control2
			points.pop() // control1
		}
	}

	return points
}

/**
 * 将 PenComponent 转换为 Paper.js Path
 */
const penComponentToPaperPath = (pen: PenComponent): paper.Path => {
	const contour = penPointsToContour(pen.points)
	return contourToPaperPath(contour)
}

/**
 * 将 Paper.js 布尔运算结果转换为新的 PenComponent
 * 若结果为 CompoundPath，取面积最大的子路径
 */
const paperResultToPenComponent = (result: paper.PathItem): PenComponent | null => {
	if (!result || (result as any).isEmpty?.()) return null

	// 处理 CompoundPath：找到面积最大的子路径
	const children = (result as any).children
	let bestPath: paper.Path | null = null
	let maxArea = -Infinity

	if (children && children.length > 0) {
		for (const child of children) {
			if (child instanceof paper.Path && child.curves && child.curves.length > 0) {
				const area = Math.abs((child as any).area ?? 0)
				if (area > maxArea) {
					maxArea = area
					bestPath = child
				}
			}
		}
	} else if (result instanceof paper.Path && result.curves && result.curves.length > 0) {
		bestPath = result
	}

	if (!bestPath || bestPath.curves.length === 0) return null

	const contour = paperPathToContour(bestPath)
	const points = contourToPenPoints(contour)

	if (points.length < 4) return null

	const comp = new PenComponent()
	comp.points = points
	comp.isClosed = true
	// 清除计算缓存
	comp.contour = []
	comp.preview = []

	return comp
}

/**
 * 布尔运算通用执行函数
 */
const executeBooleanOp = (
	pen1: PenComponent,
	pen2: PenComponent,
	operation: 'unite' | 'intersect' | 'subtract',
): PenComponent | null => {
	if (!pen1 || !pen1.points || pen1.points.length < 4) {
		if (import.meta.env.DEV) {
			console.warn(`[PenComponentOps] ${operation}: pen1 has insufficient points`)
		}
		return null
	}
	if (!pen2 || !pen2.points || pen2.points.length < 4) {
		if (import.meta.env.DEV) {
			console.warn(`[PenComponentOps] ${operation}: pen2 has insufficient points`)
		}
		return null
	}

	try {
		const path1 = penComponentToPaperPath(pen1)
		const path2 = penComponentToPaperPath(pen2)

		let result: paper.PathItem
		if (operation === 'unite') {
			result = path1.unite(path2) as paper.PathItem
		} else if (operation === 'intersect') {
			result = path1.intersect(path2) as paper.PathItem
		} else {
			result = path1.subtract(path2) as paper.PathItem
		}

		// 清理临时 paper 路径
		path1.remove()
		path2.remove()

		const penResult = paperResultToPenComponent(result)

		// 清理结果 paper 路径
		if (result) result.remove()

		if (!penResult) {
			if (import.meta.env.DEV) {
				console.warn(`[PenComponentOps] ${operation}: boolean operation produced empty result`)
			}
			return null
		}

		if (import.meta.env.DEV) {
			console.log(
				`[PenComponentOps] ${operation}: pen1(${pen1.points.length}pts) + pen2(${pen2.points.length}pts) → result(${penResult.points.length}pts)`,
			)
		}

		return penResult
	} catch (e) {
		if (import.meta.env.DEV) {
			console.error(`[PenComponentOps] ${operation} failed:`, e)
		}
		return null
	}
}

// ==================== 公开方法 ====================

/**
 * 对钢笔组件进行旋转变换
 * 围绕指定中心点旋转给定的角度（单位为度，360°制），返回旋转后的新组件
 *
 * @param pen - 要旋转的钢笔组件
 * @param angle - 旋转角度（度），正值顺时针旋转
 * @param center - 旋转中心点
 * @returns 旋转后的新 PenComponent
 */
const rotatePenComponent = (
	pen: PenComponent,
	angle: number,
	center: { x: number; y: number },
): PenComponent => {
	const comp = new PenComponent()
	comp.setData(pen.getData())

	const angleRad = (angle * Math.PI) / 180
	const cosA = Math.cos(angleRad)
	const sinA = Math.sin(angleRad)

	for (let i = 0; i < comp.points.length; i++) {
		const dx = comp.points[i].x - center.x
		const dy = comp.points[i].y - center.y
		comp.points[i] = {
			...comp.points[i],
			x: center.x + dx * cosA - dy * sinA,
			y: center.y + dx * sinA + dy * cosA,
		}
	}

	// 清除计算缓存
	comp.contour = []
	comp.preview = []

	if (import.meta.env.DEV) {
		console.log(
			`[PenComponentOps] rotate: angle=${angle}°, center=(${center.x},${center.y}), points=${comp.points.length}`,
		)
	}

	return comp
}

/**
 * 布尔差集运算：pen1 - pen2
 * 从 pen1 中减去 pen2 的区域，返回结果中面积最大的部分
 *
 * @param pen1 - 被减钢笔组件
 * @param pen2 - 减去区域钢笔组件
 * @returns 差集运算后的新 PenComponent，结果为空时返回 null
 */
const subtractOp = (pen1: PenComponent, pen2: PenComponent): PenComponent | null => {
	return executeBooleanOp(pen1, pen2, 'subtract')
}

/**
 * 布尔交集运算：pen1 ∩ pen2
 * 取 pen1 和 pen2 重叠的区域
 *
 * @param pen1 - 第一个钢笔组件
 * @param pen2 - 第二个钢笔组件
 * @returns 交集运算后的新 PenComponent，结果为空时返回 null
 */
const intersectOp = (pen1: PenComponent, pen2: PenComponent): PenComponent | null => {
	return executeBooleanOp(pen1, pen2, 'intersect')
}

/**
 * 布尔并集运算：pen1 ∪ pen2
 * 合并 pen1 和 pen2 的区域
 *
 * @param pen1 - 第一个钢笔组件
 * @param pen2 - 第二个钢笔组件
 * @returns 并集运算后的新 PenComponent，结果为空时返回 null
 */
const unionOp = (pen1: PenComponent, pen2: PenComponent): PenComponent | null => {
	return executeBooleanOp(pen1, pen2, 'unite')
}

/**
 * 对骨架（关节数组）进行旋转变换
 * 围绕指定中心点旋转给定角度（度，360°制），返回旋转后的新关节数组
 *
 * @param skeleton - 关节数组，每项包含 name、x、y
 * @param angle - 旋转角度（度），正值顺时针旋转
 * @param center - 旋转中心点
 * @returns 旋转后的新关节数组
 */
const rotateSkeleton = (
	skeleton: Array<{ name: string; x: number; y: number }>,
	angle: number,
	center: { x: number; y: number },
): Array<{ name: string; x: number; y: number }> => {
	const angleRad = (angle * Math.PI) / 180
	const cosA = Math.cos(angleRad)
	const sinA = Math.sin(angleRad)

	const result = skeleton.map((joint) => {
		const dx = joint.x - center.x
		const dy = joint.y - center.y
		return {
			name: joint.name,
			x: center.x + dx * cosA - dy * sinA,
			y: center.y + dx * sinA + dy * cosA,
		}
	})

	if (import.meta.env.DEV) {
		console.log(
			`[PenComponentOps] rotateSkeleton: angle=${angle}°, center=(${center.x},${center.y}), joints=${result.length}`,
		)
	}

	return result
}

export { interpolateFromKeyframes, rotatePenComponent, rotateSkeleton, subtractOp, intersectOp, unionOp }
export type { IKeyframe, IInterpolationResult, JointData }
