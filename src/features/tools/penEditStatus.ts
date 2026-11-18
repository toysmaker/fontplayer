/**
 * 钢笔路径编辑状态（响应式）
 * 供 BottomBar 的「钢笔路径编辑提示」显示判断：
 * 钢笔创建工具（PenTool）或钢笔路径编辑（PenSelectTool，含骨架轮廓自由编辑）激活时为 true
 */

import { ref } from 'vue'

export const penPathEditingActive = ref(false)

export function setPenPathEditingActive(active: boolean): void {
  penPathEditingActive.value = active
}
