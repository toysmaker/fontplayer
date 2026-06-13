<template>
  <n-modal v-model:show="visible" preset="dialog" :title="tm('dialogs.addTextDialog.title')" class="add-character-dialog" :style="{ width: '380px' }">
    <n-form :model="formData" label-placement="left" label-width="72" @submit.prevent="handleConfirm">
      <n-form-item :label="tm('dialogs.addTextDialog.title')">
        <n-input v-model:value="formData.text" :maxlength="1" show-count @keyup.enter="handleConfirm" />
      </n-form-item>
    </n-form>

    <div class="batch-section">
      <div class="batch-row">
        <n-button class="batch-btn" :type="selectedFile ? 'success' : 'default'" @click="handleBatchBtnClick" @pointerup="handleBatchBtnClick">
          <template v-if="selectedFile"><span class="check-icon">&#10003;</span>{{ t('dialogs.addTextDialog.viewSelectedChars') }}</template>
          <template v-else>{{ t('dialogs.addTextDialog.batchAddChars') }}</template>
        </n-button>
        <n-popover trigger="hover" v-if="!selectedFile"><template #trigger><span class="help-icon" style="cursor: pointer;">&#9432;</span></template><span>{{ t('dialogs.addTextDialog.batchAddCharsTip') }}</span></n-popover>
        <span v-else class="delete-icon" @click="handleClearFile" @pointerup="handleClearFile" style="cursor: pointer;">&#10005;</span>
      </div>
    </div>

    <div v-if="isTauri()" class="template-section">
      <n-checkbox v-model:checked="useTemplate">使用默认模板</n-checkbox>
      <div v-if="useTemplate" class="template-select-wrap">
        <n-form label-placement="left" label-width="72"><n-form-item label="笔画风格"><n-select v-model:value="templateStyle" :options="templateStyleOptions" placeholder="选择笔画风格" /></n-form-item></n-form>
      </div>
    </div>

    <n-modal v-model:show="showCharListModal" preset="dialog" title="已选字符列表" :style="{ width: '440px' }">
      <n-scrollbar style="max-height: 280px;"><div class="char-grid"><span v-for="(ch, idx) in displayChars" :key="idx" class="char-item">{{ ch }}</span></div></n-scrollbar>
      <div class="char-count">共 {{ selectedChars.length }} 个字符</div>
      <template #action><n-button @click="showCharListModal = false">关闭</n-button></template>
    </n-modal>

    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel" @pointerup="handleCancel">{{ t('dialogs.addTextDialog.cancel') }}</n-button>
        <n-button type="primary" @click="handleConfirm" @pointerup="handleConfirm">{{ t('dialogs.addTextDialog.confirm') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, nextTick } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton, NPopover, NScrollbar, NCheckbox, NSelect, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import type { ICharacterFileLite, ICharacterFileMetadata, ICharacterInfo } from '@/core/types'
import { EditStatus } from '@/core/types'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { genUUID } from '@/utils/uuid'
import { isTauri } from '@/utils/env'
import { createDebouncedHandler } from '@/utils/debounce-click'
import localforage from 'localforage'
import * as R from 'ramda'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { useTemplateSessionStore } from '@/stores/templateSession'
import { importTemplate2, importTemplate5, importTemplate6, importTemplate7, importTemplate8 } from '@/features/editor/menus/templatesHandlers'

const { t, tm, locale } = useI18n()
const message = useMessage()
const projectStore = useProjectStore()
const editorStore = useEditorStore()

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [value: boolean] }>()
const visible = computed({ get: () => props.show, set: (v: boolean) => emit('update:show', v) })
const formData = reactive({ text: '' })
const selectedFile = ref<File | null>(null)
const selectedChars = ref<string[]>([])
const showCharListModal = ref(false)
const displayChars = computed(() => selectedChars.value.slice(0, 500))
const useTemplate = ref(false)
const templateStyle = ref('字玩标准黑体')
const templateStyleOptions = [
  { label: '字玩标准黑体', value: '字玩标准黑体' }, { label: '字玩标准宋体', value: '字玩标准宋体' },
  { label: '字玩标准仿宋', value: '字玩标准仿宋' }, { label: '字玩标准楷体', value: '字玩标准楷体' },
  { label: '字玩标准隶书', value: '字玩标准隶书' },
]

