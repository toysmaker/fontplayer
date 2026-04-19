/**
 * CSS Grid `repeat(auto-fill, itemWidth)` + `column-gap` 的列数（与 track 内容区宽度一致）
 *
 * 注意：trackInnerWidthPx 若为 0 又退化成 1 列，虚拟滚动的 offsetY 会按「每索引一行」计算，
 * 与真实多列网格严重错位（常见表现：前 4列×8行=32 项正常，第 33 项起整片空白）。调用方应在
 * 未测得宽度时用 {@link fallbackTrackInnerWidthFromScrollContainer} 再算列数。
 */
export function columnsFromTrackInnerWidth(
  trackInnerWidthPx: number,
  itemWidthPx: number,
  columnGapPx: number
): number {
  if (trackInnerWidthPx <= 0) return 1
  return Math.max(1, Math.floor((trackInnerWidthPx + columnGapPx) / (itemWidthPx + columnGapPx)))
}

/** 用滚动容器 clientWidth 减去与样式一致的水平 inset，估算 grid track 宽度（弹窗未测完、WK 首帧为 0 时用） */
export function fallbackTrackInnerWidthFromScrollContainer(
  scrollContainerClientWidth: number,
  horizontalInsetPx: number
): number {
  if (scrollContainerClientWidth <= 0) return 0
  return Math.max(0, scrollContainerClientWidth - horizontalInsetPx)
}

/** 从带左右 padding 的网格容器读取 track 内容宽度 */
export function readGridTrackInnerWidth(el: HTMLElement): number {
  const cs = getComputedStyle(el)
  const pl = parseFloat(cs.paddingLeft) || 0
  const pr = parseFloat(cs.paddingRight) || 0
  return Math.max(0, el.clientWidth - pl - pr)
}
