/**
 * 字体设置「更多设置」各表类型与默认值
 * 与原工程 fontSettings 对齐，便于后续扩展
 */

export const nameTableNames = [
  'copyright',
  'fontFamily',
  'fontSubfamily',
  'uniqueID',
  'fullName',
  'version',
  'postScriptName',
  'trademark',
  'manufacturer',
  'designer',
  'description',
  'manufacturerURL',
  'designerURL',
  'license',
  'licenseURL',
  'reserved',
  'preferredFamily',
  'preferredSubfamily',
  'compatibleFullName',
  'sampleText',
  'postScriptFindFontName',
  'wwsFamily',
  'wwsSubfamily',
] as const

export interface NameTableEntry {
  nameID: number
  nameLabel: string
  platformID: number
  encodingID: number
  langID: number
  value: string
  default?: boolean
}

export function createDefaultNameEntry(): NameTableEntry {
  return {
    nameID: 1,
    nameLabel: 'fontFamily',
    platformID: 3,
    encodingID: 1,
    langID: 0x804,
    value: '',
    default: false,
  }
}

export function normalizeNameEntry(entry: Record<string, unknown>): NameTableEntry {
  const rawID = Number(entry.nameID)
  const nameID = rawID >= 0 && rawID < nameTableNames.length ? rawID : 1
  return {
    nameID,
    nameLabel: (entry.nameLabel as string) || nameTableNames[nameID],
    platformID: Number(entry.platformID) ?? 3,
    encodingID: Number(entry.encodingID) ?? 1,
    langID: Number(entry.langID) ?? 0x804,
    value: String(entry.value ?? ''),
    default: Boolean(entry.default),
  }
}

// --- head ---
export interface HeadTable {
  majorVersion: number
  minorVersion: number
  fontRevision: number
  flags: boolean[]
  created: { timestamp: number; value: number }
  modified: { timestamp: number; value: number }
  macStyle: boolean[]
  lowestRecPPEM: number
  fontDirectionHint: number
}

export function defaultHead(): HeadTable {
  return {
    majorVersion: 0x0001,
    minorVersion: 0x0000,
    fontRevision: 0x00010000,
    flags: [true, true, ...Array(14).fill(false)],
    created: { timestamp: Math.floor(Date.now() / 1000) + 2082844800, value: Date.now() },
    modified: { timestamp: Math.floor(Date.now() / 1000) + 2082844800, value: Date.now() },
    macStyle: Array(16).fill(false),
    lowestRecPPEM: 7,
    fontDirectionHint: 2,
  }
}

// --- hhea ---
export interface HheaTable {
  majorVersion: number
  minorVersion: number
  lineGap: number
  caretSlopeRise: number
  caretSlopeRun: number
  caretOffset: number
}

export function defaultHhea(): HheaTable {
  return {
    majorVersion: 0x0001,
    minorVersion: 0x0000,
    lineGap: 0,
    caretSlopeRise: 1,
    caretSlopeRun: 0,
    caretOffset: 0,
  }
}

// --- os2 ---
export interface Os2Table {
  version: number
  usWeightClass: number
  usWidthClass: number
  fsType: number
  ySubscriptXSize: number
  ySubscriptYSize: number
  ySubscriptXOffset: number
  ySubscriptYOffset: number
  ySuperscriptXSize: number
  ySuperscriptYSize: number
  ySuperscriptXOffset: number
  ySuperscriptYOffset: number
  yStrikeoutSize: number
  yStrikeoutPosition: number
  sFamilyClass: number
  panose: number[]
  achVendID: string
  fsSelection: boolean[]
  usMaxContext: number
  usLowerOpticalPointSize: number
  usUpperOpticalPointSize: number
}

export function defaultOs2(): Os2Table {
  return {
    version: 0x0005,
    usWeightClass: 400,
    usWidthClass: 5,
    fsType: 0,
    ySubscriptXSize: 650,
    ySubscriptYSize: 699,
    ySubscriptXOffset: 0,
    ySubscriptYOffset: 140,
    ySuperscriptXSize: 650,
    ySuperscriptYSize: 699,
    ySuperscriptXOffset: 0,
    ySuperscriptYOffset: 479,
    yStrikeoutSize: 49,
    yStrikeoutPosition: 258,
    sFamilyClass: 0,
    panose: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    achVendID: 'UKWN',
    fsSelection: [false, false, false, false, false, false, true, false, false, false],
    usMaxContext: 0,
    usLowerOpticalPointSize: 8,
    usUpperOpticalPointSize: 72,
  }
}

// --- post ---
export interface PostTable {
  version: number
  italicAngle: number
  underlinePosition: number
  underlineThickness: number
  isFixedPitch: number
  minMemType42: number
  maxMemType42: number
  minMemType1: number
  maxMemType1: number
}

export function defaultPost(): PostTable {
  return {
    version: 0x00030000,
    italicAngle: 0,
    underlinePosition: 0,
    underlineThickness: 0,
    isFixedPitch: 1,
    minMemType42: 0,
    maxMemType42: 0,
    minMemType1: 0,
    maxMemType1: 0,
  }
}
