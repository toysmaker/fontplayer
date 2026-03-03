/**
 * 工程文件迁移工具
 * 将旧版工程文件格式转换为新版格式
 */

import type { IFile, ICharacterFileLite } from '@/core/types'
import { indexedDBManager, IndexedDBManager } from '@/core/storage/IndexedDBManager'

export class ProjectMigrator {
  /**
   * 迁移工程文件
   */
  async migrate(oldData: any): Promise<any> {
    const migrated: any = {
      version: '2.0', // 新版本号
      file: await this.migrateFile(oldData.file),
      glyphs: oldData.glyphs || [],
      stroke_glyphs: oldData.stroke_glyphs || [],
      radical_glyphs: oldData.radical_glyphs || [],
      comp_glyphs: oldData.comp_glyphs || [],
      constants: oldData.constants || [],
      constantGlyphMap: oldData.constantGlyphMap || {},
    }

    return migrated
  }

  /**
   * 迁移文件数据
   */
  private async migrateFile(oldFile: any): Promise<Partial<IFile>> {
    const newFile: Partial<IFile> = {
      uuid: oldFile.uuid,
      name: oldFile.name,
      width: oldFile.width,
      height: oldFile.height,
      saved: false, // 迁移后标记为未保存
      iconsCount: oldFile.characterList?.length || 0,
      fontSettings: oldFile.fontSettings,
      variants: oldFile.variants,
      characterList: [],
    }

    // 迁移字符列表
    if (oldFile.characterList && Array.isArray(oldFile.characterList)) {
      const characterList: ICharacterFileLite[] = []
      
      for (const oldCharacter of oldFile.characterList) {
        const newCharacter = await this.migrateCharacter(oldCharacter)
        characterList.push(newCharacter)
      }
      
      newFile.characterList = characterList
    }

    return newFile
  }

  /**
   * 迁移字符数据
   */
  private async migrateCharacter(oldCharacter: any): Promise<ICharacterFileLite> {
    const newCharacter: ICharacterFileLite = {
      uuid: oldCharacter.uuid,
      type: oldCharacter.type,
      character: oldCharacter.character,
      components: oldCharacter.components || [],
      groups: oldCharacter.groups || [],
      orderedList: oldCharacter.orderedList || [],
      view: oldCharacter.view || { zoom: 100, translateX: 0, translateY: 0 },
      info: oldCharacter.info,
      selectedComponentsTree: oldCharacter.selectedComponentsTree,
      selectedComponentsUUIDs: oldCharacter.selectedComponentsUUIDs,
      script: oldCharacter.script,
      glyph_script: oldCharacter.glyph_script,
    }

    // 如果有轮廓数据，迁移到IndexedDB
    if (oldCharacter.contour || oldCharacter.overlap_removed_contours) {
      const contourData = oldCharacter.overlap_removed_contours || oldCharacter.contour
      if (contourData) {
        const contourKey = IndexedDBManager.generateContourKey(oldCharacter.uuid)
        await indexedDBManager.set(contourKey, contourData)
        newCharacter.contourRef = contourKey
      }
    }

    // 如果有预览数据，迁移到IndexedDB
    if (oldCharacter.preview) {
      const previewKey = IndexedDBManager.generatePreviewKey(oldCharacter.uuid)
      await indexedDBManager.set(previewKey, oldCharacter.preview)
      newCharacter.previewRef = previewKey
    }

    // 移除大型数据字段（已迁移到IndexedDB）
    // 注意：不删除 _o，因为可能需要延迟实例化

    return newCharacter
  }

  /**
   * 检查是否需要迁移
   */
  static needsMigration(data: any): boolean {
    debugger
    // 检查版本号
    if (data.version === '2.0') {
      return false
    }

    // 检查是否有旧格式的特征
    if (data.file?.characterList) {
      const firstChar = data.file.characterList[0]
      if (firstChar && (firstChar.contour || firstChar.overlap_removed_contours)) {
        // 如果有轮廓数据直接存储在字符对象中，需要迁移
        return !firstChar.contourRef && !firstChar.previewRef
      }
    }

    return false
  }
}

// 导出单例
export const projectMigrator = new ProjectMigrator()
