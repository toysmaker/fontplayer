<template>
  <div class="parameter-editor">
    <n-form v-if="component" :model="component" label-placement="left" label-width="100">
      <!-- 基础属性 -->
      <n-form-item label="X偏移">
        <n-input-number v-model:value="component.ox" :min="0" />
      </n-form-item>
      <n-form-item label="Y偏移">
        <n-input-number v-model:value="component.oy" :min="0" />
      </n-form-item>
      <n-form-item label="宽度">
        <n-input-number v-model:value="component.w" :min="0" />
      </n-form-item>
      <n-form-item label="高度">
        <n-input-number v-model:value="component.h" :min="0" />
      </n-form-item>
      <n-form-item label="旋转">
        <n-input-number v-model:value="component.rotation" :min="0" :max="360" />
      </n-form-item>
      <n-form-item label="透明度">
        <n-slider v-model:value="opacity" :min="0" :max="100" />
      </n-form-item>
      
      <!-- 如果是字形组件，显示参数 -->
      <template v-if="isGlyphComponent">
        <n-divider />
        <div v-for="(param, index) in glyphParameters" :key="(param as any).uuid || param.name || index" class="parameter-item">
          <n-form-item :label="(param as any).name || `参数 ${index + 1}`">
            <n-input-number
              v-if="(param as any).type === ParameterType.Number"
              v-model:value="(param as any).value"
              :min="(param as any).min"
              :max="(param as any).max"
            />
            <n-switch v-else-if="(param as any).type === ParameterType.Constant" v-model:value="(param as any).value" />
            <n-select
              v-else-if="(param as any).type === ParameterType.Enum"
              v-model:value="(param as any).value"
              :options="(param as any).options"
            />
          </n-form-item>
        </div>
      </template>
    </n-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NForm, NFormItem, NInputNumber, NSlider, NSwitch, NSelect, NDivider } from 'naive-ui'
import { ParameterType } from '@/core/types'
import type { IComponent, IGlyphComponent, ICustomGlyph } from '@/core/types'
import { useGlyphStore } from '@/stores/glyph'
import { useCharacterStore } from '@/stores/character'

const props = defineProps<{
  component: IComponent | IGlyphComponent
}>()

const glyphStore = useGlyphStore()
const characterStore = useCharacterStore()

const opacity = ref(props.component.opacity || 100)

// 监听组件变化，更新参数
watch(() => props.component, (component) => {
  if (component) {
    opacity.value = component.opacity || 100
  }
}, { deep: true })

// 监听参数变化，更新store
watch([opacity, () => props.component.ox, () => props.component.oy, () => props.component.w, () => props.component.h, () => props.component.rotation], () => {
  if (props.component) {
    const updates = {
      opacity: opacity.value,
      ox: props.component.ox,
      oy: props.component.oy,
      w: props.component.w,
      h: props.component.h,
      rotation: props.component.rotation,
    }
    
    // 根据组件类型更新对应的store
    if (props.component.type === 'glyph') {
      glyphStore.updateComponent(props.component.uuid, updates as any)
    } else {
      characterStore.updateComponent(props.component.uuid, updates)
    }
  }
}, { deep: true })

const isGlyphComponent = computed(() => {
  return props.component.type === 'glyph'
})

const glyphParameters = computed(() => {
  if (!isGlyphComponent.value) return []
  
  const glyphValue = props.component.value as any
  if (!glyphValue || typeof glyphValue !== 'object') return []
  
  // 如果 value 是字形组件，尝试获取字形对象
  const glyph = (glyphValue.uuid ? glyphValue : null) as ICustomGlyph | null
  if (!glyph || !glyph.parameters) return []
  
  if (Array.isArray(glyph.parameters)) {
    return glyph.parameters
  }
  
  // 处理 Map 类型（虽然类型定义是 Array，但运行时可能是 Map）
  const params = glyph.parameters as any
  if (params && typeof params === 'object' && typeof params.values === 'function') {
    try {
      return Array.from(params.values())
    } catch {
      return []
    }
  }
  
  return []
})

// 监听字形参数变化，更新store
watch(() => glyphParameters.value, (params) => {
  if (isGlyphComponent.value && glyphStore.editingGlyph) {
    params.forEach(param => {
      const paramObj = param as any
      if (paramObj.name && paramObj.value !== undefined) {
        glyphStore.updateGlyphParameter(glyphStore.editingGlyph!.uuid, paramObj.name, paramObj.value)
      }
    })
  }
}, { deep: true })
</script>

<style scoped>
.parameter-editor {
  padding: 16px;
}

.parameter-item {
  margin-bottom: 16px;
}
</style>
