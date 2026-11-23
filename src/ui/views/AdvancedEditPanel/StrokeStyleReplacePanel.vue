<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { NButton, NInput, NScrollbar, useDialog, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useAdvancedEditStore } from '@/stores/advancedEdit'
import { useDialogsStore } from '@/stores/dialogs'
import { createDebouncedHandler } from '@/utils/debounce-click'
import CharacterZoomPreview from './CharacterZoomPreview.vue'

const advancedEdit = useAdvancedEditStore()
const dialogs = useDialogsStore()
const dialog = useDialog()
const message = useMessage()
const { t } = useI18n()
const zoomedIndex = ref<number | null>(null)

onMounted(async () => {
  await advancedEdit.getStrokeListFromProject()
  await advancedEdit.refreshMergedStyleStrokePreviews()
})

onUnmounted(() => {
  advancedEdit.strokeList.length = 0
  advancedEdit.strokeMap.clear()
  advancedEdit.wholeReplaceStyle = ''
})

/** 是否存在待应用的配置（整体替换风格 / 单笔画替换），无配置时禁用一键更新避免空跑 */
const hasPendingChanges = computed(() => {
  const anyPerStroke = advancedEdit.strokeList.some((s) => s.replaced)
  return !!advancedEdit.wholeReplaceStyle || anyPerStroke
})

function handleToggleEditSample() {
  advancedEdit.isEditingSample = !advancedEdit.isEditingSample
  if (!advancedEdit.isEditingSample) {
    void advancedEdit.refreshMergedStyleStrokePreviews()
  }
}

const _applyMerged = () => {
  void advancedEdit.applyMergedStrokeReplacementsToEntireProject()
}
const handleApplyMerged = createDebouncedHandler(
  _applyMerged,
  'StrokeStyleReplacePanel.applyMerged',
)

async function handleSelectStroke(stroke: (typeof advancedEdit.strokeList)[0]) {
  advancedEdit.selectedStrokeUUID = stroke.uuid
  await nextTick()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      advancedEdit.renderStrokePreviewCanvas(stroke.uuid)
    })
  })
}

/** 必须先锁定当前行，否则 setReplacementStroke 因找不到 selectedStroke 直接 return */
function handleSetReplacementStroke(stroke: (typeof advancedEdit.strokeList)[0]) {
  advancedEdit.selectedStrokeUUID = stroke.uuid
  advancedEdit.onStrokeReplacement = true
  dialogs.openGlyphComponentsDialogForStrokeReplace((uuid) => {
    void advancedEdit.setReplacementStroke(uuid)
    advancedEdit.onStrokeReplacement = false
  })
}

// ---- 一键替换所有笔画（整体笔画风格替换，作用于整个工程全部字符） ----
const _openWholeDialog = () => {
  dialogs.openGlyphComponentsDialogForStylePick((style) => {
    void handleWholeStylePicked(style)
  })
}
const handleOpenWholeReplace = createDebouncedHandler(
  _openWholeDialog,
  'StrokeStyleReplacePanel.openWholeReplace',
)

async function handleWholeStylePicked(style: string) {
  // 一键替换所有笔画只作用于样例字符的预览；工程级替换在「一键更新全部字库」时执行
  const plan = await advancedEdit.planWholeStyleReplaceForSamples(style)
  if (!plan || plan.totalPairs === 0) {
    dialog.warning({
      title: t('panels.advancedEditPanel.strokeStyleReplace.wholeReplaceNoneTitle'),
      content: t('panels.advancedEditPanel.strokeStyleReplace.wholeReplaceNoneContent'),
    })
    return
  }
  const doApply = async () => {
    advancedEdit.wholeReplaceStyle = style
    await advancedEdit.refreshMergedStyleStrokePreviews()
    message.success(t('panels.advancedEditPanel.strokeStyleReplace.wholeReplaceSuccess', { count: plan.totalPairs }))
  }
  if (plan.skippedNames.length > 0) {
    const shown = plan.skippedNames.slice(0, 20).join('、')
    const names = plan.skippedNames.length > 20 ? `${shown} 等` : shown
    dialog.warning({
      title: t('panels.advancedEditPanel.strokeStyleReplace.wholeReplacePartialTitle'),
      content: t('panels.advancedEditPanel.strokeStyleReplace.wholeReplacePartialContent', { names }),
      positiveText: t('panels.advancedEditPanel.strokeStyleReplace.wholeReplaceConfirm'),
      negativeText: t('panels.advancedEditPanel.strokeStyleReplace.wholeReplaceCancel'),
      onPositiveClick: () => {
        void doApply()
      },
    })
    return
  }
  await doApply()
}

function handleClearWholeReplaceStyle() {
  advancedEdit.wholeReplaceStyle = ''
  void advancedEdit.refreshMergedStyleStrokePreviews()
}
</script>

