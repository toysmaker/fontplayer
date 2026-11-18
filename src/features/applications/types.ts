import type { IAnimationClip, ICharacterFileLite, IMicroInteraction } from '@/core/types'

export type ApplicationType = 'card' | 'logo' | 'avatar'

/** 应用文档（存 IndexedDB；fontBuffer 为每次保存固化的字体拷贝） */
export interface IApplicationDocument {
  schemaVersion: number
  type: ApplicationType
  id: string
  name: string
  createdAt: number
  updatedAt: number
  /** 每次保存固化的字体拷贝（去重叠 + cff，或彩色字体） */
  fontBuffer: ArrayBuffer
  fontFamily: string
  videos: IAppVideoDocument[]
  micros: IAppMicroDocument[]
  data: ICardAppData | ILogoAppData | IAvatarAppData
}

// ---------------- 画布组件（卡片应用画布） ----------------

export interface IImageSourcePattern {
  kind: 'pattern'
  patternId: string
}

export interface IImageSourceFile {
  kind: 'file'
  dataUrl: string
}

export type IImageSource = IImageSourcePattern | IImageSourceFile

export interface IImageComponent {
  kind: 'image'
  id: string
  x: number
  y: number
  width: number
  height: number
  source: IImageSource
  opacity?: number
}

export interface IFreeTextComponent {
  kind: 'freeText'
  id: string
  x: number
  y: number
  width: number
  height: number
  text: string
  fontSize: number
  direction: 'horizontal' | 'vertical'
  color: string
  align?: 'left' | 'center' | 'right'
  lineHeight?: number
}

export interface ICharGridComponent {
  kind: 'charGrid'
  id: string
  x: number
  y: number
  width: number
  height: number
  cols: number
  rows: number
  gapX: number
  gapY: number
  content: string
  fontSize: number
  color: string
}

export type IAppComponent = IImageComponent | IFreeTextComponent | ICharGridComponent

export interface ICardAppData {
  canvas: { width: number; height: number; background: string }
  /** 数组顺序 = z 序（下标大者在上） */
  components: IAppComponent[]
}

// ---------------- 视频文档（卡片/logo 共用的组合视频） ----------------

export interface IPlacedClip {
  id: string
  /** 引用字符的 IAnimationClip.id */
  clipId: string
  /** 起始时间（秒） */
  startTime: number
}

/** 字符在应用布局中的位置（视频保存时从布局解析） */
export interface IAppLayoutPosition {
  x: number
  y: number
  fontSize: number
}

export interface IAppVideoTrack {
  id: string
  label: string
  charUuid: string
  /** 布局位置；null 表示该字符不在布局中（渲染时跳过该轨） */
  layoutPosition: IAppLayoutPosition | null
  /** 对应卡片布局中的字符出现（occurrenceId = 组件id:组件内序号；重复字符各占一轨） */
  occurrenceId?: string
  /** 出现序号（布局顺序，快速排列用） */
  occurrenceIndex?: number
  clips: IPlacedClip[]
}

/** 保存时固化的 (clip, char) 快照，脱离工程可重放/导出 */
export interface IAppClipSnapshot {
  charUuid: string
  clipId: string
  clip: IAnimationClip
  char: ICharacterFileLite
}

export interface IAppVideoDocument {
  id: string
  name: string
  fps: number
  width: number
  height: number
  /** 渲染模式（创建时默认取当前预览模式，可修改；预览/导出统一按此渲染） */
  renderStyle?: 'contour' | 'black' | 'color'
  tracks: IAppVideoTrack[]
  snapshots: IAppClipSnapshot[]
  createdAt: number
  updatedAt: number
}

// ---------------- 微交互（复用 IMicroInteraction；状态 segmentId = 视频 id） ----------------

export interface IAppMicroDocument {
  id: string
  name: string
  micro: IMicroInteraction
}

// ---------------- Logo ----------------

export type ILogoIconSource =
  | { kind: 'fontLibrary'; unicode: string }
  | { kind: 'external'; dataUrl: string; isSvg: boolean }

/** 生成时固化的布局块（供视频合成/SVG 复现，脱离工程可重建） */
export interface ILogoLayoutBlock {
  char: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
}

export interface ILogoPersistedLayout {
  totalW: number
  totalH: number
  iconBlock: ILogoLayoutBlock | null
  textBlocks: ILogoLayoutBlock[]
}

export interface ILogoAppData {
  iconSource: ILogoIconSource
  text: string
  /** 默认 72 */
  iconFontSize: number
  /** 默认 72 */
  textFontSize: number
  /** 默认 mono（黑白） */
  mode: 'mono' | 'color'
  /** 默认 leftRight */
  layout: 'leftRight' | 'topBottom'
  /** 生成时自动规划 */
  canvas: { width: number; height: number }
  /** 生成时固化的布局（视频/导出复现用） */
  layoutBlocks: ILogoPersistedLayout | null
}

// ---------------- 头像 ----------------

export type IAvatarIconSource =
  | { kind: 'none' }
  | { kind: 'fontLibrary'; unicode: string }
  | { kind: 'external'; dataUrl: string; isSvg: boolean }

export interface IAvatarAppData {
  iconSource: IAvatarIconSource
  /** 1-4 字 */
  text: string
  /** 默认 500（正方形边长） */
  size: number
  /** 图标字号（默认 size*0.35；旧数据缺失时回退） */
  iconFontSize?: number
  /** 文本字号（默认 size*0.35；旧数据缺失时回退） */
  textFontSize?: number
}

// ---------------- 动态模板（布局 + 动画组合模板） ----------------

export interface IAppTemplateTrack {
  /** 卡片布局中的字符出现序号（第 N 个出现，含重复，按组件 z 序排列） */
  charIndex: number
  /** 匹配字符 animations 中同名 clip；无则不放置 */
  clipName?: string
  /** 与前一轨的时间间隔（秒） */
  startInterval: number
}

// ---------------- 布局字符出现（视频左侧列表一一对应） ----------------

export interface IAppLayoutChar {
  /** 出现标识（组件id:组件内序号），布局修改后仍稳定 */
  id: string
  char: string
  x: number
  y: number
  fontSize: number
  /** 对应工程字符 uuid（找不到为 null，如外部图标/工程缺失字符） */
  charUuid: string | null
}

export interface IAppTemplate {
  id: string
  name: string
  canvas: { width: number; height: number; background: string }
  components: IAppComponent[]
  tracks: IAppTemplateTrack[]
}
