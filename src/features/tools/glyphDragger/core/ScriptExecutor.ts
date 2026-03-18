/**
 * 脚本执行器
 * 负责执行字形脚本中的骨架拖拽回调
 * 注意：使用实例管理器获取实例，而不是 glyph._o
 */

import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'
import type { ICustomGlyph } from '@/core/types'
import type { IDragEvent, IJoint } from './types'

export class ScriptExecutor {
  /**
   * 获取字形实例（从实例管理器）
   * @param glyph 字形对象
   * @param componentUUID 组件的 UUID，用作 instanceKey
   */
  private static getGlyphInstance(
    glyph: ICustomGlyph,
    componentUUID: string
  ): CustomGlyph | null {
    // 使用 componentUUID 作为 instanceKey，而不是 glyph.uuid
    const instanceKey = componentUUID
    
    // 如果临时实例已存在，直接获取
    if (instanceManager.isTemporary(instanceKey)) {
      const instance = instanceManager.acquireTemporaryInstance(
        instanceKey,
        () => new CustomGlyph(glyph),
        'glyph'
      ) as CustomGlyph
      
      if (import.meta.env.DEV) {
        console.log('[ScriptExecutor.getGlyphInstance] Got existing temporary instance:', {
          instanceKey,
          hasOnSkeletonDragStart: !!instance.onSkeletonDragStart,
          hasOnSkeletonDrag: !!instance.onSkeletonDrag,
          hasOnSkeletonDragEnd: !!instance.onSkeletonDragEnd,
          hasTempData: !!instance.tempData
        })
      }
      
      return instance
    }
    
    // 否则尝试获取或创建实例
    const instance = instanceManager.acquireTemporaryInstance(
      instanceKey,
      () => new CustomGlyph(glyph),
      'glyph'
    ) as CustomGlyph
    
    if (import.meta.env.DEV) {
      console.log('[ScriptExecutor.getGlyphInstance] Created new instance:', {
        instanceKey,
        hasOnSkeletonDragStart: !!instance.onSkeletonDragStart,
        hasOnSkeletonDrag: !!instance.onSkeletonDrag,
        hasOnSkeletonDragEnd: !!instance.onSkeletonDragEnd,
        hasTempData: !!instance.tempData
      })
    }
    
    return instance
  }

  /**
   * 执行拖拽开始回调
   */
  static executeDragStart(
    glyph: ICustomGlyph,
    componentUUID: string,
    joint: IJoint
  ): void {
    const glyphInstance = this.getGlyphInstance(glyph, componentUUID)
    if (!glyphInstance) {
      console.warn('[ScriptExecutor.executeDragStart] No glyph instance found for', componentUUID)
      return
    }
    
    if (import.meta.env.DEV) {
      console.log('[ScriptExecutor.executeDragStart] Before callback:', {
        componentUUID,
        hasOnSkeletonDragStart: !!glyphInstance.onSkeletonDragStart,
        hasTempData: !!glyphInstance.tempData,
        joint: joint.name
      })
    }
    
    // 从实例获取回调函数（如果存在）
    if (glyphInstance.onSkeletonDragStart) {
      try {
        glyphInstance.onSkeletonDragStart({
          draggingJoint: joint,
          deltaX: 0,
          deltaY: 0
        })
        
        if (import.meta.env.DEV) {
          console.log('[ScriptExecutor.executeDragStart] After callback:', {
            componentUUID,
            hasTempData: !!glyphInstance.tempData,
            tempDataKeys: glyphInstance.tempData ? Object.keys(glyphInstance.tempData) : []
          })
        }
      } catch (error) {
        console.error('Error in onSkeletonDragStart:', error)
      }
    } else {
      if (import.meta.env.DEV) {
        console.warn('[ScriptExecutor.executeDragStart] No onSkeletonDragStart callback for', componentUUID)
      }
    }
  }

