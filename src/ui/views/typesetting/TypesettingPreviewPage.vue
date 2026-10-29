<template>
  <div class="typesetting-page">
    <header class="typesetting-header">
      <span class="typesetting-title">{{ t('typesetting.title') }}</span>
      <div class="typesetting-toolbar">
        <span class="toolbar-label">{{ t('typesetting.fontSize') }}</span>
        <!-- @mousedown.prevent：防止点击输入框时浏览器清掉编辑器选区；手动聚焦内部 input。
             输入框为受控组件：选中字符时显示选区字号（混合字号显示为空，像 Word），
             原生 +/- 按钮（naive-ui 样式）点击经 @click.capture 拦截后按选区加权平均字号 ±1 -->
        <div
          class="toolbar-size"
          @mousedown.prevent="handleSizeMousedown"
          @click.capture="handleSizeControlClick"
        >
          <n-input-number
            :value="sizeInputValue"
            size="small"
            :min="12"
            :max="200"
            :step="1"
            @update:value="handleSizeInput"
          />
        </div>
        <span class="toolbar-label">{{ t('typesetting.color') }}</span>
        <!-- @mousedown.prevent：防止点击取色器时编辑器选区被清空，颜色才能应用到选区
             #label 置空：触发器只显示颜色方块，色值显示在方块之后 -->
        <n-color-picker
          v-model:value="defaultColor"
          size="small"
          :show-alpha="false"
          :modes="['hex']"
          :swatches="DEFAULT_COLORS"
          @mousedown.prevent
        >
          <template #label></template>
        </n-color-picker>
        <span class="color-value">{{ defaultColor }}</span>
      </div>
      <!-- 全局生效：勾选时字号/颜色作用于全文（含已调整字符），否则仅作用于选中字符 -->
      <n-checkbox v-model:checked="globalMode" size="small" class="global-check">
        {{ t('typesetting.globalMode') }}
      </n-checkbox>
    </header>

    <!-- 入口：是否复用上一次生成的字体 -->
    <n-modal
      v-model:show="showEntryModal"
      preset="dialog"
      :title="t('typesetting.title')"
      :show-icon="false"
      @update:show="handleEntryModalClose"
    >
      <div class="entry-content">
        <n-checkbox v-model:checked="useLastFont">
          {{ t('typesetting.useLastFont') }}
        </n-checkbox>
      </div>
      <template #action>
        <n-button type="primary" size="small" @click="handleEntryConfirm" @pointerup="handleEntryConfirm">
          {{ t('typesetting.confirm') }}
        </n-button>
      </template>
    </n-modal>

    <!-- 字库生成进度 -->
    <div v-if="building" class="typesetting-loading">
      <n-spin size="large" />
      <div class="loading-text">
        {{ t('typesetting.buildingCharacters') }}（{{ progressDone }}/{{ progressTotal }}）
      </div>
      <n-progress type="line" :percentage="progressPercent" :height="8" class="loading-progress" />
    </div>

    <div v-else-if="error" class="typesetting-error">{{ error }}</div>

    <!-- 排版编辑区：默认使用生成的字体渲染
         注意：颜色不绑定 defaultColor；字号只绑定 baseFontSize（仅全局模式更新），
         选区模式下改字号/颜色只作用于选中文字，不影响其他文字 -->
    <main
      v-else
      class="typesetting-content"
      :style="{
        fontFamily: family ? `'${family}', sans-serif` : undefined,
        fontSize: `${baseFontSize}px`,
      }"
      @click="handleContentClick"
    >
      <editor-content :editor="editor" class="typesetting-editor" />
    </main>

    <!-- DEV-only：页面级异常自报，便于定位环境问题 -->
    <div v-if="isDev && devErrors.length" class="dev-errors">
      <div v-for="(err, i) in devErrors" :key="i" class="dev-error-item">{{ err }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { NModal, NCheckbox, NButton, NSpin, NProgress, NInputNumber, NColorPicker, useMessage } from 'naive-ui'
import { indexedDBManager } from '@/core/storage/IndexedDBManager'
import { generateTypesettingKeys } from '@/features/typesettingPreview/typesettingPreviewBridge'
import { buildExportFontBuffer } from '@/features/editor/services/ExportFontService'
import { FontSize } from '@/features/typesettingPreview/fontSize'
import { SelectionHighlight } from '@/features/typesettingPreview/selectionHighlight'
import { useProjectStore } from '@/stores/project'
import type { IFile } from '@/core/types'

const { t } = useI18n()
const route = useRoute()

const FAMILY_PREFIX = 'fp-typesetting-'
// 仅保留深色可读色板，避免选到白色/浅色导致文字在白色背景上不可见
const DEFAULT_COLORS = [
  '#000000', '#333333', '#666666', '#999999',
  '#C41D1D', '#C8641A', '#A88610', '#1F9E40', '#1466B8', '#7A3BB8',
]

// ---- 状态 ----
const fileUUID = ref('')
const building = ref(false)
const progressDone = ref(0)
const progressTotal = ref(0)
const error = ref('')
const family = ref('')

const showEntryModal = ref(false)
const useLastFont = ref(true)
let entryConfirming = false
let pendingBuffer: ArrayBuffer | null = null

// 字号输入框显示值：选区字号一致时显示该字号，混合字号时为 null（输入框显示为空，像 Word）
const sizeInputValue = ref<number | null>(64)
const defaultColor = ref('#000000')
// 全局生效：勾选时字号/颜色作用于全文；不勾选时仅作用于选中字符，无选区则提示并回退
const globalMode = ref(false)
// 容器基础字号：仅在全局模式下更新（后续输入继承），选区模式不影响
const baseFontSize = ref(64)

const message = useMessage()

// 工程快照：仅用于重建字体与生成默认内容，用完即置空（内存管理）
const snapshotFile = ref<IFile | null>(null)

// 内存管理：始终只保留当前字体；重建前删除旧 face，卸载时再删一次
let activeFace: FontFace | null = null
let fontBuffer: ArrayBuffer | null = null

const keys = () => generateTypesettingKeys(fileUUID.value)

const progressPercent = computed(() => {
  if (!progressTotal.value) return 0
  return Math.round((progressDone.value / progressTotal.value) * 100)
})

// ---- Tiptap 编辑器（headless，仅保留字号与颜色工具栏） ----
const editor = useEditor({
  content: '',
  extensions: [StarterKit, TextStyle, Color, FontSize, SelectionHighlight],
  editorProps: {
    // 粘贴时清洗为纯文本，防止外部富文本样式混入
    handlePaste: (view, event) => {
      const text = event.clipboardData?.getData('text/plain')
      if (typeof text === 'string' && text) {
        view.pasteText(text)
        return true
      }
      return false
    },
  },
  onSelectionUpdate: ({ editor }) => {
    const { from, to } = editor.state.selection
    if (from !== to) {
      lastSelectionRange = { from, to }
      // 同步字号输入框：一致显示该字号，混合显示为空
      syncSizeInput(editor, from, to)
    } else if (editor.isFocused) {
      // 用户在编辑器内主动取消选区（点击/移动光标）：清除记忆，后续修改不再作用于旧选区
      lastSelectionRange = null
    }
  },
  // 失焦时再记录一次：部分场景下 selectionUpdate 不触发（如原生选区变化）。
  // 同时给选区加高亮标记：编辑器失焦后原生选区视觉消失，高亮让待改选区保持可见。
  onBlur: ({ editor }) => {
    const { from, to } = editor.state.selection
    if (from !== to) {
      lastSelectionRange = { from, to }
      editor.chain().setMark('selectionHighlight', { backgroundColor: '#d6e4ff' }).run()
    }
  },
  // 焦点回到编辑器时移除高亮（点击文字处，unsetMark 会扩展到整个标记范围）
  onFocus: ({ editor }) => {
    editor.chain().unsetMark('selectionHighlight', { extendEmptyMarkRange: true }).run()
  },
})

// 最近一次非空选区（点击工具栏导致编辑器失焦时，state 选区可能被清掉，用此兜底）
let lastSelectionRange: { from: number; to: number } | null = null

/**
 * 将字号/颜色应用到选区：
 * - 当前有非空选区 → 直接应用
 * - 无选区但有最近记忆的非空选区（点工具栏导致失焦丢失） → 应用到记忆选区
 * - 完全无选区 → 作为 stored mark，供后续输入使用
 * 应用后折叠选区到末尾，防止焦点回到编辑器后误触 Enter 把选区整体替换删除。
 * 注意：不使用 chain().focus()，避免把焦点从工具栏抢回编辑器打断输入。
 */
const applyToSelection = (apply: (chain: any) => void) => {
  const ed = editor.value
  if (!ed || ed.isDestroyed) return
  let from = ed.state.selection.from
  let to = ed.state.selection.to
  const chain = ed.chain()
  if (from === to && lastSelectionRange && lastSelectionRange.to <= ed.state.doc.content.size) {
    from = lastSelectionRange.from
    to = lastSelectionRange.to
    chain.setTextSelection(lastSelectionRange)
  }
  // 先移除选区高亮标记，再应用字号/颜色
  chain.unsetMark('selectionHighlight')
  apply(chain)
  chain.run()
  if (from !== to) {
    ed.chain().setTextSelection(to).run()
  }
}

/** 是否存在可应用的目标：当前非空选区，或失焦前记忆的非空选区 */
const hasSelectionTarget = (ed: NonNullable<typeof editor.value>): boolean => {
  const { from, to } = ed.state.selection
  if (from !== to) return true
  return !!lastSelectionRange && lastSelectionRange.to <= ed.state.doc.content.size
}

// 无选区提示防抖：连续键入时只提示一次，避免消息刷屏
let lastNoSelHint = 0
const warnNoSelection = () => {
  const now = Date.now()
  if (now - lastNoSelHint < 1500) return
  lastNoSelHint = now
  message.warning(t('typesetting.noSelectionHint'))
}

// 回退控件值时抑制 watch 再次触发，防止「回退→watch→再回退」循环
let suppressColorWatch = false

/** 计算范围内各段的字号：uniform = 全部一致时的字号（否则 null），average = 按字符数加权平均 */
// ed 参数可能是 useEditor 的 vue-3 Editor 或事件回调中的 core Editor，统一按 any 处理
const selectionSizeInfo = (
  ed: any,
  from: number,
  to: number,
): { uniform: number | null; average: number } => {
  let total = 0
  let sum = 0
  const sizes = new Set<number>()
  ed.state.doc.nodesBetween(from, to, (node) => {
    if (!node.isText) return
    const len = node.text?.length ?? 0
    if (!len) return
    let size = baseFontSize.value
    const fs = node.marks.find((m) => m.type.name === 'textStyle')?.attrs?.fontSize
    if (typeof fs === 'string') {
      const parsed = parseFloat(fs)
      if (!Number.isNaN(parsed)) size = parsed
    }
    sizes.add(size)
    total += len
    sum += size * len
  })
  const average = total > 0 ? sum / total : baseFontSize.value
  const uniform = sizes.size === 1 ? Array.from(sizes)[0] : null
  return { uniform, average }
}

/** 同步字号输入框显示：选区字号一致显示该字号，混合显示为空（像 Word） */
const syncSizeInput = (ed: any, from: number, to: number) => {
  const { uniform } = selectionSizeInfo(ed, from, to)
  sizeInputValue.value = uniform
}

/** 应用字号：全局模式作用于全文；选区模式作用于选中字符，无目标则提示 */
const applySize = (value: number) => {
  const ed = editor.value
  if (!ed || ed.isDestroyed) return
  if (globalMode.value) {
    const { from, to } = ed.state.selection
    ed.chain().selectAll().unsetMark('selectionHighlight').setFontSize(`${value}px`).run()
    ed.chain().setTextSelection({ from, to }).run()
    baseFontSize.value = value
    sizeInputValue.value = value
    return
  }
  if (!hasSelectionTarget(ed)) {
    warnNoSelection()
    return
  }
  applyToSelection((chain) => chain.setFontSize(`${value}px`))
  sizeInputValue.value = value
}

/** 输入框键入新字号 */
const handleSizeInput = (val: number | null) => {
  if (val === null) return
  applySize(val)
}

/** +/- 步进：选区基准 = 一致字号或加权平均字号（像 Word） */
let lastStepTime = 0
const stepSize = (delta: number) => {
  const now = Date.now()
  if (now - lastStepTime < 250) return
  lastStepTime = now
  const ed = editor.value
  if (!ed || ed.isDestroyed) return
  if (globalMode.value) {
    applySize((sizeInputValue.value ?? baseFontSize.value) + delta)
    return
  }
  const { from, to } = ed.state.selection
  if (from !== to) {
    const { uniform, average } = selectionSizeInfo(ed, from, to)
    applySize(Math.round(uniform ?? average) + delta)
    return
  }
  if (lastSelectionRange && lastSelectionRange.to <= ed.state.doc.content.size) {
    const { uniform, average } = selectionSizeInfo(ed, lastSelectionRange.from, lastSelectionRange.to)
    applySize(Math.round(uniform ?? average) + delta)
    return
  }
  warnNoSelection()
}

/**
 * 拦截原生 +/- 按钮的点击（捕获阶段阻止 naive-ui 内部逻辑）：
 * 用选区加权平均字号做 ±1 步进，避免内部按钮在空值（混合字号）下的不可控行为。
 * naive-ui buttonPlacement='right' 时后缀渲染顺序为 [−, +]。
 */
const handleSizeControlClick = (e: MouseEvent) => {
  const btn = (e.target as HTMLElement).closest('.n-input__suffix button')
  if (!btn) return
  e.stopPropagation()
  e.preventDefault()
  const siblings = Array.from((btn.parentElement as HTMLElement).querySelectorAll('button'))
  const isPlus = siblings.indexOf(btn as HTMLButtonElement) === 1
  stepSize(isPlus ? 1 : -1)
}

watch(defaultColor, (color, oldColor) => {
  if (suppressColorWatch) {
    suppressColorWatch = false
    return
  }
  const ed = editor.value
  if (!ed || ed.isDestroyed) return
  if (globalMode.value) {
    const { from, to } = ed.state.selection
    ed.chain().selectAll().unsetMark('selectionHighlight').setColor(color).run()
    ed.chain().setTextSelection({ from, to }).run()
    return
  }
  if (!hasSelectionTarget(ed)) {
    warnNoSelection()
    suppressColorWatch = true
    defaultColor.value = oldColor
    return
  }
  applyToSelection((chain) => chain.setColor(color))
})

// ---- FontFace 管理（仿 InfoPanel：单 face + 重建前删除） ----
const cleanupFace = () => {
  if (activeFace && document.fonts?.delete) {
    try {
      document.fonts.delete(activeFace)
    } catch {
      /* ignore */
    }
  }
  activeFace = null
}

const applyFont = async (buffer: ArrayBuffer) => {
  cleanupFace()
  family.value = ''
  const fam = FAMILY_PREFIX + fileUUID.value
  const face = new FontFace(fam, buffer)
  await face.load()
  document.fonts?.add(face)
  activeFace = face
  fontBuffer = buffer
  family.value = fam
}

// ---- 内容初始化与持久化 ----
/** 默认内容 = 全部字符依次排列；快照不在内存时从 IDB 读取 */
const getDefaultHtml = async (): Promise<string> => {
  let file = snapshotFile.value
  if (!file) {
    try {
      const raw = await indexedDBManager.get<string>(keys().file)
      if (raw) file = JSON.parse(raw)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[TypesettingPreview] load snapshot for default content failed:', err)
      }
    }
  }
  return (file?.characterList || [])
    // 排除功能性字符：.notdef 与空白字符不参与排版预览
    .filter((m) => {
      const text = m.character?.text ?? ''
      return text !== '.notdef' && text.trim() !== ''
    })
    .map((m) => m.character?.text ?? '')
    .join('')
}

