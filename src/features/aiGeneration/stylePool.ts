/**
 * 风格向量池与采样 — 复刻 demo6 sample.py / demo9 infer.py 的算法
 *
 * demo6 五风格顺序固定: 字玩标准黑体/宋体/楷体/仿宋/隶书 (五边形 UI 的五角)
 * demo9 九风格: KAI_STYLES 顺序 (楷-多宝塔 ... 楷-魏碑)
 *
 * 随机数用 Math.random (统计等价, 不追求与 numpy 逐位一致);
 * 协方差等统计量用 float64 计算, 与 np.cov(ddof=1) 一致。
 */

export const STROKE_STYLE_DIM = 64
export const CHAR_STYLE_DIM = 64

/** demo6: 每单位权重采样数 / 推开系数 (sample.py 硬编码) */
export const CTRL_SAMPLE_PER_UNIT = 8
export const CTRL_PUSH_FACTOR = 0.3
/** 随机模式协方差正则 (demo6/demo9 均为 0.01) */
export const RANDOM_COV_EPS = 0.01

export interface StylePools {
  styles: string[]
  pools: Record<string, number[][]>
}

const AI_BASE = `${import.meta.env.BASE_URL || '/'}models/ai/`

function aiUrl(path: string): string {
  const base = AI_BASE.endsWith('/') ? AI_BASE : `${AI_BASE}/`
  return `${base}${path}`
}

let _strokePools: Promise<StylePools> | null = null
let _charPools: Promise<StylePools> | null = null

async function loadPools(url: string): Promise<StylePools> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`风格池加载失败: ${url} (${res.status})`)
  }
  return (await res.json()) as StylePools
}

export function getStrokeStylePools(): Promise<StylePools> {
  if (!_strokePools) _strokePools = loadPools(aiUrl('stroke_style_pools.json'))
  return _strokePools
}

export function getCharStylePools(): Promise<StylePools> {
  if (!_charPools) _charPools = loadPools(aiUrl('char_style_pools.json'))
  return _charPools
}

// ── 向量工具 ────────────────────────────────────────────

function meanVec(rows: number[][]): Float64Array {
  const dim = rows.length > 0 ? rows[0].length : 0
  const m = new Float64Array(dim)
  for (const r of rows) {
    for (let d = 0; d < dim; d++) m[d] += r[d]
  }
  for (let d = 0; d < dim; d++) m[d] /= rows.length
  return m
}

/** np.cov(rowvar=False, ddof=1) + 对角 eps (float64) */
function computeCov(rows: number[][], eps: number): Float64Array {
  const n = rows.length
  const dim = rows.length > 0 ? rows[0].length : 0
  const m = meanVec(rows)
  const cov = new Float64Array(dim * dim)
  for (const r of rows) {
    for (let j = 0; j < dim; j++) {
      const dj = r[j] - m[j]
      for (let k = j; k < dim; k++) {
        cov[j * dim + k] += dj * (r[k] - m[k])
      }
    }
  }
  for (let j = 0; j < dim; j++) {
    for (let k = j; k < dim; k++) {
      const v = cov[j * dim + k] / (n - 1)
      cov[j * dim + k] = v
      cov[k * dim + j] = v
    }
    cov[j * dim + j] += eps
  }
  return cov
}

/** np.random.choice(len, k, replace=False) 等价: 打乱取前 k (无放回) */
function sampleChoice(pool: number[][], k: number, rng: () => number): number[][] {
  const idx = Array.from({ length: pool.length }, (_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx.slice(0, Math.min(k, pool.length)).map((i) => pool[i])
}

/** 标准正态 (Box-Muller) */
function randn(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12)
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

/** 多元正态采样: Cholesky 分解 cov = L·Lᵀ, z = mean + L·ε (统计等价于 numpy MVN) */
function sampleMvn(mean: Float64Array, cov: Float64Array, rng: () => number): Float64Array {
  const dim = mean.length
  const L = new Float64Array(dim * dim)
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j <= i; j++) {
      let s = cov[i * dim + j]
      for (let k = 0; k < j; k++) s -= L[i * dim + k] * L[j * dim + k]
      if (i === j) {
        L[i * dim + j] = Math.sqrt(Math.max(s, 0))
      } else {
        L[i * dim + j] = s / L[j * dim + j]
      }
    }
  }
  const eps = new Float64Array(dim)
  for (let d = 0; d < dim; d++) eps[d] = randn(rng)
  const out = new Float64Array(dim)
  for (let i = 0; i < dim; i++) {
    let s = 0
    for (let k = 0; k <= i; k++) s += L[i * dim + k] * eps[k]
    out[i] = mean[i] + s
  }
  return out
}

