/**
 * 字体管理器加载状态
 * 用于字体导出等操作的进度跟踪
 */

import { ref } from 'vue'

export const loading = ref(false)
export const loaded = ref(0)
export const total = ref(100)
export const loadingMsg = ref('')
