import { EllipseComponent } from './EllipseComponent'
import { PenComponent } from './PenComponent'
import { PolygonComponent } from './PolygonComponent'
import { RectangleComponent } from './RectangleComponent'
import { Skeleton } from './Skeleton'
import { Joint } from './Joint'
import { Character } from '../instance/Character'
import { _fitCurve as fitCurve } from '../utils/fitCurve'
import { bezierCurve, multiBezierCurve, IPoint } from '../utils/bezierCurve'
import * as R from 'ramda'

interface IGetContoursOption {
	unticlockwise?: boolean;
	skeletonPos?: string;
	weightsVariation?: string;
	weightsVariationPower?: number;
	weightsVariationDir?: string;
	startWeight?: number;
	endWeight?: number;
	weightsVariationFnType?: string;
	in_startWeight?: number;
	in_endWeight?: number;
	out_startWeight?: number;
	out_endWeight?: number;
	weightsVariationSpeed?: number;
	startCapType?: 'horizontal' | 'vertical' | 'normal'; // 起笔类型：水平方头、竖直方头、正常（垂直于骨架）
	endCapType?: 'horizontal' | 'vertical' | 'normal'; // 收笔类型：水平方头、竖直方头、正常（垂直于骨架）
	capTransitionRatio?: number; // 方头到法线的过渡比例，默认0.1（前10%和后10%使用方头方向）
}

const getLineContours = (name, skeleton, weight, options: IGetContoursOption) => {
	// 确保 weight 是数字类型（如果 getParam 正确解析了 Constant 类型，这应该已经是数字）
	if (typeof weight !== 'number') {
		if (import.meta.env.DEV) {
			console.warn(`[FP.getLineContours] Invalid weight type for ${name}:`, {
				weight,
				type: typeof weight,
				note: 'This may indicate that getParam did not resolve Constant type correctly'
			})
		}
		// 如果仍然是字符串（UUID），尝试转换为数字，但会失败，所以使用默认值
		weight = Number(weight) || 40
	}
	
	let { startWeight, endWeight } = options || {}
	if (!startWeight) {
		startWeight = weight
	} else if (typeof startWeight !== 'number') {
		startWeight = Number(startWeight) || weight
	}
	if (!endWeight) {
		endWeight = weight
	} else if (typeof endWeight !== 'number') {
		endWeight = Number(endWeight) || weight
	}
	let unticlockwise = false
	let skeletonPos = 'center'
	if (options && options.unticlockwise) {
		unticlockwise = options.unticlockwise
	}
	if (options && options.skeletonPos) {
		skeletonPos = options.skeletonPos
	}
  const start = skeleton[`${name}_start`]
	const end = skeleton[`${name}_end`]
	
	if (import.meta.env.DEV && (!start || !end)) {
		console.warn(`[FP.getLineContours] Invalid skeleton for ${name}:`, { start, end, skeleton })
	}
	
	const angle = Math.atan2(end.y - start.y, end.x - start.x)

	const contours = {}

	// 顺时针方向，右上侧为out, 左下侧为in
	// 逆时针方向，左下侧为out, 右上侧为in

	if (skeletonPos === 'center' && !unticlockwise) {
		contours[`out_${name}_start`] = {
			x: start.x + startWeight / 2 * Math.sin(angle),
			y: start.y - startWeight / 2 * Math.cos(angle),
		}
		contours[`in_${name}_start`] = {
			x: start.x - startWeight / 2 * Math.sin(angle),
			y: start.y + startWeight / 2 * Math.cos(angle),
		}
		contours[`out_${name}_end`] = {
			x: end.x + endWeight / 2 * Math.sin(angle),
			y: end.y - endWeight / 2 * Math.cos(angle),
		}
		contours[`in_${name}_end`] = {
			x: end.x - endWeight / 2 * Math.sin(angle),
			y: end.y + endWeight / 2 * Math.cos(angle),
		}
	}

	else if (skeletonPos === 'center' && unticlockwise) {
		contours[`out_${name}_start`] = {
			x: start.x - startWeight / 2 * Math.sin(angle),
			y: start.y + startWeight / 2 * Math.cos(angle),
		}
		contours[`in_${name}_start`] = {
			x: start.x + startWeight / 2 * Math.sin(angle),
			y: start.y - startWeight / 2 * Math.cos(angle),
		}
		contours[`out_${name}_end`] = {
			x: end.x - endWeight / 2 * Math.sin(angle),
			y: end.y + endWeight / 2 * Math.cos(angle),
		}
		contours[`in_${name}_end`] = {
			x: end.x + endWeight / 2 * Math.sin(angle),
			y: end.y - endWeight / 2 * Math.cos(angle),
		}
	}

	else if (skeletonPos === 'inner' && !unticlockwise) {
		contours[`out_${name}_start`] = {
			x: start.x + startWeight * Math.sin(angle),
			y: start.y - startWeight * Math.cos(angle),
		}
		contours[`in_${name}_start`] = {
			x: start.x,
			y: start.y,
		}
		contours[`out_${name}_end`] = {
			x: end.x + endWeight * Math.sin(angle),
			y: end.y - endWeight * Math.cos(angle),
		}
		contours[`in_${name}_end`] = {
			x: end.x,
			y: end.y,
		}
	}

	if (import.meta.env.DEV) {
		console.log(`[FP.getLineContours] ${name}:`, {
			start: { x: start?.x, y: start?.y },
			end: { x: end?.x, y: end?.y },
			weight,
			weightType: typeof weight,
			skeletonPos,
			unticlockwise,
			returnedKeys: Object.keys(contours),
			returnedValues: Object.keys(contours).reduce((acc, key) => {
				acc[key] = contours[key]
				return acc
			}, {} as any),
		})
	}

	return contours
}

// 辅助函数：根据给定的 x 坐标，在贝塞尔曲线上找到对应的参数 t，然后返回 y 值
// 输入的 x 是 x 坐标（0-1），不是曲线参数 t
const getYFromBezierByX = (bezier: Array<IPoint>, targetX: number): number => {
	// 二分查找找到对应的参数 t，使得 bezier 的 x 坐标等于 targetX
	let tLow = 0
	let tHigh = 1
	let t = 0.5
	
	for (let i = 0; i < 30; i++) {
		t = (tLow + tHigh) / 2
		const point = bezierCurve.q(bezier, t)
		if (Math.abs(point.x - targetX) < 0.0001) break
		if (point.x < targetX) tLow = t
		else tHigh = t
	}
	
	const point = bezierCurve.q(bezier, t)
	return point.y
}

// 辅助函数：根据给定的 x 坐标，在高阶贝塞尔曲线上找到对应的参数 t，然后返回 y 值
// 输入的 x 是 x 坐标（0-1），不是曲线参数 t
const getYFromMultiBezierByX = (bezier: Array<IPoint>, targetX: number, speed: number = 1.0): number => {
	// 二分查找找到对应的参数 t，使得 bezier 的 x 坐标等于 targetX
	let tLow = 0
	let tHigh = 1
	let t = 0.5
	
	for (let i = 0; i < 30; i++) {
		t = (tLow + tHigh) / 2
		const point = multiBezierCurve.q(bezier, t)
		if (Math.abs(point.x - targetX) < 0.0001) break
		if (point.x < targetX) tLow = t
		else tHigh = t
	}
	
	const remappedT = remapParameter(t, speed)
  const point = multiBezierCurve.q(bezier, remappedT)
	return point.y
}

// Sigmoid 重映射 - 控制变化的平滑度和速度
// k 控制变化速度：k 越大，变化越快（更陡），k 越小，变化越慢（更平缓）
// center 控制中心点位置（0-1）
const sigmoidRemap = (t: number, k: number = 1.0, center: number = 0.5): number => {
  // 边界处理
  if (t <= 0) return 0
  if (t >= 1) return 1
  
  // 将 t 映射到 sigmoid 曲线
  const shifted = (t - center) * k
  return 1 / (1 + Math.exp(-shifted))
}

// 归一化 sigmoid 到 [0, 1] 范围
// k 控制变化速度：k > 1 变化更快，k < 1 变化更慢，k = 1 线性映射
const normalizedSigmoidRemap = (t: number, k: number = 1.0): number => {
  // 如果 k 为 1 或接近 1，直接返回线性映射
  if (Math.abs(k - 1.0) < 0.001) {
    return Math.max(0, Math.min(1, t))
  }
  
  // 边界处理
  if (t <= 0) return 0
  if (t >= 1) return 1
  
  const sigmoid = sigmoidRemap(t, k, 0.5)
  const min = sigmoidRemap(0, k, 0.5)
  const max = sigmoidRemap(1, k, 0.5)
  
  // 防止除零
  const range = max - min
  if (Math.abs(range) < 1e-10) {
    return t
  }
  
  const result = (sigmoid - min) / range
  // 确保结果在 [0, 1] 范围内
  return Math.max(0, Math.min(1, result))
}

// 参数重映射函数 - 控制变化速度（对称版本）
// speed 参数：> 1 表示变化更快（更陡），< 1 表示变化更慢（更平缓）
// 保证 t=0 和 t=1 两端的变化速率一致
const remapParameter = (t: number, speed: number = 1.0): number => {
  // speed = 1: 线性映射（不变）
  if (speed === 1.0) return t
  
  // 边界处理
  if (t <= 0) return 0
  if (t >= 1) return 1
  
  // 使用对称映射：将 [0, 1] 分成两半，分别应用相同的变换
  // 这样保证两端的变化速率一致
  if (t < 0.5) {
    // 前半段：将 [0, 0.5] 映射到 [0, 0.5]，使用幂函数
    const normalized = t * 2  // 映射到 [0, 1]
    const remapped = Math.pow(normalized, speed)
    return remapped * 0.5  // 映射回 [0, 0.5]
  } else {
    // 后半段：将 [0.5, 1] 映射到 [0.5, 1]，使用相同的变换（对称）
    const normalized = (1 - t) * 2  // 映射到 [1, 0]，然后反转
    const remapped = Math.pow(normalized, speed)
    return 1 - remapped * 0.5  // 映射回 [0.5, 1]
  }
}

