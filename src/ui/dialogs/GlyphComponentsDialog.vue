<template>
  <n-modal
    :show="visible"
    preset="dialog"
    :title="t('dialogs.glyphComponentDialog.title')"
    class="glyph-components-dialog"
    :style="{ width: '805px', height: '560px' }"
    :mask-closable="true"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <!-- Tab 按钮：右上角，与列表页右下角按钮样式一致 -->
    <div class="dialog-tabs">
      <span
        class="tab-btn"
        :class="{ selected: activeTab === 'stroke_glyphs' }"
        @click="dialogs.setGlyphComponentsActiveTab('stroke_glyphs')"
        @pointerup="dialogs.setGlyphComponentsActiveTab('stroke_glyphs')"
      >{{ t('dialogs.glyphComponentDialog.tabs.stroke') }}</span>
      <span
        class="tab-btn"
        :class="{ selected: activeTab === 'radical_glyphs' }"
        @click="dialogs.setGlyphComponentsActiveTab('radical_glyphs')"
        @pointerup="dialogs.setGlyphComponentsActiveTab('radical_glyphs')"
      >{{ t('dialogs.glyphComponentDialog.tabs.radical') }}</span>
      <span
        class="tab-btn"
        :class="{ selected: activeTab === 'glyphs' }"
        @click="dialogs.setGlyphComponentsActiveTab('glyphs')"
        @pointerup="dialogs.setGlyphComponentsActiveTab('glyphs')"
      >{{ t('dialogs.glyphComponentDialog.tabs.glyph') }}</span>
      <span
        class="tab-btn"
        :class="{ selected: activeTab === 'comp_glyphs' }"
        @click="dialogs.setGlyphComponentsActiveTab('comp_glyphs')"
        @pointerup="dialogs.setGlyphComponentsActiveTab('comp_glyphs')"
      >{{ t('dialogs.glyphComponentDialog.tabs.comp') }}</span>
    </div>

    <!-- 列表区域 -->
    <div class="tab-body">
      <VirtualGlyphSelectionList v-show="activeTab === 'stroke_glyphs'" :visible="visible" glyph-type="stroke_glyphs" @select="handleSelect" />
      <VirtualGlyphSelectionList v-show="activeTab === 'radical_glyphs'" :visible="visible" glyph-type="radical_glyphs" @select="handleSelect" />
      <VirtualGlyphSelectionList v-show="activeTab === 'glyphs'" :visible="visible" glyph-type="glyphs" @select="handleSelect" />
      <VirtualGlyphSelectionList v-show="activeTab === 'comp_glyphs'" :visible="visible" glyph-type="comp_glyphs" @select="handleSelect" />
    </div>

    <!-- 底部：左下角单选/多选切换，右侧取消/确定 -->
    <template #action>
      <div class="dialog-footer">
        <div class="footer-left">
          <n-switch
            v-if="!dialogs.glyphComponentsStrokeReplaceHandler"
            :value="dialogs.glyphComponentsMultiSelect"
            @update:value="dialogs.toggleGlyphComponentsMultiSelect"
          >
            <template #checked>{{ t('dialogs.glyphComponentDialog.multiSelection') }}</template>
            <template #unchecked>{{ t('dialogs.glyphComponentDialog.singleSelection') }}</template>
          </n-switch>
        </div>
        <div class="footer-right">
          <div
            v-if="dialogs.glyphComponentsMultiSelect && selectedPickRows.length"
            class="selected-buttons"
          >
            <n-button
              v-for="row in selectedPickRows"
              :key="row.pickId"
              size="small"
              class="selected-glyph-btn"
              @click="dialogs.unselectGlyphComponentPick(row.pickId)"
            >
              {{ row.glyph.name }}
            </n-button>
          </div>
          <n-button @click="handleCancel" @pointerup="handleCancel">{{ t('dialogs.glyphComponentDialog.cancel') }}</n-button>
          <n-button
            type="primary"
            :disabled="dialogs.glyphComponentsMultiSelect && dialogs.glyphComponentsSelectedCount === 0"
            @click="handleConfirm"
            @pointerup="handleConfirm"
          >
            {{ dialogs.glyphComponentsMultiSelect ? t('dialogs.glyphComponentDialog.confirm') : t('dialogs.glyphComponentDialog.close') }}
          </n-button>
        </div>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NModal, NSwitch, NButton, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import * as R from 'ramda'
import { genUUID } from '@/utils/uuid'
import { useDialogsStore } from '@/stores/dialogs'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { useToolStore } from '@/stores/tool'
import { EditStatus, type ICustomGlyph } from '@/core/types'
import VirtualGlyphSelectionList from '@/ui/components/VirtualList/GlyphSelection/VirtualGlyphSelectionList.vue'

const { t } = useI18n()
const message = useMessage()
const dialogs = useDialogsStore()
const projectStore = useProjectStore()
const editorStore = useEditorStore()
const characterStore = useCharacterStore()
const glyphStore = useGlyphStore()
const toolStore = useToolStore()

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [value: boolean] }>()

const visible = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v),
})

const activeTab = computed(() => dialogs.glyphComponentsActiveTab)

