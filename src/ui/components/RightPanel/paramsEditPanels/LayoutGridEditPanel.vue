<script setup lang="ts">
/**
 * 对齐原工程 LayoutEditPanel.vue 中「九宫格 / 布局」区块：按钮切换编辑对象 + 全量数值表 + 骨架开关
 */
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import * as R from 'ramda'
import {
  NButton,
  NForm,
  NFormItem,
  NInputNumber,
  NSwitch,
  useDialog,
  useMessage,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useCharacterStore, ensureCharacterInfoGridSettings, defaultGridItem } from '@/stores/character'
import { useCharacterGridEditStore } from '@/stores/characterGridEdit'
import { useProjectStore } from '@/stores/project'
import type { IComponent, ICustomGlyph, IGlyphComponent } from '@/core/types'
import { ComponentType } from '@/core/types'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import {
  formatContainerGlyphComponents,
  formatGridComponents,
  orderedListWithItemsForCharacterFile,
} from '@/features/editor/services/FormatGlyphService'
import type { ILayoutTransformGrid } from '@/core/utils/grid'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()
const characterStore = useCharacterStore()
const gridEditStore = useCharacterGridEditStore()
const projectStore = useProjectStore()
const { gridEditTarget, layoutGridDirty } = storeToRefs(gridEditStore)

const emWidth = computed(() => projectStore.selectedFile?.width ?? 1000)

const gridSettings = computed(() => {
  const ch = characterStore.editingCharacter
  if (!ch) return null
  ensureCharacterInfoGridSettings(ch)
  return ch.info!.gridSettings!
})

const canUseSkeletonGrid = computed(() => {
  const list = characterStore.orderedListWithItemsForCurrentCharacterFile
  if (!list.length) return false
  if (!list.every((c) => c?.type === ComponentType.CustomGlyph)) return false
  return list.every((component: IComponent) => {
    const gv = (component as IGlyphComponent).value as ICustomGlyph | undefined
    if (!gv) return false
    const key = component.uuid
    try {
      executeGlyphScript(gv, key)
    } catch {
      return false
    }
    const inst = instanceManager.acquireTemporaryInstance(
      key,
      () => new CustomGlyph(gv),
      'glyph',
    ) as CustomGlyph
    return (
      typeof inst.getSkeleton === 'function' &&
      inst.getSkeleton != null &&
      typeof inst.getComponentsBySkeleton === 'function' &&
      inst.getComponentsBySkeleton != null
    )
  })
})

const useSkeletonGridModel = computed({
  get: () => !!characterStore.editingCharacter?.info?.useSkeletonGrid,
  set: (v: boolean) => {
    const ch = characterStore.editingCharacter
    if (!ch) return
    if (!canUseSkeletonGrid.value && v) {
      message.warning(t('panels.paramsPanel.layoutGridPanel.skeletonGuardMsg'))
      return
    }
    ensureCharacterInfoGridSettings(ch)
    ch.info!.useSkeletonGrid = v
    gridEditStore.markLayoutGridDirty()
  },
})

watch(canUseSkeletonGrid, (ok) => {
  const ch = characterStore.editingCharacter
  if (!ok && ch?.info?.useSkeletonGrid) {
    ensureCharacterInfoGridSettings(ch)
    ch.info!.useSkeletonGrid = false
  }
})

watch(
  () => characterStore.editingCharacter?.info?.gridSettings?.currentGrid,
  () => {
    characterStore.syncGridSettingsShorthandFromCurrentGrid()
  },
  { deep: true },
)

function onNumberChange() {
  gridEditStore.markLayoutGridDirty()
}

function buildDefaultGridSettingsPayload() {
  const w = emWidth.value
  const ig = defaultGridItem()
  const cg = R.clone(ig)
  return {
    dx: 0,
    dy: 0,
    centerSquareSize: w / 3,
    size: w,
    default: true as const,
    initialGrid: R.clone(ig),
    currentGrid: R.clone(cg),
  }
}

