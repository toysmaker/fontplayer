import type { ICharacter } from './character'
import type { ITable } from './table'
import { getUnicodeRange } from './tables/os_2'
import { getMetrics, PathType } from './character'
import type { IHeadTable } from './tables/head'
import type { IHheaTable } from './tables/hhea'
import type { IOS2Table } from './tables/os_2'
import type { IMaxpTable } from './tables/maxp'
import type { INameTable } from './tables/name'
import type { IPostTable } from './tables/post'
import type { ICmapTable } from './tables/cmap'
import type { IHmtxTable } from './tables/hmtx'
import type { IGlyfTable } from './tables/glyf'
import type { ILocaTable } from './tables/loca'
import type { ICffTable } from './tables/cff'
import { create as createFontData, parse as parseFontData } from './tables/sfnt'
import { createTable as createCmapTable } from './tables/cmap'
import { createTable as createNameTable, nameTableNames, createTable2 as createNameTable2 } from './tables/name'
import { createTable as createCffTable } from './tables/cff'
import { computeCheckSum, hasChineseChar, isChineseChar } from './utils'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { convertToPinyin } from 'tiny-pinyin'
import { encoder } from './encode'
import { loaded, total, loading } from './utils/loading'
import { incrementProgress, reserveProgressBudget, setProgressMessage, yieldToEventLoop } from './utils/progress'
import { createFvarTable } from './tables/fvar'
import { createGvarTable } from './tables/gvar'
import { createStatTable } from './tables/STAT'
import { create as createGlyfTable } from './tables/glyf'
import { create as createLocaTable } from './tables/loca'
import { convertContoursToQuadratic } from './utils/cubicToQuadratic'
import { buildGlyfAndLocaTables } from './utils/glyfBuilder'
import { createFromCharactersV0 as createColrTable } from './tables/colr'
import { createFromLayers as createCpalTable } from './tables/cpal'

// font对象数据类型
// font object data type
interface IFont {
  characters: Array<ICharacter>;
	settings: ISettings;
	tableConfig?: ITableConfig;
	tables?: Array<ITable>;
	rawData?: DataView;
	bytes?: Array<number>;
	buffer?: ArrayBuffer;
	checksum?: number;
}

// font settings 数据类型
// font settings data type
interface ISettings {
	numGlyphs?: number;
	numberOfHMetrics?: number;
	indexToLocFormat?: number;
	gsubrs?: Array<any>;
	gsubrsBias?: number;
	defaultWidthX?: number;
	nominalWidthX?: number;
	isCIDFont?: boolean;
	subrs?: Array<any>;
	subrsBias?: number;
	unitsPerEm?: number;
	ascender?: number;
	descender?: number;
}

// table config对象数据类型，包含每个表的基础信息
// table config data type which contains basic info of each table
interface ITableConfig {
	sfntVersion: number | string;
	numTables: number;
	searchRange: number;
	entrySelector: number;
	rangeShift: number;
}

// 可变字体轴定义
// Variation axis definition
interface IVariationAxis {
	tag: string;      // 轴标签，如 'wght', 'wdth'
	name: string;     // 轴名称，如 'Weight', 'Width'
	minValue: number;
	defaultValue: number;
	maxValue: number;
	nameID?: number;  // 在name表中的ID（由createTable2自动分配）
}

// 可变字体实例定义
// Variation font instance definition
interface IVariationInstance {
	subfamilyName: string;        // 实例名称，如 'Bold', 'Light'
	coordinates: number[];        // 各轴的坐标值
	postScriptName?: string;      // PostScript名称（可选）
	subfamilyNameID?: number;     // 在name表中的ID（由createTable2自动分配）
	postScriptNameID?: number;    // PostScript名称的nameID（由createTable2自动分配）
	flags?: number;
}

// 可变字体配置
// Variation font configuration
interface IVariants {
	axes: Array<IVariationAxis>;
	instances?: Array<IVariationInstance>;
}

// font option 配置信息数据类型
// font option data type
interface IOption {
	contourStorage?: string;
	familyName: string;
	styleName?: string;
	fullName?: string;
	postScriptName?: string;
	designer?: string;
	designerURL?: string;
	manufacturer?: string;
	manufacturerURL?: string;
	license?: string;
	licenseURL?: string;
	version?: string;
	description?: string;
	copyright?: string;
	trademark?: string;
	unitsPerEm: number;
	ascender: number;
	descender: number;
	createdTimestamp?: number;
	tables?: any;
	variants?: any;
	isColorFont?: boolean;
}

const average = (vs: Array<number>) => {
	let sum = 0
	for (let i = 0; i < vs.length; i += 1) {
		sum += vs[i]
	}

	return sum / vs.length
}

/**
 * 解析字体
 * @param buffer 包含字体信息的ArrayBuffur
 * @returns font对象
 */
/**
 * parse font data
 * @param buffer ArrayBuffur for font data
 * @returns font object
 */
const parseFont = (buffer: ArrayBuffer) => {
	const data = new DataView(buffer)
	const font: IFont = {
		characters: [],
		settings: {},
		rawData: data,
		buffer,
		tables: []
	}
	return parseFontData(data, font)
}

/**
 * 创建字体
 * @param characters 包含每个字符信息的数组
 * @param options 配置选项
 * @returns font对象
 */
/**
 * create font
 * @param characters characters array contain info of each character
 * @param options font options
 * @returns font object
 */
