/**
 * 伪随机数生成器（Mulberry32 算法）
 * 给定 seed 生成确定性的 [0, 1) 随机序列
 */
export class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed | 0
    if (this.state === 0) this.state = 1
  }

  /** 返回 [0, 1) 的下一个随机数 */
  next(): number {
    let t = (this.state += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** 返回 [min, max] 范围内的随机数 */
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** 返回 [min, max] 范围内的随机整数 */
  rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }
}

/**
 * 快捷函数：用 seed 生成 [min, max] 之间的伪随机数（不保留状态）
 */
export const seededRandom = (seed: number, min: number, max: number): number => {
  const rng = new SeededRandom(seed)
  return rng.range(min, max)
}
