<script setup lang="ts">
	/**
	 * 字形组件参数编辑面板
	 */
	/**
	 * params editing panel for glyph
	 */

  import { getRatioOptions, ParameterType, getConstant, IParameter, executeScript, editGlyph, IRingParameter, IParameter2, getRatioLayout, ICustomGlyph, selectedParam, selectedParamType, constantGlyphMap, ConstantType, getGlyphByUUID, GlyphType } from '../../stores/glyph'
  import { useI18n } from 'vue-i18n'
  import { emitter } from '../../Event/bus'
  import { checkJoints, checkRefLines } from '../../stores/global'
	import RingController from '../../components/Widgets/RingController.vue'
  import { editing as editingLayout } from '../../stores/glyphLayoutResizer_glyph'
	import { nextTick, onMounted, ref, watch } from 'vue'
	import { CustomGlyph } from '../../programming/CustomGlyph'
  import { setSelectGlobalParamDialogVisible, setSetAsGlobalParamDialogVisible } from '../../stores/dialogs'
	import { selectedFile, selectedItemByUUID } from '../../stores/files'
  import { More } from '@element-plus/icons-vue'
  import { OpType, saveState, StoreType } from '../../stores/edit'
  import { editStatus, Status } from '../../stores/font'
  const { t, tm } = useI18n()
  const controlType = ref(0)
	const controlTypeOptions = [
		{
			value: 0,
			key: 'widget',
		},
		{
			value: 1,
			key: 'number',
		},
	]
  const layoutType = ref(0)
  const layoutTypeOptions = [
		{
			value: 0,
			key: 'null',
		},
		{
			value: 1,
			key: 'rect',
		},
	]
  const onLayoutSelect = ref(false)

	const size = ref(150)

  const saveGlyphEditState = (options) => {
    // 保存状态
		saveState('编辑字形参数', [
			editStatus.value === Status.Glyph ? StoreType.EditGlyph : StoreType.EditCharacter
		],
			OpType.Undo,
			options,
		)
  }

  let opTimer = null
  let opstatus = false
	watch(editGlyph, (newValue, oldValue) => {
		if (opTimer) {
      clearTimeout(opTimer)
    }
    opTimer = setTimeout(() => {
      opstatus = false
			clearTimeout(opTimer)
    }, 500)
    if (!opstatus) {
			saveGlyphEditState({
				editGlyph: oldValue,
        newRecord: true,
			})
      opstatus = true
    }
	}, {
		deep: true,
	})

	const handleChangeParameter = (parameter: IParameter | IParameter2, value: number) => {
    parameter.value = value
    if (parameter.ratioed) {
      if (!editGlyph.value.param_script) {
        editGlyph.value.param_script = {}
      }
      const layout = getRatioLayout(editGlyph.value, value)
      const script = `window.glyph.setParam('${parameter.name}',window.glyph.getRatioLayout('${value}') / ${layout} * ${parameter.value});`
      editGlyph.value.param_script[parameter.name] = script
    }
    executeScript(editGlyph.value)
    emitter.emit('renderGlyphPreviewCanvasByUUID', editGlyph.value.uuid)
    emitter.emit('renderGlyph')
  }

  const handleRatioOptionChange = (parameter: IParameter | IParameter2, value: string) => {
    if (parameter.ratioed) {
      if (!editGlyph.value.param_script) {
        editGlyph.value.param_script = {}
      }
      const layout = getRatioLayout(editGlyph.value, value)
      const script = `window.glyph.setParam('${parameter.name}',window.glyph.getRatioLayout('${value}') / ${layout} * ${parameter.value});`
      editGlyph.value.param_script[parameter.name] = script
    }
    executeScript(editGlyph.value)
    emitter.emit('renderGlyphPreviewCanvasByUUID', editGlyph.value.uuid)
    emitter.emit('renderGlyph')
  }

  const onChange = (parameter, _radius: number, _degree: number, _params: Array<any>) => {
    // radius.value.value = _radius
    // degree.value.value = _degree
    // params.value = Object.assign([], _params)
    parameter.radius.value = _radius
    parameter.degree.value = _degree
    parameter.params = Object.assign([], _params)
    executeScript(editGlyph.value)
    emitter.emit('renderGlyphPreviewCanvasByUUID', editGlyph.value.uuid)
    emitter.emit('renderGlyph')
  }

  watch([checkJoints, checkRefLines], () => {
    emitter.emit('renderGlyph')
  })

  watch(layoutType, () => {
    if (layoutType.value === 0) {
      editGlyph.value.layout = null
    } else if (layoutType.value === 1) {
      // const map = {new Map()}
      // map.set('width', {ratioed: false, ratio: 'DEFAULT'})
      // map.set('height', {ratioed: false, ratio: 'DEFAULT'})
      const map = {
        width: {ratioed: false, ratio: 'DEFAULT'},
        height: {ratioed: false, ratio: 'DEFAULT'},
      }
      editGlyph.value.layout = {
        type: 'rect',
        params: {
          width: 1000,
          height: 1000,
        },
        ratioedMap: map,
      }
    }
    onLayoutSelect.value = false
  })

  let collapsedMap: any = ref({})
  onMounted(() => {
    editGlyph.value.parameters.parameters.map((param) => {
      collapsedMap.value[param.uuid] = false
    })
  })

	let timer = null

  const onLayoutParamsChange = async () => {
    emitter.emit('renderGlyphPreviewCanvasByUUID', editGlyph.value.uuid)
		if (timer) clearTimeout(timer)
		timer = setTimeout(() => {
			executeScript(editGlyph.value)
    	emitter.emit('renderGlyph', true)
		}, 1500)
  }

  const cancelGlobalParam = (parameter: IParameter) => {
		const param = getConstant(parameter.value as string)
		parameter.type = param.type
		parameter.value = param.value
    const arr = constantGlyphMap.get(param.uuid)
		for (let i = 0; i < arr.length; i++) {
			if (arr[i].parameterUUID === parameter.uuid) {
				arr.splice(i, 1)
				break
			}
		}
	}

	const setAsGlobalParam = (parameter: IParameter) => {
		selectedParam.value = parameter
		selectedParamType.value = 'glyph_components'
		setSetAsGlobalParamDialogVisible(true)
	}

	const selectGlobalParam = (parameter: IParameter) => {
		selectedParam.value = parameter
		selectedParamType.value = 'glyph_components'
		setSelectGlobalParamDialogVisible(true)
	}


	const updateGlobalParam = (parameter: IParameter) => {
		const arr = constantGlyphMap.get(parameter.value as unknown as string)
		for (let i = 0; i < arr.length; i++) {
			const pair = arr[i]
			let glyph = null
			if (pair.constantType === ConstantType.Parameter) {
				glyph = getGlyphByUUID(arr[i].glyphUUID)
			} else if (pair.constantType === ConstantType.Component) {
				const parentUUID = arr[i].parentUUID
				let parent = null
				if (pair.glyphType === GlyphType.Char) {
					parent = selectedItemByUUID(selectedFile.value.characterList, parentUUID)
				} else {
					parent = getGlyphByUUID(parentUUID)
				}
				glyph = parent.value
			}
			if (!glyph) continue
			executeScript(glyph)
			emitter.emit('renderGlyphPreviewCanvasByUUID', glyph.uuid)
		}
	}
