/**
 * 核心数据类型定义
 * 基于重构方案优化后的数据结构
 */

// 重新导出 core/font/types 中的类型
export * from '../font/types'

// ==================== 基础类型 ====================

/**
 * 字符信息
 */
export interface ICharacter {
  uuid: string
  text: string
  unicode: string
}

/**
 * 字体设置
 */
export interface IFontSettings {
  unitsPerEm: number
  ascender: number
  descender: number
  advanceWidth?: number
  tables?: any
}

/**
 * 视图设置
 */
export interface IView {
  zoom: number
  translateX: number
  translateY: number
}

/**
 * 网格设置
 */
export interface IGridItem {
  ox: number
  oy: number
  width: number
  height: number
  centerSquareScale: number
  dx1: number
  dx2: number
  dx3: number
  dx4: number
  dy1: number
  dy2: number
  dy3: number
  dy4: number
  dx: number
  dy: number
}

/**
 * 字符信息
 */
export interface ICharacterInfo {
  gridSettings?: {
    dx: number
    dy: number
    centerSquareSize: number
    size: number
    default?: boolean
    initialGrid?: IGridItem
    currentGrid?: IGridItem
  }
  useSkeletonGrid?: boolean
  layout?: string
  layoutTree?: any
  metrics?: {
    lsb?: number
    advanceWidth?: number
    useDefaultValues?: boolean
  }
}

// ==================== 组件类型 ====================

/**
 * 组件类型枚举
 */
export enum ComponentType {
  Pen = 'pen',
  Polygon = 'polygon',
  Rectangle = 'rectangle',
  Ellipse = 'ellipse',
  Picture = 'picture',
  CustomGlyph = 'glyph',
}

/**
 * 基础组件接口
 */
export interface IComponentBase {
  uuid: string
  type: string
  name: string
  lock: boolean
  visible: boolean
  x: number
  y: number
  w: number
  h: number
  rotation: number
  flipX: boolean
  flipY: boolean
  usedInCharacter: boolean
  opacity?: number
  fillColor?: string
  layer?: string
}

/**
 * 钢笔组件
 */
export interface IPenComponent {
  points: any
  strokeColor: string
  /** 分色填充；缺省表示无分色（非彩色字体图层） */
  fillColor?: string
  closePath: boolean
  editMode: boolean
  contour?: Array<any>
  preview?: Array<any>
}

/**
 * 多边形组件
 */
export interface IPolygonComponent {
  points: any
  strokeColor: string
  fillColor: string
  closePath: boolean
  contour?: Array<any>
  preview?: Array<any>
}

/**
 * 矩形组件
 */
export interface IRectangleComponent {
  width: number
  height: number
  strokeColor: string
  fillColor?: string
  closePath: boolean
  contour?: Array<any>
  preview?: Array<any>
}

/**
 * 椭圆组件
 */
export interface IEllipseComponent {
  radiusX: number
  radiusY: number
  strokeColor: string
  fillColor?: string
  closePath: boolean
  contour?: Array<any>
  preview?: Array<any>
}

/**
 * 图片组件
 */
export interface IPictureComponent {
  data: string
  img: HTMLImageElement
  pixels: Array<number> | Uint8ClampedArray
  originImg: HTMLImageElement
  pixelMode: boolean
  contour?: Array<any>
  preview?: Array<any>
}

/**
 * 组件值类型联合
 */
export type IComponentValue =
  | IPenComponent
  | IPolygonComponent
  | IRectangleComponent
  | IEllipseComponent
  | IPictureComponent
  | ICustomGlyphComponent

/**
 * 字符组件（用于字符编辑界面）
 */
export interface IComponent extends IComponentBase {
  value: IComponentValue
  ox?: number // x-offset
  oy?: number // y-offset
}

/**
 * 字形组件（用于字形编辑界面）
 */
export interface IGlyphComponent extends IComponentBase {
  value: IComponentValue
  ox?: number
  oy?: number
}

// ==================== 后处理规则类型 ====================

/**
 * 后处理规则类型枚举
 */
export enum PostProcessRuleType {
  Difference = 'difference',
  /** 差集留白：合并目标组件 → 膨胀 → 差集 */
  DifferenceRetainWhitespace = 'differenceRetainWhitespace',
}