/** 编辑文本始终实时计算：工程包含的全部字符依次排列（不从 storage 恢复） */
const initContent = async () => {
  const ed = editor.value
  if (!ed || ed.isDestroyed) return
  const html = await getDefaultHtml()
  snapshotFile.value = null
  ed.commands.setContent(html)
}

// 点击内容区空白处时聚焦编辑器（内容为空时编辑区塌缩，
// 若不自动聚焦，用户点击空白处键入的文字进不了编辑器）
const handleContentClick = (e: MouseEvent) => {
  const ed = editor.value
  if (!ed || ed.isDestroyed) return
  const target = e.target as HTMLElement
  if (!target.closest('.ProseMirror')) {
    ed.commands.focus('end')
  }
}

// 点击字号输入框：阻止 mousedown 默认行为（保留编辑器选区），手动聚焦内部 input；
// 点击 +/- 按钮时不抢焦点（编辑器保持聚焦，选区原生可见）
const handleSizeMousedown = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (target.closest('button')) return
  const input = (e.currentTarget as HTMLElement).querySelector('input')
  if (input) {
    ;(input as HTMLInputElement).focus()
  }
}

// DEV-only：捕获页面级异常并展示，便于定位环境问题
const isDev = import.meta.env.DEV
const devErrors = ref<string[]>([])
const handleWindowError = (e: ErrorEvent) => {
  if (isDev) devErrors.value.push(`[window] ${e.message?.slice(0, 300) ?? ''}`)
}
const handleRejection = (e: PromiseRejectionEvent) => {
  if (isDev) devErrors.value.push(`[promise] ${String(e.reason).slice(0, 300)}`)
}

