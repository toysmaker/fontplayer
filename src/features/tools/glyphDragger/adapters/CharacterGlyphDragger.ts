/**
 * 字符界面字形组件拖拽器
 * 处理字符编辑界面中的字形组件拖拽
 */

import { BaseGlyphDragger } from '../core/BaseGlyphDragger'
import { JointManager } from '../core/JointManager'
import type { IDragContext, IDraggerConfig, IJoint } from '../core/types'
import type { IComponent } from '@/core/types'

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
    const { component } = this.context
    
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
