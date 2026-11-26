import type { IFont } from '../font'
import type { ILocaTable } from './loca'
import * as decode from '../decode'
import { ICubicBezierCurve, ILine, IQuadraticBezierCurve, PathType } from '../character'
import * as R from 'ramda'
import { encoder } from '../encode'
import { serializeGlyfTable } from '../utils/glyfSerializer'

// glyf表格式
// glyf table format
interface IGlyfTable {
	glyphTables: Array<IGlyphTable>;
}

// glyph表格式
// glyph table format
interface IGlyphTable {
	numberOfContours: number;
	xMin: number;
	yMin: number;
	xMax: number;
	yMax: number;
	endPtsOfContours: Array<number>;
	instructionLength: number;
	instructions: Array<number>;
	contours: Array<IContour>;
	flags?: Array<number>;
	isComposite?: boolean;
	components?: Array<any>;
}

// contour数据类型
// contour data type
interface IContour {
	xCoordinates: Array<number>;
	yCoordinates: Array<number>;
	points: Array<IPoint>;
	paths: Array<Path>;
}

interface IPoint {
	x?: number;
	y?: number;
	onCurve?: boolean;
}

type Path = ILine | IQuadraticBezierCurve | ICubicBezierCurve

const transformPoint = (point, transform) => {
	return {
		x: transform.xScale * point.x + transform.scale01 * point.y + transform.dx,
		y: transform.scale10 * point.x + transform.yScale * point.y + transform.dy,
	}
}

/**
 * 解析glyf表
 * @param data 字体文件DataView数据
 * @param offset 当前表的位置
 * @param font 字体对象
 * @returns IGlyfTable对象
 */
/**
 * parse glyf table
 * @param data font data, type of DataView
 * @param offset offset of current table
 * @param font font object
 * @returns IGlyfTable object
 */