/** 多选队列顺序解析为模板字形（同一 uuid 可出现多行） */
const selectedPickRows = computed(() => {
  const f: any = projectStore.selectedFile
  if (!f) return [] as Array<{ pickId: string; glyph: ICustomGlyph }>
  const all: ICustomGlyph[] = [
    ...(f.stroke_glyphs || []),
    ...(f.radical_glyphs || []),
    ...(f.glyphs || []),
    ...(f.comp_glyphs || []),
  ]
  const byUuid = new Map(all.map((g) => [g.uuid, g]))
  return dialogs.glyphComponentsSelectedPicks
    .map((p) => {
      const glyph = byUuid.get(p.templateUuid)
      if (!glyph) return null
      return { pickId: p.pickId, glyph }
    })
    .filter((x): x is { pickId: string; glyph: ICustomGlyph } => x != null)
})

/** 与原工程一致：名称 = 字形名 + 时间戳末四位；同毫秒批量插入时用 nameNonce 保证互异 */
function fourCharTimeSuffix(nameNonce = 0): string {
  return String(Date.now() + nameNonce).slice(-4).padStart(4, '0')
}

// 字形组件的包围框由轮廓点决定，不依赖 x,y,w,h；不设置可避免误用 fallback 导致全画布命中
function buildGlyphComponentFromGlyph(glyph: ICustomGlyph, nameNonce = 0) {
  const cloned = R.clone(glyph) as any
  const baseName = cloned.name || 'glyph'
  return {
    uuid: genUUID(),
    type: 'glyph',
    name: baseName + fourCharTimeSuffix(nameNonce),
    lock: false,
    visible: true,
    rotation: 0,
    flipX: false,
    flipY: false,
    usedInCharacter: true,
    ox: 0,
    oy: 0,
    value: cloned,
  } as any
}

function addGlyphToCurrentContainer(glyph: ICustomGlyph, nameNonce = 0) {
  const comp = buildGlyphComponentFromGlyph(glyph, nameNonce)
  if (editorStore.editStatus === EditStatus.Edit) {
    return characterStore.addComponent(comp)
  }
  if (editorStore.editStatus === EditStatus.Glyph) {
    return glyphStore.addComponent(comp)
  }
  return false
}

function handleSelect(glyph: ICustomGlyph) {
  const strokeCb = dialogs.glyphComponentsStrokeReplaceHandler
  if (strokeCb) {
    strokeCb(glyph.uuid)
    dialogs.clearGlyphComponentsStrokeReplaceHandler()
    dialogs.closeGlyphComponentsDialog()
    visible.value = false
    return
  }
  if (!dialogs.glyphComponentsMultiSelect) {
    const ok = addGlyphToCurrentContainer(glyph)
    if (!ok) {
      message.warning(t('dialogs.glyphComponentDialog.notInEditMode'))
      return
    }
    // 导入字形后默认切换到选择工具，便于直接拖拽/调整
    toolStore.setTool('select')
    dialogs.closeGlyphComponentsDialog()
    visible.value = false
    return
  }
  dialogs.selectGlyphComponentUUID(glyph.uuid)
}

function handleCancel() {
  dialogs.closeGlyphComponentsDialog()
  visible.value = false
}

function handleConfirm() {
  if (!dialogs.glyphComponentsMultiSelect) {
    handleCancel()
    return
  }
  const list = selectedPickRows.value
  if (!list.length) return
  let added = 0
  list.forEach((row, i) => {
    if (addGlyphToCurrentContainer(row.glyph, i)) added++
  })
  if (added > 0) {
    message.success(t('dialogs.glyphComponentDialog.added', { count: added }))
    // 导入字形后默认切换到选择工具，便于直接拖拽/调整
    toolStore.setTool('select')
  }
  dialogs.closeGlyphComponentsDialog()
  visible.value = false
}
</script>

<style scoped>
/* Tab 按钮：右上角，与列表页 list-switch 样式一致 */
.dialog-tabs {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  gap: 5px;
  margin-bottom: 8px;
  cursor: pointer;
  line-height: 40px;
}
.dialog-tabs .tab-btn {
  text-align: center;
  width: auto;
  height: 40px;
  padding: 0 20px;
  box-sizing: border-box;
  color: white;
  border: 1px solid var(--primary-1);
  line-height: 40px;
  background: var(--primary-0);
  transition: all 0.2s ease;
}
.dialog-tabs .tab-btn:hover {
  background-color: var(--primary-1);
}
.dialog-tabs .tab-btn.selected {
  font-weight: bold;
  color: var(--primary-0);
  border: 1px solid var(--primary-1);
  background: var(--primary-5);
}
.tab-body {
  height: 360px;
  margin-top: 8px;
}
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 10px;
}
.footer-left {
  display: flex;
  align-items: center;
}
.footer-right {
  display: flex;
  gap: 10px;
  align-items: center;
}
.selected-buttons {
  display: flex;
  flex-direction: row-reverse;
  max-width: 500px;
  overflow-x: auto;
  padding-bottom: 2px;
  gap: 6px;
}
.selected-glyph-btn {
  min-width: 56px;
  padding: 0 12px;
  height: 30px;
  line-height: 30px;
  border-radius: 0;
  border: 1px solid var(--primary-1);
  background: var(--primary-0);
  color: #ffffff;
}
</style>

<style>
.glyph-components-dialog .virtual-list-content {
  padding: 8px 0;
}
</style>