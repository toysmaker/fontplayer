<script setup lang="ts">
import { nextTick, onMounted, onUnmounted } from 'vue'
import { NButton, NScrollbar } from 'naive-ui'
import { useAdvancedEditStore } from '@/stores/advancedEdit'
import { useDialogsStore } from '@/stores/dialogs'

const advancedEdit = useAdvancedEditStore()
const dialogs = useDialogsStore()

onMounted(async () => {
  await advancedEdit.getStrokeListFromProject()
  await advancedEdit.updatePreviewList()
  await advancedEdit.refreshStrokeReplacePreviews()
  await nextTick()
  for (const s of advancedEdit.strokeList) {
    advancedEdit.renderStrokePreviewCanvas(s.uuid)
  }
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
  advancedEdit.renderStrokePreviewCanvas(stroke.uuid)
}

function handleSetReplacementStroke() {
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
          <n-button
            block
            :type="advancedEdit.isEditingSample ? 'success' : 'primary'"
            style="margin-bottom: 20px"
            @click="handleToggleEditSample"
          >
            {{ advancedEdit.isEditingSample ? '确认' : '编辑预览样例字符' }}
          </n-button>
        </div>
        <div class="update-section">
          <n-button type="error" size="large" block @click="advancedEdit.applyStrokeReplacementsToAll">
            一键更新全部字库
          </n-button>
        </div>
      </div>
      <div class="main">
        <div class="characters" id="advanced-edit-characters-list">
          <div
            v-for="ch in advancedEdit.sampleCharactersList"
            :key="ch.uuid"
            class="character-preview char-preview"
          >
            <span class="char-label">{{ ch.character.text }}</span>
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
              @click="handleSelectStroke(stroke)"
            >
              <div class="stroke-preview">
                <canvas
                  v-if="!stroke.replaced"
                  :class="`stroke-preview-${stroke.uuid}`"
                  width="100"
                  height="100"
                />
                <canvas
                  v-else
                  :class="`stroke-preview-${stroke.uuid}`"
                  width="100"
                  height="100"
                />
              </div>
              <div class="stroke-info">
                <div class="stroke-name">{{ stroke.name }}</div>
                <div class="stroke-style">{{ stroke.style }}</div>
                <div class="replacement-setting-btn">
                  <n-button size="small" type="primary" @click.stop="handleSetReplacementStroke">
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
  gap: 20px;
  height: 100%;
  box-sizing: border-box;
}
.sample-characters-section h3 {
  margin: 0 0 15px 0;
  color: var(--light-0);
}
.update-section {
  margin-top: auto;
}
.main {
  flex: auto;
  overflow: auto;
}
.characters {
  flex: 0 0 450px;
}
.character-preview {
  display: inline-block;
  margin: 10px;
  width: 100px;
  text-align: center;
}
.char-label {
  font-size: 12px;
  color: var(--primary-0);
}
.right {
  flex: 0 0 260px;
  border-left: 1px solid var(--light-5);
  height: 100%;
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
.stroke-list {
  padding-bottom: 20px;
}
</style>