// ---- 字体重建 ----
const rebuildFont = async () => {
  building.value = true
  error.value = ''
  progressDone.value = 0
  progressTotal.value = 0

  // 静音 fontManager 构建日志（Tauri webview 输出慢）
  const originalLog = console.log
  console.log = () => {}

  try {
    const raw = await indexedDBManager.get<string>(keys().file)
    if (!raw) {
      error.value = t('typesetting.noSnapshot')
      return
    }
    let file: IFile
    try {
      file = JSON.parse(raw)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[TypesettingPreview] parse snapshot failed:', err)
      }
      error.value = t('typesetting.noSnapshot')
      return
    }
    snapshotFile.value = file
    progressTotal.value = (file.characterList || []).length

    // 关键：预览窗口是独立 JS 上下文，projectStore 里没有工程数据。
    // 把快照工程注册进 store，脚本执行器才能解析 glyph 的 script_reference、
    // 注入 selectedFile 全局并构建 constantsMap，否则所有脚本字形生成空白。
    const projectStore = useProjectStore()
    projectStore.addFile(file)
    projectStore.selectFile(file.uuid)

    const buffer = await buildExportFontBuffer(
      file,
      {
        editingCharacterUUID: '',
        editingCharacter: null,
        onProgress: (done, total) => {
          progressDone.value = done
          progressTotal.value = total
        },
      },
      // 默认对所有字形去除重叠；轮廓存储与现有预览一致用 cff
      { contourStorage: 'cff', removeOverlap: true },
    )

    // 保存为「上一次字体」，下次进入时复用
    await indexedDBManager.set(keys().font, buffer)
    await applyFont(buffer)
    await initContent()
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[TypesettingPreview] rebuild font failed:', err)
    }
    error.value = t('typesetting.buildFailed')
  } finally {
    console.log = originalLog
    building.value = false
  }
}

