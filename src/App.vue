<script setup lang="ts">
import { RouterView } from 'vue-router'
import { NConfigProvider, NMessageProvider, NNotificationProvider, NDialogProvider, type GlobalThemeOverrides } from 'naive-ui'
import { initTauri } from './utils/tauri-renderer'
import { getCSSVariable } from './utils/theme'
import paper from 'paper'

initTauri()
let canvas = document.createElement('canvas')
paper.setup(canvas)

// 配置全局主题覆盖
// 注意：Naive UI 需要直接的颜色值，不能使用 CSS 变量
// 所以我们需要从 CSS 变量中分别读取实际值
const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: getCSSVariable('--primary-0', '#153063'),
    baseColor: getCSSVariable('--light-0', '#eeeeee'),
    primaryColorHover: getCSSVariable('--primary-1', '#37558f'),
    primaryColorPressed: getCSSVariable('--primary-2', '#375e84'),
    primaryColorSuppl: getCSSVariable('--primary-1', '#37558f'),
    borderRadius: '0px',
    borderRadiusSmall: '0px',
    scrollbarBorderRadius: '0px',
    // 文字颜色
    textColor1: getCSSVariable('--light-2', '#c4c4c4'),
    textColor2: getCSSVariable('--light-2', '#c4c4c4'),
    textColor3: getCSSVariable('--light-3', '#bcbcbc'),
    // 背景颜色
    cardColor: getCSSVariable('--dark-1', '#242424'),
    modalColor: getCSSVariable('--dark-1', '#242424'),
    popoverColor: getCSSVariable('--dark-1', '#242424'),
  },
  Modal: {
    color: getCSSVariable('--dark-1', '#242424'),
    textColor: getCSSVariable('--light-2', '#c4c4c4'),
    boxShadow: 'none',
  },
  Input: {
    textColor: getCSSVariable('--primary-0', '#153063'),
    placeholderColor: getCSSVariable('--light-4', '#9a9a9a'),
  },
  Button: {
    textColor: getCSSVariable('--primary-0', '#153063'),
    textColorHover: getCSSVariable('--primary-2', '#375e84'),
    textColorPressed: getCSSVariable('--primary-2', '#375e84'),
    textColorFocus: getCSSVariable('--primary-2', '#375e84'),
    textColorDisabled: getCSSVariable('--light-3', '#bcbcbc'),
    color: getCSSVariable('--primary-5', '#d9e6f0'),
    colorHover: getCSSVariable('--primary-4', '#b2c6d5'),
    colorPressed: getCSSVariable('--primary-4', '#b2c6d5'),
    colorFocus: getCSSVariable('--primary-4', '#b2c6d5'),
    // 主按钮样式
    textColorPrimary: '#ffffff',
    colorPrimary: getCSSVariable('--primary-0', '#153063'),
  },
  Form: {
    labelTextColor: getCSSVariable('--light-2', '#c4c4c4'),
  },
  Radio: {
    textColor: getCSSVariable('--primary-0', '#153063'),
  },
  Popover: {
    color: getCSSVariable('--primary-0', '#153063'),
  },
}
</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-notification-provider>
        <n-dialog-provider>
          <RouterView />
        </n-dialog-provider>
      </n-notification-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<style scoped>
</style>
