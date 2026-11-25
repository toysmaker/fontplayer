/**
 * Tauri 白屏恢复协同：字库构建期间主线程会出现秒级同步段，
 * 若窗口聚焦时恰逢阻塞，Rust 侧存活检测会误判页面死亡并 reload。
 * 构建开始/结束时通知 Rust 置位/清除 busy 标志，存活检测在 busy 时跳过 reload。
 */
import { getEnv } from '@/utils/env'

export async function setTauriBuildBusy(busy: boolean): Promise<void> {
  if (getEnv() !== 'tauri') return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('log_diagnostic', { msg: busy ? 'build-busy-start' : 'build-busy-end' })
  } catch {
    /* 非致命：通知失败仅退化为原有行为 */
  }
}