// ---- 入口流程 ----
const doEntryConfirm = async () => {
  if (entryConfirming) return
  entryConfirming = true
  try {
    showEntryModal.value = false
    const buffer = pendingBuffer
    pendingBuffer = null
    if (useLastFont.value && buffer) {
      // 复用上一次字体：直接读回注册，不重新生成
      try {
        await applyFont(buffer)
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[TypesettingPreview] load stored font failed:', err)
        }
        error.value = t('typesetting.loadFontFailed')
        return
      }
      await initContent()
    } else {
      // 更新预览字体：从快照重新生成
      await rebuildFont()
    }
  } finally {
    entryConfirming = false
  }
}

// 按钮同时绑定 click 与 pointerup，加防抖防止多重触发（Tauri webview 机制）
let lastConfirmTime = 0
const handleEntryConfirm = () => {
  const now = Date.now()
  if (now - lastConfirmTime < 300) return
  lastConfirmTime = now
  void doEntryConfirm()
}

// 点击遮罩/ESC 关闭弹窗：按当前 checkbox 状态处理（默认勾选 = 复用上次字体）
const handleEntryModalClose = (show: boolean) => {
  if (!show) {
    void doEntryConfirm()
  }
}

// ---- 生命周期 ----
onMounted(async () => {
  const queryFile = route.query.file
  if (!queryFile || typeof queryFile !== 'string') {
    error.value = t('typesetting.noFileParam')
    return
  }
  fileUUID.value = queryFile
  window.addEventListener('error', handleWindowError)
  window.addEventListener('unhandledrejection', handleRejection)

  try {
    const stored = await indexedDBManager.get<ArrayBuffer>(keys().font)
    if (stored) {
      // 存在上一次字体：先弹 checkbox 让用户选择复用或更新
      pendingBuffer = stored
      showEntryModal.value = true
    } else {
      // 无存储字体：自动更新（重建）
      await rebuildFont()
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[TypesettingPreview] read last font failed:', err)
    }
    await rebuildFont()
  }
})

