/**
 * 列表导航防误触守卫
 *
 * 场景：工具栏「字符列表」按钮与文件条的语言切换按钮（中文/English）位置相邻，
 * 点击「字符列表」跳回列表页后，鼠标指针恰好落在语言切换按钮上，手一抖就会误切语言。
 * 防护：跳列表动作发生后 10 秒内，语言切换点击无效。
 */

const BLOCK_MS = 10_000
let lastToListNavigationAt = 0

/** 标记一次「跳到列表页」导航（在导航动作成功后调用） */
export function markToListNavigation(): void {
  lastToListNavigationAt = Date.now()
}

/** 语言切换是否处于防误触窗口内 */
export function isLanguageSwitchBlocked(): boolean {
  return Date.now() - lastToListNavigationAt < BLOCK_MS
}