const bezierFn = (x: number) : number => {
	const bezier = [
		{ x: 0, y: 0 },
		{ x: 0, y: 0.75 },
		{ x: 0.25, y: 1 },
		{ x: 1, y: 1 },
	]
	return bezierCurve.q(bezier, x).y
}

const bezier1Fn = (x: number) : number => {
	const bezier = [
		{ x: 0, y: 0.3 },
		{ x: 0.15, y: 1.0 },
		{ x: 0.85, y: 1.0 },
		{ x: 1, y: 0.3 },
	]
	return bezierCurve.q(bezier, x).y
}

const bezierRoundHeadFn = (x: number) : number => {
	const bezier = [
		{ x: 0, y: 0 },
		{ x: 0, y: 1 },
		{ x: 0.04, y: 1 },
		{ x: 0.08, y: 1 },
	]
	if (x < 0.07) {
		return getYFromBezierByX(bezier, x)
	} else {
		return 1
	}
	// return bezierCurve.q(bezier, x).y
}

const multiBezierFn1 = (x: number, speed: number = 1.0) : number => {
	const bezier = [
		{ x: 0, y: 0 },
		{ x: 0, y: 2.5 },
		{ x: 0.2, y: 2.5 },
		{ x: 0.25, y: 0 },
		{ x: 0.75, y: 0 },
		{ x: 0.8, y: 2.5 },
		{ x: 1, y: 2.5 },
		{ x: 1, y: 0 },
	]
	return getYFromMultiBezierByX(bezier, x, speed)
}

const getBezierFn = (type: string) => {
  if (type === 'bezier1') {
		return bezier1Fn
	} else if (type === 'bezierRoundHead') {
		return bezierRoundHeadFn
	} else if (type === 'multiBezier1') {
		return multiBezierFn1
	}
	return bezierFn
}

