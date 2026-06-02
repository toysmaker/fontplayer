<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { NEmpty } from 'naive-ui'
import { useAdvancedEditStore } from '@/stores/advancedEdit'
import CharacterZoomPreview from './CharacterZoomPreview.vue'

const advancedEdit = useAdvancedEditStore()
const zoomedIndex = ref<number | null>(null)

onMounted(() => {
  void advancedEdit.updatePreviewList()
})
</script>

<template>
  <div class="wrap">
    <div class="condition-filter-panel">
      <div class="left">
        <n-empty description="待开发" />
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
        <n-empty description="待开发" />
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
.condition-filter-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
}
.left {
  border-right: 1px solid var(--light-5);
  flex: 0 0 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
  height: 100%;
}
.main {
  flex: auto;
  min-width: 0;
  overflow: auto;
}
.characters {
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
  border-left: 1px solid var(--light-5);
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