  /**
   * 执行拖拽中回调
   */
  static executeDrag(
    glyph: ICustomGlyph,
    componentUUID: string,
    event: IDragEvent
  ): void {
    const glyphInstance = this.getGlyphInstance(glyph, componentUUID)
    if (!glyphInstance) {
      console.warn('[ScriptExecutor.executeDrag] No glyph instance found for', componentUUID)
      return
    }
    
    if (import.meta.env.DEV) {
      const componentsBefore = glyphInstance._components?.length || 0
      console.log('[ScriptExecutor.executeDrag] Before onSkeletonDrag:', {
        componentUUID,
        hasOnSkeletonDrag: !!glyphInstance.onSkeletonDrag,
        hasTempData: !!glyphInstance.tempData,
        componentsCount: componentsBefore,
        event: event
      })
    }
    
    if (glyphInstance.onSkeletonDrag) {
      try {
        glyphInstance.onSkeletonDrag(event)
        
        if (import.meta.env.DEV) {
          const componentsAfter = glyphInstance._components?.length || 0
          console.log('[ScriptExecutor.executeDrag] After onSkeletonDrag:', {
            componentUUID,
            componentsCount: componentsAfter,
            componentsChanged: componentsAfter !== (glyphInstance._components?.length || 0)
          })
        }
      } catch (error) {
        console.error('Error in onSkeletonDrag:', error)
      }
    } else {
      if (import.meta.env.DEV) {
        console.warn('[ScriptExecutor.executeDrag] No onSkeletonDrag callback for', componentUUID)
      }
    }
  }

  /**
   * 执行拖拽结束回调
   */
  static executeDragEnd(
    glyph: ICustomGlyph,
    componentUUID: string,
    event: IDragEvent
  ): void {
    const glyphInstance = this.getGlyphInstance(glyph, componentUUID)
    if (!glyphInstance) {
      if (import.meta.env.DEV) {
        console.warn('[ScriptExecutor.executeDragEnd] No glyph instance found for', componentUUID)
      }
      return
    }
    
    if (import.meta.env.DEV) {
      const paramsBefore = glyphInstance._glyph.parameters?.map((p: any) => ({ name: p.name, value: p.value })) || []
      console.log('[ScriptExecutor.executeDragEnd] Before onSkeletonDragEnd:', {
        componentUUID,
        hasOnSkeletonDragEnd: !!glyphInstance.onSkeletonDragEnd,
        hasTempData: !!glyphInstance.tempData,
        parametersBefore: paramsBefore
      })
    }
    
    if (glyphInstance.onSkeletonDragEnd) {
      try {
        const paramsBefore = glyphInstance._glyph.parameters?.map((p: any) => ({ name: p.name, value: p.value })) || []
        glyphInstance.onSkeletonDragEnd(event)

        // 拖拽结束后清理 tempData，避免后续 executeGlyphScript 因 tempData 而跳过（导致参数修改不生效）。
        glyphInstance.tempData = null
        
        if (import.meta.env.DEV) {
          const paramsAfter = glyphInstance._glyph.parameters?.map((p: any) => ({ name: p.name, value: p.value })) || []
          const paramChanges: any[] = []
          for (let i = 0; i < Math.max(paramsBefore.length, paramsAfter.length); i++) {
            const oldParam = paramsBefore[i]
            const newParam = paramsAfter[i]
            if (oldParam && newParam && oldParam.value !== newParam.value) {
              paramChanges.push({
                name: oldParam.name,
                oldValue: oldParam.value,
                newValue: newParam.value
              })
            }
          }
          console.log('[ScriptExecutor.executeDragEnd] After onSkeletonDragEnd:', {
            componentUUID,
            hasTempData: !!glyphInstance.tempData,
            parametersAfter: paramsAfter,
            paramChanges: paramChanges.length > 0 ? paramChanges : 'NO CHANGES',
            allParamsBefore: paramsBefore,
            allParamsAfter: paramsAfter
          })
        }
      } catch (error) {
        console.error('Error in onSkeletonDragEnd:', error)
      }
    } else {
      if (import.meta.env.DEV) {
        console.warn('[ScriptExecutor.executeDragEnd] No onSkeletonDragEnd callback for', componentUUID, '- parameters will be synced from onSkeletonDrag')
      }
      // 没有回调也要清理 tempData（如果有）
      glyphInstance.tempData = null
    }
  }
}
