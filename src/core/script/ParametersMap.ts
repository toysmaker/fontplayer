// 从 core/types 导入类型定义
import type { IParameter } from '@/core/types'
import { ParameterType } from '@/core/types'
export type { IParameter }
export { ParameterType }

// 全局 constantsMap（简化版本，实际应该从项目存储中获取）
let globalConstantsMap: ConstantsMap | null = null

export function setGlobalConstantsMap(constantsMap: ConstantsMap | null) {
  globalConstantsMap = constantsMap
}

export function getGlobalConstantsMap(): ConstantsMap | null {
  return globalConstantsMap
}

import { ConstantsMap } from './ConstantsMap'
import { precisionFromParamMax, roundToPrecision } from '@/utils/number'

class ParametersMap {
	public parameters: Array<IParameter>
  
	constructor (parameters: Array<IParameter>) {
		this.parameters = parameters
	}

	public get (name: string) {
		for (let i = 0; i < this.parameters.length; i++) {
			if (this.parameters[i].name === name) {
				return this.getValue(this.parameters[i])
			}
		}
	}

	public getRange (name: string) {
		for (let i = 0; i < this.parameters.length; i++) {
			if (this.parameters[i].name === name) {
				return {
					min: this.parameters[i].min || 0,
					max: this.parameters[i].max === 0 ? 0 : this.parameters[i].max || 1000,
				}
			}
		}
	}

	public set (name: string, value: number) {
		for (let i = 0; i < this.parameters.length; i++) {
			const param = this.parameters[i]
			if (param.name === name) {
				let next: number
				if (value < param.min) {
					next = param.min
				} else if (value > param.max) {
					next = param.max
				} else {
					next = value
				}
				param.value = roundToPrecision(next, precisionFromParamMax(param.max))
				if (param.type === ParameterType.Constant) {
					param.type = ParameterType.Number
				}
			}
		}
	}

	public getByUUID (uuid: string) {
		for (let i = 0; i < this.parameters.length; i++) {
			if (this.parameters[i].uuid === uuid) {
				return this.getValue(this.parameters[i])
			}
		}
	}

	public getValue (parameter: IParameter) {
		if (parameter.type === ParameterType.Number || parameter.type === ParameterType.RingController) {
      return parameter.value
    } else if (parameter.type === ParameterType.Constant) {
			// 使用全局 constantsMap（如果已设置）
			if (globalConstantsMap) {
        return globalConstantsMap.getByUUID(parameter.value as string)
      }
      // 如果没有全局 constantsMap，返回原值
      return parameter.value
		} else if (parameter.type === ParameterType.PlaygroundConstant) {
			// TODO: playground 模式下的 constantsMap
			if (globalConstantsMap) {
        return globalConstantsMap.getByUUID(parameter.value as string)
      }
      return parameter.value
		} else if (parameter.type === ParameterType.AdvancedEditConstant) {
			// TODO: advancedEdit 模式下的 constantsMap
			if (globalConstantsMap) {
        return globalConstantsMap.getByUUID(parameter.value as string)
      }
      return parameter.value
		} else if (parameter.type === ParameterType.Enum) {
			// 如果选择类型，返回相应的类型value标识
			return parameter.value
		}
    return parameter.value
	}
}

export {
	ParametersMap,
}