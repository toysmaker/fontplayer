/**
 * 确定性噪声工具：2D 值噪声 + 分形布朗运动（FBM）
 * 输出均归一化到 [0, 1]，相同坐标与 seed 始终返回相同值
 */

/**
 * 2D 值噪声的整数哈希（确定性，输出 [0, 1)）
 */
export const noiseHashInt = (xi: number, yi: number, seed: number): number => {
	let h = Math.imul(xi, 374761393) ^ Math.imul(yi, 668265263) ^ Math.imul(seed, 2246822519)
	h = Math.imul(h ^ (h >>> 13), 1274126177)
	h = h ^ (h >>> 16)
	return (h >>> 0) / 4294967296
}

/**
 * 2D 值噪声（双线性插值 + smoothstep 渐变），输出 [0, 1]
 * 确定性：相同坐标与 seed 始终返回相同值
 *
 * @param x 采样 x 坐标
 * @param y 采样 y 坐标
 * @param seed 噪声种子
 */
export const valueNoise = (x: number, y: number, seed: number): number => {
	const xi = Math.floor(x)
	const yi = Math.floor(y)
	const xf = x - xi
	const yf = y - yi
	const u = xf * xf * (3 - 2 * xf)
	const v = yf * yf * (3 - 2 * yf)
	const a = noiseHashInt(xi, yi, seed)
	const b = noiseHashInt(xi + 1, yi, seed)
	const c = noiseHashInt(xi, yi + 1, seed)
	const d = noiseHashInt(xi + 1, yi + 1, seed)
	return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/**
 * 分形布朗运动（FBM）噪声：叠加多层值噪声并归一化，输出 [0, 1]
 * 用于生成自然的疏密/方向变化场
 *
 * @param x 采样 x 坐标
 * @param y 采样 y 坐标
 * @param scale 噪声空间频率的倒数（波长，px），越小斑块越碎
 * @param octaves 叠加层数 2~6，越多细节越丰富
 * @param lacunarity 每层频率倍增系数，一般 2.0
 * @param gain 每层振幅衰减系数，一般 0.5
 * @param seed 随机种子（第 i 层使用 seed + i）
 */
export const fbm = (
	x: number,
	y: number,
	scale: number,
	octaves: number,
	lacunarity: number,
	gain: number,
	seed: number,
): number => {
	let value = 0
	let amplitude = 1
	let frequency = 1 / scale
	let totalAmp = 0
	for (let i = 0; i < octaves; i++) {
		value += amplitude * valueNoise(x * frequency, y * frequency, seed + i)
		totalAmp += amplitude
		amplitude *= gain
		frequency *= lacunarity
	}
	return value / totalAmp
}
