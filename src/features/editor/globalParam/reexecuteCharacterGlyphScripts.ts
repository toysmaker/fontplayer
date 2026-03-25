/**
 * 用当前工程已提交的 constants（projectStore.constantsMap / getGlobalConstantsMap 为 null 时的回退）
 * 重跑「字符顶层」字形脚本，修正仅因全局常量草稿导致的内存中字形几何与 file 不一致。
 * 嵌套子字形由 executeGlyphScript 内部递归处理。
 */

import type { ICharacterFileLite, ICustomGlyph, IComponent } from '@/core/types'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { instanceManager } from '@/core/instance/InstanceManager'

export function reexecuteAllGlyphScriptsInEditingCharacter(
  ch: ICharacterFileLite | null | undefined,
): void {
  if (!ch?.components?.length) return
  for (const c of ch.components as IComponent[]) {
    if (c.type !== 'glyph' || !c.value) continue
    const gv = c.value as ICustomGlyph
    if (gv.script || gv.script_reference || gv.skeleton) {
      executeGlyphScript(gv, c.uuid)
      if (!instanceManager.isEditing(c.uuid)) {
        instanceManager.releaseTemporaryInstance(c.uuid)
      }
    }
  }
}
