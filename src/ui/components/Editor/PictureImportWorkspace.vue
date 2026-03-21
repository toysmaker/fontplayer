<script setup lang="ts">
/**
 * 识别图片完整工作区：与 CharacterEditor / GlyphEditor 同构（工具栏 + 左五阶段 + 主区 + 右参数 + 底栏）
 */
import ToolBar from '@/ui/components/ToolBar/ToolBar.vue'
import EditFilesBar from '@/ui/components/FilesBar/EditFilesBar.vue'
import BottomBar from '@/ui/components/BottomBar/BottomBar.vue'
import RightPanel from '@/ui/components/RightPanel/RightPanel.vue'
import PictureImportViewList from '@/ui/components/Editor/PictureImportViewList.vue'
import PictureImportEditor from '@/ui/components/Editor/PictureImportEditor.vue'
</script>

<template>
  <div class="picture-import-workspace">
    <header class="toolbar-wrapper">
      <ToolBar />
    </header>
    <main class="editor-content-wrapper">
      <aside class="left-panel-wrapper">
        <div class="left-panel-content">
          <PictureImportViewList />
        </div>
      </aside>
      <main class="main-wrapper">
        <header class="files-bar-wrapper">
          <EditFilesBar />
        </header>
        <div class="canvas-panel-wrapper">
          <div class="pic-import-canvas-host">
            <PictureImportEditor />
          </div>
        </div>
        <footer class="bottom-bar-wrapper">
          <BottomBar />
        </footer>
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

.toolbar-wrapper {
  flex: 0 0 50px;
  box-sizing: border-box;
}

.editor-content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: row;
  height: 0;
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

.files-bar-wrapper {
  flex: 0 0 36px;
  border-bottom: 1px solid var(--dark-4);
  background-color: white;
}

.canvas-panel-wrapper {
  flex: 1;
  overflow: hidden;
  min-height: 0;
  background-color: var(--dark-1);
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

.bottom-bar-wrapper {
  flex: 0 0 36px;
  border-top: 1px solid var(--dark-4);
  background-color: white;
}

.right-panel-wrapper {
  height: 100%;
  flex: 0 0 300px;
  border-left: 1px solid var(--dark-4);
  background-color: white;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
