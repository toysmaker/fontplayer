/**
 * 梵高油画笔触丛复刻
 * 基于密度图（FBM 噪声）在指定矩形区域内生成笔触丛：
 * - 密度场控制疏密（亮度高 = 密集）
 * - Bridson 可变泊松盘布点
 * - 方向场（基础角度 + 噪声扰动）控制笔触走向
 * - 两级颜色抖动：簇基准色（基准 HSL ± 簇级容差）→ 笔画色（簇基准 ± 笔画级容差）
 *
 * 依赖（FP 对象注入，避免与 FPUtils 循环引用）：
 *   FP.fbm / FP.SeededRandom / FP.PenComponent / FP.degreeToRadian /
 *   FP.turnAngleFromStart / FP.getControlPoint / FP.turnRight / FP.turnLeft /
 *   FP.getMiddlePoint / FP.getPointOnCurveByPercentage / FP.getCurveContours2
 */

/** 笔触丛配置：所有参数可调 */
export interface VanGoghClusterConfig {
	// --- 密度场参数（FBM 噪声） ---
	density_scale: number        // 噪声波长（px），越小斑块越碎，越大越整体
	density_octaves: number      // 叠加层数 2~6，越多细节越丰富
	density_lacunarity: number   // 每层频率倍增 1.5~2.5
	density_gain: number         // 每层振幅衰减 0.3~0.7
	density_offset: number       // 整体密度偏移 -0.5~0.5，正值变密
	density_contrast: number     // 对比度 0.5~3.0，大于 1 疏密对比更强
	density_seed: number         // 密度噪声种子
	// --- 间距参数（Bridson 可变泊松盘） ---
	r_min: number                // 最密处最小间距（建议 ≈0.75×簇直径）
	r_max: number                // 最疏处最小间距（建议 ≈0.95×簇直径）
	placement_seed: number       // 布点随机种子
	placement_k: number          // 每次候选尝试次数
	// --- 方向场参数 ---
	direction_base_angle: number      // 整体主方向（度）
	direction_noise_amplitude: number // 角度扰动最大幅度（度）0~90
	direction_noise_scale: number     // 方向噪声波长（px），越小方向变化越碎
	direction_noise_octaves: number   // 方向噪声层数 2~5
	direction_seed: number            // 方向噪声种子
	// --- 颜色参数（HSL） ---
	color_base_hue: number               // 基准色相 0~360
	color_base_saturation: number        // 基准饱和度 0~100
	color_base_lightness: number         // 基准亮度 0~100
	color_cluster_hue_jitter: number     // 簇基准色色相抖动容差（±）
	color_cluster_saturation_jitter: number // 簇基准色饱和度抖动容差（±）
	color_cluster_lightness_jitter: number  // 簇基准色亮度抖动容差（±）
	color_stroke_hue_jitter: number      // 簇内笔画色相抖动容差（±）
	color_stroke_saturation_jitter: number // 簇内笔画饱和度抖动容差（±）
	color_stroke_lightness_jitter: number  // 簇内笔画亮度抖动容差（±）
	color_seed: number                   // 颜色抖动随机种子
	// --- 固定笔触丛数据 ---
	clusterSize: number          // 骨架跨度
	strokeLength: number         // 笔触长度
	skeletonCurvature: number    // 骨架曲率
	strokeCurvature: number      // 笔触曲率
	strokeWeight: number         // 笔触厚度
	gap: number                  // 笔触间距
}

/** 单个笔触丛数据 */
export interface VanGoghClusterData {
	coord: { x: number; y: number }
	angle: number
	/** 簇基准色（hsl 格式字符串） */
	color: string
	/** 簇内笔画颜色抖动的确定性种子 */
	colorSeed: number
	clusterSize: number
	strokeLength: number
	skeletonCurvature: number
	strokeCurvature: number
	strokeWeight: number
	gap: number
}

