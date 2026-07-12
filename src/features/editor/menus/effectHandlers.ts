/**
 * 效果菜单处理器
 * 为每个效果滤镜创建菜单点击回调
 */

import type { MenuHandlerContext, MenuHandlersMap } from './menuHandlerTypes'
import { useEffectStore } from '@/features/effects/effectStore'

export function createEffectHandlers(ctx: MenuHandlerContext): MenuHandlersMap {
  const { message, characterStore, t } = ctx

  /**
   * 通用效果启动器
   */
  function startEffectHandler(effectType: string) {
    return () => {
      const effectStore = useEffectStore()

      // 已有其他效果激活时，弹提示并中断
      if (effectStore.isActive && effectStore.effectType !== effectType) {
        message.warning(t('effects.effectPanelActive'))
        return
      }

      const editing = characterStore.editingCharacter
      if (!editing) {
        message.info(t('effects.noCharacterEditing'))
        return
      }

      // 检查是否有 pen 组件
      const penComps = (editing.components || []).filter((c) => c.type === 'pen')
      if (penComps.length === 0) {
        message.info(t('effects.noPenComponents'))
        return
      }

      effectStore.startEffect(effectType)
    }
  }

  return {
    'effect-adjust-weight': startEffectHandler('adjust-weight'),
    'effect-ink-bleed': startEffectHandler('ink-bleed'),
    'effect-rough-edge': startEffectHandler('rough-edge'),
    'effect-glitch': startEffectHandler('glitch'),
    'effect-hand-drawn-jitter': startEffectHandler('hand-drawn-jitter'),
    'effect-melt': startEffectHandler('melt'),
    'effect-geometric-simplify': startEffectHandler('geometric-simplify'),
    'effect-pixelate': startEffectHandler('pixelate'),
  }
}
