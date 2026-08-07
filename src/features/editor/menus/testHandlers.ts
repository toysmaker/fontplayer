/**
 * 测试菜单处理器（仅 DEV 环境可见）
 */

import type { MenuHandlerContext, MenuHandlersMap } from './menuHandlerTypes'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'

/**
 * 深拷贝并清理一个对象中的运行时缓存字段
 */
function cleanValueForExport(value: any): any {
  if (!value || typeof value !== 'object') return value
  const cleaned = { ...value }
  // 移除运行时图片数据
  delete cleaned.img
  delete cleaned.originImg
  delete cleaned.pixels
  // 移除 InstanceManager 引用
  delete cleaned._o
  // 递归清理子组件
  if (cleaned.components && Array.isArray(cleaned.components)) {
    cleaned.components = cleaned.components.map((c: any) => cleanComponentForExport(c))
  }
  return cleaned
}

function cleanComponentForExport(comp: any): any {
  const cleaned: any = {}
  for (const key of Object.keys(comp)) {
    if (key === '_o') continue
    const val = comp[key]
    if (key === 'value') {
      cleaned.value = cleanValueForExport(val)
    } else {
      cleaned[key] = val
    }
  }
  return cleaned
}

/**
 * 运行字形脚本并生成 objData
 * objData 包含 _components（脚本生成的组件及其 contour 数据）、_joints、_reflines
 */
async function bakeGlyphObjData(glyph: any): Promise<any> {
  if (!glyph.script && !glyph.script_reference) return null

  try {
    // 执行字形脚本
    executeGlyphScript(glyph, glyph.uuid)

    // 获取实例
    const instance = instanceManager.acquireTemporaryInstance(
      glyph.uuid,
      () => new CustomGlyph(glyph),
      'glyph',
    )

    if (!instance) return null

    // 提取脚本生成的组件数据（含 contour）
    const scriptComponents = ((instance as any)._components || []).map((comp: any) => {
      if (typeof comp.getData === 'function') {
        return comp.getData()
      }
      // fallback: 提取关键字段
      return {
        points: comp.points,
        type: comp.type,
        hasPathBegan: comp.hasPathBegan,
        usedInCharacter: comp.usedInCharacter,
        contour: comp.contour,
        preview: comp.preview,
      }
    })

    // 提取 joints 和 reflines
    const joints = ((instance as any)._joints || []).map((j: any) => ({
      _x: j._x ?? j.x,
      _y: j._y ?? j.y,
      uuid: j.uuid,
      name: j.name,
    }))

    const reflines = ((instance as any)._reflines || []).map((r: any) => ({
      name: r.name,
      start: r.start,
      end: r.end,
      type: r.type,
    }))

    const objData: any = {}
    if (scriptComponents.length > 0) objData._components = scriptComponents
    if (joints.length > 0) objData._joints = joints
    if (reflines.length > 0) objData._reflines = reflines

    // 释放临时实例
    if (instanceManager.isTemporary(glyph.uuid)) {
      instanceManager.releaseTemporaryInstance(glyph.uuid)
    }

    return Object.keys(objData).length > 0 ? objData : null
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn(`[testHandlers] bakeGlyphObjData failed for "${glyph.name}":`, e)
    }
    return null
  }
}

/**
 * 清理并保留 contour/preview 数据（与 plainCharacter 相反——保留几何数据用于纯 JSON 导出）
 */
function plainCharacterWithContours(character: any): any {
  const data: any = {
    uuid: character.uuid,
    type: character.type,
    character: character.character,
    components: (character.components || []).map((component: any) => {
      const cleanComponent: any = {}
      for (const key of Object.keys(component)) {
        if (key === '_o') continue
        if (key === 'value') {
          cleanComponent.value = cleanValueForExport(component.value)
        } else {
          cleanComponent[key] = component[key]
        }
      }
      return cleanComponent
    }),
    groups: character.groups || [],
    orderedList: character.orderedList || [],
    selectedComponentsUUIDs: character.selectedComponentsUUIDs || [],
    script: character.script || '',
    view: character.view || { zoom: 1, translateX: 0, translateY: 0 },
    glyph_script: character.glyph_script || {},
    info: character.info || {},
  }
  return data
}

