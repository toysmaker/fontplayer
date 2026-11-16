<template>
  <div class="advanced-edit-panel">
    <!-- ============ Section 1: 笔画风格替换 ============ -->
    <div class="section">
      <div class="section-title">{{ t('panels.advancedEditPanel.strokeStyleReplace.title') }}</div>
      <div class="section-body">
        <p class="section-desc">{{ t('panels.advancedEditPanel.strokeStyleReplace.description') }}</p>

        <n-button
          block
          size="small"
          type="primary"
          @click="handleWholeReplace"
          @pointerup="handleWholeReplace"
        >
          <template #icon>
            <font-awesome-icon :icon="['fas', 'gears']" />
          </template>
          {{ t('panels.advancedEditPanel.strokeStyleReplace.wholeReplace') }}
        </n-button>

        <n-button
          v-if="!strokeStyleReplace.singleListExpanded"
          block
          size="small"
          class="single-replace-btn"
          @click="handleToggleSingleList"
          @pointerup="handleToggleSingleList"
        >
          {{ t('panels.advancedEditPanel.strokeStyleReplace.singleReplace') }}
        </n-button>

        <!-- 单个笔画风格替换：展开的笔画列表 -->
        <div v-if="strokeStyleReplace.singleListExpanded" class="stroke-list">
          <div class="stroke-list-title">
            {{ t('panels.advancedEditPanel.strokeStyleReplace.strokeListTitle') }}
            ({{ strokeStyleReplace.strokeItems.length }})
          </div>
          <n-empty
            v-if="strokeStyleReplace.strokeItems.length === 0"
            size="small"
            :description="t('panels.advancedEditPanel.strokeStyleReplace.noStrokes')"
          />
          <div
            v-for="item in strokeStyleReplace.strokeItems"
            :key="item.uuid"
            class="stroke-row"
          >
            <div class="stroke-row-info">
              <span class="stroke-row-name">{{ item.name }}</span>
              <span class="stroke-row-style">
                {{ t('panels.advancedEditPanel.strokeStyleReplace.currentStyle') }}:
                {{ item.style || t('panels.advancedEditPanel.strokeStyleReplace.unnamedStyle') }}
              </span>
            </div>
            <n-button
              size="tiny"
              type="primary"
              @click="handleSingleReplace(item)"
              @pointerup="handleSingleReplace(item)"
            >
              {{ t('panels.advancedEditPanel.strokeStyleReplace.replace') }}
            </n-button>
          </div>
          <n-button
            block
            size="tiny"
            class="collapse-btn"
            @click="handleCollapseList"
            @pointerup="handleCollapseList"
          >
            {{ t('panels.advancedEditPanel.strokeStyleReplace.collapseList') }}
          </n-button>
        </div>
      </div>
    </div>

    <!-- ============ Section 2: 动效与视频 ============ -->
    <div class="section">
      <div class="section-title">{{ t('panels.advancedEditPanel.animation.title') }}</div>
      <div class="section-body">
        <n-button
          block
          size="small"
          type="primary"
          @click="handleAddClip"
          @pointerup="handleAddClip"
        >
          <template #icon>
            <font-awesome-icon :icon="['fas', 'film']" />
          </template>
          {{ t('panels.advancedEditPanel.animation.addClip') }}
        </n-button>

        <!-- 动效视频列表 -->
        <div class="anim-list">
          <div class="anim-list-title">
            {{ t('panels.advancedEditPanel.animation.clipListTitle') }}
            ({{ animationStore.clips.length }})
          </div>
          <n-empty
            v-if="animationStore.clips.length === 0"
            size="small"
            :description="t('panels.advancedEditPanel.animation.noClips')"
          />
          <div v-for="clip in animationStore.clips" :key="clip.id" class="anim-list-row">
            <span class="anim-list-name">{{ clip.name }}</span>
            <span class="anim-list-actions">
              <n-button size="tiny" @click="handleEditClip(clip.id)" @pointerup="handleEditClip(clip.id)">
                {{ t('panels.advancedEditPanel.animation.edit') }}
              </n-button>
              <n-button size="tiny" type="primary" @click="handleExportClip(clip.id)" @pointerup="handleExportClip(clip.id)">
                {{ t('panels.advancedEditPanel.animation.export') }}
              </n-button>
            </span>
          </div>
        </div>

        <!-- 微交互依赖动画片段：视频列表为空时不显示按钮与列表 -->
        <template v-if="animationStore.clips.length > 0">
          <n-button
            block
            size="small"
            class="anim-add-micro"
            @click="handleAddMicro"
            @pointerup="handleAddMicro"
          >
            <template #icon>
              <font-awesome-icon :icon="['fas', 'diagram-project']" />
            </template>
            {{ t('panels.advancedEditPanel.animation.addMicro') }}
          </n-button>

          <!-- 交互列表 -->
          <div class="anim-list">
            <div class="anim-list-title">
              {{ t('panels.advancedEditPanel.animation.microListTitle') }}
              ({{ animationStore.microInteractions.length }})
            </div>
            <n-empty
              v-if="animationStore.microInteractions.length === 0"
              size="small"
              :description="t('panels.advancedEditPanel.animation.noMicros')"
            />
            <div v-for="micro in animationStore.microInteractions" :key="micro.id" class="anim-list-row">
              <span class="anim-list-name">{{ micro.name }}</span>
              <span class="anim-list-actions">
                <n-button size="tiny" @click="handleEditMicro(micro.id)" @pointerup="handleEditMicro(micro.id)">
                  {{ t('panels.advancedEditPanel.animation.edit') }}
                </n-button>
                <n-button size="tiny" type="primary" @click="handleExportMicro(micro.id)" @pointerup="handleExportMicro(micro.id)">
                  {{ t('panels.advancedEditPanel.animation.export') }}
                </n-button>
              </span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- ============ Section 3: 后续功能 ============ -->
    <!-- 注：动效/微交互对话框挂载在编辑界面根部（CharacterEditor），
         避免右侧面板 z-index 层叠上下文影响 naive-ui 弹层（select 下拉等）显示 -->
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NEmpty, useDialog, useMessage } from 'naive-ui'
import { useCharacterStore } from '@/stores/character'
import { useDialogsStore } from '@/stores/dialogs'
import {
  useStrokeStyleReplaceStore,
  type StrokeListItem,
} from '@/stores/strokeStyleReplace'
import { useAnimationStore } from '@/stores/animation'
import { exportMicroInteractionFile } from '@/features/animation/stateMachineExporter'
import { createDebouncedHandler } from '@/utils/debounce-click'