const parse = (data: DataView, offset: number, font: IFont) => {
	const table: IGlyfTable = {
		glyphTables: []
	}
	const numGlyphs = font.settings.numGlyphs as number
	const offsets = (font.tables?.filter((table) => table.name === 'loca')[0].table as unknown as ILocaTable).offsets
	for (let i = 0; i < numGlyphs; i++) {
		// 零长度字形：loca[i] === loca[i+1] 表示该字形没有描述数据（如 space/.null），
		// 必须生成空字形。此前直接按 offset 解析会读到下一个字形的数据，
		// 导致空格等空字形被错误填充其他字形的轮廓（如 Verdana Italic 的 space 变成 !）
		if (offsets[i] === offsets[i + 1]) {
			table.glyphTables.push({
				numberOfContours: 0,
				xMin: 0,
				yMin: 0,
				xMax: 0,
				yMax: 0,
				endPtsOfContours: [],
				instructionLength: 0,
				instructions: [],
				contours: [],
				flags: [],
				isComposite: false,
				components: [],
			})
			continue
		}
		table.glyphTables.push(parseGlyph(data, offset + offsets[i], font))
	}
	// 复合字形展开：重复多轮直到没有新的字形被展开。
	// 复合字形可以引用另一个复合字形（且可能引用索引更大的字形），
	// 单轮展开会静默丢失尚未展开的组件，因此迭代到稳定（上限 8 轮，防御递归引用）。
	let expandedCount = 0
	for (let pass = 0; pass < 8; pass++) {
		let expandedThisPass = 0
		for (let i = 0; i < numGlyphs; i++) {
			const glyfTable = table.glyphTables[i]
			if (!glyfTable.isComposite || (glyfTable as any).expanded) continue

			// 等待所有组件就绪：简单字形天然就绪，复合字形需已展开
			let allComponentsReady = true
			for (let j = 0; j < glyfTable.components.length; j += 1) {
				const componentGlyph = table.glyphTables[glyfTable.components[j].glyphIndex]
				if (!componentGlyph) { allComponentsReady = false; break }
				if (componentGlyph.isComposite && !(componentGlyph as any).expanded) {
					allComponentsReady = false
					break
				}
			}
			if (!allComponentsReady) continue

			glyfTable.contours = []
			for (let j = 0; j < glyfTable.components.length; j += 1) {
				const component = glyfTable.components[j]
				const componentGlyph = table.glyphTables[component.glyphIndex]
				if (!componentGlyph || !componentGlyph.contours.length) continue
				let contours = []
				if (component.matchedPoints === undefined) {
					contours = R.clone(componentGlyph.contours)
					for (let n = 0; n < contours.length; n++) {
						const contour = contours[n].paths
						for (let m = 0; m < contour.length; m++) {
							const path = contour[m]
							path.start = transformPoint(path.start, component)
							path.end = transformPoint(path.end, component)
							if (path.type === PathType.QUADRATIC_BEZIER) {
								path.control = transformPoint(path.control, component)
							}
						}
					}
				} else {
					let points = []
					for (let n = 0; n < glyfTable.contours.length; n++) {
						const contour = glyfTable.contours[n]
						points = points.concat(contour.points)
					}

					let componentPoints = []
					for (let n = 0; n < componentGlyph.contours.length; n++) {
						const contour = componentGlyph.contours[n]
						componentPoints = componentPoints.concat(contour.points)
					}

					// 各自的点数边界分别校验（此前误用同一数组长度比较）
					if ((component.matchedPoints[0] > points.length - 1) ||
						(component.matchedPoints[1] > componentPoints.length - 1)) {
						continue
					}
					const firstPt = points[component.matchedPoints[0]]
					const secondPt = componentPoints[component.matchedPoints[1]]
					const transform = {
						xScale: component.xScale, scale01: component.scale01,
						scale10: component.scale10, yScale: component.yScale,
						dx: 0, dy: 0
					}
					const transformedSecondPt = transformPoint(secondPt, transform)
					transform.dx = firstPt.x - transformedSecondPt.x
					transform.dy = firstPt.y - transformedSecondPt.y
					contours = R.clone(componentGlyph.contours)
					for (let n = 0; n < contours.length; n++) {
						const contour = contours[n].paths
						for (let m = 0; m < contour.length; m++) {
							const path = contour[m]
							path.start = transformPoint(path.start, transform)
							// 此前误写为 transformPoint(path.start, ...)，end 点从未被变换
							path.end = transformPoint(path.end, transform)
							if (path.type === PathType.QUADRATIC_BEZIER) {
								path.control = transformPoint(path.control, transform)
							}
						}
					}
				}
				glyfTable.contours.push(...contours)
			}
			;(glyfTable as any).expanded = true
			expandedThisPass++
		}
		expandedCount += expandedThisPass
		if (expandedThisPass === 0) break
	}
	if (import.meta.env.DEV && expandedCount > 0) {
		console.log(`[glyf] composite glyphs expanded: ${expandedCount}`)
	}
	return table
}

/**
 * 解析glyph字形
 * @param data 字体文件DataView数据
 * @param offset 当前字形的位置
 * @param font 字体对象
 * @returns IGlyphTable对象
 */
/**
 * parse glyph table
 * @param data font data, type of DataView
 * @param offset offset of current glyph
 * @param font font object
 * @returns IGlyphTable object
 */