onUnmounted(() => {
  window.removeEventListener('error', handleWindowError)
  window.removeEventListener('unhandledrejection', handleRejection)
  // 及时清空缓存：删除 FontFace、释放字体缓冲与快照引用（窗口关闭时上下文整体销毁）
  cleanupFace()
  fontBuffer = null
  snapshotFile.value = null
  pendingBuffer = null
})
</script>

<style scoped>
.typesetting-page {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  overflow: hidden;
}

.typesetting-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #fafafa;
  flex-shrink: 0;
}

.typesetting-title {
  font-size: 14px;
  font-weight: 600;
  color: #333333;
  margin-right: 8px;
}

.typesetting-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.toolbar-label {
  font-size: 13px;
  color: #666666;
  white-space: nowrap;
  flex: none;
}

.toolbar-size {
  width: 150px;
  flex: none;
}

/* 色值文字：显示在颜色预览方块之后 */
.color-value {
  font-size: 13px;
  color: #333333;
  white-space: nowrap;
}

/* 全局生效 checkbox：固定在最右侧 */
.global-check {
  margin-left: auto;
  flex: none;
  white-space: nowrap;
}

/* 空 label 插槽会令触发器塌缩为 0 宽：强制颜色预览方块的尺寸 */
.typesetting-toolbar :deep(.n-color-picker) {
  width: 32px;
}

