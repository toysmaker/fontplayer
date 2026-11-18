<template>
  <div class="app-list-page">
    <header class="app-header">
      <n-button quaternary size="small" class="back-btn" @click="handleBack" @pointerup="handleBack">
        ← {{ t('applications.listPage.back') }}
      </n-button>
      <span class="app-title">{{ title }}</span>
      <span class="header-spacer"></span>
      <n-button
        v-if="!noProject"
        type="primary"
        size="small"
        @click="handleAdd"
        @pointerup="handleAdd"
      >
        + {{ t('applications.listPage.add') }}
      </n-button>
    </header>

    <main class="app-list-main">
      <div v-if="noProject" class="empty-state">
        <p>{{ t('applications.listPage.noProject') }}</p>
        <n-button type="primary" size="small" @click="handleOpenEditor" @pointerup="handleOpenEditor">
          {{ t('applications.listPage.openProject') }}
        </n-button>
      </div>

      <template v-else>
        <n-spin :show="loading">
          <div v-if="!loading && docs.length === 0" class="empty-state">
            <p>{{ t('applications.listPage.empty') }}</p>
          </div>
          <div v-else class="app-grid">
            <div v-for="item in docs" :key="item.id" class="app-item">
              <div class="app-item-name">{{ item.name }}</div>
              <div class="app-item-time">{{ formatTime(item.updatedAt) }}</div>
              <div class="app-item-actions">
                <n-button size="tiny" @click="handleEdit(item.id)" @pointerup="handleEdit(item.id)">
                  {{ t('applications.listPage.edit') }}
                </n-button>
                <n-button size="tiny" type="error" @click="handleAskDelete(item)" @pointerup="handleAskDelete(item)">
                  {{ t('applications.listPage.delete') }}
                </n-button>
              </div>
            </div>
          </div>
        </n-spin>
      </template>
    </main>

    <n-modal
      v-model:show="showDeleteConfirm"
      preset="dialog"
      :title="t('applications.listPage.deleteConfirmTitle')"
      :show-icon="false"
    >
      <div>{{ t('applications.listPage.deleteConfirm') }}</div>
      <template #action>
        <n-button size="small" @click="handleCancelDelete" @pointerup="handleCancelDelete">
          {{ t('applications.exportDialog.cancel') }}
        </n-button>
        <n-button size="small" type="error" @click="handleConfirmDelete" @pointerup="handleConfirmDelete">
          {{ t('applications.listPage.delete') }}
        </n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NButton, NModal, NSpin, useMessage } from 'naive-ui'
import { createDebouncedHandler } from '@/utils/debounce-click'
import { useProjectStore } from '@/stores/project'
import { applicationStorage } from '@/features/applications/applicationStorage'
import { MAX_APPS_PER_TYPE } from '@/features/applications/constants'
import {
  closeApplicationWindow,
  restoreApplicationProject,
} from '@/features/applications/applicationWindowBridge'
import type { ApplicationType, IApplicationDocument } from '@/features/applications/types'

const props = defineProps<{ type: ApplicationType }>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const projectStore = useProjectStore()

const docs = ref<IApplicationDocument[]>([])
const loading = ref(true)
const showDeleteConfirm = ref(false)
const pendingDelete = ref<IApplicationDocument | null>(null)

const noProject = computed(() => !projectStore.hasFiles)
const title = computed(() => t(`applications.listPage.title.${props.type}`))

const _load = async () => {
  loading.value = true
  try {
    const file = projectStore.selectedFile
    if (!file) return
    docs.value = await applicationStorage.listDocs(file, props.type)
  } catch (err) {
    message.error(t('applications.listPage.loadFailed'))
    if (import.meta.env.DEV) {
      console.error('[applications] list failed:', err)
    }
  } finally {
    loading.value = false
  }
}
const load = createDebouncedHandler(_load, 'ApplicationListPage.load')

const _handleAdd = async () => {
  const file = projectStore.selectedFile
  if (!file) return
  const count = await applicationStorage.countDocs(file, props.type)
  if (count >= MAX_APPS_PER_TYPE) {
    message.warning(t('applications.listPage.maxReached', { max: MAX_APPS_PER_TYPE }))
    return
  }
  // 显式新建：清除历史「新建」草稿，保证干净开始
  await applicationStorage.clearDraft(file, props.type, 'new')
  router.push(`/applications/${props.type}/editor`)
}
const handleAdd = createDebouncedHandler(_handleAdd, 'ApplicationListPage.add')

const _handleEdit = (id: string) => {
  router.push(`/applications/${props.type}/editor/${id}`)
}
const handleEdit = createDebouncedHandler(_handleEdit, 'ApplicationListPage.edit', (args) => args[0])

const _handleAskDelete = (item: IApplicationDocument) => {
  pendingDelete.value = item
  showDeleteConfirm.value = true
}
const handleAskDelete = createDebouncedHandler(_handleAskDelete, 'ApplicationListPage.askDelete', (args) => args[0]?.id)

const _handleConfirmDelete = async () => {
  const item = pendingDelete.value
  showDeleteConfirm.value = false
  pendingDelete.value = null
  if (!item) return
  try {
    const file = projectStore.selectedFile
    if (!file) return
    await applicationStorage.removeDoc(file, props.type, item.id)
    await _load()
  } catch (err) {
    message.error(t('applications.listPage.loadFailed'))
    if (import.meta.env.DEV) {
      console.error('[applications] delete failed:', err)
    }
  }
}
const handleConfirmDelete = createDebouncedHandler(_handleConfirmDelete, 'ApplicationListPage.confirmDelete')

const _handleCancelDelete = () => {
  showDeleteConfirm.value = false
  pendingDelete.value = null
}
const handleCancelDelete = createDebouncedHandler(_handleCancelDelete, 'ApplicationListPage.cancelDelete')

const _handleBack = () => {
  // 独立窗口：返回 = 关闭窗口（主窗口保持打开状态）
  void closeApplicationWindow()
}
const handleBack = createDebouncedHandler(_handleBack, 'ApplicationListPage.back')

const _handleOpenEditor = () => {
  // 无工程快照：关闭窗口，回到主窗口打开工程
  void closeApplicationWindow()
}
const handleOpenEditor = createDebouncedHandler(_handleOpenEditor, 'ApplicationListPage.openEditor')

const formatTime = (ts: number) => new Date(ts).toLocaleString()

onMounted(async () => {
  // 应用窗口为独立 JS 上下文：先从快照恢复工程（主窗口打开前已写入）
  const fileUUID = (route.query.file as string | undefined) || ''
  await restoreApplicationProject(fileUUID)
  load()
})
</script>

<style scoped>
.app-list-page {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--dark-1);
  color: #e8eaed;
  box-sizing: border-box;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--dark-4);
  flex-shrink: 0;
}

.app-title {
  font-size: 16px;
  font-weight: 600;
}

.header-spacer {
  flex: 1;
}

.app-list-main {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.list-toolbar {
  margin-bottom: 12px;
}

.empty-state {
  padding: 60px 0;
  text-align: center;
  opacity: 0.7;
}

.empty-state p {
  margin-bottom: 16px;
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.app-item {
  border: 1px solid var(--dark-4);
  border-radius: 8px;
  padding: 12px;
  background: var(--dark-2);
}

.app-item-name {
  font-size: 14px;
  font-weight: 600;
  word-break: break-all;
  margin-bottom: 4px;
}

.app-item-time {
  font-size: 12px;
  opacity: 0.6;
  margin-bottom: 10px;
}

.app-item-actions {
  display: flex;
  gap: 8px;
}
</style>
