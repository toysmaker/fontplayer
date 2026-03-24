// 从 core/types 导入类型定义
import type { IConstant } from '@/core/types'
export type { IConstant }

class ConstantsMap {
	private static instance: ConstantsMap | null = null
	private constants: Array<IConstant>
  
	private constructor (constants: Array<IConstant> = []) {
		this.constants = constants
	}

	/**
	 * 获取单例实例
	 */
	public static getInstance (constants?: Array<IConstant>): ConstantsMap {
		if (!ConstantsMap.instance) {
			ConstantsMap.instance = new ConstantsMap(constants || [])
		} else if (constants !== undefined) {
			// 如果提供了新的 constants，更新实例
			ConstantsMap.instance.update(constants)
		}
		return ConstantsMap.instance
	}

	/**
	 * 重置单例实例（主要用于测试或清理）
	 */
	public static resetInstance (): void {
		ConstantsMap.instance = null
	}

	/** 非单例：高级编辑面板等需要独立 constants 映射时使用 */
	public static createLocal (constants: Array<IConstant> = []): ConstantsMap {
		return new ConstantsMap(constants)
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
				return this.constants[i].value
			}
		}
		if (import.meta.env.DEV) {
			console.warn(`[ConstantsMap.getByUUID] Constant not found for UUID:`, uuid, {
				availableConstants: this.constants.map(c => ({ uuid: c.uuid, name: c.name }))
			})
		}
		return undefined
	}

	/**
	 * 更新指定 UUID 的常量值
	 * @param uuid 常量的 UUID
	 * @param value 新的值（必须是 number 类型，因为 IConstant.value 是 number）
	 */
	public updateConstantValue (uuid: string, value: number) {
		for (let i = 0; i < this.constants.length; i++) {
			if (this.constants[i].uuid === uuid) {
				this.constants[i].value = value
				return true
			}
		}
		return false
	}
}

export {
	ConstantsMap,
}