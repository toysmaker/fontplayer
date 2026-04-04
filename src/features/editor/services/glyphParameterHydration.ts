/**
 * 从工程内字形定义补全「字符上的字形组件」里被语义裁剪掉的 enum.options（如旧版 .fp 保存时删除了 options）。
 */

import { ParameterType, type IComponent, type ICustomGlyph, type IParameter } from '@/core/types'

function parametersArrayFromGlyph(g: ICustomGlyph): IParameter[] | undefined {
  const raw = g.parameters as unknown
  if (Array.isArray(raw)) return raw as IParameter[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { parameters?: IParameter[] }).parameters)) {
    return (raw as { parameters: IParameter[] }).parameters
  }
  return undefined
}

function definitionParameterMap(library: ICustomGlyph[]): Map<string, IParameter[]> {
  const m = new Map<string, IParameter[]>()
  for (const g of library) {
    if (!g?.uuid) continue
    const arr = parametersArrayFromGlyph(g)
    if (arr?.length) m.set(g.uuid, arr)
  }
  return m
}

/**
 * 为 components 树中 type==='glyph' 的项补全 Enum 的 options（仅当当前缺失且库中同名/同 uuid 参数有 options）。
 * 递归子字形，保证后续临时脚本（如方圆黑体参数放宽）在整棵树与库同步之后再跑。
 */
export function hydrateGlyphComponentEnumOptionsFromLibrary(
  components: IComponent[] | undefined,
  library: ICustomGlyph[],
): void {
  if (!components?.length || !library.length) return
  const defMap = definitionParameterMap(library)

  const walk = (list: IComponent[] | undefined): void => {
    if (!list?.length) return
    for (const comp of list) {
      if (!comp || comp.type !== 'glyph' || !comp.value) continue
      const value = comp.value as ICustomGlyph
      const instanceParams = value.parameters
      if (Array.isArray(instanceParams)) {
        const defParams =
          (value.uuid && defMap.get(value.uuid)) ||
          (value.script_reference ? defMap.get(value.script_reference) : undefined)
        if (defParams?.length) {
          for (const ip of instanceParams as IParameter[]) {
            if (ip.type !== ParameterType.Enum) continue
            if (ip.options && ip.options.length > 0) continue
            const dp =
              defParams.find((d) => d.uuid === ip.uuid && d.type === ParameterType.Enum) ||
              defParams.find((d) => d.name === ip.name && d.type === ParameterType.Enum)
            if (dp?.options?.length) {
              ip.options = dp.options.map((o) => ({ ...o }))
            }
          }
        }
      }
      walk(value.components as IComponent[] | undefined)
    }
  }

  walk(components)
}