/** FP 依赖的最小接口 */
interface VanGoghFPDeps {
	fbm: (x: number, y: number, scale: number, octaves: number, lacunarity: number, gain: number, seed: number) => number
	SeededRandom: new (seed: number) => { next: () => number; range: (min: number, max: number) => number }
	PenComponent: new () => {
		beginPath: () => void
		closePath: () => void
		moveTo: (x: number, y: number) => void
		bezierTo: (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => void
		lineTo: (x: number, y: number) => void
		setFillColor: (color?: string) => void
	}
	degreeToRadian: (degree: number) => number
	turnAngleFromStart: (start: { x: number; y: number }, end: { x: number; y: number }, angle: number, length: number) => { x: number; y: number }
	getControlPoint: (start: { x: number; y: number }, end: { x: number; y: number }, ratio: number, length: number) => { x: number; y: number }
	turnRight: (start: { x: number; y: number }, end: { x: number; y: number }, length: number) => { x: number; y: number }
	turnLeft: (start: { x: number; y: number }, end: { x: number; y: number }, length: number) => { x: number; y: number }
	getMiddlePoint: (a: { x: number; y: number }, b: { x: number; y: number }) => { x: number; y: number }
	getPointOnCurveByPercentage: (curve: any, percentage: number) => { point: { x: number; y: number } }
	getCurveContours2: (name: string, skeleton: any[], weight: number, options: any) => any
}

/** 色相环绕（0~360） */
const wrapHue = (h: number): number => ((h % 360) + 360) % 360

/** 钳制到 0~100 */
const clamp100 = (v: number): number => Math.max(0, Math.min(100, v))

/** 解析 hsl 格式颜色字符串 */
const parseHsl = (str: string | undefined): { h: number; s: number; l: number } => {
	const m = /hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/.exec(str || '')
	return m ? { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) } : { h: 0, s: 0, l: 0 }
}

/** 格式化 hsl 颜色字符串 */
const formatHsl = (h: number, s: number, l: number): string =>
	`hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`

/**
 * 生成区域内所有笔触丛的数据（坐标、角度、颜色、固定字段）
 * 密度图（FBM）→ Bridson 可变泊松盘布点 → 方向场 → 簇基准色
 */