const getCurveContours = (name, skeleton, weight, options: IGetContoursOption) => {
	let { startWeight, endWeight, in_startWeight, in_endWeight, out_startWeight, out_endWeight } = options || {}
	if (!startWeight) {
		if (options && options.weightsVariation) {
			if (options.weightsVariationDir === 'reverse') {
				startWeight = weight
			} else {
				startWeight = 0
			}
		} else {
			startWeight = weight
		}
	}
	if (!endWeight) {
		if (options && options.weightsVariation) {
			if (options.weightsVariationDir === 'reverse') {
				endWeight = 0
			} else {
				endWeight = weight
			}
		} else {
			endWeight = weight
		}
	}
	if (!in_startWeight) {
		in_startWeight = startWeight / 2
	}
	if (!in_endWeight) {
		in_endWeight = endWeight / 2
	}
	if (!out_startWeight) {
		out_startWeight = startWeight / 2
	}
	if (!out_endWeight) {
		out_endWeight = endWeight / 2
	}
	let unticlockwise = false
	let skeletonPos = 'center'
	if (options && options.unticlockwise) {
		unticlockwise = options.unticlockwise
	}
	if (options && options.skeletonPos) {
		skeletonPos = options.skeletonPos
	}

	let bezier = []
	if (skeleton[`${name}_bend`]) {
		bezier = [
			skeleton[`${name}_start`],
			{
				x: skeleton[`${name}_start`].x + 2 / 3 * (skeleton[`${name}_bend`].x - skeleton[`${name}_start`].x),
				y: skeleton[`${name}_start`].y + 2 / 3 * (skeleton[`${name}_bend`].y - skeleton[`${name}_start`].y),
			},
			{
				x: skeleton[`${name}_end`].x + 2 / 3 * (skeleton[`${name}_bend`].x - skeleton[`${name}_end`].x),
				y: skeleton[`${name}_end`].y + 2 / 3 * (skeleton[`${name}_bend`].y - skeleton[`${name}_end`].y),
			},
			skeleton[`${name}_end`],
		]
	} else if (skeleton[`${name}_control1`] && skeleton[`${name}_control2`]) {
		bezier = [
			skeleton[`${name}_start`],
			skeleton[`${name}_control1`],
			skeleton[`${name}_control2`],
			skeleton[`${name}_end`],
		]
	}

	// 顺时针方向，右上侧为out, 左下侧为in
	// 逆时针方向，左下侧为out, 右上侧为in
	const out_points = []
	const in_points = []
	const n = 100

	const in_weights = []
	const out_weights = []
	for (let i = 0; i <= n; i++) {
		if (!options) {
			break
		} else if (options.weightsVariation === 'linear') {
			// 字重为线性变化
			if (options.weightsVariationDir === 'reverse') {
				// 字重变化方向为由收尾到起始方向
				const j = n - i
				const f = j / n
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				// 字重变化为由起始到收尾方向
				const f = i / n
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		} else if (options.weightsVariation === 'pow') {
			// 字重变化为幂变化，options.weightsVariationPower取值范围为[0, 2]
			if (options.weightsVariationDir === 'reverse') {
				// 字重变化方向为由收尾到起始方向
				const j = n - i
				const f = Math.pow(j / n, options.weightsVariationPower)
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				// 字重变化为由起始到收尾方向
				const f = Math.pow(i / n, options.weightsVariationPower)
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		} else if (options.weightsVariation === 'log') {
			// 字重变化为幂变化，options.weightsVariationPower取值范围为[0, 2]
			if (options.weightsVariationDir === 'reverse') {
				// 字重变化方向为由收尾到起始方向
				const j = n - i
				//const f = Math.pow(j / n, options.weightsVariationPower)
				const f = Math.pow(Math.log(j / n + 1) / Math.log(2), options.weightsVariationPower)
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				// 字重变化为由起始到收尾方向
				//const f = Math.pow(i / n, options.weightsVariationPower)
				const f = Math.pow(Math.log(i / n + 1) / Math.log(2), options.weightsVariationPower)
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		} else if (options.weightsVariation === 'bezier') {
			const fn = getBezierFn(options.weightsVariationFnType)
			// 字重变化为幂变化，options.weightsVariationPower取值范围为[0, 2]
			if (options.weightsVariationDir === 'reverse') {
				// 字重变化方向为由收尾到起始方向
				const j = n - i
				//const f = Math.pow(j / n, options.weightsVariationPower)
				const f = fn(j / n)
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				// 字重变化为由起始到收尾方向
				//const f = Math.pow(i / n, options.weightsVariationPower)
				const f = fn(i / n)
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		}
	}

	let lastPoint = bezierCurve.q(bezier, 0)
	let lastK = bezierCurve.qprime(bezier, 0)
	let lastAngle = Math.atan2(lastK.y, lastK.x)

	for (let t = 1; t <= n + 1; t++) {
		let point = lastPoint
		let k = lastK
		let angle = lastAngle
		const _inweight = in_weights.length ? in_weights[t - 1] : in_startWeight
		const _outweight = out_weights.length ? out_weights[t - 1] : out_startWeight
		if (t < (n + 1)) {
			point = bezierCurve.q(bezier, t / n)
			k = bezierCurve.qprime(bezier, t / n)
			angle = Math.atan2(k.y, k.x)
		}
		if (skeletonPos === 'center' && !unticlockwise) {
			out_points.push({
				x: lastPoint.x + _outweight * Math.sin(lastAngle),
				y: lastPoint.y - _outweight * Math.cos(lastAngle),
			})
			in_points.push({
				x: lastPoint.x - _inweight * Math.sin(lastAngle),
				y: lastPoint.y + _inweight * Math.cos(lastAngle),
			})
		}
		else if (skeletonPos === 'inner' && !unticlockwise) {
			out_points.push({
				x: lastPoint.x + (_outweight + _inweight)* Math.sin(lastAngle),
				y: lastPoint.y - (_outweight + _inweight) * Math.cos(lastAngle),
			})
			in_points.push({
				x: lastPoint.x,
				y: lastPoint.y,
			})
		}
		else if (skeletonPos === 'center' && unticlockwise) {
			out_points.push({
				x: lastPoint.x - _outweight * Math.sin(lastAngle),
				y: lastPoint.y + _outweight * Math.cos(lastAngle),
			})
			in_points.push({
				x: lastPoint.x + _inweight * Math.sin(lastAngle),
				y: lastPoint.y - _inweight * Math.cos(lastAngle),
			})
		}
		else if (skeletonPos === 'inner' && unticlockwise) {
			out_points.push({
				x: lastPoint.x - (_outweight + _inweight) * Math.sin(lastAngle),
				y: lastPoint.y + (_outweight + _inweight) * Math.cos(lastAngle),
			})
			in_points.push({
				x: lastPoint.x,
				y: lastPoint.y,
			})
		}
		lastPoint = point
		lastK = k
		lastAngle = angle
	}
	const out_result = fitCurvesByPoints(out_points)
	const in_result = fitCurvesByPoints(in_points)
	const contours = {}
	contours[`out_${name}_points`] = out_points
	contours[`in_${name}_points`] = in_points
	contours[`out_${name}_curves`] = out_result?.curves || []
	contours[`in_${name}_curves`] = in_result?.curves || []
	return contours
}

const getCurveContoursHorizontal = (name, skeleton, weight, options: IGetContoursOption) => {
	let { startWeight, endWeight, in_startWeight, in_endWeight, out_startWeight, out_endWeight } = options || {}
	if (!startWeight) {
		if (options && options.weightsVariation) {
			if (options.weightsVariationDir === 'reverse') {
				startWeight = weight
			} else {
				startWeight = 0
			}
		} else {
			startWeight = weight
		}
	}
	if (!endWeight) {
		if (options && options.weightsVariation) {
			if (options.weightsVariationDir === 'reverse') {
				endWeight = 0
			} else {
				endWeight = weight
			}
		} else {
			endWeight = weight
		}
	}
	if (!in_startWeight) {
		in_startWeight = startWeight / 2
	}
	if (!in_endWeight) {
		in_endWeight = endWeight / 2
	}
	if (!out_startWeight) {
		out_startWeight = startWeight / 2
	}
	if (!out_endWeight) {
		out_endWeight = endWeight / 2
	}
	let unticlockwise = false
	let skeletonPos = 'center'
	if (options && options.unticlockwise) {
		unticlockwise = options.unticlockwise
	}
	if (options && options.skeletonPos) {
		skeletonPos = options.skeletonPos
	}

	let bezier = []
	if (skeleton[`${name}_bend`]) {
		bezier = [
			skeleton[`${name}_start`],
			{
				x: skeleton[`${name}_start`].x + 2 / 3 * (skeleton[`${name}_bend`].x - skeleton[`${name}_start`].x),
				y: skeleton[`${name}_start`].y + 2 / 3 * (skeleton[`${name}_bend`].y - skeleton[`${name}_start`].y),
			},
			{
				x: skeleton[`${name}_end`].x + 2 / 3 * (skeleton[`${name}_bend`].x - skeleton[`${name}_end`].x),
				y: skeleton[`${name}_end`].y + 2 / 3 * (skeleton[`${name}_bend`].y - skeleton[`${name}_end`].y),
			},
			skeleton[`${name}_end`],
		]
	} else if (skeleton[`${name}_control1`] && skeleton[`${name}_control2`]) {
		bezier = [
			skeleton[`${name}_start`],
			skeleton[`${name}_control1`],
			skeleton[`${name}_control2`],
			skeleton[`${name}_end`],
		]
	}

	// 顺时针方向，右上侧为out, 左下侧为in
	// 逆时针方向，左下侧为out, 右上侧为in
	const out_points = []
	const in_points = []
	const n = 100

	const in_weights = []
	const out_weights = []
	for (let i = 0; i <= n; i++) {
		if (!options) {
			break
		} else if (options.weightsVariation === 'linear') {
			// 字重为线性变化
			if (options.weightsVariationDir === 'reverse') {
				// 字重变化方向为由收尾到起始方向
				const j = n - i
				const f = j / n
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				// 字重变化为由起始到收尾方向
				const f = i / n
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		} else if (options.weightsVariation === 'pow') {
			// 字重变化为幂变化，options.weightsVariationPower取值范围为[0, 2]
			if (options.weightsVariationDir === 'reverse') {
				// 字重变化方向为由收尾到起始方向
				const j = n - i
				const f = Math.pow(j / n, options.weightsVariationPower)
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				// 字重变化为由起始到收尾方向
				const f = Math.pow(i / n, options.weightsVariationPower)
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		} else if (options.weightsVariation === 'log') {
			// 字重变化为幂变化，options.weightsVariationPower取值范围为[0, 2]
			if (options.weightsVariationDir === 'reverse') {
				// 字重变化方向为由收尾到起始方向
				const j = n - i
				//const f = Math.pow(j / n, options.weightsVariationPower)
				const f = Math.pow(Math.log(j / n + 1) / Math.log(2), options.weightsVariationPower)
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				// 字重变化为由起始到收尾方向
				//const f = Math.pow(i / n, options.weightsVariationPower)
				const f = Math.pow(Math.log(i / n + 1) / Math.log(2), options.weightsVariationPower)
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		} else if (options.weightsVariation === 'bezier') {
			const fn = getBezierFn(options.weightsVariationFnType)
			// 字重变化为幂变化，options.weightsVariationPower取值范围为[0, 2]
			if (options.weightsVariationDir === 'reverse') {
				// 字重变化方向为由收尾到起始方向
				const j = n - i
				//const f = Math.pow(j / n, options.weightsVariationPower)
				const f = fn(j / n)
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				// 字重变化为由起始到收尾方向
				//const f = Math.pow(i / n, options.weightsVariationPower)
				const f = fn(i / n)
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		}
	}

	let lastPoint = bezierCurve.q(bezier, 0)
	let lastK = bezierCurve.qprime(bezier, 0)
	let lastAngle = Math.atan2(lastK.y, lastK.x)

	for (let t = 1; t <= n + 1; t++) {
		let point = lastPoint
		let k = lastK
		let angle = lastAngle
		const _inweight = in_weights.length ? in_weights[t - 1] : in_startWeight
		const _outweight = out_weights.length ? out_weights[t - 1] : out_startWeight
		if (t < (n + 1)) {
			point = bezierCurve.q(bezier, t / n)
			k = bezierCurve.qprime(bezier, t / n)
			angle = Math.atan2(k.y, k.x)
		}
		if (skeletonPos === 'center' && !unticlockwise) {
			out_points.push({
				x: lastPoint.x + _outweight,
				y: lastPoint.y,
			})
			in_points.push({
				x: lastPoint.x - _inweight,
				y: lastPoint.y,
			})
		}
		else if (skeletonPos === 'inner' && !unticlockwise) {
			out_points.push({
				x: lastPoint.x + (_outweight + _inweight),
				y: lastPoint.y,
			})
			in_points.push({
				x: lastPoint.x,
				y: lastPoint.y,
			})
		}
		else if (skeletonPos === 'center' && unticlockwise) {
			out_points.push({
				x: lastPoint.x - _outweight,
				y: lastPoint.y,
			})
			in_points.push({
				x: lastPoint.x + _inweight,
				y: lastPoint.y,
			})
		}
		else if (skeletonPos === 'inner' && unticlockwise) {
			out_points.push({
				x: lastPoint.x - (_outweight + _inweight),
				y: lastPoint.y,
			})
			in_points.push({
				x: lastPoint.x,
				y: lastPoint.y,
			})
		}
		lastPoint = point
		lastK = k
		lastAngle = angle
	}
	const out_result = fitCurvesByPoints(out_points)
	const in_result = fitCurvesByPoints(in_points)
	const contours = {}
	contours[`out_${name}_points`] = out_points
	contours[`in_${name}_points`] = in_points
	contours[`out_${name}_curves`] = out_result?.curves || []
	contours[`in_${name}_curves`] = in_result?.curves || []
	return contours
}

const getCurveContoursVertical = (name, skeleton, weight, options: IGetContoursOption) => {
	let { startWeight, endWeight, in_startWeight, in_endWeight, out_startWeight, out_endWeight } = options || {}
	if (!startWeight) {
		if (options && options.weightsVariation) {
			if (options.weightsVariationDir === 'reverse') {
				startWeight = weight
			} else {
				startWeight = 0
			}
		} else {
			startWeight = weight
		}
	}
	if (!endWeight) {
		if (options && options.weightsVariation) {
			if (options.weightsVariationDir === 'reverse') {
				endWeight = 0
			} else {
				endWeight = weight
			}
		} else {
			endWeight = weight
		}
	}
	if (!in_startWeight) {
		in_startWeight = startWeight / 2
	}
	if (!in_endWeight) {
		in_endWeight = endWeight / 2
	}
	if (!out_startWeight) {
		out_startWeight = startWeight / 2
	}
	if (!out_endWeight) {
		out_endWeight = endWeight / 2
	}
	let unticlockwise = false
	let skeletonPos = 'center'
	if (options && options.unticlockwise) {
		unticlockwise = options.unticlockwise
	}
	if (options && options.skeletonPos) {
		skeletonPos = options.skeletonPos
	}

	let bezier = []
	if (skeleton[`${name}_bend`]) {
		bezier = [
			skeleton[`${name}_start`],
			{
				x: skeleton[`${name}_start`].x + 2 / 3 * (skeleton[`${name}_bend`].x - skeleton[`${name}_start`].x),
				y: skeleton[`${name}_start`].y + 2 / 3 * (skeleton[`${name}_bend`].y - skeleton[`${name}_start`].y),
			},
			{
				x: skeleton[`${name}_end`].x + 2 / 3 * (skeleton[`${name}_bend`].x - skeleton[`${name}_end`].x),
				y: skeleton[`${name}_end`].y + 2 / 3 * (skeleton[`${name}_bend`].y - skeleton[`${name}_end`].y),
			},
			skeleton[`${name}_end`],
		]
	} else if (skeleton[`${name}_control1`] && skeleton[`${name}_control2`]) {
		bezier = [
			skeleton[`${name}_start`],
			skeleton[`${name}_control1`],
			skeleton[`${name}_control2`],
			skeleton[`${name}_end`],
		]
	}

	// 顺时针方向，右上侧为out, 左下侧为in
	// 逆时针方向，左下侧为out, 右上侧为in
	const out_points = []
	const in_points = []
	const n = 100

	const in_weights = []
	const out_weights = []
	for (let i = 0; i <= n; i++) {
		if (!options) {
			break
		} else if (options.weightsVariation === 'linear') {
			// 字重为线性变化
			if (options.weightsVariationDir === 'reverse') {
				// 字重变化方向为由收尾到起始方向
				const j = n - i
				const f = j / n
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				// 字重变化为由起始到收尾方向
				const f = i / n
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		} else if (options.weightsVariation === 'pow') {
			// 字重变化为幂变化，options.weightsVariationPower取值范围为[0, 2]
			if (options.weightsVariationDir === 'reverse') {
				// 字重变化方向为由收尾到起始方向
				const j = n - i
				const f = Math.pow(j / n, options.weightsVariationPower)
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				// 字重变化为由起始到收尾方向
				const f = Math.pow(i / n, options.weightsVariationPower)
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		} else if (options.weightsVariation === 'log') {
			// 字重变化为幂变化，options.weightsVariationPower取值范围为[0, 2]
			if (options.weightsVariationDir === 'reverse') {
				// 字重变化方向为由收尾到起始方向
				const j = n - i
				//const f = Math.pow(j / n, options.weightsVariationPower)
				const f = Math.pow(Math.log(j / n + 1) / Math.log(2), options.weightsVariationPower)
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				// 字重变化为由起始到收尾方向
				//const f = Math.pow(i / n, options.weightsVariationPower)
				const f = Math.pow(Math.log(i / n + 1) / Math.log(2), options.weightsVariationPower)
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		} else if (options.weightsVariation === 'bezier') {
			const fn = getBezierFn(options.weightsVariationFnType)
			// 字重变化为幂变化，options.weightsVariationPower取值范围为[0, 2]
			if (options.weightsVariationDir === 'reverse') {
				// 字重变化方向为由收尾到起始方向
				const j = n - i
				//const f = Math.pow(j / n, options.weightsVariationPower)
				const f = fn(j / n)
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				// 字重变化为由起始到收尾方向
				//const f = Math.pow(i / n, options.weightsVariationPower)
				const f = fn(i / n)
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		}
	}

	let lastPoint = bezierCurve.q(bezier, 0)
	let lastK = bezierCurve.qprime(bezier, 0)
	let lastAngle = Math.atan2(lastK.y, lastK.x)

	for (let t = 1; t <= n + 1; t++) {
		let point = lastPoint
		let k = lastK
		let angle = lastAngle
		const _inweight = in_weights.length ? in_weights[t - 1] : in_startWeight
		const _outweight = out_weights.length ? out_weights[t - 1] : out_startWeight
		if (t < (n + 1)) {
			point = bezierCurve.q(bezier, t / n)
			k = bezierCurve.qprime(bezier, t / n)
			angle = Math.atan2(k.y, k.x)
		}
		if (skeletonPos === 'center' && !unticlockwise) {
			out_points.push({
				x: lastPoint.x,
				y: lastPoint.y - _outweight,
			})
			in_points.push({
				x: lastPoint.x,
				y: lastPoint.y + _inweight,
			})
		}
		else if (skeletonPos === 'inner' && !unticlockwise) {
			out_points.push({
				x: lastPoint.x,
				y: lastPoint.y - (_outweight + _inweight),
			})
			in_points.push({
				x: lastPoint.x,
				y: lastPoint.y,
			})
		}
		else if (skeletonPos === 'center' && unticlockwise) {
			out_points.push({
				x: lastPoint.x,
				y: lastPoint.y + _outweight,
			})
			in_points.push({
				x: lastPoint.x,
				y: lastPoint.y - _inweight,
			})
		}
		else if (skeletonPos === 'inner' && unticlockwise) {
			out_points.push({
				x: lastPoint.x,
				y: lastPoint.y + (_outweight + _inweight),
			})
			in_points.push({
				x: lastPoint.x,
				y: lastPoint.y,
			})
		}
		lastPoint = point
		lastK = k
		lastAngle = angle
	}
	const out_result = fitCurvesByPoints(out_points)
	const in_result = fitCurvesByPoints(in_points)
	const contours = {}
	contours[`out_${name}_points`] = out_points
	contours[`in_${name}_points`] = in_points
	contours[`out_${name}_curves`] = out_result?.curves || []
	contours[`in_${name}_curves`] = in_result?.curves || []
	return contours
}

// 多条连续贝塞尔曲线骨架，可以用这个方法获取轮廓
const getCurveContours2 = (name, skeleton, weight, options: IGetContoursOption) => {
	let { startWeight, endWeight, in_startWeight, in_endWeight, out_startWeight, out_endWeight } = options || {}
	if (!startWeight) {
		if (options && options.weightsVariation) {
			if (options.weightsVariationDir === 'reverse') {
				startWeight = weight
			} else {
				startWeight = 0
			}
		} else {
			startWeight = weight
		}
	}
	if (!endWeight) {
		if (options && options.weightsVariation) {
			if (options.weightsVariationDir === 'reverse') {
				endWeight = 0
			} else {
				endWeight = weight
			}
		} else {
			endWeight = weight
		}
	}
	if (!in_startWeight) {
		in_startWeight = startWeight / 2
	}
	if (!in_endWeight) {
		in_endWeight = endWeight / 2
	}
	if (!out_startWeight) {
		out_startWeight = startWeight / 2
	}
	if (!out_endWeight) {
		out_endWeight = endWeight / 2
	}
	let unticlockwise = false
	let skeletonPos = 'center'
	if (options && options.unticlockwise) {
		unticlockwise = options.unticlockwise
	}
	if (options && options.skeletonPos) {
		skeletonPos = options.skeletonPos
	}

	const beziers = []
	for (let i = 0; i < skeleton.length; i++) {
		const segment = skeleton[i]
		if (!segment) {
			// 跳过 undefined 或 null 的元素
			continue
		}
		const { start, control1, control2, end, bend } = segment
		// 确保 start 和 end 存在
		if (!start || !end) {
			console.warn(`Skeleton segment ${i} is missing start or end point`)
			continue
		}
		if (control1 && control2) {
			// cubic bezier
			beziers.push([start, control1, control2, end])
		} else if (bend) {
			// quadratic bezier
			beziers.push([start, {
				x: start.x + 2 / 3 * (bend.x - start.x),
				y: start.y + 2 / 3 * (bend.y - start.y),
			}, {
				x: end.x + 2 / 3 * (bend.x - end.x),
				y: end.y + 2 / 3 * (bend.y - end.y),
			}, end])
		} else {
			const l = distance(start, end) * 0.3
			beziers.push([start, getPointOnLine(start, end, l), getPointOnLine(end, start, l), end])
		}
	}

	// 顺时针方向，右上侧为out, 左下侧为in
	// 逆时针方向，左下侧为out, 右上侧为in
	const out_points = []
	const in_points = []
	const n = 100

	const in_weights = []
	const out_weights = []
	for (let i = 0; i <= n * beziers.length; i++) {
		if (!options) {
			break
		} else if (options.weightsVariation === 'linear') {
			// 字重为线性变化
			if (options.weightsVariationDir === 'reverse') {
				// 字重变化方向为由收尾到起始方向
				const j = n * beziers.length - i
				const f = j / (n * beziers.length)
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				// 字重变化为由起始到收尾方向
				const f = i / (n * beziers.length)
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		} else if (options.weightsVariation === 'pow') {
			// 字重变化为幂变化，options.weightsVariationPower取值范围为[0, 2]
			if (options.weightsVariationDir === 'reverse') {
				// 字重变化方向为由收尾到起始方向
				const j = n * beziers.length - i
				const f = Math.pow(j / (n * beziers.length), options.weightsVariationPower)
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				// 字重变化为由起始到收尾方向
				const f = Math.pow(i / (n * beziers.length), options.weightsVariationPower)
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		} else if (options.weightsVariation === 'log') {
			// 字重变化为幂变化，options.weightsVariationPower取值范围为[0, 2]
			if (options.weightsVariationDir === 'reverse') {
				// 字重变化方向为由收尾到起始方向
				const j = n * beziers.length - i
				//const f = Math.pow(j / n, options.weightsVariationPower)
				const f = Math.pow(Math.log(j / (n * beziers.length) + 1) / Math.log(2), options.weightsVariationPower)
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				// 字重变化为由起始到收尾方向
				//const f = Math.pow(i / n, options.weightsVariationPower)
				const f = Math.pow(Math.log(i / (n * beziers.length) + 1) / Math.log(2), options.weightsVariationPower)
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		} else if (options.weightsVariation === 'bezier') {
			let fn = getBezierFn(options.weightsVariationFnType)

			// 字重变化为幂变化，options.weightsVariationPower取值范围为[0, 2]
			// 获取速度参数，默认为 1.0
			const speed = options.weightsVariationSpeed !== undefined ? options.weightsVariationSpeed : 1.0
			
			if (options.weightsVariationDir === 'reverse') {
				// 字重变化方向为由收尾到起始方向
				const j = n * beziers.length - i
				//const f = Math.pow(j / n, options.weightsVariationPower)
				if (options.weightsVariationFnType === 'multiBezier1') {
					const f = fn(j / (n * beziers.length), speed)
					in_weights.push(weight / 2 * f)
					out_weights.push(weight / 2 * f)
				} else {
					const f = fn(j / (n * beziers.length))
					in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
					out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
				}
			} else {
				// 字重变化为由起始到收尾方向
				//const f = Math.pow(i / n, options.weightsVariationPower)
				if (options.weightsVariationFnType === 'multiBezier1') {
					const f = fn(i / (n * beziers.length), speed)
					in_weights.push(weight / 2 * f)
					out_weights.push(weight / 2 * f)
				} else {
					const f = fn(i / (n * beziers.length))
					in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
					out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
				}
			}
		}
	}

	let lastPoint = bezierCurve.q(beziers[0], 0)
	let lastK = bezierCurve.qprime(beziers[0], 0)
	if (lastK.x === 0 && lastK.y === 0) {
		lastK = { x: 0, y: 1 }
	}
	let lastAngle = Math.atan2(lastK.y, lastK.x)

	for (let t = 1; t <= n * beziers.length + 1; t++) {
		let point = lastPoint
		let k = lastK
		let angle = lastAngle
		let bezierIndex = Math.floor((t - 1) / n)
		if (bezierIndex >= beziers.length) {
			bezierIndex = beziers.length - 1
		}
		const bezier = beziers[bezierIndex]
		let t_local = t % n
		if (t_local === 0) {
			t_local = n
		}
		const _inweight = in_weights.length ? in_weights[t - 1] : in_startWeight
		const _outweight = out_weights.length ? out_weights[t - 1] : out_startWeight
		if (t_local < (n + 1)) {
			point = bezierCurve.q(bezier, t_local / n)
			k = bezierCurve.qprime(bezier, t_local / n)
			if (k.x === 0 && k.y === 0) {
				k = { x: 0, y: 1 }
			}
			angle = Math.atan2(k.y, k.x)
		}
		if (skeletonPos === 'center' && !unticlockwise) {
			out_points.push({
				x: lastPoint.x + _outweight * Math.sin(lastAngle),
				y: lastPoint.y - _outweight * Math.cos(lastAngle),
			})
			in_points.push({
				x: lastPoint.x - _inweight * Math.sin(lastAngle),
				y: lastPoint.y + _inweight * Math.cos(lastAngle),
			})
			if (t === n * beziers.length) {
				out_points.push({
					x: point.x + _outweight * Math.sin(angle),
					y: point.y - _outweight * Math.cos(angle),
				})
				in_points.push({
					x: point.x - _inweight * Math.sin(angle),
					y: point.y + _inweight * Math.cos(angle),
				})
			}
		}
		else if (skeletonPos === 'inner' && !unticlockwise) {
			out_points.push({
				x: lastPoint.x + (_outweight + _inweight)* Math.sin(lastAngle),
				y: lastPoint.y - (_outweight + _inweight) * Math.cos(lastAngle),
			})
			in_points.push({
				x: lastPoint.x,
				y: lastPoint.y,
			})
			if (t === n * beziers.length) {
				out_points.push({
					x: point.x + (_outweight + _inweight) * Math.sin(angle),
					y: point.y - (_outweight + _inweight) * Math.cos(angle),
				})
				in_points.push({
					x: point.x,
					y: point.y,
				})
			}
		}
		else if (skeletonPos === 'center' && unticlockwise) {
			out_points.push({
				x: lastPoint.x - _outweight * Math.sin(lastAngle),
				y: lastPoint.y + _outweight * Math.cos(lastAngle),
			})
			in_points.push({
				x: lastPoint.x + _inweight * Math.sin(lastAngle),
				y: lastPoint.y - _inweight * Math.cos(lastAngle),
			})
			if (t === n * beziers.length) {
				out_points.push({
					x: point.x - _outweight * Math.sin(angle),
					y: point.y + _outweight * Math.cos(angle),
				})
				in_points.push({
					x: point.x + _inweight * Math.sin(angle),
					y: point.y - _inweight * Math.cos(angle),
				})
			}
		}
		else if (skeletonPos === 'inner' && unticlockwise) {
			out_points.push({
				x: lastPoint.x - (_outweight + _inweight) * Math.sin(lastAngle),
				y: lastPoint.y + (_outweight + _inweight) * Math.cos(lastAngle),
			})
			in_points.push({
				x: lastPoint.x,
				y: lastPoint.y,
			})
			if (t === n * beziers.length) {
				out_points.push({
					x: point.x - (_outweight + _inweight) * Math.sin(angle),
					y: point.y + (_outweight + _inweight) * Math.cos(angle),
				})
				in_points.push({
					x: point.x,
					y: point.y,
				})
			}
		}
		lastPoint = point
		lastK = k
		lastAngle = angle
	}

	const out_result = fitCurvesByPoints(out_points)
	const in_result = fitCurvesByPoints(in_points)
	const contours = {}
	contours[`out_${name}_points`] = out_points
	contours[`in_${name}_points`] = in_points
	contours[`out_${name}_curves`] = out_result?.curves || []
	contours[`in_${name}_curves`] = in_result?.curves || []
	return contours
}

// 支持方头起笔和收笔的曲线轮廓生成方法
// startCapType 和 endCapType 可以是 'horizontal'（水平方头）、'vertical'（竖直方头）或 'normal'（正常，垂直于骨架）
const getCurveContours3 = (name, skeleton, weight, options: IGetContoursOption) => {
	let { startWeight, endWeight, in_startWeight, in_endWeight, out_startWeight, out_endWeight } = options || {}
	if (!startWeight) {
		if (options && options.weightsVariation) {
			if (options.weightsVariationDir === 'reverse') {
				startWeight = weight
			} else {
				startWeight = 0
			}
		} else {
			startWeight = weight
		}
	}
	if (!endWeight) {
		if (options && options.weightsVariation) {
			if (options.weightsVariationDir === 'reverse') {
				endWeight = 0
			} else {
				endWeight = weight
			}
		} else {
			endWeight = weight
		}
	}
	if (!in_startWeight) {
		in_startWeight = startWeight / 2
	}
	if (!in_endWeight) {
		in_endWeight = endWeight / 2
	}
	if (!out_startWeight) {
		out_startWeight = startWeight / 2
	}
	if (!out_endWeight) {
		out_endWeight = endWeight / 2
	}
	let unticlockwise = false
	let skeletonPos = 'center'
	if (options && options.unticlockwise) {
		unticlockwise = options.unticlockwise
	}
	if (options && options.skeletonPos) {
		skeletonPos = options.skeletonPos
	}
	
	// 方头选项
	const startCapType = options?.startCapType || 'normal'
	const endCapType = options?.endCapType || 'normal'
	const capTransitionRatio = options?.capTransitionRatio || 0.1 // 默认前10%和后10%使用方头方向

	const bezier = [
		skeleton[`${name}_start`],
		{
			x: skeleton[`${name}_start`].x + 2 / 3 * (skeleton[`${name}_bend`].x - skeleton[`${name}_start`].x),
			y: skeleton[`${name}_start`].y + 2 / 3 * (skeleton[`${name}_bend`].y - skeleton[`${name}_start`].y),
		},
		{
			x: skeleton[`${name}_end`].x + 2 / 3 * (skeleton[`${name}_bend`].x - skeleton[`${name}_end`].x),
			y: skeleton[`${name}_end`].y + 2 / 3 * (skeleton[`${name}_bend`].y - skeleton[`${name}_end`].y),
		},
		skeleton[`${name}_end`],
	]

	// 计算起点和终点的切线方向
	const startPoint = bezierCurve.q(bezier, 0)
	const endPoint = bezierCurve.q(bezier, 1)
	const startTangent = bezierCurve.qprime(bezier, 0)
	const endTangent = bezierCurve.qprime(bezier, 1)
	
	// 归一化切线
	const normalize = (v: { x: number, y: number }) => {
		const len = Math.sqrt(v.x * v.x + v.y * v.y)
		if (len === 0) return { x: 0, y: 1 }
		return { x: v.x / len, y: v.y / len }
	}
	
	const startTangentNorm = normalize(startTangent)
	const endTangentNorm = normalize(endTangent)
	
	// 计算起点的方头方向
	const getStartCapDirection = (): { angle: number, outDir: { x: number, y: number }, inDir: { x: number, y: number } } => {
		if (startCapType === 'horizontal') {
			// 水平方头：方向为水平（0度或180度）
			// 根据 unticlockwise 和 skeletonPos 确定左右方向
			if (!unticlockwise) {
				// 顺时针：out在右上，in在左下
				// 水平方头：out在右，in在左
				return {
					angle: 0, // 水平向右
					outDir: { x: 1, y: 0 },
					inDir: { x: -1, y: 0 }
				}
			} else {
				// 逆时针：out在左下，in在右上
				// 水平方头：out在左，in在右
				return {
					angle: Math.PI, // 水平向左
					outDir: { x: -1, y: 0 },
					inDir: { x: 1, y: 0 }
				}
			}
		} else if (startCapType === 'vertical') {
			// 竖直方头：方向为竖直（90度或-90度）
			if (!unticlockwise) {
				// 顺时针：out在右上，in在左下
				// 竖直方头：out在上，in在下
				return {
					angle: Math.PI / 2, // 竖直向上
					outDir: { x: 0, y: -1 },
					inDir: { x: 0, y: 1 }
				}
			} else {
				// 逆时针：out在左下，in在右上
				// 竖直方头：out在下，in在上
				return {
					angle: -Math.PI / 2, // 竖直向下
					outDir: { x: 0, y: 1 },
					inDir: { x: 0, y: -1 }
				}
			}
		} else {
			// normal：垂直于切线
			const normalAngle = Math.atan2(startTangentNorm.y, startTangentNorm.x) + Math.PI / 2
			return {
				angle: normalAngle,
				outDir: { x: Math.sin(normalAngle), y: -Math.cos(normalAngle) },
				inDir: { x: -Math.sin(normalAngle), y: Math.cos(normalAngle) }
			}
		}
	}
	
	// 计算终点的方头方向
	const getEndCapDirection = (): { angle: number, outDir: { x: number, y: number }, inDir: { x: number, y: number } } => {
		if (endCapType === 'horizontal') {
			if (!unticlockwise) {
				return {
					angle: 0,
					outDir: { x: 1, y: 0 },
					inDir: { x: -1, y: 0 }
				}
			} else {
				return {
					angle: Math.PI,
					outDir: { x: -1, y: 0 },
					inDir: { x: 1, y: 0 }
				}
			}
		} else if (endCapType === 'vertical') {
			// 根据切线方向区分撇和捺
			// 撇：切线向左（endTangentNorm.x < 0），使用法线方向判断
			// 捺：切线向右（endTangentNorm.x > 0），固定效果
			if (endTangentNorm.x < 0) {
				// 撇：根据法线方向判断
				const endNormalAngle = Math.atan2(endTangentNorm.y, endTangentNorm.x) + Math.PI / 2
				const endNormalOutDir = { x: Math.sin(endNormalAngle), y: -Math.cos(endNormalAngle) }
				// 如果法线的 out 方向向上（y < 0），那么竖直方头的 out 应该向上
				// 如果法线的 out 方向向下（y > 0），那么竖直方头的 out 应该向下
				if (endNormalOutDir.y < 0) {
					// out 在上方
					return {
						angle: Math.PI / 2,
						outDir: { x: 0, y: -1 },
						inDir: { x: 0, y: 1 }
					}
				} else {
					// out 在下方
					return {
						angle: -Math.PI / 2,
						outDir: { x: 0, y: 1 },
						inDir: { x: 0, y: -1 }
					}
				}
			} else {
				// 捺：固定效果（和之前 !unticlockwise 的效果一致）
				return {
					angle: Math.PI / 2,
					outDir: { x: 0, y: -1 },
					inDir: { x: 0, y: 1 }
				}
			}
		} else {
			const normalAngle = Math.atan2(endTangentNorm.y, endTangentNorm.x) + Math.PI / 2
			return {
				angle: normalAngle,
				outDir: { x: Math.sin(normalAngle), y: -Math.cos(normalAngle) },
				inDir: { x: -Math.sin(normalAngle), y: Math.cos(normalAngle) }
			}
		}
	}
	
	const startCap = getStartCapDirection()
	const endCap = getEndCapDirection()

	const out_points = []
	const in_points = []
	const n = 100

	const in_weights = []
	const out_weights = []
	for (let i = 0; i <= n; i++) {
		if (!options) {
			break
		} else if (options.weightsVariation === 'linear') {
			if (options.weightsVariationDir === 'reverse') {
				const j = n - i
				const f = j / n
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				const f = i / n
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		} else if (options.weightsVariation === 'pow') {
			if (options.weightsVariationDir === 'reverse') {
				const j = n - i
				const f = Math.pow(j / n, options.weightsVariationPower)
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				const f = Math.pow(i / n, options.weightsVariationPower)
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		} else if (options.weightsVariation === 'log') {
			if (options.weightsVariationDir === 'reverse') {
				const j = n - i
				const f = Math.pow(Math.log(j / n + 1) / Math.log(2), options.weightsVariationPower)
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				const f = Math.pow(Math.log(i / n + 1) / Math.log(2), options.weightsVariationPower)
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		} else if (options.weightsVariation === 'bezier') {
			const fn = getBezierFn(options.weightsVariationFnType)
			if (options.weightsVariationDir === 'reverse') {
				const j = n - i
				const f = fn(j / n)
				in_weights.push(in_endWeight + (in_startWeight - in_endWeight) * f)
				out_weights.push(out_endWeight + (out_startWeight - out_endWeight) * f)
			} else {
				const f = fn(i / n)
				in_weights.push(in_startWeight + (in_endWeight - in_startWeight) * f)
				out_weights.push(out_startWeight + (out_endWeight - out_startWeight) * f)
			}
		}
	}

	let lastPoint = bezierCurve.q(bezier, 0)
	let lastK = bezierCurve.qprime(bezier, 0)
	let lastAngle = Math.atan2(lastK.y, lastK.x)

	for (let t = 1; t <= n + 1; t++) {
		let point = lastPoint
		let k = lastK
		let angle = lastAngle
		const _inweight = in_weights.length ? in_weights[t - 1] : in_startWeight
		const _outweight = out_weights.length ? out_weights[t - 1] : out_startWeight
		
		if (t < (n + 1)) {
			point = bezierCurve.q(bezier, t / n)
			k = bezierCurve.qprime(bezier, t / n)
			angle = Math.atan2(k.y, k.x)
		}
		
		// 计算当前点在曲线上的位置比例
		const tRatio = (t - 1) / n
		
		// 计算法线方向（与原代码保持一致）
		// 原代码使用 Math.sin(lastAngle) 和 Math.cos(lastAngle) 来表示法线方向
		const normalOutDir = { x: Math.sin(lastAngle), y: -Math.cos(lastAngle) }
		const normalInDir = { x: -Math.sin(lastAngle), y: Math.cos(lastAngle) }
		
		// 确定当前点应该使用的方向
		let outDir: { x: number, y: number }
		let inDir: { x: number, y: number }
		
		if (tRatio <= capTransitionRatio) {
			// 起点附近：从起点方头方向过渡到法线方向
			if (startCapType === 'normal') {
				outDir = normalOutDir
				inDir = normalInDir
			} else {
				// 从起点方头方向平滑过渡到法线方向
				const transitionRatio = tRatio / capTransitionRatio // 0 到 1
				const smoothRatio = transitionRatio * transitionRatio * (3 - 2 * transitionRatio) // 平滑插值
				// 直接使用 getStartCapDirection 返回的方向，确保一致性
				const startOutDir = startCap.outDir
				const startInDir = startCap.inDir
				// 从方头方向平滑过渡到当前点的法线方向（normalOutDir 和 normalInDir）
				// 使用方向向量插值，而不是角度插值，避免角度问题
				const mixDir = (dir1: { x: number, y: number }, dir2: { x: number, y: number }, ratio: number) => {
					const result = {
						x: dir1.x * (1 - ratio) + dir2.x * ratio,
						y: dir1.y * (1 - ratio) + dir2.y * ratio
					}
					const len = Math.sqrt(result.x * result.x + result.y * result.y)
					if (len === 0) return result
					return { x: result.x / len, y: result.y / len }
				}
				// 使用当前点的法线方向（normalOutDir 和 normalInDir），而不是起点的法线方向
				// 这样可以从方头方向平滑过渡到当前点的法线方向
				outDir = mixDir(startOutDir, normalOutDir, smoothRatio)
				inDir = mixDir(startInDir, normalInDir, smoothRatio)
			}
		} else if (tRatio >= 1 - capTransitionRatio) {
			// 终点附近：从法线方向过渡到终点方头方向
			if (endCapType === 'normal') {
				outDir = normalOutDir
				inDir = normalInDir
			} else {
				// 从法线方向平滑过渡到终点方头方向
				const transitionRatio = (tRatio - (1 - capTransitionRatio)) / capTransitionRatio // 0 到 1
				const smoothRatio = transitionRatio * transitionRatio * (3 - 2 * transitionRatio) // 平滑插值
				// 直接使用 getEndCapDirection 返回的方向，确保一致性
				const endOutDir = endCap.outDir
				const endInDir = endCap.inDir
				// 从当前点的法线方向平滑过渡到终点方头方向
				// 使用方向向量插值，而不是角度插值，避免角度问题
				const mixDir = (dir1: { x: number, y: number }, dir2: { x: number, y: number }, ratio: number) => {
					const result = {
						x: dir1.x * (1 - ratio) + dir2.x * ratio,
						y: dir1.y * (1 - ratio) + dir2.y * ratio
					}
					const len = Math.sqrt(result.x * result.x + result.y * result.y)
					if (len === 0) return result
					return { x: result.x / len, y: result.y / len }
				}
				// 从当前点的法线方向平滑过渡到终点方头方向
				outDir = mixDir(normalOutDir, endOutDir, smoothRatio)
				inDir = mixDir(normalInDir, endInDir, smoothRatio)
			}
		} else {
			// 中间部分：完全使用法线方向
			outDir = normalOutDir
			inDir = normalInDir
		}
		
		if (skeletonPos === 'center' && !unticlockwise) {
			out_points.push({
				x: lastPoint.x + _outweight * outDir.x,
				y: lastPoint.y + _outweight * outDir.y,
			})
			in_points.push({
				x: lastPoint.x + _inweight * inDir.x,
				y: lastPoint.y + _inweight * inDir.y,
			})
		}
		else if (skeletonPos === 'inner' && !unticlockwise) {
			out_points.push({
				x: lastPoint.x + (_outweight + _inweight) * outDir.x,
				y: lastPoint.y + (_outweight + _inweight) * outDir.y,
			})
			in_points.push({
				x: lastPoint.x,
				y: lastPoint.y,
			})
		}
		else if (skeletonPos === 'center' && unticlockwise) {
			out_points.push({
				x: lastPoint.x + _outweight * outDir.x,
				y: lastPoint.y + _outweight * outDir.y,
			})
			in_points.push({
				x: lastPoint.x + _inweight * inDir.x,
				y: lastPoint.y + _inweight * inDir.y,
			})
		}
		else if (skeletonPos === 'inner' && unticlockwise) {
			out_points.push({
				x: lastPoint.x + (_outweight + _inweight) * outDir.x,
				y: lastPoint.y + (_outweight + _inweight) * outDir.y,
			})
			in_points.push({
				x: lastPoint.x,
				y: lastPoint.y,
			})
		}
		
		lastPoint = point
		lastK = k
		lastAngle = angle
	}
	
	const out_result = fitCurvesByPoints(out_points)
	const in_result = fitCurvesByPoints(in_points)
	const contours = {}
	contours[`out_${name}_points`] = out_points
	contours[`in_${name}_points`] = in_points
	contours[`out_${name}_curves`] = out_result?.curves || []
	contours[`in_${name}_curves`] = in_result?.curves || []
	return contours
}

const getIntersection = (item1, item2) => {
	let curve1 = null
	let curve2 = null
	let line1 = null
	let line2 = null
	if (item1.type === 'line') {
		line1 = item1
	} else if (item1.type === 'curve') {
		curve1 = item1 
	}
	if (item2.type === 'line') {
		if (line1) {
			line2 = item2
		} else {
			line1 = item2
		}
	} else if (item2.type === 'curve') {
		if (curve1) {
			curve2 = item2
		} else {
			curve1 = item2
		}
	}

	if (curve2) {
    // 遍历第一条曲线的所有线段
    for (let i = 0; i < curve1.points.length - 1; i++) {
			const p1 = curve1.points[i]
			const p2 = curve1.points[i + 1]

			// 遍历第二条曲线的所有线段
			for (let j = 0; j < curve2.points.length - 1; j++) {
				const p3 = curve2.points[j]
				const p4 = curve2.points[j + 1]

				// 计算两条线段的交点
				const intersection = calculateIntersection(p1, p2, p3, p4)
				if (intersection) {
					return {
						corner: intersection,
						corner_index: [i, j],
					}
				}
			}
    }
	} else if (line2) {
		// 两条轮廓都为直线
		return {
			corner: calculateLineIntersection(line1.start, line1.end, line2.start, line2.end),
			corner_index: 0,
		}
	} else if (line1 && curve1) {
		// 一条轮廓为曲线，另一条为直线
		let lastPoint = curve1.points[0]
		for (let i = 1; i < curve1.points.length; i++) {
			const point = curve1.points[i]
			const intersection = calculateIntersection(lastPoint, point, line1.start, line1.end)
			if (intersection) {
				return {
					corner: intersection,
					corner_index: i,
				}
			}
		}
	}

	return {
		corner: null,
		corner_index: 0,
	}
}

const calculateIntersection = (p1, p2, p3, p4) => {
	// 计算分母
	const denominator = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
	if (p1.x === p2.x && p1.y === p2.y || p3.x === p4.x && p3.y === p4.y && denominator === 0) {
		return null
	}
	// 平行或重合
	if (denominator === 0) return p2;

	// 计算参数 ua 和 ub
	const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denominator;
	const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denominator;

	// 检查参数是否在有效范围内
	if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
		// 计算交点坐标
		return {
			x: p1.x + ua * (p2.x - p1.x),
			y: p1.y + ua * (p2.y - p1.y)
		};
	}

	// 如果没有交点，返回 null
	return null;
}

const calculateLineIntersection = (p1, p2, p3, p4) => {
	// 计算分母
	const denominator = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
	// 平行或重合
	if (denominator === 0) return p2;

	// 计算参数 ua 和 ub
	const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denominator;
	const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denominator;

	// 计算交点坐标
	return {
			x: p1.x + ua * (p2.x - p1.x),
			y: p1.y + ua * (p2.y - p1.y)
	};
}

const fitCurvesByPoints = (points: Array<{ x: number, y: number }>) => {
	if (!points || points.length < 4) {
		// 返回空对象而不是 null，避免解构错误
		return {
			curves: []
		}
	}
	try {
		const _curves = fitCurve(points, 3.5)
		const curves = []
		if (_curves && Array.isArray(_curves)) {
			for (let i = 0; i < _curves.length; i++) {
				const curve = _curves[i]
				if (curve && Array.isArray(curve) && curve.length >= 4) {
					curves.push({
						start: curve[0],
						control1: curve[1],
						control2: curve[2],
						end: curve[3],
					})
				}
			}
		}
		return {
			curves,
		}
	} catch (error) {
		// 如果拟合失败，返回空数组而不是 null
		console.warn('Error in fitCurvesByPoints:', error)
		return {
			curves: []
		}
	}
}

const distance = (p1, p2) => {
  return Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y))
}

const getAngle = (A, B, C) => {
  // 计算向量 BA
  const BA = { x: A.x - B.x, y: A.y - B.y }
  // 计算向量 BC
  const BC = { x: C.x - B.x, y: C.y - B.y }
  
  // 使用 atan2 计算每个向量的角度
  const angleBA = Math.atan2(BA.y, BA.x)
  const angleBC = Math.atan2(BC.y, BC.x)
  
  // 计算角度差
  let angle = angleBA - angleBC
  
  // 确保角度在 [0, 2π] 范围内
  if (angle < 0) {
    angle += 2 * Math.PI
  }
  if (angle > Math.PI) {
    angle = 2 * Math.PI - angle
  }
  
  return angle
}

const getRadiusPointsOnCurve = (_points, radius, reverse: boolean = false, reverse_final_curves: boolean = false) => {
	let length = 0
	let points = R.clone(_points)
	if (reverse) {
		// 如果需要从末尾开始计算，反转points
		points.reverse()
	}

	if (!radius) {
		// radius为0
		const result = fitCurvesByPoints(points)
		const final_curves = result?.curves || []
		if (final_curves.length === 0) {
			// 如果没有曲线，返回默认值
			return {
				point: points[0] || { x: 0, y: 0 },
				index: 0,
				tangent: {
					start: points[0] || { x: 0, y: 0 },
					end: points[0] || { x: 0, y: 0 },
				},
				final_curves: [],
			}
		}
		const _curve = [final_curves[0].start, final_curves[0].control1, final_curves[0].control2, final_curves[0].end]
		const _k = bezierCurve.qprime(getBezierCurve(final_curves[0]), 0)
		const _angle = Math.atan2(_k.y, _k.x)
		const _line = {
			start: points[0],
			end: {
				x: points[0].x + Math.cos(_angle) * 100,
				y: points[0].y + Math.sin(_angle) * 100,
			},
		}
		return {
			point: points[0],
			index: 0,
			tangent: _line,
			final_curves: reverse && !reverse_final_curves ? reverseCurves(final_curves) : final_curves,
		}
	}
	for (let i = 1; i < points.length; i++) {
		length += distance(points[i], points[i - 1])
		if (length >= radius) {
			const final_points = points.slice(i)
			const result = fitCurvesByPoints(final_points)
			const final_curves = result?.curves || []
			if (final_curves.length === 0) {
				// 如果没有曲线，返回默认值
				return {
					point: points[i] || { x: 0, y: 0 },
					index: i,
					tangent: {
						start: points[i] || { x: 0, y: 0 },
						end: points[i] || { x: 0, y: 0 },
					},
					final_curves: [],
					final_points: final_points,
				}
			}
			const _curve = [final_curves[0].start, final_curves[0].control1, final_curves[0].control2, final_curves[0].end]
			const _k = bezierCurve.qprime(getBezierCurve(final_curves[0]), 0)
			const _angle = Math.atan2(_k.y, _k.x)
			const _line = {
				start: points[i],
				end: {
					x: points[i].x + Math.cos(_angle) * 100,
					y: points[i].y + Math.sin(_angle) * 100,
				},
			}
			return {
				point: points[i],
				index: i,
				tangent: _line,
				final_curves: reverse && !reverse_final_curves ? reverseCurves(final_curves) : final_curves,
				final_points: final_points,
			}
		}
	}
	const result = fitCurvesByPoints(points)
	const final_curves = result?.curves || []
	if (final_curves.length === 0) {
		// 如果没有曲线，返回默认值
		const lastPoint = points[points.length - 1] || { x: 0, y: 0 }
		return {
			point: lastPoint,
			index: points.length - 1,
			tangent: {
				start: lastPoint,
				end: lastPoint,
			},
			final_curves: [],
		}
	}
	const _curve = [final_curves[0].start, final_curves[0].control1, final_curves[0].control2, final_curves[0].end]
	const _k = bezierCurve.qprime(getBezierCurve(final_curves[0]), 0)
	const _angle = Math.atan2(_k.y, _k.x)
	const _line = {
		start: points[points.length - 1],
		end: {
			x: points[points.length - 1].x + Math.cos(_angle) * 100,
			y: points[points.length - 1].y + Math.sin(_angle) * 100,
		},
	}
	return {
		point: points[points.length - 1],
		index: points.length - 1,
		tangent: _line,
		final_curves: reverse && !reverse_final_curves ? reverseCurves(final_curves) : final_curves,
	}
}

const reverseCurves = (curves) => {
	const final_curves = []
	for (let i = curves.length - 1; i >= 0; i--) {
		const curve = {
			start: curves[i].end,
			control1: curves[i].control2,
			control2: curves[i].control1,
			end: curves[i].start
		}
		final_curves.push(curve)
	}
	return final_curves
}

const getBezierCurve = (curve) => {
	const _curve = [curve.start, curve.control1, curve.control2, curve.end]
	return _curve
}

const getCurvesPoints = (curves) => {
	const n = 100
	const points = []
	for (let i = 0; i < curves.length; i++) {
		const curve = curves[i]
		let _curve = [curve.start, curve.control1, curve.control2, curve.end]
		if (curve.control) {
			_curve = [
				curve.start,
				{
					x: curve.start.x + 2 / 3 * (curve.control.x - curve.start.x),
					y: curve.start.y + 2 / 3 * (curve.control.y - curve.start.y),
				},
				{
					x: curve.end.x + 2 / 3 * (curve.control.x - curve.end.x),
					y: curve.end.y + 2 / 3 * (curve.control.y - curve.end.y),
				},
				curve.end,
			]
		}
		for (let j = 0; j <= n; j++) {
			const point = bezierCurve.q(_curve, j / n)
			points.push(point)
		}
	}
	return points
}

const getTurnAngles = (p1, p2, p3) => {
	const angle1 = Math.atan2(p1.y - p2.y, p2.x - p1.x)
	const angle2 = Math.atan2(p3.y - p2.y, p2.x - p3.x)
	const inner_angle = angle2 - angle1
	const mid_angle = angle1 + inner_angle / 2
	return {
		angle1,
		angle2,
		inner_angle,
		mid_angle,
	}
}

const distanceAndFootPoint = (A, B, C) => {
	const { x: x1, y: y1 } = A;
	const { x: x2, y: y2 } = B;
	const { x: x0, y: y0 } = C;

	// 计算线段 AB 的长度
	const dxAB = x2 - x1;
	const dyAB = y2 - y1;
	const ABLength = Math.sqrt(dxAB ** 2 + dyAB ** 2);

	// 辅助变量：交点、newC、比例
	let footPoint, newC, percentageFromA;

	// 处理垂直线（x1 === x2）
	if (x1 === x2) {
		let footY = y0;
		const minY = Math.min(y1, y2);
		const maxY = Math.max(y1, y2);

		// 判断交点是否在线段内
		const isOnSegment = footY >= minY && footY <= maxY;
		if (!isOnSegment) {
				footY = footY < minY ? minY : maxY;
		}

		footPoint = { x: x1, y: footY };
		newC = isOnSegment ? null : { x: x0, y: footY };

		// 计算比例：沿 AB 的 y 方向
		const distanceFromA = Math.abs(footY - y1);
		percentageFromA = ABLength === 0 ? 0 : distanceFromA / Math.abs(y2 - y1);
		percentageFromA = Math.min(1, Math.max(0, percentageFromA)); // 限制在 [0,1]

		return {
			distance: Math.abs(x0 - x1),
			footPoint,
			newC,
			percentageFromA,
		};
	}

	// 处理水平线（y1 === y2）
	if (y1 === y2) {
		let footX = x0;
		const minX = Math.min(x1, x2);
		const maxX = Math.max(x1, x2);

		// 判断交点是否在线段内
		const isOnSegment = footX >= minX && footX <= maxX;
		if (!isOnSegment) {
			footX = footX < minX ? minX : maxX;
		}

		footPoint = { x: footX, y: y1 };
		newC = isOnSegment ? null : { x: footX, y: y0 };

		// 计算比例：沿 AB 的 x 方向
		const distanceFromA = Math.abs(footX - x1);
		percentageFromA = ABLength === 0 ? 0 : distanceFromA / Math.abs(x2 - x1);
		percentageFromA = Math.min(1, Math.max(0, percentageFromA));

		return {
			distance: Math.abs(y0 - y1),
			footPoint,
			newC,
			percentageFromA,
		};
	}

	// 一般情况（非垂直/水平线）
	const m = (y2 - y1) / (x2 - x1);
	const mPerpendicular = -1 / m;

	// 计算交点坐标
	const x = (m * x1 - y1 + y0 - mPerpendicular * x0) / (m - mPerpendicular);
	const y = m * (x - x1) + y1;

	// 判断交点是否在线段 AB 内
	const isOnSegment =
		x >= Math.min(x1, x2) &&
		x <= Math.max(x1, x2) &&
		y >= Math.min(y1, y2) &&
		y <= Math.max(y1, y2);

	if (!isOnSegment) {
		// 限制到端点 A 或 B
		const distToA = Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
		const distToB = Math.sqrt((x - x2) ** 2 + (y - y2) ** 2);
		footPoint = distToA < distToB ? { x: x1, y: y1 } : { x: x2, y: y2 };
	} else {
		footPoint = { x, y };
	}

	// 计算 newC
	newC = isOnSegment
		? null
		: {
				x: x0 + (footPoint.x - x),
				y: y0 + (footPoint.y - y),
			};

	// 计算交点到 A 的沿线段比例
	const dxFoot = footPoint.x - x1;
	const dyFoot = footPoint.y - y1;
	const distanceFromA = Math.sqrt(dxFoot ** 2 + dyFoot ** 2);
	percentageFromA = ABLength === 0 ? 0 : distanceFromA / ABLength;
	percentageFromA = Math.min(1, Math.max(0, percentageFromA)); // 确保在 [0,1]

	return {
		distance: Math.sqrt((x - x0) ** 2 + (y - y0) ** 2),
		footPoint,
		newC,
		percentageFromA,
	};
}

// 计算从 bend 点到 start-end 线段的垂足坐标
// 经过 bend 作垂直于 start-end 的垂线，返回垂足坐标
const getPerpendicularFoot = (start, end, bend) => {
	const { x: x1, y: y1 } = start;
	const { x: x2, y: y2 } = end;
	const { x: x0, y: y0 } = bend;

	// 计算线段 start-end 的向量
	const dx = x2 - x1;
	const dy = y2 - y1;
	const lengthSquared = dx * dx + dy * dy;

	// 如果线段长度为 0，返回起点
	if (lengthSquared === 0) {
		return { x: x1, y: y1 };
	}

	// 计算 bend 到 start 的向量
	const dx0 = x0 - x1;
	const dy0 = y0 - y1;

	// 计算投影参数 t（点积除以长度的平方）
	const t = (dx0 * dx + dy0 * dy) / lengthSquared;

	// 计算垂足坐标
	const footX = x1 + t * dx;
	const footY = y1 + t * dy;

	return { x: footX, y: footY };
}

const turnLeft = (start, end, length) => {
	const angle = Math.atan2(start.y - end.y, end.x - start.x)
	const turn_control = {
		x: end.x - length * Math.sin(angle),
		y: end.y - length * Math.cos(angle),
	}
	return turn_control
}

const turnRight = (start, end, length) => {
	const angle = Math.atan2(start.y - end.y, end.x - start.x)
	const turn_control = {
		x: end.x + length * Math.sin(angle),
		y: end.y + length * Math.cos(angle),
	}
	return turn_control
}

const goStraight = (start, end, length) => {
	const angle = Math.atan2(start.y - end.y, end.x - start.x)
	const go_straight = {
		x: end.x + length * Math.cos(angle),
		y: end.y - length * Math.sin(angle),
	}
	return go_straight
}

const turnAngle = (start, end, angle, length) => {
	const angle1 = Math.atan2(start.y - end.y, end.x - start.x)
	// 往左为负，往右为正
	const andle2 = angle1 + angle
	const point = {
		x: start.x + length * Math.cos(angle),
		y: start.y - length * Math.sin(angle),
	}
	return point
}

const turnAngleFromStart = (start, end, angle, length) => {
	const angle1 = Math.atan2(start.y - end.y, end.x - start.x)
	// 逆时针为正，顺时针为负
	const angle2 = angle1 + angle
	const point = {
		x: start.x + length * Math.cos(angle2),
		y: start.y - length * Math.sin(angle2),
	}
	return point
}

const turnAngleFromEnd = (start, end, angle, length) => {
	const angle1 = Math.atan2(start.y - end.y, end.x - start.x)
	// 逆时针为正，顺时针为负
	const angle2 = angle1 + angle
	const point = {
		x: end.x + length * Math.cos(angle2),
		y: end.y - length * Math.sin(angle2),
	}
	return point
}

const degreeToRadius = (degree) => {
	return Math.PI * degree / 180
}

const radiusToDegree = (radius) => {
	return radius * 180 / Math.PI
}

const getPointOnLine = (start, end, length) => {
	const angle = Math.atan2(start.y - end.y, end.x - start.x)
	const point = {
		x: start.x + length * Math.cos(angle),
		y: start.y - length * Math.sin(angle),
	}
	return point
}

const getPointOnLineByPercentage = (start, end, percentage) => {
	const point = {
		x: start.x + percentage * (end.x - start.x),
		y: start.y + percentage * (end.y - start.y),
	}
	return point
}

const isPointOnLineSegment = (point, lineStart, lineEnd) => {
	const { x, y } = point;
	const { x: x1, y: y1 } = lineStart;
	const { x: x2, y: y2 } = lineEnd;
	
	// 计算点到线段两端点的距离
	const distToStart = Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
	const distToEnd = Math.sqrt((x - x2) ** 2 + (y - y2) ** 2);
	const segmentLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
	
	// 如果点到两端点距离之和等于线段长度，说明点在线段上
	return Math.abs(distToStart + distToEnd - segmentLength) < 1e-10;
}

const getSquare = (point, sideLength) => {
	const square = [
		{ x: point.x + sideLength / 2, y: point.y - sideLength / 2 },
		{ x: point.x - sideLength / 2, y: point.y - sideLength / 2 },
		{ x: point.x - sideLength / 2, y: point.y + sideLength / 2 },
		{ x: point.x + sideLength / 2, y: point.y + sideLength / 2 },
	]
	return square
}

const getCircle = (point, radius, angle = 0, reverse: boolean = false) => {
	let circle = [
		{
			start: { x: point.x - radius, y: point.y },
			control1: { x: point.x - radius, y: point.y + radius / 2 },
			control2: { x: point.x - radius / 2, y: point.y + radius },
			end: { x: point.x, y: point.y + radius },
		},
		{
			start: { x: point.x, y: point.y + radius },
			control1: { x: point.x + radius / 2, y: point.y + radius },
			control2: { x: point.x + radius, y: point.y + radius / 2 },
			end: { x: point.x + radius, y: point.y },
		},
		{
			start: { x: point.x + radius, y: point.y },
			control1: { x: point.x + radius, y: point.y - radius / 2 },
			control2: { x: point.x + radius / 2, y: point.y - radius },
			end: { x: point.x, y: point.y - radius },
		},
		{
			start: { x: point.x, y: point.y - radius },
			control1: { x: point.x - radius / 2, y: point.y - radius },
			control2: { x: point.x - radius, y: point.y - radius / 2 },
			end: { x: point.x - radius, y: point.y },
		},
	]
	if (angle !== 0) {
		circle = circle.map(curve => {
			return {
				start: rotateFromPoint(curve.start, point, angle),
				control1: rotateFromPoint(curve.control1, point, angle),
				control2: rotateFromPoint(curve.control2, point, angle),
				end: rotateFromPoint(curve.end, point, angle),
			}
		})
	}
	if (reverse) {
		circle = reverseCurves(circle)
	}
	return circle
}

const getTangentOnCurves = (curves, percentage) => {
	const length = 100
	const _percentage = percentage % (1 / curves.length) / (1 / curves.length)
	const _curveIndex = Math.floor(percentage / (1 / curves.length))
	const points = []
	let p = null
	let k = null
	let angle = 0
	const n = 100
	for (let i = 0; i < curves.length; i++) {
		if (i < _curveIndex) {
			const _curve = [curves[i].start, curves[i].control1, curves[i].control2, curves[i].end]
			for (let j = 0; j <= n; j++) {
				const point = bezierCurve.q(_curve, j / n)
				points.push(point)
			}
		} else if (i === _curveIndex) {
			const _curve = [curves[i].start, curves[i].control1, curves[i].control2, curves[i].end]
			for (let j = 0; j <= n; j++) {
				if (j <= _percentage * n) {
					const point = bezierCurve.q(_curve, j / n)
					points.push(point)
				} else if (!p){
					k = bezierCurve.qprime(_curve, j / n)
					p = bezierCurve.q(_curve, j / n)
					angle = Math.atan2(k.y, k.x)
				}
			}
		}
	}
	return {
		tangent: {
			start: p,
			end: {
				x: p.x + length * Math.cos(angle),
				y: p.y - length * Math.sin(angle),
			},
		},
		point: p,
		final_curves: percentage === 0 ? curves : (fitCurvesByPoints(points)?.curves || []),
	}
}

const rotateFromPoint = (p1, p2, angle) => {
	// 将坐标系平移到以 p2 为原点
	const dx = p1.x - p2.x
	const dy = p1.y - p2.y
	
	// 应用旋转矩阵（逆时针旋转 angle 弧度）
	// 在 canvas 坐标系（y 向下）中，y 相关的计算需要调整符号
	const cosA = Math.cos(angle)
	const sinA = Math.sin(angle)
	const rotatedDx = dx * cosA + dy * sinA
	const rotatedDy = -dx * sinA + dy * cosA
	
	// 平移回原坐标系
	return {
		x: rotatedDx + p2.x,
		y: rotatedDy + p2.y
	}
}

const FP = {
	EllipseComponent,
	PenComponent,
	PolygonComponent,
	RectangleComponent,
	Skeleton,
	Joint,
	Character,
	fitCurve,
	getLineContours,
	getCurveContours,
	getIntersection,
	fitCurvesByPoints,
	getRadiusPointsOnCurve,
	distance,
	getCurvesPoints,
	getTurnAngles,
	distanceAndFootPoint,
	getPerpendicularFoot,
	turnLeft,
	turnRight,
	goStraight,
	turnAngle,
	getPointOnLine,
	getPointOnLineByPercentage,
	isPointOnLineSegment,
	turnAngleFromStart,
	turnAngleFromEnd,
	degreeToRadius,
	getAngle,
	radiusToDegree,
	getCurveContours2,
	getCurveContours3,
	getSquare,
	getCircle,
	getTangentOnCurves,
	getCurveContoursHorizontal,
	getCurveContoursVertical,
}

const suggestion_items = [
	{
		item: 'FP',
		type: 'Variable',
	},
	{
		item: 'EllipseComponent',
		type: 'Class',
	},
	{
		item: 'PenComponent',
		type: 'Class',
	},
	{
		item: 'PolygonComponent',
		type: 'Class',
	},
	{
		item: 'RectangleComponent',
		type: 'Class',
	},
	{
		item: 'Skeleton',
		type: 'Class',
	},
	{
		item: 'Joint',
		type: 'Class',
	},
	{
		item: 'Character',
		type: 'Class',
	},
	{
		item: 'beginPath',
		type: 'method',
	},
	{
		item: 'closePath',
		type: 'method',
	},
	{
		item: 'bezierTo',
		type: 'method',
	},
	{
		item: 'quadraticBezierTo',
		type: 'method',
	},
	{
		item: 'cubicBezierTo',
		type: 'method',
	},
	{
		item: 'lineTo',
		type: 'method',
	},
	{
		item: 'genComponent',
		type: 'method',
	},
	{
		item: 'getJoints',
		type: 'method',
	},
	{
		item: 'getComponent',
		type: 'method',
	},
]

export {
	FP,
	suggestion_items,
}