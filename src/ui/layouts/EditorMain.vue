<template>
  <div class="editor-main">
    <!-- FilesBar（仅在列表模式下显示） -->
    <FilesBar v-if="isListMode" />
    
    <!-- 根据编辑状态显示不同内容 -->
    <div class="editor-content" :class="{ 'with-filesbar': isListMode }">
      <!-- 列表模式：使用 v-show 避免重绘 -->
      <div v-show="isListMode" class="list-container">
        <VirtualCharacterList v-show="editStatus === EditStatus.CharacterList" />
        <VirtualGlyphList 
          v-show="editStatus === EditStatus.StrokeGlyphList" 
          glyph-type="stroke_glyphs"
        />
        <VirtualGlyphList 
          v-show="editStatus === EditStatus.RadicalGlyphList" 
          glyph-type="radical_glyphs"
        />
        <VirtualGlyphList 
          v-show="editStatus === EditStatus.CompGlyphList" 
          glyph-type="comp_glyphs"
        />
        <VirtualGlyphList 
          v-show="editStatus === EditStatus.GlyphList" 
          glyph-type="glyphs"
        />
      </div>
      
      <!-- 编辑模式 -->
      <CharacterEditor v-if="editStatus === EditStatus.Edit" />
      <GlyphEditor v-else-if="editStatus === EditStatus.Glyph" />
      <n-empty v-else-if="!isListMode" :description="t('panels.editorMain.featureInDevelopment')" />
    </div>
    
    <!-- Tab 切换按钮（仅在列表模式下显示） -->
    <div v-show="isListMode" class="list-switch">
      <span
        class="character-list"
        @click="handleTabChange(EditStatus.CharacterList)"
        :class="{ selected: editStatus === EditStatus.CharacterList }"
      >{{ t('panels.editorMain.character') }}</span>
      <span
        class="stroke-glyph-list"
        @click="handleTabChange(EditStatus.StrokeGlyphList)"
        :class="{ selected: editStatus === EditStatus.StrokeGlyphList }"
      >{{ t('panels.editorMain.stroke') }}</span>
      <span
        class="radical-glyph-list"
        @click="handleTabChange(EditStatus.RadicalGlyphList)"
        :class="{ selected: editStatus === EditStatus.RadicalGlyphList }"
      >{{ t('panels.editorMain.radical') }}</span>
      <span
        class="comp-glyph-list"
        @click="handleTabChange(EditStatus.CompGlyphList)"
        :class="{ selected: editStatus === EditStatus.CompGlyphList }"
      >{{ t('panels.editorMain.comp') }}</span>
      <span
        class="glyph-list"
        @click="handleTabChange(EditStatus.GlyphList)"
        :class="{ selected: editStatus === EditStatus.GlyphList }"
      >{{ t('panels.editorMain.glyph') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NEmpty } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/stores/editor'
import { EditStatus } from '@/core/types'
import VirtualCharacterList from '@/ui/components/VirtualList/CharacterList/VirtualCharacterList.vue'
import VirtualGlyphList from '@/ui/components/VirtualList/GlyphList/VirtualGlyphList.vue'
import CharacterEditor from '@/ui/components/Editor/CharacterEditor.vue'
import GlyphEditor from '@/ui/components/Editor/GlyphEditor.vue'
import FilesBar from '@/ui/components/FilesBar/FilesBar.vue'

const { t } = useI18n()

const editorStore = useEditorStore()
const editStatus = computed(() => editorStore.editStatus)

// 判断是否为列表模式
const isListMode = computed(() => {
  return editStatus.value === EditStatus.CharacterList ||
         editStatus.value === EditStatus.StrokeGlyphList ||
         editStatus.value === EditStatus.RadicalGlyphList ||
         editStatus.value === EditStatus.CompGlyphList ||
         editStatus.value === EditStatus.GlyphList
})

// 处理 tab 切换
const handleTabChange = (status: EditStatus) => {
  editorStore.setEditStatus(status)
}
</script>

<style scoped>
.editor-main {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.editor-content {
  flex: 1;
  overflow: hidden;
  height: 0; /* 配合 flex: 1 使用 */
}

.editor-content.with-filesbar {
  height: calc(100% - 36px); /* 减去 FilesBar 的高度 */
}

.list-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.list-switch {
  position: fixed;
  right: 20px;
  bottom: 20px;
  display: flex;
  flex-direction: row;
  cursor: pointer;
  line-height: 40px;
  gap: 5px;
  z-index: 100;
}

.list-switch .character-list,
.list-switch .glyph-list,
.list-switch .radical-glyph-list,
.list-switch .stroke-glyph-list,
.list-switch .comp-glyph-list {
  flex: 1;
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

.list-switch .character-list:hover,
.list-switch .glyph-list:hover,
.list-switch .radical-glyph-list:hover,
.list-switch .stroke-glyph-list:hover,
.list-switch .comp-glyph-list:hover {
  background-color: var(--primary-1);
}

.list-switch .character-list.selected,
.list-switch .glyph-list.selected,
.list-switch .radical-glyph-list.selected,
.list-switch .stroke-glyph-list.selected,
.list-switch .comp-glyph-list.selected {
  font-weight: bold;
  color: var(--primary-0);
  border: 1px solid var(--primary-1);
  line-height: 40px;
  background: var(--primary-5);
}
</style>