.typesetting-toolbar :deep(.n-color-picker-trigger) {
  width: 32px;
  height: 28px;
}

/* 强制数字输入框内部宽度链，防止 naive-ui 组件在 flex 布局中塌缩为 0 */
.toolbar-size :deep(.n-input-number),
.toolbar-size :deep(.n-input),
.toolbar-size :deep(.n-input-wrapper),
.toolbar-size :deep(.n-input__input),
.toolbar-size :deep(.n-input__input-el) {
  width: 100%;
}

.entry-content {
  padding: 4px 0;
}

.typesetting-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.loading-text {
  font-size: 14px;
  color: #666666;
}

.loading-progress {
  width: 320px;
}

.typesetting-error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #d03050;
  padding: 24px;
}

.typesetting-content {
  flex: 1;
  overflow-y: auto;
}

/* 编辑区始终撑满容器：内容为空时也能点击聚焦（否则编辑器塌缩，
   点击空白处键入的文字进不了编辑器） */
.typesetting-editor {
  height: 100%;
}

.typesetting-editor :deep(.ProseMirror) {
  outline: none;
  min-height: 100%;
  padding: 24px 32px;
  word-break: break-all;
  line-height: 1.4;
}

.dev-errors {
  position: fixed;
  right: 12px;
  bottom: 12px;
  max-width: 560px;
  max-height: 220px;
  overflow-y: auto;
  z-index: 9999;
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 4px;
  padding: 8px 10px;
}

.dev-error-item {
  font-size: 12px;
  color: #d03050;
  word-break: break-all;
  margin: 2px 0;
}

.typesetting-editor :deep(.ProseMirror p) {
  margin: 0.4em 0;
}
</style>
