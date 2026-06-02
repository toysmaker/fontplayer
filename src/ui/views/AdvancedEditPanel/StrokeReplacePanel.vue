<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { NButton, NInput, NScrollbar } from 'naive-ui'
import { useAdvancedEditStore } from '@/stores/advancedEdit'
import { useDialogsStore } from '@/stores/dialogs'
import CharacterZoomPreview from './CharacterZoomPreview.vue'

const advancedEdit = useAdvancedEditStore()
const dialogs = useDialogsStore()
const zoomedIndex = ref<number | null>(null)

onMounted(async () => {
  await advancedEdit.getStrokeListFromProject()
  await advancedEdit.refreshStrokeReplacePreviews()
})

onUnmounted(() => {
  advancedEdit.strokeList.length = 0
  advancedEdit.strokeMap.clear()
})

function handleToggleEditSample() {
  advancedEdit.isEditingSample = !advancedEdit.isEditingSample
  if (!advancedEdit.isEditingSample) {
    void advancedEdit.refreshStrokeReplacePreviews()
  }
}

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
          <n-button type="error" size="large" block @click="void advancedEdit.applyStrokeReplacementsToAll()">
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
  border-left: 1px solid var(--light-5);
  height: 100%;
  display: flex;
  flex-direction: column;
}
.title {
  padding: 8px 10px;
  background: var(--primary-0);
  color: var(--light-0);
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
</style>
