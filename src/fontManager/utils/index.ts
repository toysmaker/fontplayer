const getTag = (data: DataView, offset: number) => {
	const tagArr: Array<number> = []
	let tagStr: string = ''
	for (let i = 0; i < 4; i++) {
		tagArr.push(data.getUint8(offset + i))
		tagStr += String.fromCharCode(tagArr[i])
	}
	return {
		tagArr, tagStr,
	}
}

const getVersion = (data: DataView, offset: number) => {
	const major = data.getUint16(offset)
	const minor = data.getUint16(offset + 2)
	return major + minor / 0x1000 / 10
}

/**
 * Mac Roman 高区（0x80-0xFF）→ Unicode 映射表（Apple 标准，unicode.org VENDORS/APPLE/ROMAN.TXT）。
 * 纯 JS 实现，避免浏览器环境没有 Node Buffer 全局的问题（iconv-lite 依赖 Buffer）。
 */
const MAC_ROMAN_HIGH: Array<number> = [
	0x00C4, 0x00C5, 0x00C7, 0x00C9, 0x00D1, 0x00D6, 0x00DC, 0x00E1, // 0x80-0x87
	0x00E0, 0x00E2, 0x00E4, 0x00E3, 0x00E5, 0x00E7, 0x00E9, 0x00E8, // 0x88-0x8F
	0x00EA, 0x00EB, 0x00ED, 0x00EC, 0x00EE, 0x00EF, 0x00F1, 0x00F3, // 0x90-0x97
	0x00F2, 0x00F4, 0x00F6, 0x00F5, 0x00FA, 0x00F9, 0x00FB, 0x00FC, // 0x98-0x9F
	0x2020, 0x00B0, 0x00A2, 0x00A3, 0x00A7, 0x2022, 0x00B6, 0x00DF, // 0xA0-0xA7
	0x00AE, 0x00A9, 0x2122, 0x00B4, 0x00A8, 0x2260, 0x00C6, 0x00D8, // 0xA8-0xAF
	0x221E, 0x00B1, 0x2264, 0x2265, 0x00A5, 0x00B5, 0x2202, 0x2211, // 0xB0-0xB7
	0x220F, 0x03C0, 0x222B, 0x00AA, 0x00BA, 0x2126, 0x00E6, 0x00F8, // 0xB8-0xBF（0xBD 按 WHATWG 为 OHM SIGN）
	0x00BF, 0x00A1, 0x00AC, 0x221A, 0x0192, 0x2248, 0x2206, 0x00AB, // 0xC0-0xC7
	0x00BB, 0x2026, 0x00A0, 0x00C0, 0x00C3, 0x00D5, 0x0152, 0x0153, // 0xC8-0xCF
	0x2013, 0x2014, 0x201C, 0x201D, 0x2018, 0x2019, 0x00F7, 0x25CA, // 0xD0-0xD7
	0x00FF, 0x0178, 0x2044, 0x00A4, 0x2039, 0x203A, 0xFB01, 0xFB02, // 0xD8-0xDF（0xDB 按 WHATWG 为 ¤）
	0x2021, 0x00B7, 0x201A, 0x201E, 0x2030, 0x00C2, 0x00CA, 0x00C1, // 0xE0-0xE7
	0x00CB, 0x00C8, 0x00CD, 0x00CE, 0x00CF, 0x00CC, 0x00D3, 0x00D4, // 0xE8-0xEF
	0xFFFD, 0x00D2, 0x00DA, 0x00DB, 0x00D9, 0x0131, 0x02C6, 0x02DC, // 0xF0-0xF7（0xF0 Apple logo 按 WHATWG 为 U+FFFD）
	0x00AF, 0x02D8, 0x02D9, 0x02DA, 0x00B8, 0x02DD, 0x02DB, 0x02C7, // 0xF8-0xFF
]

/**
 * 读取 name 表字符串存储区的一条记录（按 OpenType name 表规范解码各平台/编码）。
 * - platform 0（Unicode）/ platform 3 encoding 1、10（Windows Unicode）：UTF-16BE
 * - platform 1 encoding 0（Mac Roman）：单字节 Mac Roman（TextDecoder 不可用时回退内置表）
 * - platform 1 encoding 25（Mac 简体中文 GB2312）/ platform 3 encoding 3（Windows 简体中文 GBK）→ gbk
 * - platform 1 encoding 2 / platform 3 encoding 4（繁体中文 Big5）→ big5
 * - platform 1 encoding 1 / platform 3 encoding 2（日文 Shift-JIS）→ shift_jis
 * - platform 3 encoding 5（韩文 Wansung）→ euc-kr
 * TextDecoder 为 WHATWG 标准 API，浏览器（含 WKWebView）与 Node 均原生支持，
 * 不依赖 Node Buffer，避免浏览器环境崩溃。
 */