const { t } = useI18n()
const dialog = useDialog()
const message = useMessage()
const characterStore = useCharacterStore()
const dialogsStore = useDialogsStore()
const strokeStyleReplace = useStrokeStyleReplaceStore()
const animationStore = useAnimationStore()

// ---------------- 整体笔画风格替换 ----------------

function handleWholeStylePicked(style: string) {
  const plan = strokeStyleReplace.planWhole(style)
  if (!plan) return

  // 全部不匹配：给出提示让用户知道，不替换
  if (plan.pairs.length === 0) {
    dialog.warning({
      title: t('panels.advancedEditPanel.strokeStyleReplace.wholeReplaceNoneTitle'),
      content: t('panels.advancedEditPanel.strokeStyleReplace.wholeReplaceNoneContent'),
    })
    return
  }

  const doReplace = () => {
    const ch = characterStore.editingCharacter
    if (!ch) return
    const count = strokeStyleReplace.executeWhole(ch, plan.pairs)
    message.success(
      t('panels.advancedEditPanel.strokeStyleReplace.wholeReplaceSuccess', { count }),
    )
  }

  // 部分笔画无法替换：弹出提示，确认后再替换
  if (plan.skipped.length > 0) {
    const names = plan.skipped.map((s) => s.name).join('、')
    dialog.warning({
      title: t('panels.advancedEditPanel.strokeStyleReplace.wholeReplacePartialTitle'),
      content: t('panels.advancedEditPanel.strokeStyleReplace.wholeReplacePartialContent', {
        names,
      }),
      positiveText: t('panels.advancedEditPanel.strokeStyleReplace.wholeReplaceConfirm'),
      negativeText: t('panels.advancedEditPanel.strokeStyleReplace.wholeReplaceCancel'),
      onPositiveClick: doReplace,
    })
    return
  }

  // 全部匹配：无需提示，直接替换
  doReplace()
}

const _openWholeDialog = () => {
  dialogsStore.openGlyphComponentsDialogForStylePick((style) => {
    handleWholeStylePicked(style)
  })
}
const handleWholeReplace = createDebouncedHandler(
  _openWholeDialog,
  'AdvancedEditPanel.handleWholeReplace',
)

// ---------------- 单个笔画风格替换 ----------------

const _toggleSingleList = () => {
  if (strokeStyleReplace.singleListExpanded) {
    strokeStyleReplace.collapseSingleList()
  } else {
    strokeStyleReplace.expandSingleList()
  }
}
const handleToggleSingleList = createDebouncedHandler(
  _toggleSingleList,
  'AdvancedEditPanel.toggleSingleList',
)

const _collapseList = () => {
  strokeStyleReplace.collapseSingleList()
}
const handleCollapseList = createDebouncedHandler(
  _collapseList,
  'AdvancedEditPanel.collapseList',
)

/**
 * 点击替换按钮 → 打开字形选择对话框。
 * 点击目标字形后立即匹配：成功直接替换，失败在对话框底部给出提示并保持打开。
 */
const _openSingleDialog = (item: StrokeListItem) => {
  strokeStyleReplace.pendingStrokeUUID = item.uuid
  dialogsStore.openGlyphComponentsDialogForSingleStyleReplace((templateUuid) => {
    return handleSinglePick(item, templateUuid)
  })
}
const handleSingleReplace = createDebouncedHandler(
  _openSingleDialog,
  'AdvancedEditPanel.handleSingleReplace',
  (args) => (args[0] as StrokeListItem | undefined)?.uuid,
)

