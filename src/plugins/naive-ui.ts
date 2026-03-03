import type { App } from 'vue'
import {
  // 基础组件
  NConfigProvider,
  NMessageProvider,
  NNotificationProvider,
  NDialogProvider,
  NLoadingBarProvider,
  // 布局组件
  NLayout,
  NLayoutHeader,
  NLayoutSider,
  NLayoutContent,
  NLayoutFooter,
  // 导航组件
  NMenu,
  NBreadcrumb,
  NBreadcrumbItem,
  NTabs,
  NTabPane,
  // 数据展示
  NTable,
  NDataTable,
  NList,
  NListItem,
  NCard,
  // 数据输入
  NInput,
  NInputNumber,
  NSelect,
  NCheckbox,
  NRadio,
  NRadioGroup,
  NSwitch,
  NSlider,
  // 反馈
  NButton,
  NButtonGroup,
  NModal,
  NDrawer,
  NPopconfirm,
  NPopover,
  NTooltip,
  // 其他
  NIcon,
  NDivider,
  NEmpty,
  NSpin,
  NProgress,
  NScrollbar,
  NGrid,
  NGridItem,
  NForm,
  NFormItem,
  NTag,
  NBadge,
  NAvatar,
  // 文本组件（仅保留实际存在的）
  NText,
  NCode,
} from 'naive-ui'

/**
 * 配置 NaiveUI 组件
 */
export function setupNaiveUI(app: App) {
  // 注册所有需要的组件（仅保留实际存在的组件）
  const components = [
    NConfigProvider,
    NMessageProvider,
    NNotificationProvider,
    NDialogProvider,
    NLoadingBarProvider,
    NLayout,
    NLayoutHeader,
    NLayoutSider,
    NLayoutContent,
    NLayoutFooter,
    NMenu,
    NBreadcrumb,
    NBreadcrumbItem,
    NTabs,
    NTabPane,
    NTable,
    NDataTable,
    NList,
    NListItem,
    NCard,
    NInput,
    NInputNumber,
    NSelect,
    NCheckbox,
    NRadio,
    NRadioGroup,
    NSwitch,
    NSlider,
    NButton,
    NButtonGroup,
    NModal,
    NDrawer,
    NPopconfirm,
    NPopover,
    NTooltip,
    NIcon,
    NDivider,
    NEmpty,
    NSpin,
    NProgress,
    NScrollbar,
    NGrid,
    NGridItem,
    NForm,
    NFormItem,
    NTag,
    NBadge,
    NAvatar,
    NText,
    NCode,
  ]

  components.forEach((component) => {
    app.component(component.name || component.__name, component)
  })
}