/**
 * 后处理规则基础接口
 */
export interface IPostProcessRule {
  type: PostProcessRuleType
}

/**
 * 差集后处理规则
 * 计算当前组件与目标组件的差集，使用面积最大的结果作为最终轮廓
 */
export interface IDifferenceRule extends IPostProcessRule {
  type: PostProcessRuleType.Difference
  /** 目标组件 UUID 列表（当前字符/字形中包含的其他组件） */
  targetComponentUUIDs: string[]
}

/**
 * 差集留白后处理规则
 * 与差集类似，但先将目标组件合并后膨胀（默认30px留白），再用当前组件减去膨胀后的合集
 */
export interface IDifferenceRetainWhitespaceRule extends IPostProcessRule {
  type: PostProcessRuleType.DifferenceRetainWhitespace
  /** 目标组件 UUID 列表 */
  targetComponentUUIDs: string[]
  /** 留白膨胀距离（px），默认 30 */
  whitespaceMargin?: number
}

/**
 * 后处理规则联合类型
 */
export type PostProcessRule = IDifferenceRule | IDifferenceRetainWhitespaceRule

/**
 * 自定义字形组件值
 */
export interface ICustomGlyphComponent {
  uuid: string
  name: string
  components: Array<IGlyphComponent>
  groups?: Array<any>
  orderedList?: Array<{ type: string; uuid: string }>
  parameters?: Array<any>
  skeleton?: any
  joints?: Array<IJoint>
  reflines?: Array<IRefLine>
  script?: string
  script_reference?: string
  variables?: IVariable[]
  layers?: Record<string, string[]>
  /** 后处理规则列表 */
  postProcessRules?: PostProcessRule[]
  // ... 其他属性
}

/**
 * 组件类型联合
 */
export type Component = IComponent | IGlyphComponent

// ==================== 轮廓类型 ====================

/**
 * 直线
 */
export interface ILine {
  type: 'line'
  start: { x: number; y: number }
  end: { x: number; y: number }
}

/**
 * 二次贝塞尔曲线
 */
export interface IQuadraticBezierCurve {
  type: 'quadratic'
  start: { x: number; y: number }
  control: { x: number; y: number }
  end: { x: number; y: number }
}

/**
 * 三次贝塞尔曲线
 */
export interface ICubicBezierCurve {
  type: 'cubic'
  start: { x: number; y: number }
  control1: { x: number; y: number }
  control2: { x: number; y: number }
  end: { x: number; y: number }
}

/**
 * 轮廓类型联合
 */
export type ContourSegment = ILine | IQuadraticBezierCurve | ICubicBezierCurve
export type Contour = Array<ContourSegment>

// ==================== 字符文件类型（优化后） ====================

/**
 * 字符文件元数据（仅包含基本信息，用于列表显示）
 */
export interface ICharacterFileMetadata {
  uuid: string
  type: string
  character: ICharacter
  // 其他字段存储在IndexedDB中
}

/**
 * 字符文件（轻量版，大型数据存储在IndexedDB）
 */
export interface ICharacterFileLite {
  uuid: string
  type: string
  character: ICharacter
  components: Array<IComponent>
  groups: Array<{
    type: string
    uuid: string
  }>
  orderedList: Array<{
    type: string
    uuid: string
  }>
  view: IView
  info?: ICharacterInfo
  selectedComponentsTree?: Array<string>
  selectedComponentsUUIDs?: Array<string>
  script?: string
  glyph_script?: string
  contourRef?: string // IndexedDB key for contour data
  previewRef?: string // IndexedDB key for preview data
  /** 部件拆解（部分批量脚本依赖；可选） */
  decomposition?: unknown
  /** 部件匹配表（部分批量脚本依赖；可选） */
  matches?: unknown
}

/**
 * 参考线接口
 */
export interface IRefLine {
  id?: string
  name: string
  start: string
  end: string
  type?: string
}

/**
 * 关节接口
 */
export interface IJoint {
  id?: string
  name: string
  x: number | (() => number)
  y: number | (() => number)
  uuid?: string
}

/**
 * 字形脚本回调接口
 */
