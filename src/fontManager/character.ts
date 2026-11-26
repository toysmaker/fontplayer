import type { ITable } from './table'
import type { ICmapTable } from './tables/cmap'
import type { IHmtxTable } from './tables/hmtx'
import type { IGlyfTable } from './tables/glyf'
import type { ICffTable, IGlyphTable } from './tables/cff'
import type { IFont } from './font'

// character数据类型
// character data type
interface ICharacter {
	unicode: number;
	name?: string;
	contours: Array<Array<ILine | IQuadraticBezierCurve | ICubicBezierCurve>>;
	contourNum: number;
	advanceWidth?: number;
	leftSideBearing?: number | undefined;
	rightSideBearing?: number;
	xMin?: number;
	xMax?: number;
	yMin?: number;
	yMax?: number;
	index?: number;
	layers?: Array<ILayer>;
}

// 图层数据类型
// layer data type
interface ILayer {
	fillColor?: string;
	contours: Array<Array<ILine | IQuadraticBezierCurve | ICubicBezierCurve>>;
	contourNum: number;
	/** 填充单元：同一单元内同色轮廓合并为一个图层（非零环绕镂空） */
	fillUnit?: string;
	advanceWidth?: number;
	leftSideBearing?: number | undefined;
	rightSideBearing?: number;
	xMin?: number;
	xMax?: number;
	yMin?: number;
	yMax?: number;
	index?: number;
	name?: string;
}

// point数据类型
// point data type
interface IPoint {
	x: number;
	y: number;
}

// line数据类型
// line data type
interface ILine {
	type: PathType.LINE;
	start: IPoint;
	end: IPoint;
	fill?: boolean;
}

// quadratic bezier curve数据类型
// quadratic bezier curve data type
interface IQuadraticBezierCurve {
	type: PathType.QUADRATIC_BEZIER;
	start: IPoint;
	end: IPoint;
	control: IPoint;
	fill?: boolean;
}

// cubic bezier curve数据类型
// cubic bezier curve data type
interface ICubicBezierCurve {
	type: PathType.CUBIC_BEZIER;
	start: IPoint;
	end: IPoint;
	control1: IPoint;
	control2: IPoint;
	fill?: boolean;
}

// 路径类型
// path type
enum PathType {
	LINE,
	QUADRATIC_BEZIER,
	CUBIC_BEZIER,
}

/**
 * 获取字符的基础信息
 * @param character 字符对象
 * @returns metrics
 */
/**
 * get basic info for character
 * @param character character object
 * @returns metrics
 */
const getMetrics = (character: ICharacter) => {
	const xCoords = []
	const yCoords = []
	for (let i = 0; i < character.contours.length; i += 1) {
		for (let j = 0; j < character.contours[i].length; j++) {
			const contour = character.contours[i][j]
			xCoords.push(contour.start.x)
			yCoords.push(contour.start.y)
			xCoords.push(contour.end.x)
			yCoords.push(contour.end.y)
			if (contour.type === PathType.QUADRATIC_BEZIER) {
				xCoords.push(contour.control.x)
				yCoords.push(contour.control.y)
			} else if (contour.type === PathType.CUBIC_BEZIER) {
				xCoords.push(contour.control1.x)
				yCoords.push(contour.control1.y)
				xCoords.push(contour.control2.x)
				yCoords.push(contour.control2.y)
			}
		}
	}

	const metrics = {
		xMin: Math.min.apply(null, xCoords),
		yMin: Math.min.apply(null, yCoords),
		xMax: Math.max.apply(null, xCoords),
		yMax: Math.max.apply(null, yCoords),
		leftSideBearing: character.leftSideBearing,
		rightSideBearing: 0,
	}

	if (!isFinite(metrics.xMin)) {
		metrics.xMin = 0;
	}

	if (!isFinite(metrics.xMax)) {
		metrics.xMax = character.advanceWidth || 0
	}

	if (!isFinite(metrics.yMin)) {
		metrics.yMin = 0
	}

	if (!isFinite(metrics.yMax)) {
		metrics.yMax = 0
	}

	if (!metrics.leftSideBearing) {
		metrics.leftSideBearing = metrics.xMin
	}

	metrics.rightSideBearing = (character.advanceWidth || 0) - metrics.leftSideBearing - (metrics.xMax - metrics.xMin)
	return metrics
}

