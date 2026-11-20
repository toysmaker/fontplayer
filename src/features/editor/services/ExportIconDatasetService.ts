import { useProjectStore } from '@/stores/project'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { isTauri } from '@/utils/env'
import { unicodeToCode } from '@/utils/unicode'
import { PathType, type IContour } from '@/core/font/types'
import { ContourConverter } from '@/core/font/converter'
import type { ICharacterFileLite, IFile } from '@/core/types'
import { buildExportColorFontBuffer } from '@/features/editor/services/ExportColorFontService'
import { resolveFontSettings } from '@/features/editor/services/ExportFontService'
import { exportAnimationClip } from '@/features/animation/exporters'
import {
  buildStateMachineData,
} from '@/features/animation/stateMachineExporter'
import { buildReferencePlayerHtml } from '@/features/animation/referencePlayerHtml'

/**
 * 导出图标数据集（测试菜单）：
 * 1. 当前字符列表中所有图标 → 彩色字库 OTF
 * 2. 每个图标 → SVG（以 unicode 命名，如 0xf000.svg）
 * 3. 每个图标的动效 → GIF（unicode_动效名.gif）；
 *    微交互 → JSON + HTML（unicode_交互名）
 * 所有文件生成到用户选择的本地文件夹（Tauri 目录选择；Web 回退为 zip 下载）。
 */

