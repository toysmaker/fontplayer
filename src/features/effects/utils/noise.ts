/**
 * 2D Perlin 噪声实现
 * 用于效果滤镜中的随机扰动生成
 *
 * 基于经典 Perlin 噪声算法，使用排列表实现可复现的随机性
 */

// 排列表（标准 Perlin 排列表）
const PERMUTATION: number[] = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
  140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
  247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
  57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
  74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
  60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
  65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
  200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
  52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
  207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213,
  119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
  129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104,
  218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
  81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
  184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93,
  222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
]

/** 生成基于种子的排列表 */
function buildPermutationTable(seed: number = 0): number[] {
  const table = [...PERMUTATION]
  // 使用 seed 打乱排列表（可复现）
  if (seed !== 0) {
    let s = seed
    for (let i = table.length - 1; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647
      const j = s % (i + 1)
      ;[table[i], table[j]] = [table[j], table[i]]
    }
  }
  // 双倍排列表（用于 wrap）
  return [...table, ...table]
}

/** 缓存的排列表（按 seed） */
const permCache = new Map<number, number[]>()

function getPerm(seed: number): number[] {
  if (!permCache.has(seed)) {
    permCache.set(seed, buildPermutationTable(seed))
  }
  return permCache.get(seed)!
}

/** 渐变向量 */
const GRADIENTS: [number, number][] = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
]

/** 平滑函数 */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/** 线性插值 */
function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a)
}

/** 点积 */
function dot(gx: number, gy: number, x: number, y: number): number {
  return gx * x + gy * y
}

/**
 * 2D Perlin 噪声
 * @param x X 坐标
 * @param y Y 坐标
 * @param seed 随机种子（默认 0）
 * @returns 噪声值，范围 [-1, 1]
 */
export function noise2D(x: number, y: number, seed: number = 0): number {
  const perm = getPerm(seed)

  // 确定晶格单元
  const xi = Math.floor(x) & 255
  const yi = Math.floor(y) & 255

  // 晶格内相对位置
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)

  // 平滑权重
  const u = fade(xf)
  const v = fade(yf)

  // 四个角的哈希
  const aa = perm[perm[xi] + yi]
  const ab = perm[perm[xi] + yi + 1]
  const ba = perm[perm[xi + 1] + yi]
  const bb = perm[perm[xi + 1] + yi + 1]

  // 四个角的梯度索引
  const gAA = GRADIENTS[aa % 8]
  const gAB = GRADIENTS[ab % 8]
  const gBA = GRADIENTS[ba % 8]
  const gBB = GRADIENTS[bb % 8]

  // 计算四个角的贡献
  const nAA = dot(gAA[0], gAA[1], xf, yf)
  const nAB = dot(gAB[0], gAB[1], xf, yf - 1)
  const nBA = dot(gBA[0], gBA[1], xf - 1, yf)
  const nBB = dot(gBB[0], gBB[1], xf - 1, yf - 1)

  // 双线性插值
  const x1 = lerp(nAA, nBA, u)
  const x2 = lerp(nAB, nBB, u)

  return lerp(x1, x2, v)
}

/**
 * 1D Perlin 噪声（沿轮廓参数 t）
 * @param t 参数值
 * @param seed 随机种子
 * @returns 噪声值，范围 [-1, 1]
 */
export function noise1D(t: number, seed: number = 0): number {
  return noise2D(t, 0, seed)
}

/**
 * 带频率缩放的 2D 噪声
 */
export function noise2DFreq(x: number, y: number, frequency: number, seed: number = 0): number {
  return noise2D(x * frequency, y * frequency, seed)
}

/**
 * 带频率缩放的 1D 噪声
 */
export function noise1DFreq(t: number, frequency: number, seed: number = 0): number {
  return noise1D(t * frequency, seed)
}

/**
 * 基于种子的伪随机数生成器（可复现）
 * @param seed 种子值
 * @returns 返回 [0, 1) 的随机数，每次调用推进内部状态
 */
export function createPRNG(seed: number): () => number {
  // seed=0 会让 LCG 卡在 0，用非零常量兜底
  let state = seed === 0 ? 12345 : (seed & 0x7fffffff) || 1
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}