export const buildVanGoghClustersData = (
	FP: VanGoghFPDeps,
	config: VanGoghClusterConfig,
	x: number,
	y: number,
	w: number,
	h: number,
): VanGoghClusterData[] => {
	const cfg = config

	// 密度场：亮度高 = 密集（间距小），亮度低 = 稀疏（间距大）
	const getDensity = (px: number, py: number): number => {
		const raw = FP.fbm(
			px, py,
			cfg.density_scale, cfg.density_octaves, cfg.density_lacunarity, cfg.density_gain,
			cfg.density_seed,
		)
		const d = (raw - 0.5) * cfg.density_contrast + 0.5 + cfg.density_offset
		return Math.max(0, Math.min(1, d))
	}

	// 间距函数：密度越高允许的最小间距越小
	const rFunc = (px: number, py: number): number =>
		cfg.r_min + (cfg.r_max - cfg.r_min) * (1 - getDensity(px, py))

	// Bridson 可变泊松盘（网格加速）：输入为区域内的局部坐标
	const cell = cfg.r_min / Math.sqrt(2)
	const cols = Math.max(1, Math.ceil(w / cell))
	const rows = Math.max(1, Math.ceil(h / cell))
	const grid = new Array(cols * rows).fill(-1)
	const ring = Math.ceil(cfg.r_max / cell) + 1

	const pts: Array<{ x: number; y: number }> = []
	const rng = new FP.SeededRandom(cfg.placement_seed)

	const tooClose = (px: number, py: number): boolean => {
		const gx = Math.floor(px / cell)
		const gy = Math.floor(py / cell)
		const rq = rFunc(px, py)
		const rq2 = rq * rq
		for (let gyy = Math.max(0, gy - ring); gyy <= Math.min(rows - 1, gy + ring); gyy++) {
			for (let gxx = Math.max(0, gx - ring); gxx <= Math.min(cols - 1, gx + ring); gxx++) {
				const si = grid[gyy * cols + gxx]
				if (si < 0) continue
				const s = pts[si]
				const dx = s.x - px
				const dy = s.y - py
				if (dx * dx + dy * dy < rq2) return true
			}
		}
		return false
	}

	const p0 = { x: rng.next() * w, y: rng.next() * h }
	pts.push(p0)
	grid[Math.floor(p0.y / cell) * cols + Math.floor(p0.x / cell)] = 0

	const active = [0]
	while (active.length > 0) {
		const ai = Math.floor(rng.next() * active.length)
		const p = pts[active[ai]]
		let found = false
		for (let k = 0; k < cfg.placement_k; k++) {
			const r = rFunc(p.x, p.y)
			const angle = rng.next() * 2 * Math.PI
			const dist = r * (1 + rng.next())
			const qx = p.x + Math.cos(angle) * dist
			const qy = p.y + Math.sin(angle) * dist
			if (qx < 0 || qx >= w || qy < 0 || qy >= h) continue
			if (!tooClose(qx, qy)) {
				const qi = pts.length
				pts.push({ x: qx, y: qy })
				grid[Math.floor(qy / cell) * cols + Math.floor(qx / cell)] = qi
				active.push(qi)
				found = true
				break
			}
		}
		if (!found) {
			active.splice(ai, 1)
		}
	}

	// 方向场：基础角度 + 噪声扰动
	const angleAt = (px: number, py: number): number => {
		const n = FP.fbm(
			px, py,
			cfg.direction_noise_scale, cfg.direction_noise_octaves, 2.0, 0.5,
			cfg.direction_seed,
		)
		return cfg.direction_base_angle + (n * 2 - 1) * cfg.direction_noise_amplitude
	}

	// 簇基准色：基准 HSL 基础上小范围抖动（确定性，color_seed 控制）
	const colorRng = new FP.SeededRandom(cfg.color_seed)
	const colorAt = (idx: number): { h: number; s: number; l: number } => {
		const h = wrapHue(cfg.color_base_hue + colorRng.range(-cfg.color_cluster_hue_jitter, cfg.color_cluster_hue_jitter))
		const s = clamp100(cfg.color_base_saturation + colorRng.range(-cfg.color_cluster_saturation_jitter, cfg.color_cluster_saturation_jitter))
		const l = clamp100(cfg.color_base_lightness + colorRng.range(-cfg.color_cluster_lightness_jitter, cfg.color_cluster_lightness_jitter))
		return { h, s, l }
	}

	return pts.map((p, idx) => {
		const c = colorAt(idx)
		return {
			coord: { x: x + p.x, y: y + p.y },
			angle: angleAt(p.x, p.y),
			// 簇基准色（hsl 格式）
			color: formatHsl(c.h, c.s, c.l),
			// 簇内笔画颜色抖动的确定性种子（基准 color_seed + 簇序号）
			colorSeed: cfg.color_seed + idx,
			clusterSize: cfg.clusterSize,
			strokeLength: cfg.strokeLength,
			skeletonCurvature: cfg.skeletonCurvature,
			strokeCurvature: cfg.strokeCurvature,
			strokeWeight: cfg.strokeWeight,
			gap: cfg.gap,
		}
	})
}

/**
 * 根据一个笔触丛数据生成笔画组件
 * 沿骨架（start→bend→end 二次贝塞尔）均匀取点，每隔一段在相邻采样点
 * 中点处画一道垂直于骨架切线的弯曲笔触（厚度 strokeWeight），
 * 每道笔画颜色 = 簇基准色 ± 笔画级抖动容差
 */
