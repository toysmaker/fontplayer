// Keep values aligned with original project stores/global.ts
// 骨骼密度: 每段固定 5 根 (典型骨骼 20-60 单位, 与笔画宽 ~50 同量级)。
// 实测对比 (缩短竖 200→30 的毛刺数): 5 根/段 = 0 毛刺, 20 根/段 = 6 毛刺 —
// 骨骼过细时压缩段内多根独立缩放的小骨产生手风琴式皱褶, 且相邻采样点权重差异更大。
export const maxSegment = 5
export const minSegment = 3
export const skeletonThreshold = 1

