/**
 * 字符界面字形组件拖拽器
 * 处理字符编辑界面中的字形组件拖拽
 */

import { BaseGlyphDragger } from '../core/BaseGlyphDragger'
import { JointManager } from '../core/JointManager'
import type { IDragContext, IDraggerConfig, IJoint } from '../core/types'
import type { IComponent, ICustomGlyph, IGlyphComponent } from '@/core/types'
import { instanceManager } from '@/core/instance/InstanceManager'
import { CustomGlyph } from '@/core/instance/CustomGlyph'

export class CharacterGlyphDragger extends BaseGlyphDragger {
  private characterStore: any = null

  constructor(config: IDraggerConfig) {
    super(config)
    // 从配置中获取store实例
    this.characterStore = config.characterStore
  }
  protected getJoints(): IJoint[] {
    const { component, componentUUID } = this.context
    // 获取正确的原点坐标（考虑子组件的累积偏移）
    const origin = this.getOrigin()
    // 传入正确的 ox, oy 以确保 joints 坐标计算正确
    return JointManager.getJoints(component, componentUUID, origin.ox, origin.oy)
  }
  
  protected getOrigin(): { ox: number; oy: number } {
    const { component, rootComponent, selectedComponentsTree } = this.context
    
    // 如果有根组件和选择树，计算子组件的原点
    if (rootComponent && selectedComponentsTree && selectedComponentsTree.length > 1) {
      return this.calculateSubComponentOrigin(rootComponent, selectedComponentsTree)
    }
    
    // 否则使用组件自身的原点
    return {
      ox: (component as IComponent).ox,
      oy: (component as IComponent).oy
    }
  }
  
  private calculateSubComponentOrigin(
    rootComponent: IComponent,
    selectedComponentsTree: string[]
  ): { ox: number; oy: number } {
    let ox = rootComponent.ox
    let oy = rootComponent.oy
    let current: any = rootComponent
    
    // 遍历选择树，累加偏移量
    for (let i = 1; i < selectedComponentsTree.length - 1; i++) {
      const compUUID = selectedComponentsTree[i]
      const comp = this.findComponentByUUID(current.value?.components || [], compUUID)
      if (comp) {
        ox += comp.ox
        oy += comp.oy
        current = comp
      }
    }
    
    return { ox, oy }
  }
  
  private findComponentByUUID(components: any[], uuid: string): any {
    for (const comp of components) {
      if (comp.uuid === uuid) return comp
      if (comp.value?.components) {
        const found = this.findComponentByUUID(comp.value.components, uuid)
        if (found) return found
      }
    }
    return null
  }

  protected getSnapKeyLinePeers(
    excludeComponentUuid: string,
  ): Array<IComponent | IGlyphComponent> {
    const list = this.characterStore?.editingCharacter?.components ?? []
    return list.filter(
      (c): c is IComponent =>
        c.type === 'glyph' && c.uuid !== excludeComponentUuid,
    )
  }

  protected handleGlyphDrag(dx: number, dy: number): void {
    const { component } = this.context
    
    // 获取拖拽开始时的初始位置
    const initialOrigin = this.getInitialOrigin()
    
    // 使用初始值加上增量来计算新位置（而不是累加）
    const comp = component as IComponent
    comp.ox = initialOrigin.ox + dx
    comp.oy = initialOrigin.oy + dy
    
    this.config.onUpdate?.(comp)
    
    // 更新store（如果可用）
    if (this.characterStore) {
      this.characterStore.updateComponent(comp.uuid, comp)
    }
  }
  