const parseGlyph = (data: DataView, offset: number, font: IFont) => {
	// 启动一个新的decoder
	// start a new decoder
	decode.start(data, offset)

	const numberOfContours = decode.decoder['int16']()
	const xMin = decode.decoder['int16']()
	const yMin = decode.decoder['int16']()
	const xMax = decode.decoder['int16']()
	const yMax = decode.decoder['int16']()
	const endPtsOfContours = []
	let components = []
	let isComposite = false
	const instructions = []
	const contours: Array<IContour> = []
	let px = 0
	let py = 0

	if (numberOfContours < 0) {
		isComposite = true
		components = []
		let moreComponents = true
		let flags = 0
		while (moreComponents) {
			flags = decode.decoder['uint16']()
			const component = {
				glyphIndex: decode.decoder['uint16'](),
				xScale: 1,
				scale01: 0,
				scale10: 0,
				yScale: 1,
				dx: 0,
				dy: 0,
				matchedPoints: undefined,
			}
			if ((flags & 1) > 0) {
				if ((flags & 2) > 0) {
					component.dx = decode.decoder['int16']()
					component.dy = decode.decoder['int16']()
				} else {
					component.matchedPoints = [decode.decoder['uint16'](), decode.decoder['uint16']()]
				}
			} else {
				if ((flags & 2) > 0) {
					component.dx = decode.decoder['int8']()
					component.dy = decode.decoder['int8']()
				} else {
					component.matchedPoints = [decode.decoder['uint8'](), decode.decoder['uint8']()]
				}
			}

			if ((flags & 8) > 0) {
				component.xScale = component.yScale = decode.decoder['F2DOT14']()
			} else if ((flags & 64) > 0) {
				component.xScale = decode.decoder['F2DOT14']()
				component.yScale = decode.decoder['F2DOT14']()
			} else if ((flags & 128) > 0) {
				component.xScale = decode.decoder['F2DOT14']()
				component.scale01 = decode.decoder['F2DOT14']()
				component.scale10 = decode.decoder['F2DOT14']()
				component.yScale = decode.decoder['F2DOT14']()
			}

			components.push(component)
			moreComponents = !!(flags & 32)
		}
		if (flags & 0x100) {
			const instructionLength = decode.decoder['uint16']()
			for (let i = 0; i < instructionLength; i++) {
				instructions.push(decode.decoder['uint8']())
			}
		}
		// 复合字形描述到此结束：后面没有简单字形的 endPts/指令/坐标数据。
		// 此前代码继续解析简单字形结构，会把下一个字形的数据误读为指令，
		// 最终越过 glyf 表边界抛 RangeError（如 Verdana Italic）。
		decode.end()
		return {
			numberOfContours,
			xMin,
			yMin,
			xMax,
			yMax,
			endPtsOfContours: [],
			instructionLength: 0,
			instructions,
			contours: [],
			flags: [],
			isComposite,
			components,
		}
	}

	for (let i = 0; i < numberOfContours; i++) {
		endPtsOfContours.push(decode.decoder['uint16']())
	}
	const instructionLength = decode.decoder['uint16']()
	for (let i = 0; i < instructionLength; i++) {
		instructions.push(decode.decoder['uint8']())
	}
	const flags: Array<number> = []
	const pointsCount = endPtsOfContours[endPtsOfContours.length - 1] + 1
	for (let j = 0; j < pointsCount; j++) {
		const flag = decode.decoder['uint8']()
		flags.push(flag)
		if ((flag & 8) > 0) {
			const count = decode.decoder['uint8']()
			for (let n = 0; n < count; n++) {
				flags.push(flag)
				j += 1
			}
		}
	}
	for (let i = 0; i < numberOfContours; i++) {
		const xCoordinates: Array<number> = []
		const yCoordinates: Array<number> = []
		const points: Array<IPoint> = []
		const paths: Array<Path> = []
		contours.push({
			xCoordinates,
			yCoordinates,
			points,
			paths,
		})
	}
	for (let i = 0; i < numberOfContours; i++) {
		const start = i > 0 ? endPtsOfContours[i - 1] + 1 : 0
		const end = endPtsOfContours[i]
		for (let j = start; j <= end; j++) {
			const x = parseGlyphCoordinate(decode.decoder, flags[j], px, 2, 16)
			contours[i].xCoordinates.push(x)
			contours[i].points.push({
				x,
				onCurve: !!(flags[j] & 1),
			})
			px = x
		}
	}
	for (let i = 0; i < numberOfContours; i++) {
		const start = i > 0 ? endPtsOfContours[i - 1] + 1 : 0
		const end = endPtsOfContours[i]
		for (let j = start; j <= end; j++) {
			const y = parseGlyphCoordinate(decode.decoder, flags[j], py, 4, 32)
			contours[i].yCoordinates.push(y)
			contours[i].points[j - start].y = y
			py = y
			// if (contours[i].flags[j] & 4) {
			// 	contours[i].yCoordinates.push(decode.decoder['uint8']())
			// } else {
			// 	contours[i].yCoordinates.push(decode.decoder['int16']())
			// }
		}
	}

	for (let i = 0; i < numberOfContours; i++) {
		const contour = contours[i]
		const points = contour.points

		let prev = null
		let curr = points[points.length - 1]
		let next = points[0]
		let pointer = null
	
		if (curr.onCurve) {
			pointer = curr
		} else {
			if (next.onCurve) {
				pointer = next
			} else {
				const start = {x: (curr.x + next.x) * 0.5, y: (curr.y + next.y) * 0.5};
				pointer = start
			}
		}

		for (let i = 0; i < points.length; i++) {
			prev = curr
			curr = next
			next = points[(i + 1) % points.length]
	
			if (curr.onCurve) {
				const path: ILine = {
					type: PathType.LINE,
					start: {
						x: pointer.x,
						y: pointer.y,
					},
					end: {
						x: curr.x,
						y: curr.y,
					},
				}
				pointer = curr
				contour.paths.push(path)
			} else {
				let prev2 = prev
				let next2 = next
	
				if (!prev.onCurve) {
					prev2 = { x: (curr.x + prev.x) * 0.5, y: (curr.y + prev.y) * 0.5 }
				}
	
				if (!next.onCurve) {
					next2 = { x: (curr.x + next.x) * 0.5, y: (curr.y + next.y) * 0.5 }
				}

				const path: IQuadraticBezierCurve = {
					type: PathType.QUADRATIC_BEZIER,
					start: {
						x: pointer.x,
						y: pointer.y,
					},
					end: {
						x: next2.x,
						y: next2.y,
					},
					control: {
						x: curr.x,
						y: curr.y,
					}
				}
				pointer = next2
				contour.paths.push(path)
			}
		}
	}

	decode.end()

	const table = {
		numberOfContours,
		xMin,
		yMin,
		xMax,
		yMax,
		endPtsOfContours,
		instructionLength,
		instructions,
		contours,
		flags,
		isComposite,
		components,
	}

	return table
}