function toUnicodeString(ch: string): string {
  if (!ch) return ''
  const code = ch.codePointAt(0) ?? 0
  return 'U+' + code.toString(16).toUpperCase().padStart(4, '0')
}

function buildCharacterInfo(width: number): ICharacterInfo {
  const size = width || 1000; const css = size / 3
  return { gridSettings: { dx: 0, dy: 0, centerSquareSize: css, size, default: true,
    initialGrid: { dx:0,dy:0,dx1:0,dx2:0,dx3:0,dx4:0,dy1:0,dy2:0,dy3:0,dy4:0,ox:500,oy:500,width:1000,height:1000,centerSquareScale:1 },
    currentGrid: { dx:0,dy:0,dx1:0,dx2:0,dx3:0,dx4:0,dy1:0,dy2:0,dy3:0,dy4:0,ox:500,oy:500,width:1000,height:1000,centerSquareScale:1 } },
    useSkeletonGrid: false, layout: '', layoutTree: [] }
}

function makeEmptyChar(fuuid: string, cuuid: string, ch: string, ul: string, width: number): ICharacterFileLite {
  return { uuid: fuuid, type: 'text', character: { uuid: cuuid, text: ch, unicode: ul },
    components: [], groups: [], orderedList: [], view: { zoom: 100, translateX: 0, translateY: 0 },
    info: buildCharacterInfo(width), selectedComponentsTree: [], selectedComponentsUUIDs: [],
    script: `function script_${fuuid.replaceAll('-', '_')}(character, constants, FP) {\n\t// Todo something\n}` }
}

const resetForm = () => { formData.text = ''; selectedFile.value = null; selectedChars.value = []; useTemplate.value = false; /* 不重置 templateStyle，保留用户选择 */ }

// ---- 批量文件选择 ----
async function pickTxtFileTauri(): Promise<File | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const { readTextFile } = await import('@tauri-apps/plugin-fs')
  const picked = await open({ multiple: false, filters: [{ name: 'Text', extensions: ['txt'] }] })
  if (picked == null) return null
  const fp = typeof picked === 'string' ? picked : (picked as any)?.path ?? null
  if (!fp) return null
  const content = await readTextFile(fp)
  return new File([content], fp.split('/').pop() || 'chars.txt', { type: 'text/plain' })
}
function pickTxtFileWeb(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.txt,text/plain'; input.style.display = 'none'
    input.onchange = () => { resolve(input.files?.[0] || null); input.remove() }
    document.body.appendChild(input); input.click()
  })
}
async function pickTxtFile() {
  try { const f = isTauri() ? await pickTxtFileTauri() : await pickTxtFileWeb(); if (!f) return
    const text = await f.text(); const chars = Array.from(new Set(Array.from(text).filter((ch: string) => ch.trim() && ch !== '\n' && ch !== '\r')))
    if (!chars.length) { message.warning('文件中没有可识别的字符'); return }; selectedFile.value = f; selectedChars.value = chars
  } catch (e: any) { console.error(e); message.warning('文件读取失败') }
}
const handleBatchBtnClick = createDebouncedHandler(() => { selectedFile.value ? (showCharListModal.value = true) : pickTxtFile() }, 'AddChar.batch')
const handleClearFile = createDebouncedHandler(() => { selectedFile.value = null; selectedChars.value = [] }, 'AddChar.clear')

