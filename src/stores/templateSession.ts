/**
 * 模板进程级缓存 Store。
 * 仅存 fileUuid（1个字符串），索引/字形/常量全部在 IndexedDB template_cache store。
 * app 重启清空，同一进程内复用。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import localforage from 'localforage'
import { projectLoader } from '@/features/editor/services/ProjectLoader'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import type { ICharacterFileLite, ICustomGlyph, IFile } from '@/core/types'

export const useTemplateSessionStore = defineStore('templateSession', () => {
  const fileUuid = ref<string | null>(null)

  function getCacheDb() {
    return localforage.createInstance({ name: 'fontplayer_storage', storeName: 'template_cache' })
  }

  async function loadIfNeeded(): Promise<{
    fileUuid: string; strokes: ICustomGlyph[]; constants: any[]
    charList: Array<{ unicode: string; uuid: string }>
  } | null> {
    const db = getCacheDb()

    if (fileUuid.value) {
      const charList = JSON.parse((await db.getItem<string>('tmpl_char_list').catch(() => '[]')) || '[]')
      const constants = JSON.parse((await db.getItem<string>('tmpl_constants').catch(() => '[]')) || '[]')
      return { fileUuid: fileUuid.value, strokes: [], constants, charList }
    }

    const PROGRESS_MSG = '首次使用模板需要加载，请稍候'

    const { readFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
    let u8: Uint8Array
    let tmplFile: IFile
    try {
      u8 = await readFile('resources/default-template.fp', { baseDir: BaseDirectory.Resource })
      const buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
      tmplFile = await projectLoader.loadProjectFromFpArrayBuffer(buf, PROGRESS_MSG)
    } catch {
      u8 = await readFile('resources/default-template.fpz', { baseDir: BaseDirectory.Resource })
      const buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
      tmplFile = await projectLoader.loadProjectFromFpzArrayBuffer(buf, PROGRESS_MSG)
    }

    fileUuid.value = tmplFile.uuid

    const charList = (tmplFile.characterList || []).map((m: any) => ({
      unicode: (m.character?.unicode || '').replace(/^U\+/i, '').toUpperCase(),
      uuid: m.uuid,
    }))
    const strokes = (tmplFile as any).stroke_glyphs || tmplFile.stroke_glyphs || []
    const constants = (tmplFile as any).constants || []

    await db.setItem('tmpl_char_list', JSON.stringify(charList)).catch(() => {})
    await db.setItem('tmpl_strokes', JSON.stringify(strokes)).catch(() => {})
    await db.setItem('tmpl_constants', JSON.stringify(constants)).catch(() => {})

    return { fileUuid: tmplFile.uuid, strokes, constants, charList }
  }

  async function getStrokes(): Promise<ICustomGlyph[]> {
    const db = getCacheDb()
    return JSON.parse((await db.getItem<string>('tmpl_strokes').catch(() => '[]')) || '[]')
  }

  function loadChar(fileUuid: string, charUuid: string): Promise<ICharacterFileLite | null> {
    return characterDataManager.loadCharacter(fileUuid, charUuid)
  }

  return { fileUuid, loadIfNeeded, getStrokes, loadChar }
})