export const buildVanGoghPaintingCluster = (
	FP: VanGoghFPDeps,
	config: VanGoghClusterConfig,
	cluster: VanGoghClusterData,
): { curves: any[]; components: any[] } => {
	const { coord, angle, clusterSize, strokeLength, skeletonCurvature, strokeCurvature, strokeWeight, gap } = cluster
	const cfg = config
	const curves: any[] = []
	const components: any[] = []

	// 簇基准色
	const baseColor = parseHsl(cluster.color)

	// 簇内笔画颜色抖动
	const strokeColorRng = new FP.SeededRandom(cluster.colorSeed)
	const strokeColorAt = (): string => {
		const h = wrapHue(baseColor.h + strokeColorRng.range(-cfg.color_stroke_hue_jitter, cfg.color_stroke_hue_jitter))
		const s = clamp100(baseColor.s + strokeColorRng.range(-cfg.color_stroke_saturation_jitter, cfg.color_stroke_saturation_jitter))
		const l = clamp100(baseColor.l + strokeColorRng.range(-cfg.color_stroke_lightness_jitter, cfg.color_stroke_lightness_jitter))
		return formatHsl(h, s, l)
	}

	// 骨架：p0（正上）与 p1（正下）绕 coord 旋转 angle 后作为骨架端点
	const p0 = { x: coord.x, y: coord.y - clusterSize * 0.5 }
	const p1 = { x: coord.x, y: coord.y + clusterSize * 0.5 }
	const start = FP.turnAngleFromStart(coord, p0, FP.degreeToRadian(angle), clusterSize * 0.5)
	const end = FP.turnAngleFromStart(coord, p1, FP.degreeToRadian(angle), clusterSize * 0.5)
	const bend = FP.getControlPoint(start, end, 0.5, skeletonCurvature * 100)

	// 笔触道数向上取整，并让笔画均匀覆盖整个骨架（含两端）
	const count = Math.max(1, Math.ceil(clusterSize / (strokeWeight + gap)))

	// 骨架曲线（二次贝塞尔）：采样约定键名是 control
	const skeleton = { start, control: bend, end }

	const options = {
		weightsVariation: 'bezier',
		weightsVariationFnType: 'stroke',
		weightsVariationSpeed: 1.0,
	}

	let last: { x: number; y: number } | null = null
	for (let i = 0; i <= count; i++) {
		const t = i / count
		const { point } = FP.getPointOnCurveByPercentage(skeleton, t)
		if (last) {
			const center = FP.getMiddlePoint(last, point)
			const s = FP.turnRight(point, center, strokeLength * 0.5)
			const e = FP.turnLeft(point, center, strokeLength * 0.5)
			const b = FP.getControlPoint(s, e, 0.5, strokeCurvature * 100)
			// 注意：getCurveContours2 对二次贝塞尔的约定键名是 bend（不是 control）
			const strokeCurve = { start: s, bend: b, end: e }
			curves.push(strokeCurve)

			// 每道笔画独立生成轮廓，避免累积导致后一道包裹前一道（闭合错乱）
			const { out_stroke1_curves, in_stroke1_curves } = FP.getCurveContours2(
				'stroke1',
				[strokeCurve],
				strokeWeight,
				options,
			)
			const pen = new FP.PenComponent()
			pen.beginPath()
			pen.moveTo(out_stroke1_curves[0].start.x, out_stroke1_curves[0].start.y)
			for (let j = 0; j < out_stroke1_curves.length; j++) {
				const curve = out_stroke1_curves[j]
				pen.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
			}
			pen.lineTo(in_stroke1_curves[in_stroke1_curves.length - 1].end.x, in_stroke1_curves[in_stroke1_curves.length - 1].end.y)
			for (let j = in_stroke1_curves.length - 1; j >= 0; j--) {
				const curve = in_stroke1_curves[j]
				pen.bezierTo(curve.control2.x, curve.control2.y, curve.control1.x, curve.control1.y, curve.start.x, curve.start.y)
			}
			pen.lineTo(out_stroke1_curves[0].start.x, out_stroke1_curves[0].start.y)
			pen.closePath()
			// 每道笔画独立分色：簇基准色 + 笔画级抖动
			pen.setFillColor(strokeColorAt())
			components.push(pen)
		}
		last = point
	}

	return { curves, components }
}