</script>

<template>
  <div class="glyph-edit-panel">
    <div class="title">{{ t('panels.paramsPanel.layout.title') }}</div>
    <div class="layout-wrap">
      <el-button class="add-layout-button" v-show="!editGlyph.layout && !onLayoutSelect" @pointerdown="onLayoutSelect = true">{{ t('panels.paramsPanel.layout.add') }}</el-button>
      <el-button class="set-layout-button" v-show="!!editGlyph.layout && !onLayoutSelect" @pointerdown="onLayoutSelect = true">{{ t('panels.paramsPanel.layout.modify') }}</el-button>
      <el-select v-model="layoutType" v-show="onLayoutSelect" class="layout-type-select" :placeholder="tm('panels.paramsPanel.layout.title')">
        <el-option
          v-for="item in layoutTypeOptions"
          :key="item.key"
          :label="tm(`panels.paramsPanel.layout.${item.key}`)"
          :value="item.value"
        />
      </el-select>
      <div class="layout-info" v-if="!!editGlyph.layout">
        <el-form
          class="parameters-form"
          label-width="80px"
        >
          <el-form-item :label="tm('panels.paramsPanel.layout.type')">
            <el-input disabled v-model="editGlyph.layout.type"></el-input>
          </el-form-item>
          <el-form-item
            v-for="key in Object.keys(editGlyph.layout.params)"
            :label="key"
          >
            <el-input-number v-model="editGlyph.layout.params[key]" @change="onLayoutParamsChange"/>
          </el-form-item>
          <el-form-item label="编辑结构">
            <el-switch v-model="editingLayout" />
          </el-form-item>
        </el-form>
      </div>
    </div>
		<div class="parameters-wrap">
      <div class="title">{{ t('panels.paramsPanel.params.title') }}</div>
      <el-form
        class="parameters-form"
        label-width="80px"
      >
        <el-form-item :label="tm('programming.joint')">
          <el-switch
            v-model="checkJoints"
          />
        </el-form-item>
        <el-form-item :label="tm('programming.refline')">
          <el-switch
            v-model="checkRefLines"
          />
        </el-form-item>
        <el-form-item :label="parameter.name" v-for="parameter in editGlyph.parameters.parameters">
          <el-popover placement="right" :width="250" trigger="click">
            <template #reference>
              <el-icon class="more-btn"
                :class="{
                  ring: parameter.type === ParameterType.RingController || (parameter.type === ParameterType.Constant && getConstant(parameter.value).type === ParameterType.RingController),
                  show: parameter.type === ParameterType.Number || (parameter.type === ParameterType.Constant && getConstant(parameter.value).type !== ParameterType.RingController) || controlType === 0
                }"
              ><More /></el-icon>
            </template>
            <div class="param-btn-group">
              <el-button
                v-show="parameter.type === ParameterType.Constant"
                @pointerdown="cancelGlobalParam(parameter)"
              >{{ t('panels.paramsPanel.cancelGlobalParam') }}</el-button>
              <el-button
                @pointerdown="setAsGlobalParam(parameter)"
              >{{ t('panels.paramsPanel.setAsGlobalParam') }}</el-button>
              <el-button
                @pointerdown="selectGlobalParam(parameter)"
              >{{ t('panels.paramsPanel.selectGlobalParam') }}</el-button>
							<el-button
								v-show="parameter.type === ParameterType.Constant"
								type="primary"
								@pointerdown="updateGlobalParam(parameter)"
							>{{ t('panels.paramsPanel.updateGlobalParam') }}</el-button>
            </div>
          </el-popover>
          <div
            class="global-param-note"
            v-show="parameter.type === ParameterType.Constant"
            :class="{
              ring: parameter.type === ParameterType.Constant && getConstant(parameter.value).type === ParameterType.RingController
            }"
          >{{ t('panels.paramsPanel.globalParam') }}</div>
          <div v-if="parameter.type === ParameterType.Number">
            <el-input-number
              :model-value="parameter.value"
              :step="parameter.max <= 10 ? 0.01 : 1"
              :min="parameter.min"
              :max="parameter.max"
              :precision="parameter.max <= 10 ? 2 : 0"
              :disabled="parameter.type === ParameterType.Constant"
              @change="(value) => handleChangeParameter(parameter, value)"
            />
            <el-slider
              :step="parameter.max <= 10 ? 0.01 : 1"
              :min="parameter.min"
              :max="parameter.max"
              :precision="parameter.max <= 10 ? 2 : 0"
              @input="(value) => handleChangeParameter(parameter, value)"
              v-model="parameter.value" v-show="parameter.type === ParameterType.Number"
            />
            <div class="down-menu-icon-wrap" @pointerdown="collapsedMap[parameter.uuid] = !collapsedMap[parameter.uuid]">
              <font-awesome-icon :icon="['fas', 'arrow-down-wide-short']" />
            </div>
            <div class="down-menu" v-show="collapsedMap[parameter.uuid]">
              <div class="ratio-item">
                <font-awesome-icon class="ratio-icon" :class="{
                  selected: parameter.ratioed
                }" @pointerdown="() => {
                  parameter.ratioed = !parameter.ratioed
                  if (!parameter.ratioed && editGlyph.system_script && editGlyph.system_script[parameter.name]) {
                    delete editGlyph.system_script[parameter.name]
                  }
                }" :icon="['fas', 'percent']" />
                <el-select
                  v-model="parameter.ratio" class="control-type-select" placeholder="Ratio" :disabled="!parameter.ratioed"
                  @change="(value) => handleRatioOptionChange(parameter, value)"
                >
                  <el-option
                    v-for="item in getRatioOptions(editGlyph)"
                    :key="item.key"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </div>
            </div>
          </div>
          <div v-else-if="parameter.type === ParameterType.Enum">
            <el-select
              v-model="parameter.value" class="enum-param-select" placeholder="Select"
              @change="(value) => handleChangeParameter(parameter, value)"
            >
              <el-option
                v-for="option in parameter.options"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </div>
          <div v-else-if="parameter.type === ParameterType.RingController">
            <el-select v-model="controlType" class="control-type-select" :placeholder="tm('programming.controlType')">
              <el-option
                v-for="item in controlTypeOptions"
                :key="item.key"
                :label="tm(`programming.${item.key}`)"
                :value="item.value"
              />
            </el-select>
            <div v-if="controlType === 0" class="ring-controller-wrap">
              <ring-controller
                :radius="(parameter.value as IRingParameter).radius"
                :size="size"
                :degree = "(parameter.value as IRingParameter).degree"
                :params = "(parameter.value as IRingParameter).params"
                :on-change="(_radius: number, _degree: number, _params: Array<any>) => onChange(parameter.value, _radius, _degree, _params)"
              ></ring-controller>
            </div>
            <div v-else-if="controlType === 1" class="number-controller-wrap">
              <el-tabs type="border-card">
                <el-tab-pane label="radius">
                  <el-form-item label="name" label-width="42px">
                    <el-input class="parameter-value" v-model="(parameter.value as IRingParameter).radius.name" disabled></el-input>
                  </el-form-item>
                  <el-form-item label="value" label-width="42px">
                    <el-input-number
                      class="parameter-value"
                      v-model="(parameter.value as IRingParameter).radius.value"
                      :min="(parameter.value as IRingParameter).radius.min"
                      :max="(parameter.value as IRingParameter).radius.max"
                      :precision="(parameter.value as IRingParameter).radius.max <= 10 ? 2 : 0"
                      :step="(parameter.value as IRingParameter).radius.max <= 10 ? 0.01 : 1"
                    ></el-input-number>
                    <el-slider
                      @input="(value) => handleChangeParameter((parameter.value as IRingParameter).radius, value)"
                      v-model="(parameter.value as IRingParameter).radius.value"
                      :min="(parameter.value as IRingParameter).radius.min"
                      :max="(parameter.value as IRingParameter).radius.max"
                      :precision="(parameter.value as IRingParameter).radius.max <= 10 ? 2 : 0"
                      :step="(parameter.value as IRingParameter).radius.max <= 10 ? 0.01 : 1"
                    />
                  </el-form-item>
                </el-tab-pane>
                <el-tab-pane label="degree">
                  <el-form-item label="name" label-width="42px">
                    <el-input class="parameter-value" v-model="(parameter.value as IRingParameter).degree.name" disabled></el-input>
                  </el-form-item>
                  <el-form-item label="value" label-width="42px">
                    <el-input-number
                      class="parameter-value"
                      v-model="(parameter.value as IRingParameter).degree.value"
                      :min="(parameter.value as IRingParameter).degree.min"
                      :max="(parameter.value as IRingParameter).degree.max"
                      :precision="(parameter.value as IRingParameter).degree.max <= 10 ? 2 : 0"
                      :step="(parameter.value as IRingParameter).degree.max <= 10 ? 0.01 : 1"
                    ></el-input-number>
                    <el-slider
                      @input="(value) => handleChangeParameter((parameter.value as IRingParameter).degree, value)"
                      v-model="(parameter.value as IRingParameter).degree.value"
                      :min="(parameter.value as IRingParameter).degree.min"
                      :max="(parameter.value as IRingParameter).degree.max"
                      :precision="(parameter.value as IRingParameter).degree.max <= 10 ? 2 : 0"
                      :step="(parameter.value as IRingParameter).degree.max <= 10 ? 0.01 : 1"
                    />
                  </el-form-item>
                </el-tab-pane>
                <el-tab-pane label="params">
                  <el-collapse>
                    <el-collapse-item v-for="param in (parameter.value as IRingParameter).params" :title="param.name" name="1">
                      <el-form-item label="name" label-width="42px">
                        <el-input class="parameter-value" v-model="param.name" disabled></el-input>
                      </el-form-item>
                      <el-form-item label="value" label-width="42px">
                        <el-input-number
                          class="parameter-value"
                          v-model="param.value"
                          :min="param.min"
                          :max="param.max"
                          :precision="param.max <= 10 ? 2 : 0"
                          :step="param.max <= 10 ? 0.01 : 1"
                        ></el-input-number>
                        <el-slider
                          @input="(value) => handleChangeParameter(param, value)"
                          v-model="param.value"
                          :min="param.min"
                          :max="param.max"
                          :precision="param.max <= 10 ? 2 : 0"
                          :step="param.max <= 10 ? 0.01 : 1"
                        />
                      </el-form-item>
                    </el-collapse-item>
                  </el-collapse>
                </el-tab-pane>
              </el-tabs>
            </div>
          </div>
          <div v-else-if="parameter.type === ParameterType.Constant">
            <div v-if="getConstant(parameter.value).type === ParameterType.Number">
              <el-input-number
                :model-value="getConstant(parameter.value).value"
                :step="getConstant(parameter.value).max <= 10 ? 0.01 : 1"
                :min="getConstant(parameter.value).min"
                :max="getConstant(parameter.value).max"
                :precision="getConstant(parameter.value).max <= 10 ? 2 : 0"
                @change="(value) => handleChangeParameter(getConstant(parameter.value), value)"
              />
              <el-slider
                :model-value="getConstant(parameter.value).value"
                :step="getConstant(parameter.value).max <= 10 ? 0.01 : 1"
                :min="getConstant(parameter.value).min"
                :max="getConstant(parameter.value).max"
                :precision="getConstant(parameter.value).max <= 10 ? 2 : 0"
                @input="(value) => handleChangeParameter(parameter, value)"
                @change="(value) => handleChangeParameter(getConstant(parameter.value), value)"
              />
            </div>
            <div v-else-if="getConstant(parameter.value).type === ParameterType.RingController">
              <el-select v-model="controlType" class="control-type-select" :placeholder="tm('programming.controlType')">
                <el-option
                  v-for="item in controlTypeOptions"
                  :key="item.key"
                  :label="tm(`programming.${item.key}`)"
                  :value="item.value"
                />
              </el-select>
              <div v-if="controlType === 0" class="ring-controller-wrap">
                <ring-controller
                  :radius="(getConstant(parameter.value).value as IRingParameter).radius"
                  :size="size"
                  :degree = "(getConstant(parameter.value).value as IRingParameter).degree"
                  :params = "(getConstant(parameter.value).value as IRingParameter).params"
                  :on-change="(_radius: number, _degree: number, _params: Array<any>) => onChange(getConstant(parameter.value).value, _radius, _degree, _params)"
                ></ring-controller>
              </div>
              <div v-else-if="controlType === 1" class="number-controller-wrap">
                <el-tabs type="border-card">
                  <el-tab-pane label="radius">
                    <el-form-item label="name" label-width="42px">
                      <el-input class="parameter-value" :model-value="(getConstant(parameter.value).value as IRingParameter).radius.name" disabled></el-input>
                    </el-form-item>
                    <el-form-item label="value" label-width="42px">
                      <el-input-number
                        class="parameter-value"
                        :model-value="(getConstant(parameter.value).value as IRingParameter).radius.value"
                        :min="(getConstant(parameter.value).value as IRingParameter).radius.min"
                        :max="(getConstant(parameter.value).value as IRingParameter).radius.max"
                        :precision="(getConstant(parameter.value).value as IRingParameter).radius.max <= 10 ? 2 : 0"
                        :step="(getConstant(parameter.value).value as IRingParameter).radius.max <= 10 ? 0.01 : 1"
                        @change="(value) => handleChangeParameter(getConstant(parameter.value).value.radius, value)"
                      ></el-input-number>
                      <el-slider
                        @input="(value) => handleChangeParameter(getConstant(parameter.value).value.radius, value)"
                        :model-value="(getConstant(parameter.value).value as IRingParameter).radius.value"
                        :min="(getConstant(parameter.value).value as IRingParameter).radius.min"
                        :max="(getConstant(parameter.value).value as IRingParameter).radius.max"
                        :precision="(getConstant(parameter.value).value as IRingParameter).radius.max <= 10 ? 2 : 0"
                        :step="(getConstant(parameter.value).value as IRingParameter).radius.max <= 10 ? 0.01 : 1"
                      />
                    </el-form-item>
                  </el-tab-pane>
                  <el-tab-pane label="degree">
                    <el-form-item label="name" label-width="42px">
                      <el-input class="parameter-value" :model-value="(getConstant(parameter.value).value as IRingParameter).degree.name" disabled></el-input>
                    </el-form-item>
                    <el-form-item label="value" label-width="42px">
                      <el-input-number
                        class="parameter-value"
                        :model-value="(getConstant(parameter.value).value as IRingParameter).degree.value"
                        :min="(getConstant(parameter.value).value as IRingParameter).degree.min"
                        :max="(getConstant(parameter.value).value as IRingParameter).degree.max"
                        :precision="(getConstant(parameter.value).value as IRingParameter).degree.max <= 10 ? 2 : 0"
                        :step="(getConstant(parameter.value).value as IRingParameter).degree.max <= 10 ? 0.01 : 1"
                        @change="(value) => handleChangeParameter(getConstant(parameter.value).value.degree, value)"
                      ></el-input-number>
                      <el-slider
                        @input="(value) => handleChangeParameter(getConstant(parameter.value).value.degree, value)"
                        :model-value="(getConstant(parameter.value).value as IRingParameter).degree.value"
                        :min="(getConstant(parameter.value).value as IRingParameter).degree.min"
                        :max="(getConstant(parameter.value).value as IRingParameter).degree.max"
                        :precision="(getConstant(parameter.value).value as IRingParameter).degree.max <= 10 ? 2 : 0"
                        :step="(getConstant(parameter.value).value as IRingParameter).degree.max <= 10 ? 0.01 : 1"
                      />
                    </el-form-item>
                  </el-tab-pane>
                  <el-tab-pane label="params">
                    <el-collapse>
                      <el-collapse-item v-for="param in (getConstant(parameter.value).value as IRingParameter).params" :title="param.name" name="1">
                        <el-form-item label="name" label-width="42px">
                          <el-input class="parameter-value" :model-value="param.name" disabled></el-input>
                        </el-form-item>
                        <el-form-item label="value" label-width="42px">
                          <el-input-number
                            class="parameter-value test"
                            :model-value="param.value"
                            :min="param.min"
                            :max="param.max"
                            :precision="param.max <= 10 ? 2 : 0"
                            :step="param.max <= 10 ? 0.01 : 1"
                            @change="(value) => handleChangeParameter(param, value)"
                          ></el-input-number>
                          <el-slider
                            @input="(value) => handleChangeParameter(param, value)"
                            v-model="param.value"
                            :min="param.min"
                            :max="param.max"
                            :precision="param.max <= 10 ? 2 : 0"
                            :step="param.max <= 10 ? 0.01 : 1"
                          />
                        </el-form-item>
                      </el-collapse-item>
                    </el-collapse>
                  </el-tab-pane>
                </el-tabs>
              </div>
            </div>
          </div>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
  .layout-wrap {
    padding: 10px;
    .add-layout-button, .set-layout-button, .el-select {
      width: 100%;
    }
    .set-layout-button {
      margin-left: 0;
    }
  }
  .ratio-icon {
    position: absolute;
    width: 32px;
    top: 12px;
    left: -40px;
    color: var(--light-5);
    cursor: pointer;
    &:hover, &.selected {
      color: var(--light-3);
    }
  }
  .down-menu-icon-wrap {
    width: 32px;
    position: absolute;
    left: -32px;
    top: 38px;
    color: var(--light-5);
    cursor: pointer;
    &:hover {
      color: var(--light-3);
    }
  }
  .pen-edit-panel {
    width: 100%;
    height: 100%;
    .el-input {
      width: 150px;
    }
  }

  .title {
    height: 36px;
    line-height: 36px;
    padding: 0 10px;
    border-bottom: 1px solid #dcdfe6;
  }

  .el-form {
    margin: 10px 0;
  }
  .el-checkbox {
    display: flex;
    margin: 0 20px;
    color: var(--light-3);
  }
	.el-slider {
		margin: 5px 0;
    margin-right: 20px;
	}
  .el-select {
    width: 150px;
  }
	:deep(.el-slider__button) {
		border-radius: 0;
    width: 14px;
    height: 14px;
	}
  .ring-controller-wrap {
    display: flex;
    margin: 20px 0;
  }
  .el-tabs {
    width: 216px;
    margin-left: -67px !important;
    margin: 20px 0;
    .el-form-item {
      margin: 5px 0;
    }
  }

	.global-param-note {
    position: absolute;
    left: -63px;
    font-size: small;
    top: 20px;
    color: #7a2703;
		font-weight: bold;
	}

	.more-btn {
		position: absolute;
		display: none;
		left: -55px;
    top: 45px;
    color: var(--light-5);
		&:hover {
			color: white;
		}
		&.ring {
			left: -32px;
		}
		&.show {
			display: block;
		}
	}

  .param-btn-group {
		width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
		.el-button {
			margin: 0;
      width: 100%;
		}
		&.ring {
			top: 45px;
			left: 5px;
		}
	}
</style>