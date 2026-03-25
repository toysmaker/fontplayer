/**
 * 退出字符/字形编辑后，强制按当前工程数据重算列表缩略图并写回列表与持久化，
 * 避免仅靠「清 previewRef」仍被 CanvasManager 内容版本与内存位图缓存误判命中而显示旧预览。
 */

import { CharacterRenderer } from '@/core/font/CharacterRenderer'
import { GlyphRenderer } from '@/core/font/GlyphRenderer'
import { CanvasManager } from '@/core/canvas/CanvasManager'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { useProjectStore } from '@/stores/project'
import { useCharacterStore } from '@/stores/character'
import { useGlyphStore } from '@/stores/glyph'
import type { ICustomGlyph, IFontSettings } from '@/core/types'

const PREVIEW_W = 100
const PREVIEW_H = 100

export async function rebuildCharacterListPreviewAfterExitEdit(characterUUID: string): Promise<void> {
  const projectStore = useProjectStore()
  const file = projectStore.selectedFile
  if (!file?.uuid) return

  const ch = await characterDataManager.loadCharacter(file.uuid, characterUUID)
  if (!ch) return

  ch.previewRef = undefined
  ch.contourRef = undefined

  CanvasManager.invalidateCache(characterUUID)
  await CanvasManager.clearRenderCache(characterUUID)

  const canvas = CanvasManager.getOrCreateCanvas(characterUUID, PREVIEW_W, PREVIEW_H, true)
  if (!canvas) return

  await CharacterRenderer.renderPreview(ch, canvas, file.fontSettings)

  const idx = file.characterList.findIndex((c) => c.uuid === characterUUID)
  if (idx >= 0) {
    file.characterList[idx] = ch
  }
  await characterDataManager.updateCharacter(file.uuid, ch)

  const characterStore = useCharacterStore()
  characterStore.lastUpdatedCharacterUUID = characterUUID
  characterStore.characterListVersion++
}

export async function rebuildGlyphListPreviewAfterExitEdit(
  glyph: ICustomGlyph,
  fontSettings?: IFontSettings,
): Promise<void> {
  const uuid = glyph.uuid
  glyph.previewRef = undefined
  glyph.contourRef = undefined

  CanvasManager.invalidateCache(uuid)
  await CanvasManager.clearRenderCache(uuid)

  const canvas = CanvasManager.getOrCreateCanvas(uuid, PREVIEW_W, PREVIEW_H, true)
  if (!canvas) return

  await GlyphRenderer.renderPreview(canvas, glyph, fontSettings)

  const glyphStore = useGlyphStore()
  glyphStore.lastUpdatedGlyphUUID = uuid
  glyphStore.glyphListVersion++
}
