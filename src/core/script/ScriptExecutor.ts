/**
 * 脚本执行器
 * 负责执行字形脚本，生成组件
 */

import type { ICustomGlyph } from '../types'
import { instanceManager } from '../instance/InstanceManager'
import { CustomGlyph } from '../instance/CustomGlyph'
import { ConstantsMap } from './ConstantsMap'
import { useProjectStore } from '@/stores/project'
import { FP } from './FPUtils'
import { selectedFile } from './globals'

/**
 * 获取脚本字符串
 */
function getScript(glyph: ICustomGlyph, projectStore?: ReturnType<typeof useProjectStore>): string | null {
  if (glyph.script) {
    return glyph.script
  } else if (glyph.script_reference) {
    // 从项目存储中查找引用的字形
    if (projectStore) {
      const allGlyphs = [
        ...(projectStore.selectedFile?.glyphs || []),
        ...(projectStore.selectedFile?.stroke_glyphs || []),
        ...(projectStore.selectedFile?.radical_glyphs || []),
        ...(projectStore.selectedFile?.comp_glyphs || []),
      ]
      const originGlyph = allGlyphs.find(g => g.uuid === glyph.script_reference)
      if (originGlyph && originGlyph.script) {
        return originGlyph.script
      }
    }
    console.warn(`Script reference ${glyph.script_reference} not found`)
  }
  return null
}

/**
 * 执行字形脚本
 * 使用临时实例机制，执行完后自动释放
 * @param targetGlyph 目标字形对象
 * @param instanceKey 可选的实例key，用于区分不同的组件实例（默认使用 targetGlyph.uuid）
 *                    当从 characterFile 的 component 调用时，应该传入 component.uuid
 */