const parseGlyphCoordinate = (decoder, flag, previousValue, shortVectorBitMask, sameBitMask) => {
	let v
	if ((flag & shortVectorBitMask) > 0) {
		v = decoder['uint8']()
		if ((flag & sameBitMask) === 0) {
			v = -v
		}

		v = previousValue + v
	} else {
		if ((flag & sameBitMask) > 0) {
			v = previousValue;
		} else {
			v = previousValue + decoder['int16']()
		}
	}

	return v
}

/**
 * 序列化glyf表数据（使用完整的OpenType规范实现）
 * @param table IGlyfTable对象
 * @returns 原始数据数组
 */
const create = async (table: IGlyfTable) => {
	if (import.meta.env.DEV) { console.log('\n=== glyf.create() called ===') }
	if (import.meta.env.DEV) { console.log('table type:', typeof table) }
	if (import.meta.env.DEV) { console.log('table.glyphTables exists?', !!table.glyphTables) }
	if (import.meta.env.DEV) { console.log('table.glyphTables is array?', Array.isArray(table.glyphTables)) }
	
	// 验证输入
	if (!table || !table.glyphTables || !Array.isArray(table.glyphTables)) {
		console.error('❌ ERROR: Invalid IGlyfTable object!')
		console.error('   table:', table)
		return []
	}
	
	// 使用完整的OpenType序列化器
	const result = await serializeGlyfTable(table.glyphTables, {
		progressLabel: '序列化 glyf 表数据…',
	})
	
	// 将生成的offsets存储到table对象中，供loca表使用
	// 注意：这是一个临时方案，理想情况下应该重构架构
	;(table as any)._generatedOffsets = result.offsets
	
	if (import.meta.env.DEV) { console.log('glyf.create() complete\n') }
	
	return result.data
}

export {
	parse,
	create,
}

export type {
	IGlyfTable,
}