function confirmApplyGrid() {
  dialog.warning({
    title: t('panels.paramsPanel.layoutEditing.applyGridTransform'),
    content: t('panels.paramsPanel.layoutEditing.applyGridConfirmMsg'),
    positiveText: t('panels.picEditPanel.confirm'),
    negativeText: t('panels.picEditPanel.cancel'),
    onPositiveClick: () => {
      const ch = characterStore.editingCharacter
      if (!ch) return
      ensureCharacterInfoGridSettings(ch)
      const gs = ch.info!.gridSettings!
      const layoutBundle: ILayoutTransformGrid = {
        initialGrid: R.clone(gs.initialGrid!),
        currentGrid: R.clone(gs.currentGrid!),
      }
      formatContainerGlyphComponents(ch)
      formatGridComponents(orderedListWithItemsForCharacterFile(ch), {
        grid: layoutBundle,
        offset: { x: 0, y: 0 },
      })
      ch.info = ch.info || {}
      ch.info.gridSettings = R.clone(buildDefaultGridSettingsPayload()) as any
      ensureCharacterInfoGridSettings(ch)
      gridEditStore.clearLayoutGridDirty()
      gridEditStore.setGridEditTarget('currentGrid')
      gridEditStore.bumpMainCanvasRerender()
      message.success(t('panels.paramsPanel.layoutEditing.applyGridTransform'))
    },
  })
}

function saveGridLayout() {
  const ch = characterStore.editingCharacter
  if (!ch?.info?.gridSettings) return
  ch.info.gridSettings = R.clone(ch.info.gridSettings) as any
  ensureCharacterInfoGridSettings(ch)
  message.success(t('panels.paramsPanel.layoutGridPanel.saveLayoutOk'))
}

function resetGrid() {
  const ch = characterStore.editingCharacter
  if (!ch) return
  ch.info = ch.info || {}
  ch.info.gridSettings = R.clone(buildDefaultGridSettingsPayload()) as any
  ensureCharacterInfoGridSettings(ch)
  gridEditStore.markLayoutGridDirty()
  gridEditStore.bumpMainCanvasRerender()
  message.success(t('panels.paramsPanel.layoutEditing.resetGridTransform'))
}

function editInitialGrid() {
  gridEditStore.setGridEditTarget('initialGrid')
}

function resetInitialGrid() {
  const gs = gridSettings.value
  if (!gs) return
  gs.initialGrid = R.clone(defaultGridItem())
  onNumberChange()
  gridEditStore.bumpMainCanvasRerender()
}

function editCurrentGrid() {
  const gs = gridSettings.value
  if (!gs) return
  gs.currentGrid = R.clone(gs.initialGrid)
  characterStore.syncGridSettingsShorthandFromCurrentGrid()
  gridEditStore.setGridEditTarget('currentGrid')
  onNumberChange()
  gridEditStore.bumpMainCanvasRerender()
}

function resetCurrentGrid() {
  const gs = gridSettings.value
  if (!gs) return
  gs.currentGrid = R.clone(gs.initialGrid)
  characterStore.syncGridSettingsShorthandFromCurrentGrid()
  onNumberChange()
  gridEditStore.bumpMainCanvasRerender()
}
</script>

