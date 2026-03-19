<template>
  <n-modal
    :show="visible"
    preset="dialog"
    :title="t('dialogs.glyphComponentDialog.title')"
    class="glyph-components-dialog"
    :style="{ width: '920px', height: '720px' }"
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

    <!-- 多选时：已选列表在列表下方 -->
    <div v-if="dialogs.glyphComponentsMultiSelect" class="selected-strip">
      <div class="selected-strip-title">
        {{ t('dialogs.glyphComponentDialog.selected') }} ({{ dialogs.glyphComponentsSelectedCount }})
      </div>
      <div class="selected-strip-items">
        <n-tag
          v-for="g in selectedGlyphs"
          :key="g.uuid"
          closable
          @close="dialogs.unselectGlyphComponentUUID(g.uuid)"
        >
          {{ g.name }}
        </n-tag>
      </div>
    </div>

    <!-- 底部：左下角单选/多选切换，右侧取消/确定 -->
    <template #action>
      <div class="dialog-footer">
        <div class="footer-left">
          <n-switch
            :value="dialogs.glyphComponentsMultiSelect"
            @update:value="dialogs.toggleGlyphComponentsMultiSelect"
          >
            <template #checked>{{ t('dialogs.glyphComponentDialog.multiSelection') }}</template>
            <template #unchecked>{{ t('dialogs.glyphComponentDialog.singleSelection') }}</template>
          </n-switch>
        </div>
        <div class="footer-right">
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
import { NModal, NSwitch, NButton, NTag, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import * as R from 'ramda'
import { genUUID } from '@/utils/uuid'
import { useDialogsStore } from '@/stores/dialogs'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import { EditStatus, type ICustomGlyph } from '@/core/types'
import VirtualGlyphSelectionList from '@/ui/components/VirtualList/GlyphSelection/VirtualGlyphSelectionList.vue'

const { t } = useI18n()
const message = useMessage()
const dialogs = useDialogsStore()
const projectStore = useProjectStore()
const editorStore = useEditorStore()
const characterStore = useCharacterStore()
const glyphStore = useGlyphStore()

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [value: boolean] }>()

const visible = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v),
})

const activeTab = computed(() => dialogs.glyphComponentsActiveTab)

const selectedGlyphs = computed<ICustomGlyph[]>(() => {
  const f: any = projectStore.selectedFile
  if (!f) return []
  const all: ICustomGlyph[] = [
    ...(f.stroke_glyphs || []),
    ...(f.radical_glyphs || []),
    ...(f.glyphs || []),
    ...(f.comp_glyphs || []),
  ]
  const set = new Set(dialogs.glyphComponentsSelectedUUIDs)
  return all.filter((g) => set.has(g.uuid))
})

// 字形组件的包围框由轮廓点决定，不依赖 x,y,w,h；不设置可避免误用 fallback 导致全画布命中
function buildGlyphComponentFromGlyph(glyph: ICustomGlyph) {
  const cloned = R.clone(glyph) as any
  return {
    uuid: genUUID(),
    type: 'glyph',
    name: cloned.name || 'glyph',
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

function addGlyphToCurrentContainer(glyph: ICustomGlyph) {
  const comp = buildGlyphComponentFromGlyph(glyph)
  if (editorStore.editStatus === EditStatus.Edit) {
    return characterStore.addComponent(comp)
  }
  if (editorStore.editStatus === EditStatus.Glyph) {
    return glyphStore.addComponent(comp)
  }
  return false
}

function handleSelect(glyph: ICustomGlyph) {
  if (!dialogs.glyphComponentsMultiSelect) {
    const ok = addGlyphToCurrentContainer(glyph)
    if (!ok) {
      message.warning(t('dialogs.glyphComponentDialog.notInEditMode'))
      return
    }
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
  const list = selectedGlyphs.value
  if (!list.length) return
  let added = 0
  list.forEach((g) => {
    if (addGlyphToCurrentContainer(g)) added++
  })
  if (added > 0) {
    message.success(t('dialogs.glyphComponentDialog.added', { count: added }))
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
  margin-bottom: 10px;
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
  height: 480px;
}
.selected-strip {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e5e7eb;
}
.selected-strip-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.selected-strip-items {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
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
}
</style>

