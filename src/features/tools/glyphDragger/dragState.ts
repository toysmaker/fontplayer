/**
 * 字形拖拽的共享状态(供 SelectTool 等在拖拽期间跳过每 move 的昂贵命中测试)
 */
import { ref } from 'vue'

export const glyphDragActive = ref(false)
export const glyphDragComponentUUID = ref<string | null>(null)
