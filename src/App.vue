<script setup lang="ts">
import { RouterView } from 'vue-router'
import { NConfigProvider, NMessageProvider, NNotificationProvider, NDialogProvider, type GlobalThemeOverrides } from 'naive-ui'
import ProjectTagPromptDialog from '@/ui/dialogs/ProjectTagPromptDialog.vue'
import { initTauri } from './utils/tauri-renderer'
import { getCSSVariable } from './utils/theme'
import paper from 'paper'

initTauri()
let canvas = document.createElement('canvas')
paper.setup(canvas)

// 配置全局主题覆盖（设计系统「墨蓝工作台」，详见 .claude/skills/ui-design-system/SKILL.md）
// 注意：Naive UI 需要直接的颜色值，不能使用 CSS 变量
// 所以我们需要从 CSS 变量中分别读取实际值
const themeOverrides: GlobalThemeOverrides = {
  common: {
    // 交互强调统一走 --accent（选中态 / 焦点 / 开关激活 / 滑块填充）
    primaryColor: getCSSVariable('--accent', '#5b8def'),
    primaryColorHover: getCSSVariable('--accent-hover', '#7aa4f4'),
    primaryColorPressed: getCSSVariable('--primary-3', '#4f7fd6'),
    primaryColorSuppl: getCSSVariable('--accent', '#5b8def'),
    infoColor: getCSSVariable('--accent', '#5b8def'),
    successColor: getCSSVariable('--success', '#46b487'),
    warningColor: getCSSVariable('--warning', '#d8a24d'),
    errorColor: getCSSVariable('--danger', '#e05c6b'),
    baseColor: getCSSVariable('--light-0', '#eef1f7'),
    borderRadius: '4px',
    borderRadiusSmall: '4px',
    scrollbarBorderRadius: '4px',
    borderColor: getCSSVariable('--dark-4', '#3b4154'),
    dividerColor: getCSSVariable('--dark-4', '#3b4154'),
    // 文字颜色
    textColorBase: getCSSVariable('--light-0', '#eef1f7'),
    textColor1: getCSSVariable('--light-2', '#ccd2df'),
    textColor2: getCSSVariable('--light-3', '#aab1c2'),
    textColor3: getCSSVariable('--light-4', '#8b93a8'),
    placeholderColor: getCSSVariable('--light-5', '#60677a'),
    // 背景颜色
    bodyColor: getCSSVariable('--dark-0', '#14161e'),
    cardColor: getCSSVariable('--dark-1', '#1b1e28'),
    modalColor: getCSSVariable('--dark-1', '#1b1e28'),
    popoverColor: getCSSVariable('--dark-1', '#1b1e28'),
    tableColor: getCSSVariable('--dark-1', '#1b1e28'),
    inputColor: getCSSVariable('--field', '#fcfdff'),
    actionColor: getCSSVariable('--dark-3', '#2d3242'),
    hoverColor: 'rgba(91, 141, 239, 0.12)',
    boxShadow1: '0 2px 6px rgba(8, 11, 19, 0.4)',
    boxShadow2: '0 6px 16px rgba(8, 11, 19, 0.5)',
    boxShadow3: '0 12px 32px rgba(8, 11, 19, 0.55)',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontFamilyMono: "'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
  },
  Modal: {
    color: getCSSVariable('--dark-1', '#1b1e28'),
    textColor: getCSSVariable('--light-2', '#ccd2df'),
    boxShadow: getCSSVariable('--shadow-dialog', '0 16px 48px rgba(8, 11, 19, 0.6)'),
  },
  Dialog: {
    color: getCSSVariable('--dark-1', '#1b1e28'),
    textColor: getCSSVariable('--light-2', '#ccd2df'),
    titleTextColor: getCSSVariable('--light-1', '#e3e6ee'),
  },
  Input: {
    textColor: getCSSVariable('--primary-0', '#1e3a6d'),
    placeholderColor: getCSSVariable('--light-5', '#60677a'),
    color: getCSSVariable('--field', '#fcfdff'),
    // 注意：naive 的 border 槽位需要完整 shorthand（'1px solid xxx'），只传颜色会失效
    border: `1px solid ${getCSSVariable('--border-light', '#d7dce8')}`,
    borderHover: `1px solid ${getCSSVariable('--primary-3', '#4f7fd6')}`,
    borderFocus: `1px solid ${getCSSVariable('--accent', '#5b8def')}`,
    boxShadowFocus: `0 0 0 2px ${getCSSVariable('--accent-ring', 'rgba(91, 141, 239, 0.45)')}`,
  },
  InternalSelection: {
    textColor: getCSSVariable('--primary-0', '#1e3a6d'),
    placeholderColor: getCSSVariable('--light-5', '#60677a'),
    color: getCSSVariable('--field', '#fcfdff'),
    border: `1px solid ${getCSSVariable('--border-light', '#d7dce8')}`,
    borderHover: `1px solid ${getCSSVariable('--primary-3', '#4f7fd6')}`,
    borderActive: `1px solid ${getCSSVariable('--accent', '#5b8def')}`,
    borderFocus: `1px solid ${getCSSVariable('--accent', '#5b8def')}`,
    boxShadowFocus: `0 0 0 2px ${getCSSVariable('--accent-ring', 'rgba(91, 141, 239, 0.45)')}`,
    arrowColor: getCSSVariable('--primary-1', '#2b4e94'),
  },
  InternalSelectMenu: {
    color: getCSSVariable('--dark-1', '#1b1e28'),
    optionTextColor: getCSSVariable('--light-3', '#aab1c2'),
    optionTextColorActive: getCSSVariable('--accent', '#5b8def'),
    optionTextColorPressed: getCSSVariable('--primary-3', '#4f7fd6'),
    optionCheckColor: getCSSVariable('--accent', '#5b8def'),
    // 悬浮(pending)与选中(active)的 ::before 覆盖层统一用柔和强调蓝
    optionColorPending: getCSSVariable('--accent-soft', 'rgba(91, 141, 239, 0.14)'),
    optionColorActive: getCSSVariable('--accent-soft', 'rgba(91, 141, 239, 0.14)'),
    optionColorActivePending: getCSSVariable('--accent-soft', 'rgba(91, 141, 239, 0.14)'),
  },
  Button: {
    textColor: getCSSVariable('--primary-0', '#1e3a6d'),
    textColorHover: getCSSVariable('--primary-0', '#1e3a6d'),
    textColorPressed: getCSSVariable('--primary-0', '#1e3a6d'),
    textColorFocus: getCSSVariable('--primary-0', '#1e3a6d'),
    textColorDisabled: getCSSVariable('--light-5', '#60677a'),
    color: getCSSVariable('--primary-5', '#e4ebf7'),
    colorHover: getCSSVariable('--primary-4', '#b7c6de'),
    colorPressed: getCSSVariable('--primary-3', '#4f7fd6'),
    colorFocus: getCSSVariable('--primary-4', '#b7c6de'),
    border: `1px solid ${getCSSVariable('--border-light', '#d7dce8')}`,
    borderHover: `1px solid ${getCSSVariable('--primary-4', '#b7c6de')}`,
    borderPressed: `1px solid ${getCSSVariable('--primary-3', '#4f7fd6')}`,
    borderFocus: `1px solid ${getCSSVariable('--accent', '#5b8def')}`,
    // 主按钮样式（品牌墨蓝）
    textColorPrimary: '#ffffff',
    textColorHoverPrimary: '#ffffff',
    textColorPressedPrimary: '#ffffff',
    textColorFocusPrimary: '#ffffff',
    colorPrimary: getCSSVariable('--primary-0', '#1e3a6d'),
    colorHoverPrimary: getCSSVariable('--primary-1', '#2b4e94'),
    colorPressedPrimary: getCSSVariable('--primary-2', '#3862b4'),
    colorFocusPrimary: getCSSVariable('--primary-1', '#2b4e94'),
    borderPrimary: `1px solid ${getCSSVariable('--primary-0', '#1e3a6d')}`,
    borderHoverPrimary: `1px solid ${getCSSVariable('--primary-1', '#2b4e94')}`,
    borderPressedPrimary: `1px solid ${getCSSVariable('--primary-2', '#3862b4')}`,
    borderFocusPrimary: `1px solid ${getCSSVariable('--accent', '#5b8def')}`,
  },
  Form: {
    labelTextColor: getCSSVariable('--light-2', '#ccd2df'),
  },
  Radio: {
    textColor: getCSSVariable('--light-2', '#ccd2df'),
    // 未选中：圆点填充用淡色 + 浅灰描边
    color: getCSSVariable('--light-1', '#e3e6ee'),
    // 选中：整体填充透明（只留描边环），内部小圆点由 dotColorActive 渲染（墨蓝）
    colorActive: '#0000',
    dotColorActive: getCSSVariable('--primary-0', '#1e3a6d'),
    boxShadow: `inset 0 0 0 1px ${getCSSVariable('--light-5', '#60677a')}`,
    boxShadowActive: `inset 0 0 0 1px ${getCSSVariable('--accent', '#5b8def')}`,
  },
  Checkbox: {
    textColor: getCSSVariable('--light-2', '#ccd2df'),
    colorChecked: getCSSVariable('--accent', '#5b8def'),
    borderChecked: `1px solid ${getCSSVariable('--accent', '#5b8def')}`,
    border: `1px solid ${getCSSVariable('--dark-4', '#3b4154')}`,
    borderFocus: `1px solid ${getCSSVariable('--accent', '#5b8def')}`,
    boxShadowFocus: `0 0 0 2px ${getCSSVariable('--accent-ring', 'rgba(91, 141, 239, 0.45)')}`,
  },
  Switch: {
    railColorActive: getCSSVariable('--accent', '#5b8def'),
    loadingColor: getCSSVariable('--accent', '#5b8def'),
    boxShadowFocus: `0 0 0 2px ${getCSSVariable('--accent-ring', 'rgba(91, 141, 239, 0.45)')}`,
  },
  Slider: {
    fillColor: getCSSVariable('--accent', '#5b8def'),
    fillColorHover: getCSSVariable('--accent-hover', '#7aa4f4'),
  },
  Popover: {
    color: getCSSVariable('--dark-1', '#1b1e28'),
    textColor: getCSSVariable('--light-2', '#ccd2df'),
  },
  Tooltip: {
    color: getCSSVariable('--dark-2', '#232735'),
    textColor: getCSSVariable('--light-0', '#eef1f7'),
  },
  Dropdown: {
    color: getCSSVariable('--dark-1', '#1b1e28'),
    optionTextColor: getCSSVariable('--light-3', '#aab1c2'),
    optionTextColorHover: getCSSVariable('--light-0', '#eef1f7'),
    optionTextColorActive: getCSSVariable('--accent', '#5b8def'),
    optionColorActive: 'rgba(91, 141, 239, 0.14)',
  },
  Tabs: {
    barColor: getCSSVariable('--dark-2', '#232735'),
    tabTextColorLine: getCSSVariable('--light-4', '#8b93a8'),
    tabTextColorHoverLine: getCSSVariable('--light-1', '#e3e6ee'),
    tabTextColorActiveLine: getCSSVariable('--accent', '#5b8def'),
    tabTextColorDisabledLine: getCSSVariable('--light-5', '#60677a'),
    tabFontWeightActive: '600',
    tabBorderColor: getCSSVariable('--dark-4', '#3b4154'),
  },
  Tag: {
    color: getCSSVariable('--dark-3', '#2d3242'),
    textColor: getCSSVariable('--light-3', '#aab1c2'),
    border: `1px solid ${getCSSVariable('--dark-4', '#3b4154')}`,
  },
  Card: {
    color: getCSSVariable('--dark-1', '#1b1e28'),
    borderColor: getCSSVariable('--dark-4', '#3b4154'),
    textColor: getCSSVariable('--light-2', '#ccd2df'),
  },
  Message: {
    color: getCSSVariable('--dark-2', '#232735'),
    textColorInfo: getCSSVariable('--light-0', '#eef1f7'),
    textColorSuccess: getCSSVariable('--light-0', '#eef1f7'),
    textColorWarning: getCSSVariable('--light-0', '#eef1f7'),
    textColorError: getCSSVariable('--light-0', '#eef1f7'),
    borderRadius: getCSSVariable('--radius-md', '8px'),
  },
  Notification: {
    color: getCSSVariable('--dark-1', '#1b1e28'),
    textColor: getCSSVariable('--light-2', '#ccd2df'),
    borderRadius: getCSSVariable('--radius-md', '8px'),
  },
  Empty: {
    textColor: getCSSVariable('--light-4', '#8b93a8'),
    iconColor: getCSSVariable('--light-5', '#60677a'),
  },
  Progress: {
    fillColor: getCSSVariable('--accent', '#5b8def'),
    // 轨道统一用中灰，深色/浅色底上都清晰可辨（纯白页面场景再局部覆盖为浅色轨道）
    railColor: getCSSVariable('--light-5', '#60677a'),
  },
  LoadingBar: {
    colorLoading: getCSSVariable('--accent', '#5b8def'),
    colorError: getCSSVariable('--danger', '#e05c6b'),
  },
  DataTable: {
    thColor: getCSSVariable('--dark-2', '#232735'),
    tdColor: getCSSVariable('--dark-1', '#1b1e28'),
    borderColor: getCSSVariable('--dark-4', '#3b4154'),
    thTextColor: getCSSVariable('--light-4', '#8b93a8'),
    tdTextColor: getCSSVariable('--light-3', '#aab1c2'),
    thFontWeight: '600',
  },
  Drawer: {
    color: getCSSVariable('--dark-1', '#1b1e28'),
    textColor: getCSSVariable('--light-2', '#ccd2df'),
  },
}
</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-notification-provider>
        <n-dialog-provider>
          <RouterView />
          <ProjectTagPromptDialog />
        </n-dialog-provider>
      </n-notification-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<style scoped>
</style>
