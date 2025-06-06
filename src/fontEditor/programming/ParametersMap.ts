import { IParameter, constantsMap, ParameterType } from '../stores/glyph'
import { constantsMap as constantsMap_playground } from '../stores/playground'

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
					max: this.parameters[i].max || 1000,
				}
			}
		}
	}

	public set (name: string, value: number) {
		for (let i = 0; i < this.parameters.length; i++) {
			const param = this.parameters[i]
			if (param.name === name) {
				if (value < param.min) {
					param.value = param.min
				} else if (value > param.max) {
					param.value = param.max
				} else {
					param.value = value
				}
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
		if (parameter.type === ParameterType.Number || parameter.type === ParameterType.RingController) return parameter.value
		else if (parameter.type === ParameterType.Constant) {
			return constantsMap.getByUUID(parameter.value as string)
		}
		else if (parameter.type === ParameterType.PlaygroundConstant) {
			// playground中需要调用playground store中存储的constantsMap
			return constantsMap_playground.getByUUID(parameter.value as string)
		}
		else if (parameter.type === ParameterType.Enum) {
			// 如果选择类型，返回相应的类型value标识
			return parameter.value
		}
	}
}

export {
	ParametersMap,
}