/**
 * 一键生成区域内所有笔触丛
 * @returns 每个簇的 { curves, components }
 */
/**
 * 在不规则四边形区域内生成笔触丛
 * 先在四边形的包围盒矩形内按正常算法生成（密度图 + Bridson + 方向场），
 * 再将每个簇的坐标通过双线性插值映射到四边形内部
 *
 * @param FP FP 对象（依赖注入）
 * @param config 笔触丛配置
 * @param leftTop 四边形左上顶点
 * @param rightTop 右上顶点
 * @param leftBottom 左下顶点
 * @param rightBottom 右下顶点
 */
export const buildVanGoghClustersInQuad = (
	FP: VanGoghFPDeps,
	config: VanGoghClusterConfig,
	leftTop: { x: number; y: number },
	rightTop: { x: number; y: number },
	leftBottom: { x: number; y: number },
	rightBottom: { x: number; y: number },
): Array<{ curves: any[]; components: any[] }> => {
	// 四边形的包围盒
	const minX = Math.min(leftTop.x, rightTop.x, leftBottom.x, rightBottom.x)
	const maxX = Math.max(leftTop.x, rightTop.x, leftBottom.x, rightBottom.x)
	const minY = Math.min(leftTop.y, rightTop.y, leftBottom.y, rightBottom.y)
	const maxY = Math.max(leftTop.y, rightTop.y, leftBottom.y, rightBottom.y)
	const w = maxX - minX || 1
	const h = maxY - minY || 1

	// 在包围盒矩形内生成簇数据（与矩形模式完全一致）
	const clustersData = buildVanGoghClustersData(FP, config, minX, minY, w, h)

	return clustersData.map((cluster) => {
		// 双线性映射：矩形坐标 → 四边形坐标
		const u = (cluster.coord.x - minX) / w
		const v = (cluster.coord.y - minY) / h
		const top = {
			x: leftTop.x + (rightTop.x - leftTop.x) * u,
			y: leftTop.y + (rightTop.y - leftTop.y) * u,
		}
		const bottom = {
			x: leftBottom.x + (rightBottom.x - leftBottom.x) * u,
			y: leftBottom.y + (rightBottom.y - leftBottom.y) * u,
		}
		const coord = {
			x: top.x + (bottom.x - top.x) * v,
			y: top.y + (bottom.y - top.y) * v,
		}
		return buildVanGoghPaintingCluster(FP, config, { ...cluster, coord })
	})
}

/**
 * 生成区域内所有笔触丛（矩形模式）或四边形内所有笔触丛（四边形模式）
 * - 矩形：buildVanGoghClusters(config, x, y, w, h)
 * - 四边形：buildVanGoghClusters(config, leftTop, rightTop, leftBottom, rightBottom)
 */
export const buildVanGoghClusters = (
	FP: VanGoghFPDeps,
	config: VanGoghClusterConfig,
	a: number | { x: number; y: number },
	b: number | { x: number; y: number },
	c: number | { x: number; y: number },
	d: number | { x: number; y: number },
): Array<{ curves: any[]; components: any[] }> => {
	// 矩形模式：四个参数均为数字 (x, y, w, h)
	if (typeof a === 'number' && typeof b === 'number' && typeof c === 'number' && typeof d === 'number') {
		return buildVanGoghClustersData(FP, config, a, b, c, d).map((cluster) =>
			buildVanGoghPaintingCluster(FP, config, cluster),
		)
	}
	// 四边形模式：四个顶点 (leftTop, rightTop, leftBottom, rightBottom)
	return buildVanGoghClustersInQuad(
		FP,
		config,
		a as { x: number; y: number },
		b as { x: number; y: number },
		c as { x: number; y: number },
		d as { x: number; y: number },
	)
}
