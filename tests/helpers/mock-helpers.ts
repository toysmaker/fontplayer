/**
 * Mock数据辅助函数
 */

import type { IFile, ICharacterFileLite, ICustomGlyph, IComponent, IFontSettings } from '@/core/types'
import { genUUID } from '@/utils/uuid'

/**
 * 创建Mock工程文件
 */
export function createMockFile(overrides?: Partial<IFile>): IFile {
  return {
    uuid: genUUID(),
    name: 'Test Project',
    width: 1000,
    height: 1000,
    saved: false,
    iconsCount: 0,
    fontSettings: {
      unitsPerEm: 1000,
      ascender: 800,
      descender: -200,
    },
    characterList: [],
    glyphs: [],
    stroke_glyphs: [],
    radical_glyphs: [],
    comp_glyphs: [],
    constants: [],
    ...overrides,
  }
}

/**
 * 创建Mock字符文件
 */
export function createMockCharacter(overrides?: Partial<ICharacterFileLite>): ICharacterFileLite {
  return {
    uuid: genUUID(),
    type: 'character',
    character: {
      text: '测试',
    },
    components: [],
    groups: [],
    orderedList: [],
    view: {
      zoom: 100,
      translateX: 0,
      translateY: 0,
    },
    selectedComponentsUUIDs: [],
    ...overrides,
  }
}

/**
 * 创建Mock字形
 */
export function createMockGlyph(overrides?: Partial<ICustomGlyph>): ICustomGlyph {
  return {
    uuid: genUUID(),
    name: 'test-glyph',
    components: [],
    orderedList: [],
    groups: [],
    parameters: [],
    ...overrides,
  }
}

/**
 * 创建Mock字体设置
 */
export function createMockFontSettings(overrides?: Partial<IFontSettings>): IFontSettings {
  return {
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    ...overrides,
  }
}

/**
 * 创建Mock Pen组件
 */
export function createMockPenComponent(overrides?: Partial<IComponent>): IComponent {
  return {
    uuid: genUUID(),
    type: 'pen',
    name: 'pen',
    lock: false,
    visible: true,
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    rotation: 0,
    flipX: false,
    flipY: false,
    usedInCharacter: true,
    ox: 0,
    oy: 0,
    value: {
      points: [
        { uuid: genUUID(), x: 0, y: 0, type: 'anchor', origin: null, isShow: true },
        { uuid: genUUID(), x: 100, y: 0, type: 'control', origin: null, isShow: true },
        { uuid: genUUID(), x: 100, y: 100, type: 'control', origin: null, isShow: true },
        { uuid: genUUID(), x: 0, y: 100, type: 'anchor', origin: null, isShow: true },
      ],
      fillColor: '#000000',
      strokeColor: '#000000',
      closePath: true,
      editMode: false,
    },
    ...overrides,
  }
}

/**
 * 创建Mock Rectangle组件
 */
export function createMockRectangleComponent(overrides?: Partial<IComponent>): IComponent {
  return {
    uuid: genUUID(),
    type: 'rectangle',
    name: 'rectangle',
    lock: false,
    visible: true,
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    rotation: 0,
    flipX: false,
    flipY: false,
    usedInCharacter: true,
    ox: 0,
    oy: 0,
    value: {
      width: 100,
      height: 100,
      fillColor: '#000000',
    },
    ...overrides,
  }
}

/**
 * 创建Mock Ellipse组件
 */
export function createMockEllipseComponent(overrides?: Partial<IComponent>): IComponent {
  return {
    uuid: genUUID(),
    type: 'ellipse',
    name: 'ellipse',
    lock: false,
    visible: true,
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    rotation: 0,
    flipX: false,
    flipY: false,
    usedInCharacter: true,
    ox: 0,
    oy: 0,
    value: {
      radiusX: 50,
      radiusY: 50,
      fillColor: '#000000',
    },
    ...overrides,
  }
}

/**
 * 创建Mock Polygon组件
 */
export function createMockPolygonComponent(overrides?: Partial<IComponent>): IComponent {
  return {
    uuid: genUUID(),
    type: 'polygon',
    name: 'polygon',
    lock: false,
    visible: true,
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    rotation: 0,
    flipX: false,
    flipY: false,
    usedInCharacter: true,
    ox: 0,
    oy: 0,
    value: {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      fillColor: '#000000',
    },
    ...overrides,
  }
}