function sanitizeName(name: string): string {
  return (name || 'unnamed').replace(/[\\/:*?"<>|]/g, '_')
}

function iconUnicodeName(unicode: string | number): string {
  const code = unicodeToCode(unicode)
  return `0x${code.toString(16).toLowerCase()}`
}

function clipFrameCount(clip: { keyframes?: Array<{ time: number }>; fps?: number }): number {
  const kfs = clip.keyframes ?? []
  if (kfs.length === 0) return 1
  const times = kfs.map((k) => k.time)
  const duration = Math.max(0.001, Math.max(...times) - Math.min(...times))
  return Math.max(1, Math.ceil(duration * (clip.fps || 30)))
}

function isIconMeta(meta: { type: string }): boolean {
  return meta.type === 'icon'
}

/** 轮廓 → SVG path（字体坐标 y-up，SVG 内统一翻转） */
function contourToPathData(contour: IContour): string {
  if (!contour || contour.length === 0 || !contour[0].start) return ''
  const start = contour[0].start
  let d = `M ${start.x} ${start.y}`
  for (const seg of contour) {
    if (seg.type === PathType.LINE) {
      d += ` L ${seg.end.x} ${seg.end.y}`
    } else if (seg.type === PathType.QUADRATIC_BEZIER) {
      d += ` Q ${seg.control.x} ${seg.control.y} ${seg.end.x} ${seg.end.y}`
    } else if (seg.type === PathType.CUBIC_BEZIER) {
      d += ` C ${seg.control1.x} ${seg.control1.y} ${seg.control2.x} ${seg.control2.y} ${seg.end.x} ${seg.end.y}`
    }
  }
  return `${d} Z`
}

/**
 * 轮廓 → SVG path 列表（与编辑界面/预览渲染一致的填充语义）：
 * - 同一「填充单元 + 颜色」的轮廓合并为一条 `<path>` 并统一 fill-rule="nonzero"，
 *   方向相反的轮廓才能通过非零环绕规则形成镂空；逐轮廓单独填充会把镂空填实。
 * - 实心轮廓（矩形/椭圆）始终最后单独绘制，不参与非零环绕合并。
 * @param hasColor 是否为彩色模式；黑白模式所有非实心轮廓合并为一条黑色 path
 */
export function contourGroupsToSvgPaths(
  contours: IContour[],
  solidFlags: boolean[],
  fillColors: string[],
  fillUnits: string[],
  hasColor: boolean,
): string[] {
  const colorOf = (i: number): string =>
    fillColors[i] && fillColors[i] !== '#000' ? fillColors[i] : '#000000'
  const paths: string[] = []
  const solidPaths: string[] = []

  if (hasColor) {
    // 彩色：按 (fillUnit, color) 分组，保持首次出现顺序
    const groups: Array<{ color: string; ds: string[] }> = []
    const groupIndexByKey = new Map<string, number>()
    for (let i = 0; i < contours.length; i++) {
      if (solidFlags[i]) continue
      const d = contourToPathData(contours[i])
      if (!d) continue
      const color = colorOf(i)
      const key = `${fillUnits[i] || ''}|${color}`
      let groupIndex = groupIndexByKey.get(key)
      if (groupIndex === undefined) {
        groupIndex = groups.length
        groupIndexByKey.set(key, groupIndex)
        groups.push({ color, ds: [] })
      }
      groups[groupIndex].ds.push(d)
    }
    for (const g of groups) {
      paths.push(`<path d="${g.ds.join(' ')}" fill="${g.color}" fill-rule="nonzero"/>`)
    }
    for (let i = 0; i < contours.length; i++) {
      if (!solidFlags[i]) continue
      const d = contourToPathData(contours[i])
      if (!d) continue
      solidPaths.push(`<path d="${d}" fill="${colorOf(i)}" fill-rule="nonzero"/>`)
    }
  } else {
    // 黑白：所有非实心轮廓合并为一条 path（nonzero 镂空），实心轮廓最后单独绘制
    const ds: string[] = []
    for (let i = 0; i < contours.length; i++) {
      if (solidFlags[i]) continue
      const d = contourToPathData(contours[i])
      if (d) ds.push(d)
    }
    if (ds.length > 0) {
      paths.push(`<path d="${ds.join(' ')}" fill="#000000" fill-rule="nonzero"/>`)
    }
    for (let i = 0; i < contours.length; i++) {
      if (!solidFlags[i]) continue
      const d = contourToPathData(contours[i])
      if (d) solidPaths.push(`<path d="${d}" fill="#000000" fill-rule="nonzero"/>`)
    }
  }

  return [...paths, ...solidPaths]
}

function buildIconSvg(char: ICharacterFileLite, file: IFile): string {
  const fs = resolveFontSettings(file)
  const { unitsPerEm, ascender = 800, descender = -200 } = fs
  const height = ascender - descender

  // 与预览渲染（CharacterRenderer）同一条管线：componentsToContours 输出
  // 轮廓 + solid 标记 + 逐轮廓颜色 + 填充单元（glyph 组件的同色子轮廓共享单元）
  const components = ContourConverter.getComponentsForCharacter(char)
  const solidFlags: boolean[] = []
  const fillColors: string[] = []
  const fillUnits: string[] = []
  const allContours = ContourConverter.componentsToContours(
    components,
    {
      unitsPerEm,
      descender,
      advanceWidth: unitsPerEm,
      preview: false,
      forceUpdate: true,
    },
    { x: 0, y: 0 },
    solidFlags,
    fillColors,
    fillUnits,
  )

  const hasColor = fillColors.some((c) => !!c && c !== '#000')
  const paths = contourGroupsToSvgPaths(
    allContours as IContour[],
    solidFlags,
    fillColors,
    fillUnits,
    hasColor,
  )

  const width = Math.max(1, Math.round((char.info?.metrics?.advanceWidth ?? unitsPerEm) / unitsPerEm * unitsPerEm))
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<g transform="translate(0, ${ascender}) scale(1, -1)">
${paths.join('\n')}
</g>
</svg>
`
}

interface PendingFile {
  name: string
  blob: Blob
}

export async function exportIconDataset(onDone?: (msg: string) => void): Promise<void> {
  const projectStore = useProjectStore()
  const file = projectStore.selectedFile
  if (!file) {
    onDone?.('当前没有打开的工程')
    return
  }
  const iconMetas = file.characterList.filter((m) => isIconMeta(m as { type: string }))
  if (iconMetas.length === 0) {
    onDone?.('当前工程没有图标')
    return
  }

  // 选择保存目录（Tauri）；Web 回退 zip 下载
  let targetDir: string | null = null
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true, title: '选择导出文件夹' })
    if (!selected) return
    targetDir = typeof selected === 'string' ? selected : (selected as { path?: string }).path ?? null
    if (!targetDir) return
  }

  const isTauriEnv = isTauri() && !!targetDir
  const pending: PendingFile[] = []

  // 全程 loading 进度条（全局 LoadingProgress 组件读取 projectStore 状态）
  projectStore.loading = true
  projectStore.loadingProgress = 0
  try {
    // 0) 预加载字符 + 统计总文件数（用于进度总量）
    const plan: Array<{ meta: (typeof iconMetas)[0]; char: ICharacterFileLite | null }> = []
    let totalFiles = 1 // icons-color.otf
    for (const meta of iconMetas) {
      const char = await characterDataManager.loadCharacter(file.uuid, meta.uuid)
      plan.push({ meta, char })
      totalFiles += 1 // SVG
      totalFiles += (char?.animations ?? []).length // GIF
      totalFiles += (char?.microInteractions ?? []).length * 2 // JSON + HTML
    }
    projectStore.loadingTotal = totalFiles
    let filesDone = 0

    // Tauri：立即建目录，边生成边写入（内存只保留当前文件，防止大导出 OOM 被系统杀掉）
    let outDir: string | null = null
    let writeFileFn: ((path: string, bytes: Uint8Array) => Promise<void>) | null = null
    if (isTauriEnv) {
      const { mkdir, writeFile } = await import('@tauri-apps/plugin-fs')
      outDir = `${targetDir}/icon_dataset`
      await mkdir(outDir, { recursive: true })
      writeFileFn = async (name, bytes) => {
        await writeFile(`${outDir}/${name}`, bytes)
        filesDone++
        projectStore.loadingProgress = filesDone
        projectStore.loadingMessage = `写入文件 ${filesDone}/${totalFiles}：${name}`
      }
    }

    // 统一写入：Tauri 落盘；Web 收集进 zip
    const emitFile = async (name: string, blob: Blob) => {
      if (writeFileFn) {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        await writeFileFn(name, bytes)
      } else {
        pending.push({ name, blob })
      }
    }

    // 1) 彩色字库 OTF（全部图标）
    projectStore.loadingMessage = '正在生成彩色字库…'
    const iconFile: IFile = { ...file, characterList: iconMetas, iconsCount: iconMetas.length }
    const fontBuffer = await buildExportColorFontBuffer(
      iconFile,
      {
        editingCharacterUUID: '',
        editingCharacter: null,
        onProgress: (done, total) => {
          projectStore.loadingMessage = `生成彩色字库（${done}/${total} 字符）…`
        },
      },
      { removeOverlap: false } // 与「导出彩色字体」默认一致（不勾选去除重叠）
    )
    await emitFile('icons-color.otf', new Blob([fontBuffer], { type: 'font/otf' }))

    // 2) 每图标 SVG；3) 动效 GIF 与微交互 JSON/HTML（生成完立即写盘）
    for (const { meta, char } of plan) {
      const iconLabel = meta.character.text || iconUnicodeName(meta.character.unicode)
      if (!char) continue
      const uname = iconUnicodeName(meta.character.unicode)

      projectStore.loadingMessage = `处理图标 ${iconLabel}（SVG）…`
      await emitFile(
        `${uname}.svg`,
        new Blob([buildIconSvg(char, file)], { type: 'image/svg+xml;charset=utf-8' })
      )

      const clips = char.animations ?? []
      for (const clip of clips) {
        try {
          const gif = await exportAnimationClip({
            clip,
            char,
            format: 'gif',
            onProgress: (done, total) => {
              projectStore.loadingMessage = `导出动效 ${clip.name}（${done}/${total} 帧）…`
            },
          })
          await emitFile(`${uname}_${sanitizeName(clip.name)}.gif`, gif)
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn('[iconDataset] gif export failed:', err)
          }
        }
      }

      const micros = char.microInteractions ?? []
      for (const micro of micros) {
        try {
          const data = buildStateMachineData(micro, clips, char)
          const base = `${uname}_${sanitizeName(micro.name)}`
          await emitFile(
            `${base}.json`,
            new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
          )
          await emitFile(
            `${base}.html`,
            new Blob([buildReferencePlayerHtml(data)], { type: 'text/html;charset=utf-8' })
          )
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn('[iconDataset] micro export failed:', err)
          }
        }
      }
    }

    // 完成
    if (isTauriEnv && outDir) {
      onDone?.(`已导出 ${filesDone} 个文件到 ${outDir}`)
      return
    }

    // Web 回退：zip 打包下载
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    for (const f of pending) {
      zip.file(f.name, f.blob)
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const { saveAs } = await import('file-saver')
    saveAs(zipBlob, 'icon_dataset.zip')
    onDone?.(`已打包 ${pending.length} 个文件（icon_dataset.zip）`)
  } finally {
    projectStore.loading = false
  }
}