/**
 * 根据 glyf 或 cff 表，生成 characters 数组
 * @param tables 字体包含的表
 * @returns characters
 */
/**
 * parse glyf or cff table to characters
 * @param tables font tables
 * @returns characters
 */
const parseTablesToCharacters = (tables: Array<ITable>) => {
	const characters: Array<ICharacter> = []
	const cmapTable = tables.filter((table: ITable) => table.name === 'cmap')[0].table as unknown as ICmapTable
	const htmxTable = tables.filter((table: ITable) => table.name === 'hmtx')[0].table as unknown as IHmtxTable
	if (tables.filter((table: ITable) => table.name === 'glyf')[0]) {
		const glyfTable = tables.filter((table: ITable) => table.name === 'glyf')[0].table as unknown as IGlyfTable
		// 按 OpenType 规范处理 hmtx 裁剪（numberOfHMetrics < numGlyphs 时，
		// 后续字形复用最后一个 advanceWidth，lsb 取 leftSideBearings 数组）
		const hMetrics = htmxTable.hMetrics ?? []
		const lsbList = htmxTable.leftSideBearings ?? []
		const getGlyphMetrics = (index: number): { advanceWidth: number; lsb: number } => {
			if (hMetrics.length === 0) return { advanceWidth: 0, lsb: 0 }
			if (index < hMetrics.length) return hMetrics[index]
			const last = hMetrics[hMetrics.length - 1]
			const extraIndex = index - hMetrics.length
			return {
				advanceWidth: last.advanceWidth,
				lsb: extraIndex < lsbList.length ? lsbList[extraIndex] : 0,
			}
		}
		Object.keys(cmapTable.glyphIndexMap).forEach((code) => {
			//const unicode = Number(code).toString(16)
			const index = cmapTable.glyphIndexMap[code]
			// 跳过映射到 .notdef（glyph 0）的码点与越界索引（畸形/裁剪字体防御）
			if (!index) return
			const glyphTable = glyfTable.glyphTables[index]
			if (!glyphTable) return
			const contours: Array<Array<ILine | IQuadraticBezierCurve | ICubicBezierCurve>> = []
			for (let j = 0; j < glyphTable.contours.length; j++) {
				contours.push(glyphTable.contours[j].paths)
			}
			const metrics = getGlyphMetrics(index)
			characters.push({
				unicode: Number(code),
				contours,
				contourNum: glyphTable.contours.length,
				advanceWidth: metrics.advanceWidth,
				leftSideBearing: metrics.lsb,
				index,
				name: String.fromCodePoint(Number(code)),
			})
		})
	} else if (tables.filter((table: ITable) => table.name === 'CFF ')[0]) {
		const cffTable = tables.filter((table: ITable) => table.name === 'CFF ')[0].table as unknown as ICffTable

		// OpenType-CFF 字体中 advanceWidth 以 hmtx 表为准（charstring 宽度常缺省，
		// 回退到 defaultWidthX 会得到错误宽度），hmtx 缺失时回退到 charstring 宽度
		const hMetrics = htmxTable.hMetrics ?? []
		const lsbList = htmxTable.leftSideBearings ?? []
		const getHmtxMetrics = (index: number): { advanceWidth?: number; lsb?: number } => {
			if (hMetrics.length === 0) return {}
			if (index < hMetrics.length) return hMetrics[index]
			return {
				advanceWidth: hMetrics[hMetrics.length - 1].advanceWidth,
				lsb: lsbList[index - hMetrics.length],
			}
		}

		Object.keys(cmapTable.glyphIndexMap).forEach((code) => {
			//const unicode = Number(code).toString(16)
			const index = cmapTable.glyphIndexMap[code]
			// 跳过映射到 .notdef（glyph 0）的码点
			if (!index) return
			const glyphTable = (cffTable.glyphTables as Array<IGlyphTable>)[index]

			// 检查glyphTable是否存在
			if (!glyphTable) {
				return
			}

			const hmtx = getHmtxMetrics(index)
			// hmtx 表存在时以其为准（包括合法的 0 宽度字形，如组合符号）
			const advanceWidth =
				typeof hmtx.advanceWidth === 'number'
					? hmtx.advanceWidth
					: glyphTable.advanceWidth ?? 0

			characters.push({
				unicode: Number(code),
				contours: glyphTable.contours,
				contourNum: glyphTable.contours.length,
				advanceWidth,
				leftSideBearing: hmtx.lsb,
				index,
				name: cffTable.charsets?.data[index],
			})
		})
	}
	return characters
}

