/**
 * 选区高亮标记：编辑器失焦后浏览器会隐藏原生选区，
 * 用该标记把待修改的选区以浅色背景保底显示，应用字号/颜色后移除。
 */
import { Mark } from '@tiptap/core'

export const SelectionHighlight = Mark.create({
  name: 'selectionHighlight',

  addAttributes() {
    return {
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || null,
        renderHTML: (attributes) =>
          attributes.backgroundColor
            ? { style: `background-color: ${attributes.backgroundColor}` }
            : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-selection-highlight]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', { 'data-selection-highlight': 'true', ...HTMLAttributes }, 0]
  },
})