export interface IGlyphScriptCallbacks {
  onSkeletonDragStart?: (event: { draggingJoint: any; deltaX: number; deltaY: number }) => void
  onSkeletonDrag?: (event: { draggingJoint: any; deltaX: number; deltaY: number }) => void
  onSkeletonDragEnd?: (event: { draggingJoint: any; deltaX: number; deltaY: number }) => void
}

/**
 * 可变参数关键帧
 */
export interface IKeyframe {
  uuid: string
  value: number
  layer: string
}

/**
 * 可变参数（用于字形轮廓差值）
 */
export interface IVariable {
  uuid: string
  name: string
  min: number
  max: number
  default: number
  value: number
  keyframes: IKeyframe[]
}

/**
 * 自定义字形
 */
export interface ICustomGlyph {
  uuid: string
  name: string
  type: string
  components: Array<IGlyphComponent>
  groups?: Array<any>
  orderedList?: Array<{ type: string; uuid: string }>
  selectedComponentsTree?: Array<string>
  selectedComponentsUUIDs?: Array<string>
  script?: string
  script_reference?: string
  glyph_script?: Record<string, string>
  param_script?: Record<string, string>
  system_script?: Record<string, string>
  constants?: Array<any>
  parameters?: Array<any>
  // skeleton binding (ported from original project)
  skeleton?: any
  joints?: Array<IJoint>
  reflines?: Array<IRefLine>
  contourRef?: string // IndexedDB key for contour data
  previewRef?: string // IndexedDB key for preview data
  view?: {
    zoom?: number
    translateX?: number
    translateY?: number
  }
  style?: string
  /** 图层：layerName -> component UUIDs */
  layers?: Record<string, string[]>
  /** 可变参数（差值轴） */
  variables?: IVariable[]
  /** 后处理规则列表 */
  postProcessRules?: PostProcessRule[]
  // ... 其他属性
}

/**
 * 参数类型枚举
 */
export enum ParameterType {
  Number = 0,
  Constant = 1,
  RingController = 2,
  Enum = 3,
  PlaygroundConstant = 4,
  AdvancedEditConstant = 5,
}

/**
 * 字形参数接口
 */
export interface IParameter {
  uuid: string
  name: string
  type: ParameterType
  value: number | string
  ratio?: string
  ratioed?: boolean
  min?: number
  max?: number
  options?: Array<{ label: string; value: any }>
}

/**
 * 全局常量接口
 */
export interface IConstant {
  uuid: string
  name: string
  value: number
  type?: ParameterType
  min?: number
  max?: number
  ratio?: string
  ratioed?: boolean
  options?: Array<{ label: string; value: any }>
}

/** 环形控件参数（字形/常量参数编辑） */
export interface IRingAxisParam {
  name: string
  min: number
  max: number
  value: number
}

export interface IRingParameter {
  radius: IRingAxisParam
  degree: IRingAxisParam
  params: Array<{ name: string; min: number; max: number; value: number }>
}

/**
 * 文件数据结构
 */
export interface IFile {
  uuid: string
  name: string
  /** 工程标签（写入 JSON `file.tag`，保存/导出前由用户确认） */
  tag?: string
  width: number
  height: number
  saved: boolean
  iconsCount: number
  fontSettings?: IFontSettings
  // 只存储字符元数据（uuid, text等），完整数据存储在IndexedDB
  characterList: Array<ICharacterFileMetadata>
  glyphs?: Array<ICustomGlyph>
  stroke_glyphs?: Array<ICustomGlyph>
  radical_glyphs?: Array<ICustomGlyph>
  comp_glyphs?: Array<ICustomGlyph>
  constants?: Array<IConstant>
  variants?: any
}

// ==================== 编辑器状态 ====================

/**
 * 编辑状态枚举
 */
export enum EditStatus {
  CharacterList = 'CharacterList',
  StrokeGlyphList = 'StrokeGlyphList',
  RadicalGlyphList = 'RadicalGlyphList',
  CompGlyphList = 'CompGlyphList',
  GlyphList = 'GlyphList',
  Edit = 'Edit',
  Glyph = 'Glyph',
  Pic = 'Pic',
  AdvancedEdit = 'AdvancedEdit',
}