const createFont = async (characters: Array<ICharacter>, options: IOption) => {
	let enName = ''
	for(let i = 0; i < options.familyName.length; i++) {
		const charcode = options.familyName[i].charCodeAt(0)
		if (!(charcode >= 0x21 && charcode <= 0x7E)) {
			enName += `${charcode}`
		} else {
			enName += `${options.familyName[i]}`
		}
	}

	if (hasChineseChar(options.familyName)) {
		enName = convertToPinyin(options.familyName)
	}

	const fontNames = {
		fontFamily: {
			en: options.familyName || ' ',
			zh: options.familyName || ' ',
		},
		fontSubfamily: {
			en: 'Regular',//options.styleName || ' ',
			zh: '常规体',//options.styleName || ' ',
		},
		fullName: {
			en: options.fullName || options.familyName + ' ' + options.styleName,
			zh: options.fullName || options.familyName + ' ' + '常规体',//options.styleName
		},
		//postScriptName: {en: options.postScriptName || (options.familyName + options.styleName).replace(/\s/g, '')},
		postScriptName: {
			en: options.postScriptName || (enName + '-' + options.styleName).replace(/\s/g, '').slice(0, 63),
			zh: options.postScriptName || (enName + '-' + options.styleName).replace(/\s/g, '').slice(0, 63),
		},
		designer: {
			en: options.designer || ' ',
			zh: options.designer || ' ',
		},
		designerURL: {
			en: options.designerURL || ' ',
			zh: options.designerURL || ' ',
		},
		manufacturer: {
			en: options.manufacturer || ' ',
			zh: options.manufacturer || ' ',
		},
		manufacturerURL: {
			en: options.manufacturerURL || ' ',
			zh: options.manufacturerURL || ' ',
		},
		license: {
			en: options.license || ' ',
			zh: options.license || ' ',
		},
		licenseURL: {
			en: options.licenseURL || ' ',
			zh: options.licenseURL || ' ',
		},
		version: {
			en: options.version || 'Version 1.0',
			zh: options.version || 'Version 1.0',
		},
		description: {
			en: options.description || ' ',
			zh: options.description || ' ',
		},
		copyright: {
			en: options.copyright || ' ',
			zh: options.copyright || ' ',
		},
		trademark: {
			en: options.trademark || ' ',
			zh: options.trademark || ' ',
		}
	}

	const name_keys = Object.keys(fontNames)
	for (let i = 0; i < name_keys.length; i++) {
		const enName = fontNames[name_keys[i]].en
		if (hasChineseChar(enName)) {
			fontNames[name_keys[i]].en = convertToPinyin(enName)
		}
	}

	// 创建基础font对象
	// create basic font object
	const font: IFont = {
		characters,
		settings: {
			unitsPerEm: options.unitsPerEm || 1000,
			ascender: options.ascender,
			descender: options.descender,
		}
	}

	// 计算一些基础信息
	// compute some basic info
	const xMins = []
	const yMins = []
	const xMaxs = []
	const yMaxs = []
	const advanceWidths = []
	const leftSideBearings = []
	const rightSideBearings = []
	let firstCharIndex
	let lastCharIndex = 0
	let ulUnicodeRange1 = 0
	let ulUnicodeRange2 = 0
	let ulUnicodeRange3 = 0
	let ulUnicodeRange4 = 0
	let m = 0

	const compute = async (): Promise<void> => {
		// 检查是否完成所有字符处理
		if (m >= characters.length) {
			return
		}

		loaded.value++
		if (loaded.value >= total.value) {
			loading.value = false
			loaded.value = 0
			total.value = 0
		}
		const character = characters[m]
		const unicode = character.unicode | 0

		if ((firstCharIndex as number) > unicode || firstCharIndex === undefined) {
			if (unicode > 0) {
				firstCharIndex = unicode
			}
		}

		if (lastCharIndex < unicode) {
			lastCharIndex = unicode
		}

		const position = getUnicodeRange(unicode)
		if (position < 32) {
			ulUnicodeRange1 |= 1 << position;
		} else if (position < 64) {
			ulUnicodeRange2 |= 1 << position - 32;
		} else if (position < 96) {
			ulUnicodeRange3 |= 1 << position - 64;
		} else if (position < 123) {
			ulUnicodeRange4 |= 1 << position - 96;
		} else {
			throw new Error('Unicode ranges bits > 123 are reserved for internal usage');
		}
		//if (unicode === 0) continue
		const metrics = getMetrics(character)
		xMins.push(metrics.xMin)
		yMins.push(metrics.yMin)
		xMaxs.push(metrics.xMax)
		yMaxs.push(metrics.yMax)
		leftSideBearings.push(metrics.leftSideBearing)
		rightSideBearings.push(metrics.rightSideBearing)
		advanceWidths.push(character.advanceWidth)
		character.xMin = metrics.xMin
		character.xMax = metrics.xMax
		character.yMin = metrics.yMin
		character.yMax = metrics.yMax
		character.rightSideBearing = metrics.rightSideBearing
		character.leftSideBearing = metrics.leftSideBearing

		m++
		// 检查是否还有更多字符需要处理
		if (m < characters.length) {
			if (m % 100 === 0) {
				// 每100个字符后，给UI更多时间更新
				await new Promise(resolve => setTimeout(resolve, 0))
			}
			// 继续处理下一个字符
			return compute()
		}
	}
	await compute()

	const globals = {
		xMin: Math.min.apply(null, xMins),
		yMin: Math.min.apply(null, yMins),
		xMax: Math.max.apply(null, xMaxs),
		yMax: Math.max.apply(null, yMaxs),
		advanceWidthMax: Math.max.apply(null, advanceWidths as Array<number>),
		advanceWidthAvg: advanceWidths.reduce((a, b) => a + b, 0) / advanceWidths.length,
		minLeftSideBearing: Math.min.apply(null, leftSideBearings),
		maxLeftSideBearing: Math.max.apply(null, leftSideBearings),
		minRightSideBearing: Math.min.apply(null, rightSideBearings),
		ascender: options.ascender,
		descender: options.descender,
	}

	// 精确设置Unicode范围位，避免设置不包含字符的范围
	// 重新计算Unicode范围位，只包含实际存在的字符
	ulUnicodeRange1 = 0
	ulUnicodeRange2 = 0
	ulUnicodeRange3 = 0
	ulUnicodeRange4 = 0
	
	// 只对实际存在的字符设置Unicode范围位
	for (let i = 0; i < characters.length; i++) {
		const character = characters[i]
		const unicode = character.unicode | 0
		if (unicode === 0) continue // 跳过.notdef字符
		
		const position = getUnicodeRange(unicode)
		if (position < 32) {
			ulUnicodeRange1 |= 1 << position;
		} else if (position < 64) {
			ulUnicodeRange2 |= 1 << position - 32;
		} else if (position < 96) {
			ulUnicodeRange3 |= 1 << position - 64;
		} else if (position < 123) {
			ulUnicodeRange4 |= 1 << position - 96;
		}
	}
	
	const _headTable = options.tables ? options.tables.head : {}
	const convertToFlags = (flags: Array<boolean>) => {
		let _flags = 0
		for (let i = 0; i < flags.length; i++) {
			if (flags[i]) {
				_flags += Math.pow(2, i)
			}
		}
		return _flags
	}
	const convertToMacStyle = (macStyle: Array<number>) => {
		let _macStyle = 0
		for (let i = 0; i < macStyle.length; i++) {
			if (macStyle[i]) {
				_macStyle += Math.pow(2, i)
			}
		}
		return _macStyle
	}

	// 定义head表
	// define head table
	const headTable = {
		majorVersion: _headTable.majorVersion || 0x0001,
		minorVersion: _headTable.minorVersion || 0x0000,
		fontRevision: _headTable.fontRevision || 0x00010000,
		checkSumAdjustment: 0,
		magicNumber: 0x5F0F3CF5,
		flags: _headTable.flags ? convertToFlags(_headTable.flags) : 3,
		unitsPerEm: options.unitsPerEm,
		created: _headTable.created?.timestamp || Math.floor(options.createdTimestamp || Date.now() / 1000) + 2082844800,
		modified: _headTable.modified?.timestamp || Math.floor(Date.now() / 1000) + 2082844800,
		xMin: 0,//globals.xMin,
		yMin: -200,//globals.yMin,
		xMax: 1000,//globals.xMax,
		yMax: 800,//globals.yMax,
		macStyle: _headTable.macStyle ? convertToMacStyle(_headTable.macStyle) : 0,
		lowestRecPPEM: _headTable.lowestRecPPEM || 7,
		fontDirectionHint: _headTable.fontDirectionHint || 2,
		indexToLocFormat: 0,
		glyphDataFormat: 0,
	}

	const _hheaTable = options.tables ? options.tables.hhea : {}

	// 定义hhea表
	// define hhea table
	const hheaTable = {
		majorVersion: _hheaTable.majorVersion || 0x0001,
		minorVersion: _hheaTable.minorVersion || 0x0000,
		ascender: options.ascender,
		descender: options.descender,
		lineGap: _hheaTable.lineGap || 0,
		advanceWidthMax: globals.advanceWidthMax,
		minLeftSideBearing: globals.minLeftSideBearing,
		minRightSideBearing: globals.minRightSideBearing,
		xMaxExtent: globals.maxLeftSideBearing + (globals.xMax - globals.xMin),
		caretSlopeRise: _hheaTable.caretSlopeRise || 1,
		caretSlopeRun: _hheaTable.caretSlopeRun || 0,
		caretOffset: _hheaTable.caretOffset || 0,
		reserved0: 0,
		reserved1: 0,
		reserved2: 0,
		reserved3: 0,
		metricDataFormat: 0,
		numberOfHMetrics: characters.length
	}

	// 定义maxp表
	// define maxp table
	// maxp表版本：CFF=0x00005000 (6字节), TrueType=0x00010000 (32字节)
	// 可变字体使用TrueType格式，需要所有TrueType字段
	const maxpTable: any = {
		version: options.variants || options.contourStorage === 'glyf' ? 0x00010000 : 0x00005000, // TrueType : CFF
		numGlyphs: characters.length,
	}
	
	// TrueType格式需要额外的字段（总共32字节）
	if (options.variants || options.contourStorage === 'glyf') {
		maxpTable.maxPoints = 0 // 会在后面从glyf表计算
		maxpTable.maxContours = 0 // 会在后面从glyf表计算
		maxpTable.maxCompositePoints = 0
		maxpTable.maxCompositeContours = 0
		maxpTable.maxZones = 2 // 标准值
		maxpTable.maxTwilightPoints = 0
		maxpTable.maxStorage = 0
		maxpTable.maxFunctionDefs = 0
		maxpTable.maxInstructionDefs = 0
		maxpTable.maxStackElements = 0
		maxpTable.maxSizeOfInstructions = 0
		maxpTable.maxComponentElements = 0
		maxpTable.maxComponentDepth = 0
	}

	const _os2Table = options.tables ? options.tables.os2 : {}
	const convertToFsSelection = (fsSelection: Array<boolean>) => {
		let _fsSelection = 0
		for (let i = 0; i < fsSelection.length; i++) {
			if (fsSelection[i]) {
				_fsSelection += Math.pow(2, i)
			}
		}
		return _fsSelection
	}

	// 定义os2表
	// define os2 table
	// ⚠️ 注意：对于彩色字体，确保 OS/2 表的设置符合 Windows 的要求
	// 特别是 fsSelection 和 usWinAscent/usWinDescent 的设置
	const os2Table = {
		version: 0x0005,
		xAvgCharWidth: Math.round(globals.advanceWidthAvg),
		usWeightClass: _os2Table.usWeightClass || 400,
		usWidthClass: _os2Table.usWidthClass || 5,
		fsType: _os2Table.fsType || 0,
		ySubscriptXSize: _os2Table.ySubscriptXSize || 650,
		ySubscriptYSize: _os2Table.ySubscriptYSize || 699,
		ySubscriptXOffset: _os2Table.ySubscriptXOffset || 0,
		ySubscriptYOffset: _os2Table.ySubscriptYOffset || 140,
		ySuperscriptXSize: _os2Table.ySuperscriptXSize || 650,
		ySuperscriptYSize: _os2Table.ySuperscriptYSize || 699,
		ySuperscriptXOffset: _os2Table.ySuperscriptXOffset || 0,
		ySuperscriptYOffset: _os2Table.ySuperscriptYOffset || 479,
		yStrikeoutSize: _os2Table.yStrikeoutSize || 49,
		yStrikeoutPosition: _os2Table.yStrikeoutPosition || 258,
		sFamilyClass: _os2Table.sFamilyClass || 0,
		panose: _os2Table.panose || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		ulUnicodeRange1,
		ulUnicodeRange2,
		ulUnicodeRange3,
		ulUnicodeRange4,
		achVendID: _os2Table.achVendID || 'UKWN',
		fsSelection: _os2Table.fsSelection ? convertToFsSelection(_os2Table.fsSelection) : 64,
		usFirstCharIndex: firstCharIndex,
		usLastCharIndex: lastCharIndex,
		sTypoAscender: globals.ascender,
		sTypoDescender: globals.descender,
		sTypoLineGap: _hheaTable.lineGap || 0,
		// ⚠️ 重要：Windows 需要使用 usWinAscent 和 usWinDescent，这些值必须是正数
		// usWinAscent 和 usWinDescent 用于 Windows 的字体渲染，必须正确设置
		// usWinAscent: 从基线向上的距离（正数）
		// usWinDescent: 从基线向下的距离（正数，即使 descender 是负数也要转换为正数）
		usWinAscent: Math.max(options.ascender || 800, globals.yMax || 800),
		usWinDescent: Math.max(Math.abs(options.descender || -200), Math.abs(globals.yMin || -200)),
		ulCodePageRange1: (1 << 0) | (1 << 18) | (1 << 20),//1,
		ulCodePageRange2: 0,//0,
		sxHeight: metricsForChar(font, 'xyvw', {yMax: Math.round(globals.ascender / 2)}).yMax,
		sCapHeight: metricsForChar(font, 'HIKLEFJMNTZBDPRAGOQSUVWXY', globals).yMax,
		usDefaultChar: hasChar(font, ' ') ? 32 : 0,
		usBreakChar: hasChar(font, ' ') ? 32 : 0,
		usMaxContext: 0,
		usLowerOpticalPointSize: _os2Table.usLowerOpticalPointSize || 8,
		usUpperOpticalPointSize: _os2Table.usUpperOpticalPointSize || 72,
	}
	
	// ⚠️ 如果这是彩色字体，输出 OS/2 表的关键信息用于调试
	if (options.isColorFont) {
		console.log('\n📊 OS/2 Table for Color Font:')
		console.log(`   version: 0x${os2Table.version.toString(16).padStart(4, '0')}`)
		console.log(`   fsSelection: ${os2Table.fsSelection} (0x${os2Table.fsSelection.toString(16).padStart(4, '0')})`)
		console.log(`   usWinAscent: ${os2Table.usWinAscent}`)
		console.log(`   usWinDescent: ${os2Table.usWinDescent}`)
		console.log(`   usWeightClass: ${os2Table.usWeightClass}`)
		console.log(`   usWidthClass: ${os2Table.usWidthClass}`)
		console.log(`   ulCodePageRange1: 0x${os2Table.ulCodePageRange1.toString(16).padStart(8, '0')}`)
		console.log(`\n`)
	}

	// 定义hmtx表
	// define hmtx table
	const hmtxTable: IHmtxTable = {
		hMetrics: [],
	}

	for (let i = 0; i < characters.length; i++) {
		const character = characters[i]
		const advanceWidth = character.advanceWidth || 0
		const leftSideBearing = Math.round(character.leftSideBearing || 0)
		hmtxTable.hMetrics.push({
			advanceWidth,
			lsb: leftSideBearing,
		})
	}

	// 定义cmap表
	// define cmap table
	const cmapTable = createCmapTable(characters)

	// 定义name表
	// define name table
	const getEnglishName = (name: string) => {
		const translations = fontNames[name as keyof typeof fontNames]
		if (translations) {
			return translations.en
		}
	}
	const englishFamilyName = getEnglishName('fontFamily')
	const englishStyleName = getEnglishName('fontSubfamily')
	const englishFullName = englishFamilyName + '-' + englishStyleName;
	let postScriptName = getEnglishName('postScriptName');
	if (!postScriptName) {
		postScriptName = (englishFamilyName as string).replace(/\s/g, '') + '-' + englishStyleName;
	}

	const names: any = {}
	for (let n in fontNames) {
		names[n] = fontNames[n as keyof typeof fontNames]
	}

	if (!names.uniqueID) {
		names.uniqueID = { en: englishFullName, zh: englishFullName }//getEnglishName('manufacturer') + ':' + englishFullName}
		// names.uniqueID = {
		// 	en: postScriptName,
		// 	zh: postScriptName,
		// }
	}

	if (!names.postScriptName) {
		names.postScriptName = { en: postScriptName, zh: postScriptName }
	}

	// if (!names.preferredFamily) {
	// 	names.preferredFamily = fontNames.fontFamily
	// }

	// if (!names.preferredSubfamily) {
	// 	names.preferredSubfamily = fontNames.fontSubfamily
	// }

	const languageTags: Array<any> = []
	//const nameTable = createNameTable(names, languageTags)
	
	// 如果是可变字体，需要传入variants信息以添加axis names
	const nameTable = options.tables ? 
		createNameTable2(options.tables.name, options.variants) : 
		createNameTable(names, languageTags)

	const _postTable = options.tables ? options.tables.post : {}

	// 定义post表
	// define post table
	const postTable = {
		version: 0x00030000,
		italicAngle: _postTable.italicAngle || 0,
		underlinePosition: _postTable.underlinePosition || 0,
		underlineThickness: _postTable.underlineThickness || 0,
		isFixedPitch: _postTable.isFixedPitch || 1,
		minMemType42: _postTable.minMemType42 || 0,
		maxMemType42: _postTable.maxMemType42 || 0,
		minMemType1: _postTable.minMemType1 || 0,
		maxMemType1: _postTable.maxMemType1 || 0,
	}

	const tables = {
		'head': headTable,
		'hhea': hheaTable,
		'maxp': maxpTable,
		'OS/2': os2Table,
		'name': nameTable,
		'cmap': cmapTable,
		'post': postTable,
		'hmtx': hmtxTable,
	}
	if (options.contourStorage !== 'glyf') {
		// 定义cff表
		// define cff table
		const cffTable = createCffTable(characters, {
			version: getEnglishName('version'),
			fullName: englishFullName,
			familyName: englishFamilyName,
			weightName: englishStyleName,
			postScriptName: postScriptName,
			unitsPerEm: font.settings.unitsPerEm,
			fontBBox: [0, globals.yMin, globals.ascender, globals.advanceWidthMax]
		})
		tables['CFF '] = cffTable
	} else {
		// 调试：检查原始轮廓的路径类型
		const checkGlyphPaths = (char: any, index: number) => {
			let cubicCount = 0
			let quadCount = 0
			let lineCount = 0
			for (const contour of char.contours || []) {
				for (const path of contour) {
					if (path.type === PathType.CUBIC_BEZIER) cubicCount++
					else if (path.type === PathType.QUADRATIC_BEZIER) quadCount++
					else if (path.type === PathType.LINE) lineCount++
				}
			}
			return { cubicCount, quadCount, lineCount }
		}
		
		// 1. 将所有字符的轮廓转换为二次贝塞尔曲线
		const convertedCharacters = characters.map((char, index) => {
			const before = checkGlyphPaths(char, index)
			const converted = {
				...char,
				contours: convertContoursToQuadratic(char.contours, 0.5) // tolerance = 0.5
			}
			const after = checkGlyphPaths(converted, index)
			
			if (index === 7 || index === 11 || index === 12) {
				console.log(`  Glyph ${index}: cubic=${before.cubicCount}, quad=${before.quadCount}, line=${before.lineCount} → quad=${after.quadCount}, line=${after.lineCount}`)
			}
			
			return converted
		})
		
		console.log(`✅ Converted ${convertedCharacters.length} glyphs to quadratic Bezier`)
		
		console.log('\n📦 Step 2: Building glyf and loca tables...')
		
		// 2. 构建glyf表（使用转换后的轮廓）
		const { glyfTable } = await buildGlyfAndLocaTables(
			convertedCharacters,
			1 // loca version: 1 = long format (Offset32)
		)
		
		// 更新head表的indexToLocFormat
		headTable.indexToLocFormat = 1 // long format
		
		// 存储glyf表对象（sfnt.ts会调用create序列化）
		// 注意：glyf.create()会生成真实的offsets并存储在_generatedOffsets中
		tables['glyf'] = glyfTable
		
		// loca表会在后面使用glyf序列化后的真实offsets创建
		// 暂时存储一个占位符
		tables['loca'] = {
			version: 1,
			offsets: [], // 会在sfnt.ts中被替换
			_needsRealOffsets: true, // 标记需要真实offsets
			_glyfTableRef: glyfTable, // 引用glyf表
		}
		
		console.log('✅ glyf table created (loca will use real offsets after serialization)')
		
		// 从glyf表重新计算head表的边界框
		let globalXMin = Infinity
		let globalYMin = Infinity
		let globalXMax = -Infinity
		let globalYMax = -Infinity
		
		for (const glyph of glyfTable.glyphTables) {
			if (glyph.numberOfContours > 0) {
				globalXMin = Math.min(globalXMin, glyph.xMin)
				globalYMin = Math.min(globalYMin, glyph.yMin)
				globalXMax = Math.max(globalXMax, glyph.xMax)
				globalYMax = Math.max(globalYMax, glyph.yMax)
			}
		}
		
		// 更新head表的边界框
		if (isFinite(globalXMin)) {
			headTable.xMin = globalXMin
			headTable.yMin = globalYMin
			headTable.xMax = globalXMax
			headTable.yMax = globalYMax
			console.log(`✅ Updated head table bounding box: (${globalXMin}, ${globalYMin}) to (${globalXMax}, ${globalYMax})`)
		}
		
		// 从hmtx重新计算hhea表的度量值
		let minLeftSideBearing = Infinity
		let minRightSideBearing = Infinity
		let xMaxExtent = -Infinity
		
		for (let i = 0; i < convertedCharacters.length; i++) {
			const char = convertedCharacters[i]
			const glyph = glyfTable.glyphTables[i]
			const lsb = char.leftSideBearing || 0
			const advWidth = char.advanceWidth || 0
			
			if (glyph.numberOfContours > 0) {
				const rsb = Math.round(advWidth - lsb - (glyph.xMax - glyph.xMin))
				const extent = Math.round(lsb + (glyph.xMax - glyph.xMin))
				
				minLeftSideBearing = Math.min(minLeftSideBearing, Math.round(lsb))
				minRightSideBearing = Math.min(minRightSideBearing, rsb)
				xMaxExtent = Math.max(xMaxExtent, extent)
			}
		}
		
		// 更新hhea表
		if (isFinite(minLeftSideBearing)) {
			hheaTable.minLeftSideBearing = minLeftSideBearing
			hheaTable.minRightSideBearing = minRightSideBearing
			hheaTable.xMaxExtent = xMaxExtent
			console.log(`✅ Updated hhea table metrics: lsb=${minLeftSideBearing}, rsb=${minRightSideBearing}, extent=${xMaxExtent}`)
		}
		
		// 从glyf表计算maxp表的值
		let maxPoints = 0
		let maxContours = 0
		
		for (const glyph of glyfTable.glyphTables) {
			if (glyph.numberOfContours > 0) {
				// 计算该字形的总点数
				let totalPoints = 0
				for (const contour of glyph.contours) {
					totalPoints += contour.points.length
				}
				
				maxPoints = Math.max(maxPoints, totalPoints)
				maxContours = Math.max(maxContours, glyph.numberOfContours)
			}
		}
		
		// 更新maxp表
		maxpTable.maxPoints = maxPoints
		maxpTable.maxContours = maxContours

	}

	if (options.variants) {
		// ========== 可变字体：使用TrueType格式（glyf + loca + gvar） ==========
		console.log('\n🎨 === Creating Variable Font ===')
		console.log('Axes:', options.variants.axes?.map(a => `${a.tag || a.name || 'unknown'} (${a.minValue}-${a.maxValue})`).join(', ') || 'none')
		console.log('Combinations:', options.variants.combinations?.length || 0)
		
		// 调试：显示完整的axes数据
		if (options.variants.axes && options.variants.axes.length > 0) {
			console.log('Axes details:', options.variants.axes)
		} else {
			console.warn('⚠️ WARNING: No axes defined in variants!')
		}
		
		// ⚠️ 重要：可变字体需要使用TrueType格式（glyf + gvar）
		// CFF格式不支持gvar，需要使用CFF2（尚未实现）
		
		// 删除CFF表
		delete tables['CFF ']
		console.log('✅ Removed CFF table (using TrueType format for variable font)')
		
		console.log('\n📐 Step 1: Converting cubic Bezier to quadratic...')
		
		// 调试：检查原始轮廓的路径类型
		const checkGlyphPaths = (char: any, index: number) => {
			let cubicCount = 0
			let quadCount = 0
			let lineCount = 0
			for (const contour of char.contours || []) {
				for (const path of contour) {
					if (path.type === PathType.CUBIC_BEZIER) cubicCount++
					else if (path.type === PathType.QUADRATIC_BEZIER) quadCount++
					else if (path.type === PathType.LINE) lineCount++
				}
			}
			return { cubicCount, quadCount, lineCount }
		}
		
		// 1. 将所有字符的轮廓转换为二次贝塞尔曲线
		const convertedCharacters = []
		for (let i = 0; i < characters.length; i++) {
			loaded.value++
			if (i % 50 === 0) {
				await new Promise(resolve => requestAnimationFrame(resolve))
			}
			const char = characters[i]
			const before = checkGlyphPaths(char, i)
			const converted = {
				...char,
				contours: convertContoursToQuadratic(char.contours, 0.5) // tolerance = 0.5
			}
			const after = checkGlyphPaths(converted, i)
			convertedCharacters.push(converted)
		}
		// const convertedCharacters = characters.map(async (char, index) => {
		// 	const before = checkGlyphPaths(char, index)
		// 	const converted = {
		// 		...char,
		// 		contours: convertContoursToQuadratic(char.contours, 0.5) // tolerance = 0.5
		// 	}
		// 	const after = checkGlyphPaths(converted, index)
			
		// 	if (index === 7 || index === 11 || index === 12) {
		// 		console.log(`  Glyph ${index}: cubic=${before.cubicCount}, quad=${before.quadCount}, line=${before.lineCount} → quad=${after.quadCount}, line=${after.lineCount}`)
		// 	}
			
		// 	return converted
		// })
		
		console.log(`✅ Converted ${convertedCharacters.length} glyphs to quadratic Bezier`)
		
		console.log('\n📦 Step 2: Building glyf and loca tables...')
		
		// 2. 构建glyf表（使用转换后的轮廓）
		const { glyfTable } = await buildGlyfAndLocaTables(
			convertedCharacters,
			1 // loca version: 1 = long format (Offset32)
		)
		
		// 更新head表的indexToLocFormat
		headTable.indexToLocFormat = 1 // long format
		
		// 存储glyf表对象（sfnt.ts会调用create序列化）
		// 注意：glyf.create()会生成真实的offsets并存储在_generatedOffsets中
		tables['glyf'] = glyfTable
		
		// loca表会在后面使用glyf序列化后的真实offsets创建
		// 暂时存储一个占位符
		tables['loca'] = {
			version: 1,
			offsets: [], // 会在sfnt.ts中被替换
			_needsRealOffsets: true, // 标记需要真实offsets
			_glyfTableRef: glyfTable, // 引用glyf表
		}
		
		console.log('✅ glyf table created (loca will use real offsets after serialization)')
		
		// 从glyf表重新计算head表的边界框
		let globalXMin = Infinity
		let globalYMin = Infinity
		let globalXMax = -Infinity
		let globalYMax = -Infinity
		
		for (const glyph of glyfTable.glyphTables) {
			if (glyph.numberOfContours > 0) {
				globalXMin = Math.min(globalXMin, glyph.xMin)
				globalYMin = Math.min(globalYMin, glyph.yMin)
				globalXMax = Math.max(globalXMax, glyph.xMax)
				globalYMax = Math.max(globalYMax, glyph.yMax)
			}
		}
		
		// 更新head表的边界框
		if (isFinite(globalXMin)) {
			headTable.xMin = globalXMin
			headTable.yMin = globalYMin
			headTable.xMax = globalXMax
			headTable.yMax = globalYMax
			console.log(`✅ Updated head table bounding box: (${globalXMin}, ${globalYMin}) to (${globalXMax}, ${globalYMax})`)
		}
		
		// 从hmtx重新计算hhea表的度量值
		let minLeftSideBearing = Infinity
		let minRightSideBearing = Infinity
		let xMaxExtent = -Infinity
		
		for (let i = 0; i < convertedCharacters.length; i++) {
			const char = convertedCharacters[i]
			const glyph = glyfTable.glyphTables[i]
			const lsb = char.leftSideBearing || 0
			const advWidth = char.advanceWidth || 0
			
			if (glyph.numberOfContours > 0) {
				const rsb = Math.round(advWidth - lsb - (glyph.xMax - glyph.xMin))
				const extent = Math.round(lsb + (glyph.xMax - glyph.xMin))
				
				minLeftSideBearing = Math.min(minLeftSideBearing, Math.round(lsb))
				minRightSideBearing = Math.min(minRightSideBearing, rsb)
				xMaxExtent = Math.max(xMaxExtent, extent)
			}
		}
		
		// 更新hhea表
		if (isFinite(minLeftSideBearing)) {
			hheaTable.minLeftSideBearing = minLeftSideBearing
			hheaTable.minRightSideBearing = minRightSideBearing
			hheaTable.xMaxExtent = xMaxExtent
			console.log(`✅ Updated hhea table metrics: lsb=${minLeftSideBearing}, rsb=${minRightSideBearing}, extent=${xMaxExtent}`)
		}
		
		// 从glyf表计算maxp表的值
		let maxPoints = 0
		let maxContours = 0
		
		for (const glyph of glyfTable.glyphTables) {
			if (glyph.numberOfContours > 0) {
				// 计算该字形的总点数
				let totalPoints = 0
				for (const contour of glyph.contours) {
					totalPoints += contour.points.length
				}
				
				maxPoints = Math.max(maxPoints, totalPoints)
				maxContours = Math.max(maxContours, glyph.numberOfContours)
			}
		}
		
		// 更新maxp表
		maxpTable.maxPoints = maxPoints
		maxpTable.maxContours = maxContours
		console.log(`✅ Updated maxp table: maxPoints=${maxPoints}, maxContours=${maxContours}`)
		
		console.log('\n🎯 Step 3: Creating variation tables...')
		
		// 3. 创建fvar表（定义变体轴）
		const fvarTable = createFvarTable(options.variants)
		tables['fvar'] = fvarTable
		console.log('✅ fvar table created')
		
		// 4. 创建gvar表（定义字形变体）
		// 注意：gvar表也需要使用转换后的字符
		console.log('⏳ Creating gvar table (this may take a while for complex fonts)...')
		
		// 调试：检查传入的 variants 数据
		console.log('🔍 Checking options.variants:')
		console.log(`  options.variants exists: ${!!options.variants}`)
		console.log(`  options.variants.combinations exists: ${!!options.variants?.combinations}`)
		console.log(`  options.variants.combinations.length: ${options.variants?.combinations?.length || 0}`)
		
		console.time('gvar table creation')
		const gvarTable = createGvarTable(options.variants, convertedCharacters)
		console.timeEnd('gvar table creation')
		tables['gvar'] = gvarTable
		console.log('✅ gvar table created')
		
		// 5. 创建STAT表（样式属性表，macOS和PS需要）
		const STATTable = createStatTable(fvarTable, {
			elidedFallbackNameID: 2 // 使用 subfamily name
		})
		tables['STAT'] = STATTable
		console.log('✅ STAT table created (required for macOS/Photoshop)')
		
		console.log('\n🎉 Variable font tables complete!')
		console.log('================================\n')
	}

	// 处理彩色字体
	if (options.isColorFont) {
		console.log('\n🎨 === Creating Color Font ===')
		
		// 检查是否有字符包含图层
		let hasLayers = false
		for (const char of characters) {
			if (char.layers && char.layers.length > 0) {
				hasLayers = true
				break
			}
		}
		
		if (hasLayers) {
			// 彩色字体需要扩展字形数组，为每个图层创建单独的字形
			console.log('⏳ Creating extended glyph array for color layers...')
			
			// 计算需要添加的图层字形数量
			let totalLayerGlyphs = 0
			for (const char of characters) {
				if (char.layers && char.layers.length > 0) {
					totalLayerGlyphs += char.layers.length
				}
			}
			
			console.log(`Original glyphs: ${characters.length}`)
			console.log(`Layer glyphs to add: ${totalLayerGlyphs}`)
			console.log(`Total glyphs: ${characters.length + totalLayerGlyphs}`)
			
			// 为图层创建字形（如果使用 CFF）
			// 图层字形会被 COLR 表引用
			const layerGlyphs: any[] = []
			let processedLayerGlyphs = 0
			reserveProgressBudget(totalLayerGlyphs + 5)
			setProgressMessage('扩展彩色字体图层…')
			
			for (const char of characters) {
				if (char.layers && char.layers.length > 0) {
					for (const layer of char.layers) {
						// 确保图层有有效的轮廓数据
						const layerContours = layer.contours || [[]]
						const layerContourNum = layerContours.length
						
						// ⚠️ 验证：确保图层有有效的轮廓数据（Windows PS 可能需要）
						// 过滤掉空的轮廓（长度为0的数组）
						const validContours = layerContours.filter(contour => contour && contour.length > 0)
						
						if (validContours.length === 0 && layerContourNum > 0) {
							console.warn(`⚠️ Warning: Layer for glyph ${char.name || 'unnamed'} has no valid contours (all contours are empty)`)
						}
						
						// 使用过滤后的轮廓
						const finalContours = validContours.length > 0 ? validContours : layerContours
						const finalContourNum = validContours.length > 0 ? validContours.length : layerContourNum
						
						// 计算图层的度量信息
						const layerMetrics = getMetrics({
							unicode: 0,
							contours: finalContours,
							contourNum: finalContourNum,
							advanceWidth: char.advanceWidth || options.unitsPerEm,
							leftSideBearing: undefined, // 让 getMetrics 自己计算
						})
						
						// 每个图层都是一个独立的字形
						// ⚠️ 重要：图层字形的 leftSideBearing 应该等于 xMin，这样在 CFF 表中 getXValue(x) = x - xMin + lsb = x
						layerGlyphs.push({
							unicode: 0, // 图层字形不需要 unicode
							name: `layer_${layerGlyphs.length}`,
							contours: finalContours,
							contourNum: finalContourNum,
							advanceWidth: char.advanceWidth || options.unitsPerEm,
							leftSideBearing: layerMetrics.xMin, // 使用 xMin 作为 lsb，保持坐标不变
							rightSideBearing: layerMetrics.rightSideBearing,
							xMin: layerMetrics.xMin,
							xMax: layerMetrics.xMax,
							yMin: layerMetrics.yMin,
							yMax: layerMetrics.yMax,
							// 不需要 layers 字段
						})
						processedLayerGlyphs++
						incrementProgress(undefined, 1)
						await yieldToEventLoop(processedLayerGlyphs, 50)
					}
				}
			}
			
			// 创建 CPAL 表（调色板）
			// ⚠️ 重要：CPAL 表必须在 COLR 表之前创建，因为 COLR 表需要引用 CPAL 表的颜色索引
			console.log('⏳ Creating CPAL table...')
			const cpalTable = createCpalTable(characters)
			tables['CPAL'] = cpalTable
			console.log(`✅ CPAL table created with ${cpalTable.numColorRecords} colors`)
			console.log(`   - numPaletteEntries: ${cpalTable.numPaletteEntries}`)
			console.log(`   - numPalettes: ${cpalTable.numPalettes}`)
			incrementProgress('创建 CPAL 表…', 1)
			
			// 创建 COLR 表（彩色图层定义）
			console.log('⏳ Creating COLR table...')
			const totalGlyphs = characters.length + layerGlyphs.length
			
			// ⚠️ 验证：确保所有有图层的 base glyph 都有有效的轮廓数据
			// Windows PS 可能需要 baseGlyph 本身也有有效的轮廓
			for (const char of characters) {
				if (char.layers && char.layers.length > 0) {
					const hasValidContours = char.contours && char.contours.length > 0 && 
						char.contours.some(contour => contour && contour.length > 0)
					
					if (!hasValidContours) {
						console.warn(`⚠️ Warning: Base glyph ${char.name || 'unnamed'} (glyphID=${characters.indexOf(char)}) has layers but no valid contours`)
						console.warn(`   This may cause Windows PS to fail rendering the color font`)
					}
				}
			}
			
			const colrTable = createColrTable(characters, totalGlyphs)
			tables['COLR'] = colrTable
			console.log(`✅ COLR table created with ${colrTable.numBaseGlyphRecords} base glyphs and ${colrTable.numLayerRecords} layers`)
			console.log(`   - Total glyphs in font: ${totalGlyphs}`)
			console.log(`   - Base glyphs: 0 to ${characters.length - 1}`)
			console.log(`   - Layer glyphs: ${characters.length} to ${totalGlyphs - 1}`)
			
			// 验证：确保所有 layerRecords 的 paletteIndex 都在 CPAL 表的有效范围内
			for (const layerRecord of colrTable.layerRecords) {
				if (layerRecord.paletteIndex >= cpalTable.numColorRecords) {
					console.warn(`⚠️ Warning: LayerRecord paletteIndex ${layerRecord.paletteIndex} is out of range [0, ${cpalTable.numColorRecords - 1}]`)
				}
			}
			
			// ⚠️ 重要提示：Windows PS 2021 可能不完全支持 COLR/CPAL 格式
			// Photoshop 主要支持 OpenType-SVG 彩色字体格式
			// 建议在浏览器中测试字体是否正常显示彩色效果
			console.log(`\n⚠️ 重要提示：`)
			console.log(`   Windows PS 2021 主要支持 OpenType-SVG 彩色字体格式`)
			console.log(`   当前使用的是 COLR/CPAL 格式，可能在 PS 中无法显示`)
			console.log(`   建议在浏览器（Chrome/Edge）中测试字体是否能正常显示彩色`)
			console.log(`   如果在浏览器中可以显示，说明字体文件是正确的`)
			console.log(`\n`)
			
			incrementProgress('创建 COLR 表…', 1)
			
			// 如果使用 CFF 格式，需要重新创建 CFF 表包含图层字形
			if (tables['CFF ']) {
				console.log('⏳ Updating CFF table with layer glyphs...')
				
				// 验证图层字形是否有有效的轮廓数据
				for (let i = 0; i < layerGlyphs.length; i++) {
					const layerGlyph = layerGlyphs[i]
					const glyphID = characters.length + i
					const hasValidContours = layerGlyph.contours && layerGlyph.contours.length > 0 && 
						layerGlyph.contours.some(contour => contour && contour.length > 0)
					
					if (!hasValidContours) {
						console.warn(`⚠️ Warning: Layer glyph ${glyphID} (${layerGlyph.name || 'unnamed'}) has no valid contours`)
					} else {
						// 统计轮廓数量
						const totalPaths = layerGlyph.contours.reduce((sum, contour) => sum + (contour?.length || 0), 0)
						console.log(`   Layer glyph ${glyphID}: ${layerGlyph.contourNum} contours, ${totalPaths} paths, bbox=[${layerGlyph.xMin}, ${layerGlyph.yMin}, ${layerGlyph.xMax}, ${layerGlyph.yMax}]`)
					}
				}
				
				const allGlyphs = [...characters, ...layerGlyphs]
				total.value += allGlyphs.length
				const updatedCffTable = createCffTable(allGlyphs, {
					version: getEnglishName('version'),
					fullName: englishFullName,
					familyName: englishFamilyName,
					weightName: englishStyleName,
					postScriptName: postScriptName,
					unitsPerEm: font.settings.unitsPerEm,
					fontBBox: [0, globals.yMin, globals.ascender, globals.advanceWidthMax]
				})
				tables['CFF '] = updatedCffTable
				console.log(`✅ CFF table updated with ${allGlyphs.length} total glyphs`)
				console.log(`   - Base glyphs: 0 to ${characters.length - 1}`)
				console.log(`   - Layer glyphs: ${characters.length} to ${allGlyphs.length - 1}`)
				
				// 更新 maxp 表的字形数量
				maxpTable.numGlyphs = allGlyphs.length
				console.log(`✅ Updated maxp.numGlyphs to ${allGlyphs.length}`)
				
				// 更新 hmtx 表 - 为图层字形添加度量信息
				console.log('⏳ Updating hmtx table with layer glyph metrics...')
				for (const layerGlyph of layerGlyphs) {
					hmtxTable.hMetrics.push({
						advanceWidth: layerGlyph.advanceWidth || 0,
						lsb: Math.round(layerGlyph.leftSideBearing || 0),
					})
				}
				console.log(`✅ Updated hmtx table with ${hmtxTable.hMetrics.length} total metrics`)
				
				// 更新 hhea 表的 numberOfHMetrics
				hheaTable.numberOfHMetrics = hmtxTable.hMetrics.length
				console.log(`✅ Updated hhea.numberOfHMetrics to ${hheaTable.numberOfHMetrics}`)
			}
			incrementProgress('更新彩色字体表完成', 1)
			
			console.log('\n🎉 Color font tables complete!')
			console.log('================================\n')
		} else {
			console.log('⚠️ No layers found in characters, skipping color font tables')
		}
	}

	headTable.checkSumAdjustment = 0x00000000

	let _font = await createFontData(tables, 'checksum')

	const checkSum = _font.checksum
	//const checkSum = computeCheckSum(_font.data)
	headTable.checkSumAdjustment = 0xB1B0AFBA - (checkSum % 0x100000000)
	const checkSumAdjustmentData = encoder.uint32(headTable.checkSumAdjustment)
	
	if (headTable.checkSumAdjustment < 0) {
		headTable.checkSumAdjustment = (headTable.checkSumAdjustment + 0x100000000) % 0x100000000
	}

	const { data: fontData, tables: fontTables, tablesDataMap: fontDataMap } = _font

	// 动态查找head表在文件中的位置
	const headTableInfo = fontTables.find((t: any) => t.name === 'head')
	if (headTableInfo) {
		// checkSumAdjustment字段在head表中的偏移是8字节（version(4) + fontRevision(4) + checkSumAdjustment(4)）
		const checkSumAdjustmentOffsetInFile = headTableInfo.config.offset + 8
		
		console.log(`\n=== Updating head.checkSumAdjustment ===`)
		console.log(`head table offset: ${headTableInfo.config.offset}`)
		console.log(`checkSumAdjustment offset in file: ${checkSumAdjustmentOffsetInFile}`)
		console.log(`checkSumAdjustment value: 0x${headTable.checkSumAdjustment.toString(16).padStart(8, '0')}`)
		console.log(`checkSumAdjustment bytes:`, checkSumAdjustmentData)
		
		fontData[checkSumAdjustmentOffsetInFile] = checkSumAdjustmentData[0]
		fontData[checkSumAdjustmentOffsetInFile + 1] = checkSumAdjustmentData[1]
		fontData[checkSumAdjustmentOffsetInFile + 2] = checkSumAdjustmentData[2]
		fontData[checkSumAdjustmentOffsetInFile + 3] = checkSumAdjustmentData[3]
		
		console.log(`Updated bytes at position ${checkSumAdjustmentOffsetInFile}-${checkSumAdjustmentOffsetInFile + 3}`)
		console.log(`=====================================\n`)
	} else {
		console.error('❌ head table not found in fontTables!')
	}

	// 创建字体数据
	// create font data
	font.bytes = fontData
	
	console.log(`\n=== createFont Complete ===`)
	console.log(`font.bytes.length: ${fontData.length}`)

	const keys = Object.keys(tables)
	keys.sort((key1, key2) => {
		if (key1 > key2) {
			return 1
		} else {
			return -1
		}
	})
	font.tables = fontTables
	
	console.log(`Font created with ${fontTables.length} tables`)
	console.log(`==============================\n`)
	
	return font
}

