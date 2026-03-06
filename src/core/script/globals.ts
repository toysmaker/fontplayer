/**
 * 脚本执行环境的全局状态
 * 用于在脚本执行时提供全局变量
 * 
 * 注意：selectedFile 的值由 ScriptExecutor 在执行脚本时从 projectStore 注入
 */

import { ref } from 'vue'

// 字体渲染样式：'black' | 'color' | 'contour'
export const fontRenderStyle = ref<'black' | 'color' | 'contour'>('black')

// 当前选中的文件（由 ScriptExecutor 在执行脚本时从 projectStore.selectedFile 注入）
// 在脚本执行环境中，Component 类可以通过此变量访问当前项目的 fontSettings
export const selectedFile = { value: null as any }
