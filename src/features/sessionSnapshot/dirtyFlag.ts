/**
 * 会话快照脏标记
 *
 * 供 project store 的动作与快照服务共享的 O(1) 脏信号。
 * 独立成模块避免 store <-> service 循环依赖。
 * 注意：不能用 store.$subscribe({deep:true}) 代替——深度订阅会在每次状态
 * 变更时遍历整个工程状态图（大工程数十毫秒），保存等逐字符更新进度
 * 的操作会因此严重变慢。
 */

let dirty = true // 初始即脏：首次快照保证全量

/** 工程数据有变更（store 动作/直接修改路径调用） */
export function markSessionSnapshotDirty(): void {
  dirty = true
}

/** 消费脏标记（快照服务写完全量后调用） */
export function consumeSessionSnapshotDirty(): boolean {
  const d = dirty
  dirty = false
  return d
}
