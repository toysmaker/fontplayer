/**
 * 脚本执行器
 * 负责执行字形脚本，生成组件
 */

import type { ICustomGlyph } from '../types'
import { instanceManager } from '../instance/InstanceManager'
import { CustomGlyph } from '../instance/CustomGlyph'
import { ConstantsMap } from './ConstantsMap'
import { getGlobalConstantsMap } from './ParametersMap'
import { useProjectStore } from '@/stores/project'
import { FP } from './FPUtils'
import { selectedFile } from './globals'
import { strokeFnMap, updateSkeletonTransformation } from '@/templates/strokeFnMap'

/**
 * 在工程尚未写入 projectStore 时（如 loadProject 中途的临时脚本），用于解析 script_reference。
 * 与 selectedFile 内字形合并，前者优先匹配。
 */
let glyphScriptLookupExtras: ICustomGlyph[] | null = null

export function setGlyphScriptLookupExtras(glyphs: ICustomGlyph[] | null): void {
  glyphScriptLookupExtras = glyphs
}

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
        ...(glyphScriptLookupExtras || []),
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

export type ExecuteGlyphScriptOptions = {
  /** 同一调用树内防止组件环导致无限递归；由内部递归传入，外部勿手动复用同一 Set */
  recursionGuard?: Set<string>
  /**
   * 为 true 时忽略「tempData 存在则直接 return」守卫。
   * 笔画模板脚本会在中途设置 glyph.tempData；与缩略图预览共用实例池时可能残留，导致列表预览恒为 0 组件空白。
   * 仅应由 GlyphRenderer 等只读预览路径传入。
   */
  ignoreTempDataGuard?: boolean
  /**
   * 字形选择弹窗等预览路径：输出 [GlyphSel] script_* 阶段日志（与 GlyphRenderer glyphSelVerbose 一致）
   */
  glyphSelVerbose?: boolean
}

