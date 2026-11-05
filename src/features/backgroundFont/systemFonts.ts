/**
 * 系统字体枚举服务（仅 Tauri 端支持）
 *
 * 通过 Rust 侧 list_system_fonts command（macOS CoreText）获取系统字体族名与本地化显示名。
 * 结果模块级缓存，只请求一次；非 Tauri 环境或 invoke 失败时返回空列表（不预设任何字体）。
 */

import { isTauri } from '@/utils/env'

export interface SystemFontItem {
  /** 用于 canvas ctx.font 的字体族名 */
  family: string
  /** 本地化显示名（中文系统下为中文名，如「苹方」） */
  display: string
}

let loadPromise: Promise<SystemFontItem[]> | null = null

async function fetchSystemFonts(): Promise<SystemFontItem[]> {
  if (!isTauri()) return []
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const fonts = await invoke<SystemFontItem[]>('list_system_fonts')
    if (Array.isArray(fonts) && fonts.length > 0) return fonts
    return []
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[systemFonts] list_system_fonts failed:', err)
    }
    return []
  }
}

/** 获取系统可用字体列表（模块级缓存，只请求一次） */
export function getSystemFonts(): Promise<SystemFontItem[]> {
  if (!loadPromise) {
    loadPromise = fetchSystemFonts()
  }
  return loadPromise
}