export function createTestHandlers(ctx: MenuHandlerContext): MenuHandlersMap {
  const { message, t, projectStore } = ctx

  const handleExportDevJson = async () => {
    const file = projectStore.selectedFile
    if (!file) {
      message.error(t('menus.test.noFile'))
      return
    }

    const store = projectStore
    const total = file.characterList?.length || 0
    store.loadingMessage = '正在导出纯 JSON 工程（含 contour 数据）...'
    store.loadingTotal = total
    store.loadingProgress = 0
    store.loading = true

    try {
      const { characterDataManager } = await import('@/core/storage/CharacterDataManager')

      // 1. 加载所有字符
      const characterList: any[] = []
      for (let i = 0; i < file.characterList.length; i++) {
        const metadata = file.characterList[i]
        const ch = await characterDataManager.loadCharacter(file.uuid, metadata.uuid)
        if (ch) {
          characterList.push(plainCharacterWithContours(ch))
        }
        store.loadingProgress = i + 1
      }

      // 2. 烘焙所有字形：执行脚本生成 objData
      const allGlyphLists = [
        { key: 'glyphs', list: file.glyphs },
        { key: 'stroke_glyphs', list: file.stroke_glyphs },
        { key: 'radical_glyphs', list: file.radical_glyphs },
        { key: 'comp_glyphs', list: file.comp_glyphs },
      ]

      const bakedGlyphs: Record<string, any[]> = {}

      for (const { key, list } of allGlyphLists) {
        if (!list || list.length === 0) {
          bakedGlyphs[key] = []
          continue
        }

        const baked: any[] = []
        for (const glyph of list) {
          const cleanGlyph: any = { ...glyph }
          delete cleanGlyph._o

          // 清理子组件
          if (cleanGlyph.components) {
            cleanGlyph.components = cleanGlyph.components.map((c: any) => cleanComponentForExport(c))
          }

          // 执行脚本生成 objData
          const objData = await bakeGlyphObjData(glyph)
          if (objData) {
            cleanGlyph.objData = objData
          }

          baked.push(cleanGlyph)
        }
        bakedGlyphs[key] = baked
      }

      // 3. 对字符中的字形组件也烘焙 objData
      //    遍历所有已加载的字符，对其中的 glyph 组件执行脚本
      for (const chData of characterList) {
        // 需要从原始加载的数据中获取 glyph 组件的完整 value（包括 script）
        const rawCh = await characterDataManager.loadCharacter(file.uuid, chData.uuid)
        if (!rawCh?.components) continue

        for (let ci = 0; ci < rawCh.components.length; ci++) {
          const comp = rawCh.components[ci]
          if (comp.type !== 'glyph') continue

          const glyphValue: any = comp.value
          if (!glyphValue || !glyphValue.script_reference) continue

          // 执行脚本生成 objData
          const objData = await bakeGlyphObjData(glyphValue)
          if (objData && (chData.components[ci] as any)?.value) {
            ;(chData.components[ci] as any).value.objData = objData
          }
        }
      }

      // 4. 组装最终 JSON
      const projectData = {
        version: '2.0',
        file: {
          uuid: file.uuid,
          name: file.name,
          width: file.width,
          height: file.height,
          saved: true,
          iconsCount: (file as any).iconsCount,
          fontSettings: file.fontSettings,
          characterList,
          variants: (file as any).variants,
        },
        glyphs: bakedGlyphs.glyphs,
        stroke_glyphs: bakedGlyphs.stroke_glyphs,
        radical_glyphs: bakedGlyphs.radical_glyphs,
        comp_glyphs: bakedGlyphs.comp_glyphs,
        constants: file.constants || [],
      }

      // 5. 下载
      const json = JSON.stringify(projectData)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${file.name}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      message.success(t('menus.test.exportSuccess'))
    } catch (error) {
      console.error('[testHandlers] export dev JSON failed:', error)
      message.error((error as Error).message || t('menus.test.exportFailed'))
    } finally {
      store.loading = false
      store.loadingProgress = 0
      store.loadingTotal = 0
      store.loadingMessage = ''
      try {
        const { characterDataManager } = await import('@/core/storage/CharacterDataManager')
        characterDataManager.forceCleanupAllCache()
      } catch { /* ignore */ }
    }
  }

  const handleExportSkeletonParams = async () => {
    const file = projectStore.selectedFile
    if (!file) { message.error('请先打开工程'); return }
    if (!file.stroke_glyphs?.length) { message.error('工程中没有笔画字形'); return }

    const store = projectStore
    const total = file.characterList?.length || 0
    store.loading = true; store.loadingTotal = total; store.loadingProgress = 0
    store.loadingMessage = '正在导出骨架与参数...'

    try {
      const { characterDataManager } = await import('@/core/storage/CharacterDataManager')
      const result: any[] = []

      for (let i = 0; i < file.characterList.length; i++) {
        const meta = file.characterList[i]
        const ch = await characterDataManager.loadCharacter(file.uuid, meta.uuid)
        if (!ch) continue

        const charEntry: any = { name: ch.character?.text || meta.character?.text, strokes: [] }
        const components = (ch.orderedList?.length ? ch.orderedList.map((o: any) =>
          ch.components.find((c: any) => c.uuid === o.uuid)).filter(Boolean) : ch.components) || []

        for (const comp of components) {
          if (comp.type !== 'glyph') continue
          const gv = comp.value as any
          const strokeName = gv?.name || comp.name || ''

          // 获取 glyph 实例的 joints（需先执行脚本让骨架生成）
          let skeletonJoints: any[] = []
          try {
            executeGlyphScript(gv, comp.uuid, { ignoreTempDataGuard: true })
            const inst = instanceManager.acquireTemporaryInstance(
              comp.uuid,
              () => new CustomGlyph(gv),
              'glyph'
            ) as any
            if (inst) {
              const joints = inst.getJoints?.() || inst._joints || []
              skeletonJoints = joints.map((j: any) => ({
                name: j.name || '',
                x: j._x ?? j.x ?? 0,
                y: j._y ?? j.y ?? 0,
              }))
              if (instanceManager.isTemporary(comp.uuid)) {
                instanceManager.releaseTemporaryInstance(comp.uuid)
              }
            }
          } catch { /* ignore */ }

          // 分离 skeletonParams 和 constantParams
          // Constant/Enum 类型参数只导出 name 和 value（保留原始值供导入时 setParam 使用）
          const allParams = gv?.parameters || []
          const constantNames = new Set(['起笔风格','起笔数值','转角风格','转角数值','收笔风格','收笔数值','运笔风格','运笔数值','字重变化','弯曲程度','字重比率','字重','参考位置'])
          const skeletonParams: any[] = []
          const constantParams: any[] = []
          for (const p of allParams) {
            const entry = { name: p.name, value: p.value, type: p.type }
            if (constantNames.has(p.name)) {
              constantParams.push(entry)
            } else {
              skeletonParams.push(entry)
            }
          }

          charEntry.strokes.push({
            name: strokeName,
            ox: (comp as any).ox ?? 0,
            oy: (comp as any).oy ?? 0,
            skeletonParams,
            constantParams,
            skeletonJoints,
          })
        }
        result.push(charEntry)
        store.loadingProgress = i + 1
      }

      const json = JSON.stringify(result, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${file.name}_skeleton_params.json`; a.click()
      URL.revokeObjectURL(url)
      message.success('导出成功')
    } catch (e) {
      console.error(e); message.error(String(e))
    } finally {
      projectStore.loading = false; projectStore.loadingProgress = 0; projectStore.loadingTotal = 0; projectStore.loadingMessage = ''
    }
  }

  const handleImportFromParams = async () => {
    const file = projectStore.selectedFile
    if (!file) { message.error('请先打开工程'); return }
    if (!file.stroke_glyphs?.length) { message.error('工程中没有笔画字形（需先导入模板）'); return }

    // 打开文件选择器
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'
    input.onchange = async () => {
      const f = input.files?.[0]; if (!f) return
      try {
        const text = await f.text()
        const data = JSON.parse(text)
        if (!Array.isArray(data)) { message.error('JSON 格式错误：应为数组'); return }

        const { characterDataManager } = await import('@/core/storage/CharacterDataManager')
        const { genUUID } = await import('@/utils/uuid')
        const store = projectStore; store.loading = true
        store.loadingTotal = data.length; store.loadingProgress = 0
        store.loadingMessage = '正在根据参数生成字符...'

        for (let i = 0; i < data.length; i++) {
          const entry = data[i]
          const charUUID = genUUID()
          const fileUUID = genUUID()
          const charLite: any = {
            uuid: fileUUID, type: 'text',
            character: { uuid: charUUID, text: entry.name, unicode: '' },
            components: [], orderedList: [], groups: [],
            view: { zoom: 100, translateX: 0, translateY: 0 },
            selectedComponentsTree: [], selectedComponentsUUIDs: [],
            script: '', parameters: [],
          }
          for (const stroke of entry.strokes || []) {
            const glyphData = file.stroke_glyphs.find((g: any) => g.name === stroke.name)
            if (!glyphData) continue
            const compUUID = genUUID()
            const gv = JSON.parse(JSON.stringify(glyphData))
            // 设置参数：通过临时实例的 setParam 统一处理（含 Constant→Number 转换）
            {
              const tmpInst = instanceManager.acquireTemporaryInstance(
                compUUID, () => new CustomGlyph(gv), 'glyph'
              ) as any
              if (tmpInst) {
                const allParams = [...(stroke.skeletonParams || []), ...(stroke.constantParams || [])]
                for (const p of allParams) {
                  if (typeof p.value === 'number') tmpInst.setParam(p.name, p.value)
                }
                if (instanceManager.isTemporary(compUUID)) instanceManager.releaseTemporaryInstance(compUUID)
              }
            }
            charLite.components.push({
              uuid: compUUID, type: 'glyph', name: stroke.name,
              lock: false, visible: true, usedInCharacter: true,
              x: 0, y: 0, w: 0, h: 0, rotation: 0, flipX: false, flipY: false,
              ox: stroke.ox ?? 0, oy: stroke.oy ?? 0,
              value: gv,
            })
            charLite.orderedList.push({ type: 'component', uuid: compUUID })
          }
          await characterDataManager.storeCharacters(file.uuid, [charLite])
          file.characterList.push({
            uuid: fileUUID, type: 'text',
            character: charLite.character,
          })
          store.loadingProgress = i + 1
        }
        projectStore.markFileUnsaved(file.uuid)
        window.dispatchEvent(new CustomEvent('force-character-list-refresh'))
        message.success(`已生成 ${data.length} 个字符`)
      } catch (e) { console.error(e); message.error(String(e)) }
      finally { projectStore.loading = false; projectStore.loadingProgress = 0; projectStore.loadingTotal = 0; projectStore.loadingMessage = '' }
    }
    input.click()
  }

  const handleImportFromSkeleton = async () => {
    const file = projectStore.selectedFile
    if (!file) { message.error('请先打开工程'); return }
    if (!file.stroke_glyphs?.length) { message.error('工程中没有笔画字形（需先导入模板）'); return }

    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'
    input.onchange = async () => {
      const f = input.files?.[0]; if (!f) return
      try {
        const text = await f.text()
        const data = JSON.parse(text)
        if (!Array.isArray(data)) { message.error('JSON 格式错误：应为数组'); return }

        const { characterDataManager } = await import('@/core/storage/CharacterDataManager')
        const { genUUID } = await import('@/utils/uuid')
        const store = projectStore; store.loading = true
        store.loadingTotal = data.length; store.loadingProgress = 0
        store.loadingMessage = '正在根据骨架计算参数并生成字符...'

        // 动态导入 kai computeParamsByJoints
        const kaiModules: Record<string, any> = {}
        for (const stroke of (data[0]?.strokes || [])) {
          const name = stroke.name
          if (!kaiModules[name]) {
            try { kaiModules[name] = await import(`@/templates/kai/${name}.ts`) } catch { /* ignore */ }
          }
        }

        for (let i = 0; i < data.length; i++) {
          const entry = data[i]
          const charUUID = genUUID()
          const fileUUID = genUUID()
          const charLite: any = {
            uuid: fileUUID, type: 'text',
            character: { uuid: charUUID, text: entry.name, unicode: '' },
            components: [], orderedList: [], groups: [],
            view: { zoom: 100, translateX: 0, translateY: 0 },
            selectedComponentsTree: [], selectedComponentsUUIDs: [],
            script: '', parameters: [],
          }
          for (const stroke of entry.strokes || []) {
            const glyphData = file.stroke_glyphs.find((g: any) => g.name === stroke.name)
            if (!glyphData) continue
            const compUUID = genUUID()
            const gv = JSON.parse(JSON.stringify(glyphData))

            // 根据骨架计算参数
            const mod = kaiModules[stroke.name]
            if (mod?.computeParamsByJoints && stroke.skeletonJoints?.length) {
              const jointsMap: any = {}
              for (const j of stroke.skeletonJoints) {
                jointsMap[j.name] = { x: j.x, y: j.y, name: j.name }
              }
              try {
                // 创建临时实例以传给 computeParamsByJoints
                const tmpInst = instanceManager.acquireTemporaryInstance(
                  compUUID, () => new CustomGlyph(gv), 'glyph'
                ) as any
                const computed = mod.computeParamsByJoints(jointsMap, tmpInst)
                if (computed) {
                  for (const key of Object.keys(computed)) {
                    const target = (gv.parameters || []).find((gp: any) => gp.name === key)
                    if (target && target.type === 0) target.value = computed[key]
                  }
                }
                // skeleton params 是动态的，constant params 仍需从 JSON 设置
                for (const p of (stroke.constantParams || [])) {
                  if (typeof p.value === 'number') tmpInst.setParam(p.name, p.value)
                }
                if (instanceManager.isTemporary(compUUID)) {
                  instanceManager.releaseTemporaryInstance(compUUID)
                }
              } catch { /* ignore */ }
            }

            charLite.components.push({
              uuid: compUUID, type: 'glyph', name: stroke.name,
              lock: false, visible: true, usedInCharacter: true,
              x: 0, y: 0, w: 0, h: 0, rotation: 0, flipX: false, flipY: false,
              ox: stroke.ox ?? 0, oy: stroke.oy ?? 0,
              value: gv,
            })
            charLite.orderedList.push({ type: 'component', uuid: compUUID })
          }
          await characterDataManager.storeCharacters(file.uuid, [charLite])
          file.characterList.push({
            uuid: fileUUID, type: 'text',
            character: charLite.character,
          })
          store.loadingProgress = i + 1
        }
        projectStore.markFileUnsaved(file.uuid)
        window.dispatchEvent(new CustomEvent('force-character-list-refresh'))
        message.success(`已生成 ${data.length} 个字符`)
      } catch (e) { console.error(e); message.error(String(e)) }
      finally { projectStore.loading = false; projectStore.loadingProgress = 0; projectStore.loadingTotal = 0; projectStore.loadingMessage = '' }
    }
    input.click()
  }

  return {
    'test-export-json': handleExportDevJson,
    'test-export-skeleton-params': handleExportSkeletonParams,
    'test-import-from-params': handleImportFromParams,
    'test-import-from-skeleton': handleImportFromSkeleton,
  }
}
