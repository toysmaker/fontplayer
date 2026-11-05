/**
 * 复制文本到系统剪贴板（多层降级）
 *
 * 生产（打包）环境下系统剪贴板能力可能受限，因此按优先级尝试：
 * 1. navigator.clipboard.writeText（需用户手势与安全上下文）
 * 2. Tauri 原生剪贴板插件（capabilities 已开启 clipboard-manager:allow-write-text）
 * 3. 临时 textarea + document.execCommand('copy') 兜底
 */

async function copyViaTauri(text: string): Promise<boolean> {
  try {
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
    await writeText(text)
    return true
  } catch {
    return false
  }
}

function copyViaExecCommand(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 继续降级 */
  }
  if (await copyViaTauri(text)) return true
  return copyViaExecCommand(text)
}