<template>
  <div v-if="gridSettings" class="character-edit-panel layout-grid-edit-panel">
    <div class="grid-settings">
      <n-button
        class="grid-action-btn"
        type="primary"
        block
        :disabled="!layoutGridDirty"
        @click="confirmApplyGrid"
      >
        {{ t('panels.paramsPanel.layoutEditing.applyGridTransform') }}
      </n-button>
      <n-button class="grid-action-btn" type="primary" block @click="saveGridLayout">
        {{ t('panels.paramsPanel.layoutGridPanel.saveLayoutState') }}
      </n-button>
      <n-button class="grid-action-btn" block @click="resetGrid">
        {{ t('panels.paramsPanel.layoutEditing.resetGridTransform') }}
      </n-button>
      <n-form-item
        class="skeleton-row"
        label-width="120"
        :label="t('panels.paramsPanel.layoutGridPanel.useSkeletonTransform')"
      >
        <n-switch v-model:value="useSkeletonGridModel" :disabled="!canUseSkeletonGrid" />
      </n-form-item>
    </div>

    <div class="section-title">{{ t('panels.paramsPanel.layoutGridPanel.initialLayoutTitle') }}</div>
    <div class="grid-block initial-grid-settings">
      <n-form label-placement="left" label-width="120">
        <n-form-item label="dx">
          <n-input-number
            v-model:value="gridSettings.initialGrid.dx"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'currentGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dy">
          <n-input-number
            v-model:value="gridSettings.initialGrid.dy"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'currentGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dx1">
          <n-input-number
            v-model:value="gridSettings.initialGrid.dx1"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'currentGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dx2">
          <n-input-number
            v-model:value="gridSettings.initialGrid.dx2"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'currentGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dx3">
          <n-input-number
            v-model:value="gridSettings.initialGrid.dx3"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'currentGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dx4">
          <n-input-number
            v-model:value="gridSettings.initialGrid.dx4"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'currentGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dy1">
          <n-input-number
            v-model:value="gridSettings.initialGrid.dy1"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'currentGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dy2">
          <n-input-number
            v-model:value="gridSettings.initialGrid.dy2"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'currentGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dy3">
          <n-input-number
            v-model:value="gridSettings.initialGrid.dy3"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'currentGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dy4">
          <n-input-number
            v-model:value="gridSettings.initialGrid.dy4"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'currentGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="ox">
          <n-input-number
            v-model:value="gridSettings.initialGrid.ox"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'currentGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="oy">
          <n-input-number
            v-model:value="gridSettings.initialGrid.oy"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'currentGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="width">
          <n-input-number
            v-model:value="gridSettings.initialGrid.width"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'currentGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="height">
          <n-input-number
            v-model:value="gridSettings.initialGrid.height"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'currentGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="centerSquareScale">
          <n-input-number
            v-model:value="gridSettings.initialGrid.centerSquareScale"
            :min="0"
            :max="1"
            :step="0.05"
            :precision="2"
            :show-button="false"
            :disabled="gridEditTarget === 'currentGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
      </n-form>
      <n-button class="grid-action-btn" block @click="editInitialGrid">
        {{ t('panels.paramsPanel.layoutGridPanel.editInitialGrid') }}
      </n-button>
      <n-button
        class="grid-action-btn"
        block
        :disabled="gridEditTarget === 'currentGrid'"
        @click="resetInitialGrid"
      >
        {{ t('panels.paramsPanel.layoutGridPanel.resetInitialGrid') }}
      </n-button>
    </div>

    <div class="section-title">{{ t('panels.paramsPanel.layoutGridPanel.currentLayoutTitle') }}</div>
    <div class="grid-block current-grid-settings">
      <n-form label-placement="left" label-width="120">
        <n-form-item label="dx">
          <n-input-number
            v-model:value="gridSettings.currentGrid.dx"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'initialGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dy">
          <n-input-number
            v-model:value="gridSettings.currentGrid.dy"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'initialGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dx1">
          <n-input-number
            v-model:value="gridSettings.currentGrid.dx1"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'initialGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dx2">
          <n-input-number
            v-model:value="gridSettings.currentGrid.dx2"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'initialGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dx3">
          <n-input-number
            v-model:value="gridSettings.currentGrid.dx3"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'initialGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dx4">
          <n-input-number
            v-model:value="gridSettings.currentGrid.dx4"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'initialGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dy1">
          <n-input-number
            v-model:value="gridSettings.currentGrid.dy1"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'initialGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dy2">
          <n-input-number
            v-model:value="gridSettings.currentGrid.dy2"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'initialGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dy3">
          <n-input-number
            v-model:value="gridSettings.currentGrid.dy3"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'initialGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="dy4">
          <n-input-number
            v-model:value="gridSettings.currentGrid.dy4"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'initialGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="ox">
          <n-input-number
            v-model:value="gridSettings.currentGrid.ox"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'initialGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="oy">
          <n-input-number
            v-model:value="gridSettings.currentGrid.oy"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'initialGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="width">
          <n-input-number
            v-model:value="gridSettings.currentGrid.width"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'initialGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="height">
          <n-input-number
            v-model:value="gridSettings.currentGrid.height"
            :min="0"
            :max="1000"
            :precision="1"
            :show-button="false"
            :disabled="gridEditTarget === 'initialGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
        <n-form-item label="centerSquareScale">
          <n-input-number
            v-model:value="gridSettings.currentGrid.centerSquareScale"
            :min="0"
            :max="1"
            :step="0.05"
            :precision="2"
            :show-button="false"
            :disabled="gridEditTarget === 'initialGrid'"
            @update:value="onNumberChange"
          />
        </n-form-item>
      </n-form>
      <n-button class="grid-action-btn" block @click="editCurrentGrid">
        {{ t('panels.paramsPanel.layoutGridPanel.editCurrentGrid') }}
      </n-button>
      <n-button
        class="grid-action-btn"
        block
        :disabled="gridEditTarget === 'initialGrid'"
        @click="resetCurrentGrid"
      >
        {{ t('panels.paramsPanel.layoutGridPanel.resetCurrentGrid') }}
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.character-edit-panel {
  padding: 0;
}
.layout-grid-edit-panel {
  text-align: left;
}
.grid-settings {
  padding: 10px;
}
.grid-block {
  padding: 10px;
}
.grid-action-btn {
  width: 100%;
  margin: 0 0 10px 0;
}
.skeleton-row {
  margin-bottom: 0;
}
.section-title {
  height: 36px;
  line-height: 36px;
  padding: 0 10px;
  border-bottom: 1px solid var(--dark-4);
  font-size: 14px;
}
</style>