const textDecoderCache = new Map<string, TextDecoder>()
const getLegacyDecoder = (label: string): TextDecoder | null => {
	if (!textDecoderCache.has(label)) {
		try {
			textDecoderCache.set(label, new TextDecoder(label))
		} catch {
			textDecoderCache.set(label, null as unknown as TextDecoder)
		}
	}
	const d = textDecoderCache.get(label)
	return d || null
}

const decodeLegacyBytes = (data: DataView, offset: number, bytes: number, label: string): string | null => {
	const decoder = getLegacyDecoder(label)
	if (!decoder) return null
	const raw = new Uint8Array(bytes)
	for (let i = 0; i < bytes; i++) {
		raw[i] = data.getUint8(offset + i)
	}
	try {
		return decoder.decode(raw)
	} catch {
		return null
	}
}

const getStorageString = (data: DataView, offset: number, bytes: number, platformID: number = 3, encodingID: number = 1) => {
	// 越界防御：畸形 name 表不抛异常，返回空串
	if (offset < 0 || bytes < 0 || offset + bytes > data.byteLength) {
		return ''
	}
	// Unicode 平台：UTF-16BE
	if (platformID === 0 || (platformID === 3 && (encodingID === 1 || encodingID === 10))) {
		const chars = []
		for (let i = 0; i < bytes / 2; i++) {
			chars[i] = data.getUint16(offset + i * 2)
		}
		return String.fromCharCode.apply(null, chars)
	}
	if (platformID === 1) {
		if (encodingID === 0) {
			// Mac Roman：优先 TextDecoder，缺失时回退内置映射表
			const decoded = decodeLegacyBytes(data, offset, bytes, 'macintosh')
			if (decoded !== null) return decoded
			let s = ''
			for (let i = 0; i < bytes; i++) {
				const b = data.getUint8(offset + i)
				s += String.fromCharCode(b < 0x80 ? b : MAC_ROMAN_HIGH[b - 0x80])
			}
			return s
		}
		if (encodingID === 25) return decodeLegacyBytes(data, offset, bytes, 'gbk') ?? ''
		if (encodingID === 2) return decodeLegacyBytes(data, offset, bytes, 'big5') ?? ''
		if (encodingID === 1) return decodeLegacyBytes(data, offset, bytes, 'shift_jis') ?? ''
		return ''
	}
	if (platformID === 3) {
		if (encodingID === 2) return decodeLegacyBytes(data, offset, bytes, 'shift_jis') ?? ''
		if (encodingID === 3) return decodeLegacyBytes(data, offset, bytes, 'gbk') ?? ''
		if (encodingID === 4) return decodeLegacyBytes(data, offset, bytes, 'big5') ?? ''
		if (encodingID === 5) return decodeLegacyBytes(data, offset, bytes, 'euc-kr') ?? ''
		if (encodingID === 6) {
			// Johab（韩文）：TextDecoder 不支持且极为罕见，返回空串（安全降级）
			if (import.meta.env.DEV) {
				console.warn('[name] Johab (platform 3 encoding 6) name record skipped (unsupported)')
			}
			return ''
		}
		return ''
	}
	return ''
}

const computeCheckSum = (_bytes: Array<number>, write: boolean = false) => {
	let bytes = _bytes
	if (!write) {
		bytes = Object.assign([], _bytes)
	}
	while (bytes.length % 4 !== 0) {
		bytes.push(0)
	}

	let sum = 0
	for (let i = 0; i < bytes.length; i += 4) {
		// sum += (bytes[i] << 24) +
		// (bytes[i + 1] << 16) +
		// (bytes[i + 2] << 8) +
		// (bytes[i + 3])
		
		const value = ((bytes[i] << 24) >>> 0) +
		((bytes[i + 1] << 16) >>> 0) +
		((bytes[i + 2] << 8) >>> 0) +
		(bytes[i + 3] >>> 0)

		sum = (sum + value) >>> 0
	}
	
	sum %= 0x100000000
	return sum
}

const hasChineseChar = (text) => {
	let rs = false
	for (let i = 0; i < text.length; i++) {
		if (isChineseChar(text[i])) {
			rs = true
		}
	}
	return rs
}

const isChineseChar = (char) => {
	return /^[\u4E00-\u9FFF]$/.test(char);
}

export {
	getTag,
	getVersion,
	getStorageString,
	computeCheckSum,
	hasChineseChar,
	isChineseChar,
}