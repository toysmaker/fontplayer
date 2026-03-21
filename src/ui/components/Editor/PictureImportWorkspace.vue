<script setup lang="ts">
/**
 * 识别图片工作区：左五阶段 + 主画布 + 右参数（无顶栏 ToolBar / FilesBar / BottomBar，避免误切列表）
 */
import RightPanel from '@/ui/components/RightPanel/RightPanel.vue'
import { useI18n } from 'vue-i18n'
import PictureImportViewList from '@/ui/components/Editor/PictureImportViewList.vue'
import PictureImportEditor from '@/ui/components/Editor/PictureImportEditor.vue'

const { t } = useI18n()
</script>

<template>
  <div class="picture-import-workspace">
    <main class="editor-content-wrapper">
      <aside class="left-panel-wrapper">
        <div class="left-panel-header">
          {{ t('panels.view') }}
        </div>
        <div class="left-panel-content">
          <PictureImportViewList />
        </div>
      </aside>
      <main class="main-wrapper">
        <div class="canvas-panel-wrapper">
          <div class="pic-import-canvas-host">
            <PictureImportEditor />
          </div>
        </div>
      </main>
      <aside class="right-panel-wrapper">
        <RightPanel />
      </aside>
    </main>
  </div>
</template>

<style scoped>
.picture-import-workspace {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-content-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

.left-panel-wrapper {
  height: 100%;
  flex: 0 0 200px;
  border-right: 1px solid var(--dark-4);
  background-color: var(--dark-0);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.left-panel-header {
  flex: 0 0 auto;
  width: 100%;
  border-bottom: 1px solid var(--dark-4);
  line-height: 36px;
  padding: 5px 15px 8px 15px;
  box-sizing: border-box;
  color: var(--primary-5);
}

.left-panel-content {
  flex: 1;
  overflow: hidden;
  height: 0;
  display: flex;
  flex-direction: column;
}

.left-panel-content :deep(.picture-import-view-list) {
  flex: 1;
  width: 100%;
  min-width: 0;
  border-right: none;
}

.main-wrapper {
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.canvas-panel-wrapper {
  flex: 1;
  overflow: hidden;
  min-height: 0;
  background-color: #fff;
}

.pic-import-canvas-host {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.pic-import-canvas-host :deep(.picture-import-editor) {
  flex: 1;
  min-height: 0;
}

.right-panel-wrapper {
  height: 100%;
  flex: 0 0 300px;
  background-color: var(--dark-0);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