export function executeGlyphScript(
  targetGlyph: ICustomGlyph,
  instanceKey?: string
): void {
  const key = instanceKey || targetGlyph.uuid
  console.log('[executeGlyphScript] CALLED:', {
    key,
    glyphUUID: targetGlyph.uuid,
    glyphName: targetGlyph.name,
    stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
  })
  
  try {
    // 使用 instanceKey 或 targetGlyph.uuid 作为实例池的 key
    // 当从 characterFile 的 component 调用时，使用 component.uuid 确保每个组件有独立的实例
    
    // 如果字形实例缓存了数据，表示字形正在拖拽编辑中，则返回不执行脚本运行操作
    let existingInstance: CustomGlyph | null = null
    
    // 尝试获取已存在的实例
    const isTemporary = instanceManager.isTemporary(key)
    console.log('[executeGlyphScript] Instance check:', {
      key,
      isTemporary
    })
    
    if (isTemporary) {
      existingInstance = instanceManager.acquireTemporaryInstance(
        key,
        () => new CustomGlyph(targetGlyph),
        'glyph'
      ) as CustomGlyph
    } else {
      existingInstance = instanceManager.getOrCreateGlyphInstance(
      targetGlyph,
      () => new CustomGlyph(targetGlyph)
    ) as CustomGlyph
    }
    
    // 添加调试信息：检查实例的来源
    if (import.meta.env.DEV) {
      const instancePool = (instanceManager as any).instancePool
      const poolInstance = instancePool?.get(key)
      const isEditing = instanceManager.isEditing(key)
      const isTemporaryAfter = instanceManager.isTemporary(key)
      
      console.log('[executeGlyphScript] Got instance:', {
        key,
        glyphUUID: targetGlyph.uuid,
        glyphName: targetGlyph.name,
        hasInstance: !!existingInstance,
        instanceUUID: existingInstance?.uuid,
        instanceType: existingInstance?.type,
        hasTempData: !!existingInstance?.tempData,
        tempDataKeys: existingInstance?.tempData ? Object.keys(existingInstance.tempData) : [],
        componentsCount: existingInstance?._components?.length || 0,
        isEditing,
        isTemporary: isTemporaryAfter,
        poolInstanceExists: !!poolInstance,
        poolInstanceUUID: poolInstance?.uuid,
        poolInstanceComponentsCount: poolInstance?._components?.length || 0,
        instancePoolSize: instancePool?.size || 0,
        allInstanceKeys: instancePool ? Array.from(instancePool.keys()) : [],
        // 检查实例是否来自不同的 glyph（可能是缓存错误）
        instanceGlyphUUID: existingInstance?._glyph?.uuid,
        targetGlyphUUID: targetGlyph.uuid,
        glyphUUIDMatch: existingInstance?._glyph?.uuid === targetGlyph.uuid
      })
    }
    
    if (existingInstance.tempData) {
      console.log('[executeGlyphScript] ⚠️ SKIPPING script execution due to tempData:', {
          key,
          tempDataKeys: Object.keys(existingInstance.tempData),
          componentsCount: existingInstance._components?.length || 0
        })
      return
    }
    
    console.log('[executeGlyphScript] ✅ Proceeding with script execution (no tempData)')

    // TODO: 处理 skeleton 类型的字形
    // if (targetGlyph.skeleton) {
    //   const strokeFn = strokeFnMap[targetGlyph.skeleton.type]
    //   if (strokeFn) {
    //     strokeFn.instanceBasicGlyph(targetGlyph)
    //     return
    //   }
    // }

    // 递归执行子字形组件的脚本
    if (targetGlyph.components) {
      for (let i = 0; i < targetGlyph.components.length; i++) {
        const component = targetGlyph.components[i]
        if (component.type === 'glyph') {
          executeGlyphScript(component.value as ICustomGlyph)
        }
      }
    }

    // 获取临时实例（用于脚本执行）
    const glyphInstance = instanceManager.acquireTemporaryInstance(
      key,
      () => new CustomGlyph(targetGlyph),
      'glyph'
    ) as CustomGlyph
    
    // 不再维护 targetGlyph._o，统一从 InstanceManager 获取实例

    // 在 try 块外部定义变量，确保 catch 块可以访问
    let originalSelectedFile: any = null

    try {
      // 获取项目存储（用于获取 constantsMap 和 selectedFile）
      const projectStore = useProjectStore()
      
      // 从 store 获取统一的 constantsMap（使用单例模式）
      const constantsMap = projectStore.constantsMap || ConstantsMap.getInstance([])

      // 注入 selectedFile 到脚本执行环境的全局状态
      originalSelectedFile = selectedFile.value
      selectedFile.value = projectStore.selectedFile

      // 设置全局变量（脚本执行环境）
      const originalGlyph = (window as any).glyph
      const originalConstantsMap = (window as any).constantsMap
      const originalFP = (window as any).FP
      
      ;(window as any).glyph = glyphInstance
      ;(window as any).constantsMap = constantsMap
      ;(window as any).FP = FP
      ;(window as any).instanceManager = instanceManager // 注入 instanceManager 供脚本使用

      // 执行主脚本
      const script = getScript(targetGlyph, projectStore)
      if (script) {
        const scriptFunctionName = `script_${targetGlyph.uuid.replaceAll('-', '_')}`
        const scriptCode = `${script}\n${scriptFunctionName}(glyph, constantsMap, FP)`
        // console.log(`[ScriptExecutor] Executing script for glyph ${targetGlyph.uuid}:`)
        // console.log(`Script length: ${script.length} chars`)
        // console.log(`Script preview (first 500 chars):`, script.substring(0, 500))
        // console.log(`Full script:`, script)
        
        // 在执行脚本前检查组件数量和参数值
        const componentsBefore = glyphInstance._components?.length || 0
        console.log(`[ScriptExecutor] Components before script execution: ${componentsBefore}`)
        
        // 检查关键参数的值（用于调试）
        const startStyleType = glyphInstance.getParam('起笔风格')
        const weight = glyphInstance.getParam('字重')
        const horizontalSpan = glyphInstance.getParam('水平延伸')
        const verticalSpan = glyphInstance.getParam('竖直延伸')
        console.log(`[ScriptExecutor] Key parameters before execution for ${targetGlyph.uuid}:`, {
          '起笔风格': startStyleType,
          '字重': weight,
          '水平延伸': horizontalSpan,
          '竖直延伸': verticalSpan,
          'parameters array length': targetGlyph.parameters?.length || 0,
          'parameters array': targetGlyph.parameters?.map((p: any) => ({ name: p.name, value: p.value })) || [],
        })
        
        try {
          const fn = new Function(scriptCode)
          fn()
          
          // 在执行脚本后立即检查组件状态
          const componentsAfter = glyphInstance._components?.length || 0
          console.log(`[ScriptExecutor] Components after script execution: ${componentsAfter}`)
          if (componentsAfter > componentsBefore) {
            // 检查新添加的组件
            for (let i = componentsBefore; i < componentsAfter; i++) {
              const comp = glyphInstance._components[i]
              console.log(`[ScriptExecutor] New component ${i}:`, {
                type: comp.type,
                points: comp.points?.length || 0,
                hasPathBegan: comp.hasPathBegan,
                preview: comp.preview?.length || 0,
                contour: comp.contour?.length || 0,
              })
            }
          }
        } catch (scriptError) {
          console.error(`[ScriptExecutor] Error executing script for ${targetGlyph.uuid}:`, scriptError)
          throw scriptError
        }
      } else {
        console.log(`[ScriptExecutor] No script found for glyph ${targetGlyph.uuid}`)
      }

      // 执行 glyph_script（组件级别的脚本）
      if (targetGlyph.glyph_script) {
        const keys = Object.keys(targetGlyph.glyph_script)
        console.log(`[ScriptExecutor] Executing ${keys.length} glyph_script(s) for glyph ${targetGlyph.uuid}`)
        for (let i = 0; i < keys.length; i++) {
          const script = targetGlyph.glyph_script[keys[i]]
          console.log(`  glyph_script[${keys[i]}]:`, script.substring(0, 200))
          const fn = new Function(script)
          fn()
        }
      }

      // 执行 param_script（参数级别的脚本）
      if (targetGlyph.param_script) {
        const keys = Object.keys(targetGlyph.param_script)
        console.log(`[ScriptExecutor] Executing ${keys.length} param_script(s) for glyph ${targetGlyph.uuid}`)
        for (let i = 0; i < keys.length; i++) {
          const script = targetGlyph.param_script[keys[i]]
          console.log(`  param_script[${keys[i]}]:`, script.substring(0, 200))
          const fn = new Function(script)
          fn()
        }
      }

      // 执行 system_script（系统级别的脚本）
      if (targetGlyph.components) {
        targetGlyph.components.forEach((component) => {
          if (component.type === 'glyph') {
            const compGlyph = component.value as ICustomGlyph
            if (compGlyph.system_script) {
              const originalCompGlyph = (window as any).comp_glyph
              ;(window as any).comp_glyph = instanceManager.acquireTemporaryInstance(
                compGlyph.uuid,
                () => new CustomGlyph(compGlyph),
                'glyph'
              )
              
              const keys = Object.keys(compGlyph.system_script)
              for (let i = 0; i < keys.length; i++) {
                const script = compGlyph.system_script[keys[i]]
                const fn = new Function(script)
                fn()
              }
              
              instanceManager.releaseTemporaryInstance(compGlyph.uuid)
              ;(window as any).comp_glyph = originalCompGlyph
            }
          }
        })
      }

      // 恢复全局变量
      ;(window as any).glyph = originalGlyph
      ;(window as any).constantsMap = originalConstantsMap
      ;(window as any).FP = originalFP
      
      // 恢复 selectedFile
      if (originalSelectedFile !== undefined) {
        selectedFile.value = originalSelectedFile
      }
      
      // 调试：检查脚本执行后组件的数量和状态
      const componentsCount = glyphInstance._components?.length || 0
      if (componentsCount > 0) {
        console.log(`Script executed for ${targetGlyph.uuid}, generated ${componentsCount} components`)
        // 检查每个组件的状态
        glyphInstance._components.forEach((comp: any, index: number) => {
          const pointsCount = comp.points?.length || 0
          const previewCount = comp.preview?.length || 0
          const contourCount = comp.contour?.length || 0
          const hasPathBegan = comp.hasPathBegan
          console.log(`  Component ${index} (${comp.type}): points=${pointsCount}, preview=${previewCount}, contour=${contourCount}, hasPathBegan=${hasPathBegan}`)
          // 如果是 PenComponent，打印 points 的详细信息
          if (comp.type === 'glyph-pen' && comp.points) {
            console.log(`    Points detail:`, comp.points.map((p: any, i: number) => 
              `[${i}] type=${p.type}, x=${p.x}, y=${p.y}, origin=${p.origin}`
            ).join(', '))
          }
        })
      } else {
        console.warn(`Script executed for ${targetGlyph.uuid}, but no components were generated`)
      }
      
      // 注意：不在这里释放临时实例，因为转换轮廓时还需要访问实例的 _components
      // 实例会在转换完成后由调用者释放，或者由实例池的 LRU 策略管理
    } catch (innerError) {
      // 如果脚本执行出错，立即释放实例
      instanceManager.releaseTemporaryInstance(key)
      // 恢复 selectedFile
      if (originalSelectedFile !== undefined) {
        selectedFile.value = originalSelectedFile
      }
      throw innerError
    }
  } catch (e) {
    console.error('Error executing glyph script:', e)
    // 确保在错误时也释放实例（如果内层 catch 没有释放）
    // 注意：如果内层 catch 已经释放了，这里再次释放是安全的（releaseTemporaryInstance 会检查）
    const key = instanceKey || targetGlyph.uuid
    instanceManager.releaseTemporaryInstance(key)
  }
}
