<script setup lang="ts">
  /**
	 * 另存为窗口
	 */
	/**
	 * dialog for saving as project
	 */

  import { useI18n } from 'vue-i18n'
  import { setSaveAsDialogVisible, saveAsDialogVisible } from '../../stores/dialogs'
  import { ref } from 'vue'
  import saveAs from 'file-saver'
  import { IFile, selectedFile } from '../../stores/files'
  import { mapToObject, plainFile, plainGlyph } from '../../menus/handlers'
  import { total, loaded, loading } from '../../stores/global'
  import { save } from '@tauri-apps/plugin-dialog'
  import { writeTextFile } from '@tauri-apps/plugin-fs'
  import { ICustomGlyph, comp_glyphs, constantGlyphMap, constants, glyphs, radical_glyphs, stroke_glyphs } from '../../stores/glyph'
  const { tm, t } = useI18n()

  const exportItems = ref({
    characters: true,
    stroke_glyphs: true,
    radical_glyphs: true,
    comp_glyphs: true,
    glyphs: true,
  })

  const handleCancel = () => {
    setSaveAsDialogVisible(false)
  }

  const handleClick = async () => {
    total.value = 0
    loaded.value = 0
    loading.value = true
    const file = plainFile(selectedFile.value as unknown as IFile)
    let _glyphs: any = []
    let _stroke_glyphs : any = []
    let _radical_glyphs : any = []
    let _comp_glyphs : any = []
    if (exportItems.value.glyphs) {
      _glyphs = glyphs.value.map((glyph: ICustomGlyph) => {
        return plainGlyph(glyph)
      })
    }
    if (exportItems.value.stroke_glyphs) {
      _stroke_glyphs = stroke_glyphs.value.map((glyph: ICustomGlyph) => {
        return plainGlyph(glyph)
      })
    }
    if (exportItems.value.radical_glyphs) {
      _radical_glyphs = radical_glyphs.value.map((glyph: ICustomGlyph) => {
        return plainGlyph(glyph)
      })
    }
    if (exportItems.value.comp_glyphs) {
      _comp_glyphs = comp_glyphs.value.map((glyph: ICustomGlyph) => {
        return plainGlyph(glyph)
      })
    }
    const data = JSON.stringify({
      file,
      constants: constants.value,
      constantGlyphMap: mapToObject(constantGlyphMap),
      version: 1.0,
      glyphs: _glyphs,
      stroke_glyphs: _stroke_glyphs,
      radical_glyphs: _radical_glyphs,
      comp_glyphs: _comp_glyphs,
    })
    
    const path = await save({
      defaultPath: `${(selectedFile.value as unknown as IFile).name}.json`,
      filters: [
        {
          name: 'JSON Filter',
          extensions: ['json'],
        },
      ],
    })
    if (path) {
      await writeTextFile(path, data)
    }

    loading.value = false
    setSaveAsDialogVisible(false)
  }
</script>

<template>
  <el-dialog
    v-model="saveAsDialogVisible"
    :title="tm('dialogs.saveAsDialog.title')"
    width="320px"
  >
    <div class="form-wrapper">
      <div class="text">{{ t('dialogs.exportDialog.exportMsg') }}</div>
      <el-checkbox
        v-model="exportItems.characters"
        class="item-check"
        disabled
      >
        {{ t('programming.character') }}
      </el-checkbox>
      <el-checkbox
        v-model="exportItems.stroke_glyphs"
        class="item-check"
      >
        {{ t('programming.stroke') }}
      </el-checkbox>
      <el-checkbox
        v-model="exportItems.radical_glyphs"
        class="item-check"
      >
        {{ t('programming.radical') }}
      </el-checkbox>
      <el-checkbox
        v-model="exportItems.comp_glyphs"
        class="item-check"
      >
        {{ t('programming.comp') }}
      </el-checkbox>
      <el-checkbox
        v-model="exportItems.glyphs"
        class="item-check"
      >
        {{ t('programming.glyph_comp') }}
      </el-checkbox>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @pointerdown="handleCancel">{{ t('dialogs.exportDialog.cancel') }}</el-button>
        <el-button type="primary" @pointerdown="handleClick">
          {{ t('dialogs.exportDialog.confirm') }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<style scoped>
  .form-wrapper {
    color: var(--light-2) !important
  }
</style>