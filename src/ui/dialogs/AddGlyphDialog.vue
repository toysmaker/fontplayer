<template>
  <n-modal
    v-model:show="visible"
    preset="dialog"
    :title="tm('dialogs.addGlyphDialog.title')"
    class="add-glyph-dialog"
    :style="{ width: '360px' }"
  >
    <n-form
      :model="formData"
      label-placement="left"
      label-width="100"
      @submit.prevent="handleConfirm"
    >
      <n-form-item :label="tm('dialogs.addGlyphDialog.glyphName')">
        <n-input
          v-model:value="formData.name"
          :maxlength="100"
          show-count
          @keyup.enter="handleConfirm"
        />
      </n-form-item>
    </n-form>
    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel" @pointerup="handleCancel">
          {{ t('dialogs.addGlyphDialog.cancel') }}
        </n-button>
        <n-button type="primary" @click="handleConfirm" @pointerup="handleConfirm">
          {{ t('dialogs.addGlyphDialog.confirm') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { ICustomGlyph } from '@/core/types'
import { useProjectStore } from '@/stores/project'
import { useGlyphStore } from '@/stores/glyph'
import { genUUID } from '@/utils/uuid'
import { createDebouncedHandler } from '@/utils/debounce-click'

type GlyphCategory = 'glyphs' | 'stroke_glyphs' | 'radical_glyphs' | 'comp_glyphs'

const { t, tm, locale } = useI18n()
const message = useMessage()
const projectStore = useProjectStore()
const glyphStore = useGlyphStore()

const props = defineProps<{
  show: boolean
  category?: GlyphCategory
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

const formData = reactive({
  name: '',
})

const resetForm = () => {
  formData.name = ''
}

const _handleConfirm = async () => {
  const name = formData.name.trim()
  if (!name) {
    const msg =
      locale.value === 'en'
        ? "Please input glyph's name."
        : '请输入字形名称。'
    message.warning(msg)
    return
  }

  const file = projectStore.selectedFile
  if (!file) {
    message.error('No project file selected.')
    return
  }

  const uuid = genUUID()
  const glyph: ICustomGlyph = {
    uuid,
    name,
    type: 'system',
    components: [],
    groups: [],
    orderedList: [],
    selectedComponentsTree: [],
    selectedComponentsUUIDs: [],
    script: `function script_${uuid.replaceAll('-', '_')}(glyph, constants, FP) {\n\t// Todo something\n}`,
    parameters: [],
    joints: [],
    reflines: [],
    view: {
      zoom: 100,
      translateX: 0,
      translateY: 0,
    },
  }

  const category: GlyphCategory = props.category || glyphStore.glyphCategory || 'glyphs'

  if (!file[category]) {
    (file as any)[category] = []
  }

  try {
    ;(file[category] as ICustomGlyph[]).push(glyph)
    glyphStore.glyphCategory = category
    glyphStore.setEditGlyphByUUID(glyph.uuid, category)
    projectStore.markFileUnsaved(file.uuid)

    resetForm()
    visible.value = false
  } catch (error: any) {
    console.error('Failed to add glyph:', error)
    message.error(error?.message || '添加字形失败')
  }
}

const handleConfirm = createDebouncedHandler(_handleConfirm, 'AddGlyphDialog.confirm')

const _handleCancel = () => {
  resetForm()
  visible.value = false
}

const handleCancel = createDebouncedHandler(_handleCancel, 'AddGlyphDialog.cancel')
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
</style>