/**
 * 将字体数据转换为ArrayBuffer格式
 * @param font 字体对象
 * @returns buffer
 */
/**
 * convert font data to ArrayBuffer
 * @param font font object
 * @returns buffer
 */
const toArrayBuffer = (font: IFont) => {
	if (font.bytes) {
		console.log(`\n=== toArrayBuffer ===`)
		console.log(`font.bytes.length: ${font.bytes.length}`)
		
    const buffer = new ArrayBuffer(font.bytes.length)
    const intArray = new Uint8Array(buffer)
    for (let i = 0; i < font.bytes.length; i++) {
      intArray[i] = font.bytes[i]
    }

		console.log(`ArrayBuffer created: ${buffer.byteLength} bytes`)
		console.log(`===================\n`)
    return buffer
	} else if (font.rawData) {
		console.log(`Using rawData.buffer: ${font.rawData.buffer.byteLength} bytes`)
		return font.rawData.buffer
	}
}

const metricsForChar = (font: IFont, chars: string, notFoundMetrics: any) => {
	for (let i = 0; i < chars.length; i += 1) {
		const index: number = getCharacterIndex(font, chars[i]);
		if (index > 0) {
			const character = font.characters[index]
			return getMetrics(character)
		}
	}

	return notFoundMetrics
}

const getCharacterIndex = (font: IFont, char: string) => {
	const code = char.codePointAt(0)
    const characters = font.characters
    if (characters) {
			for (let i = 0; i < characters.length; i ++) {
				const character = characters[i]
				if (character.unicode === code) return i
			}
    }
    return -1
}

const hasChar = (font: IFont, char: string) => {
	return getCharacterIndex(font, char) !== -1
}

export {
	parseFont,
	createFont,
	toArrayBuffer,
	hasChar,
}

export type {
	IFont,
	ISettings,
	ITableConfig,
	IOption,
	IVariationAxis,
	IVariationInstance,
	IVariants,
}