function handleSinglePick(item: StrokeListItem, templateUuid: string): boolean {
  const plan = strokeStyleReplace.planSingle(item.uuid, templateUuid)
  if ('error' in plan) {
    const target = strokeStyleReplace.getGlyphByUUID(templateUuid)
    const targetName = target?.name ?? ''
    const base = 'panels.advancedEditPanel.strokeStyleReplace.'
    let hint: string
    if (plan.error === 'nameMismatch') {
      hint = t(base + 'singleReplaceNameMismatch', { name: item.name, targetName })
    } else if (plan.error === 'noSkeleton') {
      hint = t(base + 'singleReplaceNoSkeleton', { name: item.name, targetName })
    } else {
      hint = t(base + 'singleReplaceKeypointMismatch', { name: item.name, targetName })
    }
    dialogsStore.setGlyphStylePickHint(hint)
    // 返回 false：保持对话框打开，让用户重新选择
    return false
  }
  const ok = strokeStyleReplace.executeSingle(plan.component, plan.targetGlyph)
  if (ok) {
    message.success(
      t('panels.advancedEditPanel.strokeStyleReplace.singleReplaceSuccess', {
        name: item.name,
        targetName: plan.targetGlyph.name,
      }),
    )
  }
  return ok
}

// 对话框关闭（取消/遮罩关闭）时清理待替换笔画
watch(
  () => dialogsStore.glyphComponentsDialogVisible,
  (v) => {
    if (!v) strokeStyleReplace.pendingStrokeUUID = null
  },
)

// ---------------- Section 2: 动效与视频 ----------------

const _addClip = () => {
  animationStore.openNewClipEditor()
}
const handleAddClip = createDebouncedHandler(_addClip, 'AdvancedEditPanel.addClip')

const _editClip = (id: string) => {
  animationStore.openClipEditor(id)
}
const handleEditClip = createDebouncedHandler(_editClip, 'AdvancedEditPanel.editClip', (args) => args[0])

/** 列表点击导出：只显示导出小对话框（挂载在 CharacterEditor 根部），不打开编辑对话框 */
const _exportClip = (id: string) => {
  animationStore.openClipExport(id)
}
const handleExportClip = createDebouncedHandler(_exportClip, 'AdvancedEditPanel.exportClip', (args) => args[0])

const _addMicro = () => {
  animationStore.openNewMicroEditor()
}
const handleAddMicro = createDebouncedHandler(_addMicro, 'AdvancedEditPanel.addMicro')

const _editMicro = (id: string) => {
  animationStore.openMicroEditor(id)
}
const handleEditMicro = createDebouncedHandler(_editMicro, 'AdvancedEditPanel.editMicro', (args) => args[0])

/** 交互列表直接导出当前交互文件（状态机 JSON，内嵌片段动画） */
const _exportMicro = (id: string) => {
  const micro = animationStore.getMicro(id)
  const ch = characterStore.editingCharacter
  if (!micro || !ch) return
  exportMicroInteractionFile(micro, animationStore.clips, ch)
  message.success(t('panels.advancedEditPanel.animation.exported'))
}
const handleExportMicro = createDebouncedHandler(_exportMicro, 'AdvancedEditPanel.exportMicro', (args) => args[0])

onUnmounted(() => {
  strokeStyleReplace.reset()
})
</script>

<style scoped>
.advanced-edit-panel {
  padding: 10px;
  color: var(--light-0);
}
.section {
  margin-bottom: 12px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--light-0);
}
.section-body {
  margin-bottom: 20px;
}
.section-desc {
  margin: 0 0 10px 0;
  font-size: 12px;
  color: var(--light-5);
  line-height: 1.5;
}
.single-replace-btn {
  margin-top: 8px;
}
.stroke-list {
  margin-top: 10px;
}
.stroke-list-title {
  font-size: 12px;
  color: var(--light-5);
  margin-bottom: 6px;
}
.stroke-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  margin-bottom: 4px;
  background-color: var(--dark-1);
  border-radius: 3px;
}
.stroke-row-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.stroke-row-name {
  font-size: 13px;
  color: var(--light-0);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stroke-row-style {
  font-size: 11px;
  color: var(--light-4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.collapse-btn {
  margin-top: 6px;
}
/* Section 2: 动效与视频 */
.anim-add-micro {
  margin-top: 8px;
}
.anim-list {
  margin-top: 10px;
}
.anim-list-title {
  font-size: 12px;
  color: var(--light-5);
  margin-bottom: 6px;
}
.anim-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  margin-bottom: 4px;
  background-color: var(--dark-1);
  border-radius: 3px;
}
.anim-list-name {
  font-size: 12px;
  color: var(--light-0);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.anim-list-actions {
  display: flex;
  gap: 4px;
  flex: 0 0 auto;
}
</style>