<template>
  <div class="wrap">
    <div class="advanced-edit-params-panel">
      <div class="left">
        <div class="sample-characters-section">
          <h3>样例字符</h3>
          <n-input
            v-model:value="advancedEdit.sampleCharacters"
            type="textarea"
            :rows="4"
            :disabled="!advancedEdit.isEditingSample"
            placeholder="请输入最多20个字符，每个字符不能重复"
            :maxlength="20"
            show-count
          />
          <n-button
            block
            :type="advancedEdit.isEditingSample ? 'success' : 'primary'"
            class="sample-edit-btn"
            @click="handleToggleEditSample"
          >
            {{ advancedEdit.isEditingSample ? '确认' : '编辑预览样例字符' }}
          </n-button>
        </div>
        <div class="update-section">
          <n-button
            type="error"
            size="large"
            block
            :disabled="!hasPendingChanges"
            :title="!hasPendingChanges ? '请先选择风格或设置笔画替换' : ''"
            @click="handleApplyMerged"
            @pointerup="handleApplyMerged"
          >
            一键更新全部字库
          </n-button>
        </div>
      </div>
      <div class="main">
        <CharacterZoomPreview
          v-if="zoomedIndex !== null"
          :characters="advancedEdit.sampleCharactersList"
          :model-value="zoomedIndex"
          @update:model-value="zoomedIndex = $event"
          @close="zoomedIndex = null"
        />
        <div v-else class="characters" id="advanced-edit-characters-list">
          <div
            v-for="(ch, index) in advancedEdit.sampleCharactersList"
            :key="ch.uuid"
            class="character-preview char-preview"
            @click="zoomedIndex = index"
          >
            <canvas
              :id="`advanced-edit-preview-canvas-${ch.uuid}`"
              width="100"
              height="100"
            />
          </div>
        </div>
      </div>
      <div class="right">
        <n-scrollbar style="max-height: 100%">
          <div class="title">整体替换</div>
          <div class="whole-replace-section">
            <n-button
              type="primary"
              block
              @click="handleOpenWholeReplace"
              @pointerup="handleOpenWholeReplace"
            >
              一键替换所有笔画
            </n-button>
            <div v-if="advancedEdit.wholeReplaceStyle" class="whole-replace-pending">
              <span class="whole-replace-pending-text">
                已选风格：{{ advancedEdit.wholeReplaceStyle }}（一键更新时应用到全部字符）
              </span>
              <span class="whole-replace-clear" @click="handleClearWholeReplaceStyle">清除</span>
            </div>
          </div>

          <div class="title">笔画列表</div>
          <div class="stroke-list">
            <div
              v-for="stroke in advancedEdit.strokeList"
              :key="stroke.uuid"
              class="stroke-item"
              :class="{ 'stroke-item--selected': advancedEdit.selectedStrokeUUID === stroke.uuid }"
              @click="handleSelectStroke(stroke)"
            >
              <div class="stroke-preview">
                <canvas
                  :id="`advanced-edit-stroke-canvas-${stroke.uuid}`"
                  :class="`stroke-preview-${stroke.uuid}`"
                  width="100"
                  height="100"
                />
              </div>
              <div class="stroke-info">
                <div class="stroke-name">{{ stroke.name }}</div>
                <div class="stroke-style">{{ stroke.style }}</div>
                <div class="replacement-setting-btn">
                  <n-button size="small" type="primary" @click.stop="handleSetReplacementStroke(stroke)">
                    {{ stroke.replaced ? '修改替换笔画' : '设置替换笔画' }}
                  </n-button>
                </div>
              </div>
            </div>
          </div>
        </n-scrollbar>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--dark-3);
}
.advanced-edit-params-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
}
.left {
  border-right: 1px solid var(--light-5);
  flex: 0 0 300px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  box-sizing: border-box;
}
.sample-characters-section h3 {
  margin: 0 0 12px 0;
  color: var(--light-0);
}
.sample-edit-btn {
  margin: 12px 0;
}
.update-section {
  margin-top: auto;
}
.main {
  flex: auto;
  overflow: auto;
  min-width: 0;
}
.characters {
  flex: 0 0 450px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 10px;
  padding: 10px;
  box-sizing: border-box;
}
.character-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 100px;
  width: 100px;
  height: 100px;
  box-sizing: border-box;
  cursor: pointer;
}
.right {
  flex: 0 0 260px;
  min-width: 0;
  max-width: 260px;
  overflow: hidden;
  border-left: 1px solid var(--light-5);
  height: 100%;
  display: flex;
  flex-direction: column;
}
/* naive-ui 滚动条内容区会按内容固有宽度撑宽容器，必须硬性限制在栏宽内 */
.right :deep(.n-scrollbar),
.right :deep(.n-scrollbar-container) {
  max-width: 260px;
  box-sizing: border-box;
}
.title {
  padding: 8px 10px;
  background: var(--primary-0);
  color: var(--light-0);
}
.whole-replace-section {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--light-5);
  /* 撑满栏内容区，与笔画列表等宽；防撑宽由滚动条硬上限 + 提示文本截断保证 */
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
}
.whole-replace-pending {
  font-size: 12px;
  color: var(--light-3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}
.whole-replace-pending-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  /* flex 子项默认 min-width:auto 会阻止收缩，必须显式允许收缩 */
  min-width: 0;
  max-width: calc(100% - 40px);
  flex: 1;
}
.stroke-item {
  padding: 10px;
  border-bottom: 1px solid var(--light-5);
  cursor: pointer;
}
.stroke-item--selected {
  box-shadow: inset 3px 0 0 var(--primary-5);
}
.stroke-list {
  padding-bottom: 20px;
}
.stroke-preview {
  display: flex;
  align-items: center;
  justify-content: center;
}
.stroke-info {
  margin-top: 6px;
}
.stroke-name {
  font-size: 14px;
  color: var(--light-0);
}
.stroke-style {
  font-size: 12px;
  color: var(--light-3);
}
.replacement-setting-btn {
  margin-top: 6px;
}
</style>