function logGlyphSelScript(verbose: boolean | undefined, payload: Record<string, unknown>): void {
  if (!import.meta.env.DEV || !verbose) return
  console.log('[GlyphSel] script', payload)
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
  instanceKey?: string,
  options?: ExecuteGlyphScriptOptions,
): void {
  const key = instanceKey || targetGlyph.uuid
  const guard = options?.recursionGuard ?? new Set<string>()
  if (guard.has(key)) {
    logGlyphSelScript(options?.glyphSelVerbose, {
      phase: 'earlyExit_guard_instanceKey',
      key,
      glyphUuid: targetGlyph.uuid,
      name: targetGlyph.name,
    })
    if (import.meta.env.DEV) {
      console.warn('[executeGlyphScript] Skipping: component already in call stack:', key, targetGlyph.name)
    }
    return
  }
  // 通过字形 UUID 检测循环引用：同一字形通过不同组件实例 UUID 进入时，
  // 仍应阻止递归，否则会产生指数级展开（A→B→A 通过不同 component.uuid 绕过 key 检测）
  const glyphUuidGuardKey = 'glyph:' + targetGlyph.uuid
  if (guard.has(glyphUuidGuardKey)) {
    logGlyphSelScript(options?.glyphSelVerbose, {
      phase: 'earlyExit_guard_glyphUuid',
      key,
      glyphUuidGuardKey,
      glyphUuid: targetGlyph.uuid,
      name: targetGlyph.name,
    })
    if (import.meta.env.DEV) {
      console.warn('[executeGlyphScript] Skipping: glyph type already in call stack:', targetGlyph.uuid, targetGlyph.name)
    }
    return
  }
  guard.add(key)
  guard.add(glyphUuidGuardKey)
  instanceManager.pinTemporaryFromLRUEviction(key)

  try {
    if (import.meta.env.DEV) {
      console.log('[executeGlyphScript] CALLED:', {
        key,
        glyphUUID: targetGlyph.uuid,
        glyphName: targetGlyph.name,
      })
    }

    // 使用 instanceKey 或 targetGlyph.uuid 作为实例池的 key
    // 当从 characterFile 的 component 调用时，使用 component.uuid 确保每个组件有独立的实例
    
    // 如果字形实例缓存了数据，表示字形正在拖拽编辑中，则返回不执行脚本运行操作
    let existingInstance: CustomGlyph | null = null
    
    // 尝试获取已存在的实例
    // 重要：当传入 instanceKey（如 component.uuid）时，必须始终用该 key 占位，不能使用 getOrCreateGlyphInstance(glyph)，
    // 否则会按 glyph.uuid 存实例，导致同一字形的多个组件共享一个实例，出现「选 A 动 B」、拖拽错位、只有第一个能拖等问题。
    const isExplicitKey = instanceKey !== undefined && instanceKey !== null
    const isTemporary = instanceManager.isTemporary(key)
    
    if (isExplicitKey) {
      // 字符/字形编辑中传入的 component.uuid：只用 acquireTemporaryInstance(key)，保证每个组件独占一个实例
      existingInstance = instanceManager.acquireTemporaryInstance(
        key,
        () => new CustomGlyph(targetGlyph),
        'glyph'
      ) as CustomGlyph
    } else if (isTemporary) {
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
    
    if (existingInstance.tempData && !options?.ignoreTempDataGuard) {
      logGlyphSelScript(options?.glyphSelVerbose, {
        phase: 'earlyExit_tempData',
        key,
        glyphUuid: targetGlyph.uuid,
        name: targetGlyph.name,
        tempDataKeys: Object.keys(existingInstance.tempData),
      })
      return
    }

    // 递归执行子字形组件的脚本（必须传 component.uuid 与编辑态一致；共享 recursionGuard 防止环）
    if (targetGlyph.components) {
      for (let i = 0; i < targetGlyph.components.length; i++) {
        const component = targetGlyph.components[i]
        if (component.type === 'glyph') {
          executeGlyphScript(component.value as ICustomGlyph, component.uuid, {
            recursionGuard: guard,
            ignoreTempDataGuard: options?.ignoreTempDataGuard,
            glyphSelVerbose: options?.glyphSelVerbose,
          })
        }
      }
    }

    // 获取临时实例（用于脚本执行）
    const glyphInstance = instanceManager.acquireTemporaryInstance(
      key,
      () => new CustomGlyph(targetGlyph),
      'glyph'
    ) as CustomGlyph

    // 关键：每次执行脚本前必须清空上一次脚本生成的数据，否则 _components/_joints/_reflines 会累积，
    // 表现为“改参数后画布叠加所有历史结果”（即使 canvas clearRect 也无效，因为每次 render 都会画更多组件）。
    glyphInstance.clear()

    // 实例池中的 instance 可能是用旧的 targetGlyph 创建的，getParam() 从 _glyph.parameters 读值。
    // 若不同步为当前 targetGlyph，脚本开头读取的「水平延伸」等会一直是旧值，表现为改参数无反应。
    glyphInstance._glyph = targetGlyph

    // 处理 skeleton 类型的字形（对齐原工程 glyph.ts 1511-1524）
    // 关键点/辅助线不是通过 script 生成的，而是通过 strokeFnMap 的 instanceBasicGlyph 生成。
    // 注意：必须放在 clear() 之后，否则会被脚本执行前的 clear 清掉。
    if (targetGlyph.skeleton) {
      const skeletonObj = (targetGlyph.skeleton as any)
      const type = skeletonObj.type

      // glyphSkeleton：骨架完全由脚本中的 addJoint/addRefLine 生成，不走 strokeFnMap
      // 直接跳过此分支，让脚本正常执行
      if (type !== 'glyphSkeleton') {
        const strokeFn: any = (strokeFnMap as any)[type]
        if (strokeFn) {
          strokeFn.instanceBasicGlyph(targetGlyph, glyphInstance)
          if (skeletonObj.onSkeletonBind) {
            strokeFn.updateSkeletonListenerBeforeBind(glyphInstance)
          } else {
            strokeFn.updateSkeletonListenerAfterBind(glyphInstance)
          }
          updateSkeletonTransformation(glyphInstance)
          logGlyphSelScript(options?.glyphSelVerbose, {
            phase: 'return_after_skeleton_strokeFn',
            key,
            glyphUuid: targetGlyph.uuid,
            name: targetGlyph.name,
            skeletonType: type,
            _componentsLenAfter: glyphInstance._components?.length ?? 0,
            note: '主脚本 script 未执行（此 return 在 getScript 之前）',
          })
          return
        }
      }
    }

    // 不再维护 targetGlyph._o，统一从 InstanceManager 获取实例

    // 在 try 块外部定义变量，确保 catch 块可以访问
    let originalSelectedFile: any = null

    try {
      // 获取项目存储（用于获取 constantsMap 和 selectedFile）
      const projectStore = useProjectStore()
      
      // 优先使用 ParametersMap 当前注入的 map（高级编辑预览时 setGlobalConstantsMap 指向面板常量）
      const constantsMap =
        getGlobalConstantsMap() ||
        projectStore.constantsMap ||
        ConstantsMap.getInstance([])

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
      logGlyphSelScript(options?.glyphSelVerbose, {
        phase: 'after_getScript',
        key,
        glyphUuid: targetGlyph.uuid,
        name: targetGlyph.name,
        hasInlineScript: !!targetGlyph.script,
        script_reference: targetGlyph.script_reference ?? null,
        scriptLen: script ? script.length : 0,
        getScriptReturnedNull: !script,
      })
      if (script) {
        const scriptFunctionName = `script_${targetGlyph.uuid.replaceAll('-', '_')}`
        const scriptCode = `${script}\n${scriptFunctionName}(glyph, constantsMap, FP)`
        // console.log(`[ScriptExecutor] Executing script for glyph ${targetGlyph.uuid}:`)
        // console.log(`Script length: ${script.length} chars`)
        // console.log(`Script preview (first 500 chars):`, script.substring(0, 500))
        // console.log(`Full script:`, script)
        
        try {
          const fn = new Function(scriptCode)
          fn()
          if (import.meta.env.DEV && (targetGlyph.skeleton as any)?.type === 'glyphSkeleton') {
            console.log('[ScriptExecutor] glyphSkeleton script executed, reflines:', glyphInstance.getRefLines()?.length, 'joints:', glyphInstance.getJoints()?.length)
          }
          logGlyphSelScript(options?.glyphSelVerbose, {
            phase: 'after_main_script_fn',
            key,
            glyphUuid: targetGlyph.uuid,
            name: targetGlyph.name,
            _componentsLen: glyphInstance._components?.length ?? 0,
            _componentTypes: (glyphInstance._components || []).map((c: any) => c?.type ?? typeof c),
          })
        } catch (scriptError) {
          console.error(`[ScriptExecutor] Error executing script for "${targetGlyph.name}" (${targetGlyph.uuid}):`, scriptError)
          throw scriptError
        }
      }

      // glyphSkeleton：脚本不认 skeleton.ox/oy（custom_1 等模板使用硬编码坐标），需手动加回偏移
      if ((targetGlyph.skeleton as any)?.type === 'glyphSkeleton') {
        const skel = targetGlyph.skeleton as any
        const ox = skel.ox || 0
        const oy = skel.oy || 0
        if (ox !== 0 || oy !== 0) {
          const joints = glyphInstance.getJoints()
          for (const j of joints) {
            if ((j as any)._x !== undefined) { (j as any)._x += ox; (j as any)._y += oy }
            else if (typeof (j as any).x !== 'function' && (j as any).x !== undefined) { (j as any).x += ox; (j as any).y += oy }
          }
        }
      }

      // 执行 glyph_script（组件级别的脚本）
      if (targetGlyph.glyph_script) {
        const keys = Object.keys(targetGlyph.glyph_script)
        for (let i = 0; i < keys.length; i++) {
          const fn = new Function(targetGlyph.glyph_script[keys[i]])
          fn()
        }
      }

      // 执行 param_script（参数级别的脚本）
      if (targetGlyph.param_script) {
        const keys = Object.keys(targetGlyph.param_script)
        for (let i = 0; i < keys.length; i++) {
          const fn = new Function(targetGlyph.param_script[keys[i]])
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

      logGlyphSelScript(options?.glyphSelVerbose, {
        phase: 'inner_try_done_before_release',
        key,
        glyphUuid: targetGlyph.uuid,
        name: targetGlyph.name,
        _componentsLen: glyphInstance._components?.length ?? 0,
        _componentTypes: (glyphInstance._components || []).map((c: any) => c?.type ?? typeof c),
      })
      
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
    logGlyphSelScript(options?.glyphSelVerbose, {
      phase: 'outer_catch',
      key,
      glyphUuid: targetGlyph.uuid,
      name: targetGlyph.name,
      error: e instanceof Error ? e.message : String(e),
    })
    console.error(`Error executing glyph script for "${targetGlyph.name}" (${targetGlyph.uuid}):`, e)
    instanceManager.releaseTemporaryInstance(key)
  } finally {
    instanceManager.unpinTemporaryFromLRUEviction(key)
    guard.delete(key)
    guard.delete(glyphUuidGuardKey)
  }
}
