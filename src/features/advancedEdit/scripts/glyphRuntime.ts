import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import type { ICustomGlyph, IGlyphComponent } from '@/core/types'

/** 高级编辑脚本用：按组件 uuid 取临时 CustomGlyph 实例（与 ContourConverter 一致） */
export function glyphRuntime(comp: IGlyphComponent): CustomGlyph | null {
  const gv = comp.value as ICustomGlyph
  if (!gv) return null
  try {
    executeGlyphScript(gv, comp.uuid)
    return instanceManager.acquireTemporaryInstance(
      comp.uuid,
      () => new CustomGlyph(gv),
      'glyph',
    ) as CustomGlyph
  } catch {
    return null
  }
}