  protected handleDragEnd(): void {
    const { component, componentUUID, glyph } = this.context
    
    // 如果是骨架拖拽，需要从字形实例获取最新的参数，并同步到 component.value
    if (glyph && component.type === 'glyph') {
      // 获取字形实例（使用 componentUUID 作为 instanceKey）
      // 注意：executeDragEnd 已经在 onMouseUp 中被调用，此时实例应该已经更新了参数
      // 使用 acquireTemporaryInstance，因为拖拽过程中实例已经被创建为临时实例
      // 重要：如果实例不存在，使用 component.value（可能已经更新）而不是 this.context.glyph
      const currentGlyphValue = (component as IComponent).value as ICustomGlyph
      const glyphInstance = instanceManager.acquireTemporaryInstance(
        componentUUID,
        () => new CustomGlyph(currentGlyphValue || glyph),
        'glyph'
      ) as CustomGlyph
      
      if (import.meta.env.DEV) {
        console.log('[CharacterGlyphDragger.handleDragEnd] Got instance:', {
          componentUUID,
          hasInstance: !!glyphInstance,
          hasParameters: !!glyphInstance?._glyph?.parameters,
          parametersLength: glyphInstance?._glyph?.parameters?.length || 0,
          hasTempData: !!glyphInstance?.tempData,
          // 比较当前 component.value 的参数
          currentParametersLength: (component.value as any)?.parameters?.length || 0
        })
      }
      
      if (glyphInstance && glyphInstance._glyph.parameters) {
        // 从字形实例获取最新的参数（使用 _glyph 而不是传入的 glyph）
        const updatedGlyphValue: ICustomGlyph = {
          ...glyphInstance._glyph, // 使用实例的 _glyph，确保包含所有最新数据
          parameters: [...(glyphInstance._glyph.parameters || [])], // 创建新数组以触发响应式更新
        }
        
        if (import.meta.env.DEV) {
          // 详细比较参数值，看看是否真的发生了变化
          const oldParams = (component.value as any)?.parameters || []
          const newParams = updatedGlyphValue.parameters || []
          const paramChanges: any[] = []
          
          for (let i = 0; i < Math.max(oldParams.length, newParams.length); i++) {
            const oldParam = oldParams[i]
            const newParam = newParams[i]
            if (oldParam && newParam) {
              if (oldParam.value !== newParam.value) {
                paramChanges.push({
                  name: oldParam.name,
                  oldValue: oldParam.value,
                  newValue: newParam.value
                })
              }
            }
          }
          
          console.log('[CharacterGlyphDragger.handleDragEnd] Updating component.value:', {
            componentUUID,
            oldParametersCount: oldParams.length,
            newParametersCount: newParams.length,
            paramChanges: paramChanges.length > 0 ? paramChanges : 'NO CHANGES',
            allOldParams: oldParams.map((p: any) => ({ name: p.name, value: p.value })),
            allNewParams: newParams.map((p: any) => ({ name: p.name, value: p.value }))
          })
        }
        
        // 更新 component.value
        ;(component as IComponent).value = updatedGlyphValue
        
        // 使用 modifyComponent 来更新 store（它会正确处理 value 对象的合并）
        if (this.characterStore) {
          this.characterStore.modifyComponent((component as IComponent).uuid, {
            value: updatedGlyphValue,
          })
          if (import.meta.env.DEV) {
            console.log('[CharacterGlyphDragger.handleDragEnd] Parameters synced to component.value for', componentUUID)
          }
        }
      } else {
        if (import.meta.env.DEV) {
          console.warn('[CharacterGlyphDragger.handleDragEnd] No instance or parameters found:', {
            componentUUID,
            hasInstance: !!glyphInstance,
            hasParameters: !!glyphInstance?._glyph?.parameters
          })
        }
      }
    }
    
    // 字符界面的拖拽结束处理
    this.config.onUpdate?.(component)
    
    // 更新store（如果可用）
    if (this.characterStore) {
      this.characterStore.updateComponent((component as IComponent).uuid, component)
    }
  }
  
  updateConfig(config: Partial<IDraggerConfig>): void {
    super.updateConfig(config)
    // 如果配置中包含store，更新它
    if ((config as any).characterStore) {
      this.characterStore = (config as any).characterStore
    }
  }
}
