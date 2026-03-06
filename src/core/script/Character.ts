import type { ICharacterFileLite, ICustomGlyph } from '../types'

// 占位符函数（需要后续实现）
function getCharacterRatioLayout(character: ICharacterFileLite, value: any): any {
  // TODO: 实现 getCharacterRatioLayout 函数
  return null
}

function getRatioCoords(layout: any, col: number, row: number, n: number, options: any): { x: number; y: number } {
  // TODO: 实现 getRatioCoords 函数
  return { x: 0, y: 0 }
}

class Character {
	private _character: ICharacterFileLite
  
	constructor (character) {
		this._character = character
		// 不再维护 character._o，统一从 InstanceManager 获取实例
	}

	public getComponent (name) {
		for (let i = 0; i < this._character.components.length; i++) {
			if (this._character.components[i].name === name) {
				return this._character.components[i]
			}
		}
		return null
	}

	public getGlyph (name) {
		for (let i = 0; i < this._character.components.length; i++) {
			if (this._character.components[i].name === name) {
				const glyph = this._character.components[i].value as ICustomGlyph
				// 从 InstanceManager 获取实例（在脚本执行环境中，instanceManager 应该已经通过全局变量注入）
				const instanceManager = (window as any).instanceManager
				if (instanceManager) {
					const { CustomGlyph } = require('../instance/CustomGlyph')
					return instanceManager.getOrCreateGlyphInstance(glyph, () => new CustomGlyph(glyph))
				}
				// 如果 instanceManager 不可用，返回 null（不应该发生）
				return null
			}
		}
		return null
	}

	public getLayoutByID (id: string) {
		if (this._character.info && this._character.info.layoutTree) {
			const tree = this._character.info.layoutTree
			return getNodeByID(id, tree)
		}
		return null
	}

	public getCoords (layout, col, row, n) {
		const rect = layout.rect
		const { x, y, w, h } = rect
		const _x = x + w / n * col
		const _y = y + h / n * row
		return {
			x: _x,
			y: _y,
		}
	}

	public getRatioCoords (layout, col, row, n) {
		const { dx, dy, size, centerSquareSize } = this._character.info?.gridSettings || { dx: 0, dy: 0, size: 1000, centerSquareSize: 1000 / 3 }
		const x1 = Math.round((size - centerSquareSize) / 2) + dx
		const x2 = Math.round((size - centerSquareSize) / 2 + centerSquareSize) + dx
		const y1 = Math.round((size - centerSquareSize) / 2) + dy
		const y2 = Math.round((size - centerSquareSize) / 2 + centerSquareSize) + dy
		return getRatioCoords(layout, col, row, n, {
			x1, x2, y1, y2, l: size,
		})
	}

	public getRatioLayout (value) {
		return getCharacterRatioLayout(this._character, value)
	}
}

const getNodeByID = (id: string, tree: any) => {
	for (let i = 0; i < tree.length; i++) {
		const node = tree[i]
		if (node.id === id) {
			return node
		} else if (node.children) {
			const _node = getNodeByID(id, node.children)
			if (_node) {
				return _node
			}
		}
	}
	return null
}

export {
	Character,
}