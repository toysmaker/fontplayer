<template>
  <div class="editor-main">
    <!-- 根据编辑状态显示不同内容 -->
    <VirtualCharacterList v-if="editStatus === EditStatus.CharacterList" />
    <CharacterEditor v-else-if="editStatus === EditStatus.Edit" />
    <GlyphEditor v-else-if="editStatus === EditStatus.Glyph" />
    <n-empty v-else description="功能开发中..." />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NEmpty } from 'naive-ui'
import { useEditorStore } from '@/stores/editor'
import { EditStatus } from '@/core/types'
import VirtualCharacterList from '@/ui/components/VirtualList/CharacterList/VirtualCharacterList.vue'
import CharacterEditor from '@/features/editor/CharacterEditor.vue'
import GlyphEditor from '@/features/editor/GlyphEditor.vue'

const editorStore = useEditorStore()
const editStatus = computed(() => editorStore.editStatus)
</script>

<style scoped>
.editor-main {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
