<template>
  <div class="tab-panel name-tab">
    <p class="tab-hint">{{ t('dialogs.fontSettingsDialog.nameTableTip') }}</p>
    <n-scrollbar style="max-height: 400px">
      <div
        v-for="(item, index) in data"
        :key="index"
        class="name-table-item"
      >
        <div class="name-item-row-1">
          <n-select
            v-model:value="item.nameID"
            class="name-id-select"
            :options="nameIDOptions"
            @update:value="(v: number) => (item.nameLabel = nameTableNames[v])"
          />
          <n-select
            v-model:value="item.langID"
            class="name-lang-select"
            :options="winLangIDOptions"
          />
          <n-select
            v-model:value="item.platformID"
            class="name-lang-select"
            :options="platformIDOptions"
          />
          <n-select
            v-model:value="item.encodingID"
            class="name-lang-select"
            :options="winEncodingIDOptions"
          />
          <n-button
            v-if="!item.default"
            type="error"
            quaternary
            size="small"
            @click="removeItem(index)"
          >
            {{ t('dialogs.fontSettingsDialog.delete') }}
          </n-button>
        </div>
        <div class="name-item-row-2">
          <n-input v-model:value="item.value" type="text" placeholder="" />
          <n-tooltip trigger="hover" placement="bottom">
            <template #trigger>
              <span class="name-tip-icon">?</span>
            </template>
            {{ tm('dialogs.fontSettingsDialog.nameTableTip') }}
          </n-tooltip>
        </div>
      </div>
      <div class="name-add-wrap">
        <n-button block secondary @click="addItem">{{ t('dialogs.fontSettingsDialog.addItem') }}</n-button>
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { NScrollbar, NSelect, NInput, NButton, NTooltip } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import {
  nameTableNames,
  createDefaultNameEntry,
  type NameTableEntry,
} from './types'

const { t, tm } = useI18n()

const props = defineProps<{
  data: NameTableEntry[]
}>()

const nameIDOptions = nameTableNames.map((label, value) => ({ label, value }))

const platformIDOptions = [
  { label: 'Unicode', value: 0, disabled: true },
  { label: 'Macintosh', value: 1, disabled: true },
  { label: 'Windows', value: 3, disabled: false },
]

const winEncodingIDOptions = [{ label: 'Unicode BMP', value: 1 }]

const winLangIDOptions = [
  { label: 'zh', value: 0x804 },
  { label: 'zh-HK', value: 0x0C04 },
  { label: 'zh-MO', value: 0x1404 },
  { label: 'zh-SG', value: 0x1004 },
  { label: 'zh-TW', value: 0x0404 },
  { label: 'en', value: 0x0409 },
]

function addItem() {
  props.data.push(createDefaultNameEntry())
}

function removeItem(index: number) {
  const item = props.data[index]
  if (!item?.default) {
    props.data.splice(index, 1)
  }
}
</script>

<style scoped>
.tab-panel {
  padding: 16px;
  min-height: 360px;
}
.tab-hint {
  color: var(--light-3);
  font-size: 12px;
  margin-bottom: 8px;
}
.name-table-item {
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
}
.name-item-row-1 {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.name-id-select {
  flex: 0 0 160px;
  min-width: 140px;
}
.name-lang-select {
  flex: 0 0 120px;
  min-width: 100px;
}
.name-item-row-1 .n-button {
  flex-shrink: 0;
}
.name-item-row-2 {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
}
.name-item-row-2 .n-input {
  flex: 1;
  min-width: 0;
}
.name-tip-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--dark-2);
  color: var(--light-4);
  font-size: 12px;
  cursor: help;
}
.name-add-wrap {
  margin-top: 12px;
}
</style>
