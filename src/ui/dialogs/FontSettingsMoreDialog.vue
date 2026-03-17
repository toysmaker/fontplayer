<template>
  <n-modal
    :show="visible"
    preset="dialog"
    :title="tm('dialogs.fontSettingsDialog.title')"
    class="font-settings-more-dialog"
    :style="{ width: '800px', height: '640px' }"
    :mask-closable="false"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <n-config-provider :theme-overrides="tabsThemeOverrides">
      <n-tabs type="line" placement="left" class="font-settings-tabs" style="height: 460px">
        <n-tab-pane name="head" tab="head">
          <HeadTab :data="tables.head" />
        </n-tab-pane>
        <n-tab-pane name="hhea" tab="hhea">
          <HheaTab :data="tables.hhea" />
        </n-tab-pane>
        <n-tab-pane name="name" tab="name">
          <NameTab :data="tables.name" />
        </n-tab-pane>
        <n-tab-pane name="os_2" tab="os_2">
          <Os2Tab :data="tables.os2" />
        </n-tab-pane>
        <n-tab-pane name="post" tab="post">
          <PostTab :data="tables.post" />
        </n-tab-pane>
      </n-tabs>
    </n-config-provider>
    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel">{{ t('dialogs.fontSettingsDialog.cancel') }}</n-button>
        <n-button type="primary" @click="handleConfirm">{{ t('dialogs.fontSettingsDialog.confirm') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NConfigProvider, NModal, NTabs, NTabPane, NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { getCSSVariable } from '@/utils/theme'
import { useProjectStore } from '@/stores/project'
import * as R from 'ramda'
import HeadTab from './fontSettings/HeadTab.vue'
import HheaTab from './fontSettings/HheaTab.vue'
import NameTab from './fontSettings/NameTab.vue'
import Os2Tab from './fontSettings/Os2Tab.vue'
import PostTab from './fontSettings/PostTab.vue'
import {
  defaultHead,
  defaultHhea,
  defaultOs2,
  defaultPost,
  normalizeNameEntry,
  type NameTableEntry,
} from './fontSettings/types'

const { t, tm } = useI18n()
const projectStore = useProjectStore()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const selectedFile = computed(() => projectStore.selectedFile)

const visible = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v),
})

const tabsThemeOverrides = computed(() => ({
  Tabs: {
    tabTextColorActiveLine: getCSSVariable('--primary-3', '#153063'),
    tabTextColorHoverLine: getCSSVariable('--primary-3', '#153063'),
  },
}))

const tables = ref<{
  head: ReturnType<typeof defaultHead>
  hhea: ReturnType<typeof defaultHhea>
  name: NameTableEntry[]
  os2: ReturnType<typeof defaultOs2>
  post: ReturnType<typeof defaultPost>
}>({
  head: defaultHead(),
  hhea: defaultHhea(),
  name: [],
  os2: defaultOs2(),
  post: defaultPost(),
})

function loadTables() {
  const file = selectedFile.value
  const existing = file?.fontSettings?.tables
  if (existing) {
    const nameList = Array.isArray(existing.name)
      ? (existing.name as Record<string, unknown>[]).map(normalizeNameEntry)
      : []
    tables.value = {
      head: R.mergeDeepRight(defaultHead(), existing.head || {}),
      hhea: R.mergeDeepRight(defaultHhea(), existing.hhea || {}),
      name: nameList,
      os2: R.mergeDeepRight(defaultOs2(), existing.os2 || {}),
      post: R.mergeDeepRight(defaultPost(), existing.post || {}),
    }
  } else {
    tables.value = {
      head: defaultHead(),
      hhea: defaultHhea(),
      name: [],
      os2: defaultOs2(),
      post: defaultPost(),
    }
  }
}

watch(
  () => [props.show, selectedFile.value] as const,
  ([show, file]) => {
    if (show && file) loadTables()
  },
  { immediate: true }
)

function handleCancel() {
  visible.value = false
}

function handleConfirm() {
  const file = selectedFile.value
  if (!file) return
  const current = file.fontSettings || {}
  projectStore.updateFile(file.uuid, {
    fontSettings: {
      unitsPerEm: file.fontSettings?.unitsPerEm ?? 1000,
      ascender: file.fontSettings?.ascender ?? 800,
      descender: file.fontSettings?.descender ?? -200,
      ...current,
      tables: {
        head: R.clone(tables.value.head),
        hhea: R.clone(tables.value.hhea),
        name: R.clone(tables.value.name),
        os2: R.clone(tables.value.os2),
        post: R.clone(tables.value.post),
      },
    },
  })
  visible.value = false
}
</script>

<style scoped>
.font-settings-tabs :deep(.n-tabs-pane-wrapper),
.font-settings-tabs :deep(.n-tab-pane) {
  min-width: 0;
  overflow: hidden;
}
.dialog-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