// ---- 确认 ----
const _handleConfirm = async () => {
  const singleText = formData.text; const hasBatch = selectedChars.value.length > 0
  if (!singleText && !hasBatch) { message.warning(locale.value === 'en' ? 'Please input a character or select a txt file.' : '请输入字符或选择批量添加文件。'); return }
  const file = projectStore.selectedFile; if (!file) { message.error('No project file selected.'); return }

  const existingUnicodes = new Set(file.characterList?.map((m) => m.character?.unicode) || [])
  const charsToAdd: string[] = []
  if (singleText) { const ch = Array.from(singleText)[0]; if (ch === '.notdef') { message.warning('不能创建.notdef字符，该字符已自动添加'); return }; const ul = toUnicodeString(ch); if (existingUnicodes.has(ul)) { message.warning(t('dialogs.addTextDialog.duplicateUnicode')); return }; charsToAdd.push(ch) }
  if (hasBatch) { for (const ch of selectedChars.value) { if (ch === '.notdef') continue; const ul = toUnicodeString(ch); if (!existingUnicodes.has(ul) && !charsToAdd.includes(ch)) charsToAdd.push(ch) } }
  if (charsToAdd.length === 0) { message.warning('所有字符均已存在'); return }

  // 加载模板
  const tmplStore = useTemplateSessionStore()
  let tmplFileUuid: string | null = null; let tmplStrokeGlyphs: any[] = []; let tmplConstants: any[] = []; let tmplCharList: Array<{unicode:string;uuid:string}> = []
  if (useTemplate.value && isTauri()) {
    const selectedStyle = templateStyle.value
    resetForm(); visible.value = false
    projectStore.loading = true
    const data = await tmplStore.loadIfNeeded()
    if (!data) { projectStore.loading = false; message.warning('模板加载失败'); return }
    tmplFileUuid = data.fileUuid; tmplCharList = data.charList; tmplConstants = data.constants
    if (!file.stroke_glyphs) file.stroke_glyphs = []
    const existingStyles = new Set(file.stroke_glyphs.map((g: any) => g.style))
    if (!existingStyles.has(selectedStyle)) {
      const allStrokes = await tmplStore.getStrokes()
      const matched = allStrokes.filter((g: any) => g.style === selectedStyle)
      if (import.meta.env.DEV) console.log('[AddChar] style:', selectedStyle, 'existingStyles:', [...existingStyles], 'cachedStrokes:', allStrokes.length, 'matched:', matched.length)
      if (matched.length > 0) {
        for (const sg of matched) {
          const clone = JSON.parse(JSON.stringify(sg)); if (file.stroke_glyphs!.some((g: any) => g.uuid === clone.uuid)) clone.uuid = genUUID()
          file.stroke_glyphs!.push(clone)
        }; projectStore.markFileUnsaved(file.uuid)
      } else {
        // 模板无此风格 → 导入笔画脚本
        const savedStatus = editorStore.editStatus
        const importMap: Record<string, () => Promise<void>> = {
          '字玩标准黑体': importTemplate2, '字玩标准宋体': importTemplate5,
          '字玩标准仿宋': importTemplate6, '字玩标准楷体': importTemplate7,
          '字玩标准隶书': importTemplate8,
        }
        const importFn = importMap[selectedStyle]
        if (importFn) {
          try { await importFn() } catch (e) { if (import.meta.env.DEV) console.error('[AddChar] import style failed:', selectedStyle, e) }
          editorStore.setEditStatus(savedStatus)
          // 更新 IndexedDB 缓存
          const cacheDb = localforage.createInstance({ name: 'fontplayer_storage', storeName: 'template_cache' })
          await cacheDb.setItem('tmpl_strokes', JSON.stringify(file.stroke_glyphs || [])).catch(() => {})
        }
      }
    }
    tmplStrokeGlyphs = file.stroke_glyphs.filter((g: any) => g.style === selectedStyle)
    projectStore.loading = false; projectStore.loadingMessage = ''
  }

  const resolveConstant = (uuid: string): number | undefined => { const c = tmplConstants.find((x: any) => x.uuid === uuid); return c?.value !== undefined ? Number(c.value) : undefined }
  const newRecords: ICharacterFileLite[] = []; const newMetas: ICharacterFileMetadata[] = []

  for (const ch of charsToAdd) {
    const fuuid = genUUID(); const cuuid = genUUID(); const ul = toUnicodeString(ch); let lite: ICharacterFileLite
    if (tmplFileUuid && tmplCharList.length > 0 && tmplStrokeGlyphs.length > 0) {
      const normUl = ul.replace(/^U\+/i, '').toUpperCase(); const entry = tmplCharList.find((e: any) => e.unicode === normUl)
      let tmplChar = entry ? await tmplStore.loadChar(tmplFileUuid, entry.uuid) : null
      if (tmplChar) {
        tmplChar = R.clone(tmplChar)
        if ((tmplChar as any).parameters) { for (const p of ((tmplChar as any).parameters as any[])) { if (p.type === 1 && typeof p.value === 'string') { const r = resolveConstant(p.value); if (r !== undefined) { p.value = r; p.type = 0 } } } }
        for (const comp of tmplChar.components) {
          if (comp.type !== 'glyph') continue; const gc = comp as any; const glyphName = gc.value?.name || gc.name || ''
          const matched = tmplStrokeGlyphs.find((sg: any) => sg.name === glyphName); if (!matched) continue
          const newGlyph = R.clone(matched) as any
          if (newGlyph.parameters) { for (const p of newGlyph.parameters) { if (p.type === 1 && typeof p.value === 'string') { const r = resolveConstant(p.value); if (r !== undefined) { p.value = r; p.type = 0 } } } }
          const destParams = newGlyph.parameters || []; const srcParams = gc.value?.parameters || []
          for (const dp of destParams) { const sp = srcParams.find((q: any) => q.name === dp.name); if (!sp) continue; if (sp.type === 1 && typeof sp.value === 'string') { const r = resolveConstant(sp.value); if (r !== undefined) { dp.value = r; dp.type = sp.type === 3 ? 3 : 0 } else { dp.value = sp.value } } else { dp.value = sp.value } }
          gc.value = newGlyph; executeGlyphScript(newGlyph, comp.uuid)
        }
        lite = { uuid: fuuid, type: 'text', character: { uuid: cuuid, text: ch, unicode: ul }, components: tmplChar.components, groups: tmplChar.groups || [], orderedList: tmplChar.orderedList || [], view: tmplChar.view || { zoom: 100, translateX: 0, translateY: 0 }, info: tmplChar.info || buildCharacterInfo(file.width), selectedComponentsTree: [], selectedComponentsUUIDs: [], script: tmplChar.script || '' }
      } else { lite = makeEmptyChar(fuuid, cuuid, ch, ul, file.width) }
    } else { lite = makeEmptyChar(fuuid, cuuid, ch, ul, file.width) }
    newRecords.push(lite); newMetas.push({ uuid: fuuid, type: 'text', character: lite.character })
  }
  tmplCharList = []; tmplStrokeGlyphs = []; tmplConstants = []

  try {
    file.characterList.push(...newMetas); projectStore.markFileUnsaved(file.uuid)
    await characterDataManager.storeCharacters(file.uuid, newRecords)
    if (editorStore.editStatus !== EditStatus.CharacterList) editorStore.setEditStatus(EditStatus.CharacterList)
    resetForm(); visible.value = false; message.success(`已添加 ${charsToAdd.length} 个字符`)
  } catch (error: any) { console.error('Failed to add characters:', error); message.error(error?.message || '添加字符失败') }
  finally { await nextTick(); selectedChars.value = []; selectedFile.value = null }
}
const handleConfirm = createDebouncedHandler(_handleConfirm, 'AddCharacterDialog.confirm')
const _handleCancel = () => { resetForm(); visible.value = false }
const handleCancel = createDebouncedHandler(_handleCancel, 'AddCharacterDialog.cancel')
</script>

<style scoped>
.dialog-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; }
.batch-section { margin-top: 12px; }
.batch-row { display: flex; align-items: center; gap: 8px; }
.batch-btn { flex: 1; }
.check-icon { margin-right: 4px; font-weight: bold; color: #18a058; }
.help-icon { font-size: 16px; color: var(--primary-color, #2080f0); }
.delete-icon { font-size: 16px; color: #d03050; }
.char-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.char-item { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid var(--light-5); border-radius: 4px; font-size: 18px; color: var(--light-0); }
.char-count { margin-top: 12px; font-size: 13px; color: var(--light-0); text-align: center; }
.template-section { margin-top: 12px; }
.template-select-wrap { margin-top: 8px; }
</style>