/**
 * 绘制字符
 * @param contours 字符轮廓信息
 * @param options 配置选项
 * @param canvas 画布
 */
/**
 * draw character
 * @param contours contours
 * @param options options
 * @param canvas canvas
 */
const drawByOption = (
	contours: Array<Array<ILine | IQuadraticBezierCurve | ICubicBezierCurve>>,
	options: {
		unitsPerEm: number,
		descender: number,
		advanceWidth: number,
	},
	canvas: HTMLCanvasElement,
) => {
	const { unitsPerEm, descender, advanceWidth } = options
	const width = canvas.width
	const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
	const scale = width / (unitsPerEm as number)
	const transformPoint = (x: number, y: number) => {
		return {
			x: (x + ((unitsPerEm as number) - (advanceWidth as number)) / 2) * scale,
			y: ((unitsPerEm as number) - y + descender) * scale,
		}
	}
	ctx.fillStyle = '#fff'
	ctx.fillRect(0, 0, canvas.width, canvas.height)
	ctx.beginPath()
	for (let i = 0; i < contours.length; i++) {
		const contour = contours[i]
		if (!contour.length) continue
		const point = transformPoint(contour[0].start.x, contour[0].start.y)
		ctx.moveTo(point.x, point.y)
		for (let j = 0; j < contour.length; j++) {
			const path = contour[j]
			if (path.type === PathType.LINE) {
				const end = transformPoint(path.end.x, path.end.y)
				ctx.lineTo(end.x, end.y)
			} else if (path.type === PathType.CUBIC_BEZIER) {
				const c1 = transformPoint(path.control1.x, path.control1.y)
				const c2 = transformPoint(path.control2.x, path.control2.y)
				const end = transformPoint(path.end.x, path.end.y)
				ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y)
			}
		}
		//ctx.lineTo(point.x, point.y)
		ctx.closePath()
		if (contour[0].fill) {
			ctx.fillStyle = '#000'
			ctx.fill()
		}
	}
	ctx.fillStyle = '#000'
	ctx.fill()
}

const drawByFont = (font: IFont, code: number, canvas: HTMLCanvasElement) => {
	const arr = font.characters.filter((character) => character.unicode === code)
	if (!arr.length) return
	const character: ICharacter = arr[0]
	const { unitsPerEm, ascender } = font.settings
	const { advanceWidth, contours } = character
	const width = canvas.width
	const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
	const scale = width / (unitsPerEm as number)
	const transformPoint = (x: number, y: number) => {
		return {
			x: (x + ((unitsPerEm as number) - (advanceWidth as number)) / 2) * scale,
			y: (unitsPerEm as number) - (y + (unitsPerEm as number) - (ascender as number)) * scale,
		}
	}
	ctx.clearRect(0, 0, canvas.width, canvas.height)
	ctx.beginPath()
	for (let i = 0; i < contours.length; i++) {
		const contour = contours[i]
		if (!contour.length) continue
		const point = transformPoint(contour[0].start.x, contour[0].start.y)
		ctx.moveTo(point.x, point.y)
		for (let j = 0; j < contour.length; j++) {
			const path = contour[j]
			if (path.type === PathType.LINE) {
				const end = transformPoint(path.end.x, path.end.y)
				ctx.lineTo(end.x, end.y)
			} else if (path.type === PathType.CUBIC_BEZIER) {
				const c1 = transformPoint(path.control1.x, path.control1.y)
				const c2 = transformPoint(path.control2.x, path.control2.y)
				const end = transformPoint(path.end.x, path.end.y)
				ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y)
			}
		}
		ctx.lineTo(point.x, point.y)
	}
	ctx.fillStyle = '#000'
	ctx.fill()
	ctx.closePath()
}

export {
	getMetrics,
	parseTablesToCharacters,
	drawByFont,
	drawByOption,
}

export type {
	ICharacter,
	ILayer,
	ILine,
	ICubicBezierCurve,
	IQuadraticBezierCurve,
	IPoint,
}

export {
	PathType,
}