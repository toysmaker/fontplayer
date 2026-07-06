import { PenComponent } from "../PenComponent";

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
	component: PenComponent;
	/** 关节数据，支持 Joint 实例数组或 { name: Joint } 对象两种形式 */
	joints?: Array<{ name: string; x: number; y: number }> | Record<string, { name: string; x: number; y: number }>;
}

/**
 * interpolateFromKeyframes 的返回值
 */
interface IInterpolationResult {
	component: PenComponent;
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
		const comp = new PenComponent()
		comp.setData(keyframes[0].component.getData())
		const joints = normalizeJoints(keyframes[0].joints) || []
		return { component: comp, joints }
	}

	// 无目标参数：返回第一个关键帧的克隆
	if (!paramPairs || paramPairs.length === 0) {
		if (import.meta.env.DEV) {
			console.warn('[interpolateFromKeyframes] No paramPairs provided, returning first keyframe')
		}
		const comp = new PenComponent()
		comp.setData(keyframes[0].component.getData())
		const joints = normalizeJoints(keyframes[0].joints) || []
		return { component: comp, joints }
	}

	// 验证所有关键帧组件具有相同的点结构（点数一致）
	const pointCount = keyframes[0].component.points.length
	for (let i = 1; i < keyframes.length; i++) {
		if (keyframes[i].component.points.length !== pointCount) {
			if (import.meta.env.DEV) {
				console.error(
					`[interpolateFromKeyframes] Keyframe point count mismatch: ` +
					`keyframe[0] has ${pointCount} points, keyframe[${i}] has ${keyframes[i].component.points.length} points`,
				)
			}
			return null
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

	// 基于 low 关键帧克隆创建结果组件
	const resultComp = new PenComponent()
	resultComp.setData(lowKf.keyframe.component.getData())

	// 对每个点进行线性插值：result = low + (high - low) * t
	const lowPoints = lowKf.keyframe.component.points
	const highPoints = highKf.keyframe.component.points

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

export { interpolateFromKeyframes }
export type { IKeyframe, IInterpolationResult, JointData }
