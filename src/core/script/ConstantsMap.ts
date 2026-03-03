// 从 core/types 导入类型定义
import type { IConstant } from '@/core/types'
export type { IConstant }

class ConstantsMap {
	private constants: Array<IConstant>
  
	constructor (constants: Array<IConstant>) {
		this.constants = constants
	}

	public update (constants: Array<IConstant>) {
		this.constants = constants
	}

	public get (name: string) {
		for (let i = 0; i < this.constants.length; i++) {
			if (this.constants[i].name === name) {
				return this.constants[i].value
			}
		}
	}

	public getByUUID (uuid: string) {
		if (!uuid) {
			if (import.meta.env.DEV) {
				console.warn(`[ConstantsMap.getByUUID] Invalid UUID:`, uuid)
			}
			return undefined
		}
		for (let i = 0; i < this.constants.length; i++) {
			if (this.constants[i].uuid === uuid) {
				const value = this.constants[i].value
				if (import.meta.env.DEV) {
					console.log(`[ConstantsMap.getByUUID] Found constant:`, {
						uuid,
						name: this.constants[i].name,
						value,
						type: typeof value
					})
				}
				return value
			}
		}
		if (import.meta.env.DEV) {
			console.warn(`[ConstantsMap.getByUUID] Constant not found for UUID:`, uuid, {
				availableConstants: this.constants.map(c => ({ uuid: c.uuid, name: c.name }))
			})
		}
		return undefined
	}
}

export {
	ConstantsMap,
}