// ── demo6 笔画采样 ──────────────────────────────────────

/**
 * ctrl 模式 (五边形五权重, 顺序 黑/宋/楷/仿/隶, ∈[-1,1]):
 * 每风格无放回采样 max(1, int(|w|*8+1)) 个池向量;
 * z = 正权重池均值 (+0.3*(z−负权重池均值) 若存在负权重); 无正权重时取首风格质心
 */
export async function sampleCtrlStroke(weights: number[]): Promise<Float32Array> {
  const { styles, pools } = await getStrokeStylePools()
  const dim = STROKE_STYLE_DIM
  const rng = Math.random

  const centroids = new Map<string, Float64Array>()
  for (const s of styles) centroids.set(s, meanVec(pools[s]))

  const pos: number[][] = []
  const neg: number[][] = []
  for (let i = 0; i < styles.length; i++) {
    const w = weights[i] ?? 0
    if (Math.abs(w) < 1e-6) continue
    const nSample = Math.max(1, Math.floor(Math.abs(w) * CTRL_SAMPLE_PER_UNIT + 1))
    const sampled = sampleChoice(pools[styles[i]], nSample, rng)
    if (w > 0) pos.push(...sampled)
    else neg.push(...sampled)
  }

  let z: Float64Array
  if (pos.length > 0) {
    z = meanVec(pos)
  } else {
    z = Float64Array.from(centroids.get(styles[0])!)
  }
  if (neg.length > 0) {
    const away = meanVec(neg)
    for (let d = 0; d < dim; d++) z[d] = z[d] + CTRL_PUSH_FACTOR * (z[d] - away[d])
  }
  return Float32Array.from(z)
}

/**
 * random 模式 (五边形"随机"按钮, sample.py 默认模式):
 * z = 随机质心 + MVN(0, 质心间协方差 × temperature); temperature=1.0
 */
export async function sampleRandomStroke(temperature = 1): Promise<Float32Array> {
  const { styles, pools } = await getStrokeStylePools()
  const centroids = styles.map((s) => meanVec(pools[s]))
  const cov = computeCov(centroids.map((c) => Array.from(c)), RANDOM_COV_EPS)
  const scaled = Float64Array.from(cov, (v) => v * temperature)
  const noise = sampleMvn(new Float64Array(STROKE_STYLE_DIM), scaled, Math.random)
  const base = centroids[Math.floor(Math.random() * styles.length)]
  const z = new Float64Array(STROKE_STYLE_DIM)
  for (let d = 0; d < z.length; d++) z[d] = base[d] + noise[d]
  return Float32Array.from(z)
}

// ── demo9 字符采样 ──────────────────────────────────────

/**
 * random 模式 (infer.py --random):
 * 全池拼平 → z = MVN(mean, cov×temperature); RMS 截断: ||z−mean||/√64 > truncation 时缩放
 */
export async function sampleRandomChar(temperature = 1, truncation = 2): Promise<Float32Array> {
  const { styles, pools } = await getCharStylePools()
  const dim = CHAR_STYLE_DIM
  const allFlat = styles.flatMap((s) => pools[s])
  const mean = meanVec(allFlat)
  const cov = computeCov(allFlat, RANDOM_COV_EPS)
  const scaled = Float64Array.from(cov, (v) => v * temperature)
  let z = sampleMvn(mean, scaled, Math.random)
  const delta = new Float64Array(dim)
  let deltaNorm = 0
  for (let d = 0; d < dim; d++) {
    delta[d] = z[d] - mean[d]
    deltaNorm += delta[d] * delta[d]
  }
  deltaNorm = Math.sqrt(deltaNorm) / Math.sqrt(dim)
  if (deltaNorm > truncation) {
    for (let d = 0; d < dim; d++) {
      z[d] = mean[d] + (delta[d] / deltaNorm) * truncation
    }
  }
  return Float32Array.from(z)
}
