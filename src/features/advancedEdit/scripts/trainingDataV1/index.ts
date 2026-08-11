/**
 * 生成训练数据 v1
 *
 * 三级变换联动生成风格变体：
 * 1. 笔画风格（5种）：字玩标准黑体、楷体、隶书、宋体、仿宋
 * 2. 笔画宽度对比度（3种）：1.0, 1.25, 1.5
 * 3. 自由布局（3种）：dy2/dy4 分别为 0/0, -20/-20, -40/-40
 *
 * 共 5 × 3 × 3 = 45 个变体，每个字符生成 45 张 1000×1000 透明背景黑色字形 PNG
 */

import * as R from 'ramda'
import type { ICharacterFileLite, IComponent, IGlyphComponent, ICustomGlyph } from '@/core/types'
import { useProjectStore } from '@/stores/project'
import { useAdvancedEditStore, STYLE_SWITCH_PRESETS, type StyleSwitchPreset } from '@/stores/advancedEdit'
import { characterDataManager } from '@/core/storage/CharacterDataManager'
import { executeCharacterScript, executeGlyphScript } from '@/core/script/ScriptExecutor'
import { ContourConverter } from '@/core/font/converter'
import { RenderEngine } from '@/core/font/renderer'
import { instanceManager } from '@/core/instance/InstanceManager'
import { orderedListWithItemsForCharacterFile } from '@/features/editor/services/FormatGlyphService'
import { defaultGridItem, ensureCharacterInfoGridSettings } from '@/stores/character'
import { formatContainerGlyphComponents, formatGridComponents } from '@/features/editor/services/FormatGlyphService'
import { glyphRuntime } from '@/features/advancedEdit/scripts/glyphRuntime'
import { strokeFnMap } from '@/templates/strokeFnMap'
import { ConstantsMap } from '@/core/script/ConstantsMap'
import { setGlobalConstantsMap, getGlobalConstantsMap } from '@/core/script/ParametersMap'
import {
  isSerifStylePreset,
  applySharedSerifConstantsPatch,
  processCharacterBeforeSerifStyleSwitch,
  processCharacterAfterSongStyleSwitch,
} from '@/features/advancedEdit/styleSwitchPostProcess'

/** 5 种笔画风格预设 */
const STYLE_PRESETS: StyleSwitchPreset[] = [
  STYLE_SWITCH_PRESETS.find((s) => s.uuid === 'ss-heiti')!,
  STYLE_SWITCH_PRESETS.find((s) => s.uuid === 'ss-kai')!,
  STYLE_SWITCH_PRESETS.find((s) => s.uuid === 'ss-li')!,
  STYLE_SWITCH_PRESETS.find((s) => s.uuid === 'ss-song')!,
  STYLE_SWITCH_PRESETS.find((s) => s.uuid === 'ss-fangsong')!,
]

/** 3 种对比度参数 */
const CONTRAST_VALUES = [1.0, 1.25, 1.5]

/** 3 种自由布局变体：仅改变当前布局的 dy2/dy4 */
const LAYOUT_VARIANTS = [
  { label: '1', dy2: 0, dy4: 0 },
  { label: '2', dy2: -20, dy4: -20 },
  { label: '3', dy2: -40, dy4: -40 },
]

/**
 * 对单个字符的克隆应用笔画宽度对比度（简化版：逐字形 pow 变换）
 *
 * 与原版 updateWidthStrokesContrast 的区别：
 * - 不需要 decomposition / matches 数据
 * - 以整个字符的全局 x 范围计算 pow 变换基准
 * - 对每个字形组件的关节 x 坐标应用 pow 变换后重新计算参数
 */
function applySimpleWidthContrast(char: ICharacterFileLite, contrastValue: number): void {
  if (contrastValue === 1.0) return

  const glyphComps = (char.components || []).filter(
    (c) => c.type === 'glyph',
  ) as IGlyphComponent[]

  if (glyphComps.length === 0) return

  // 第一遍：收集所有关节数据，计算全局 x 范围
  let minX = Infinity
  let maxX = -Infinity
  const jointDataList: Array<{
    comp: IGlyphComponent
    joints: any[]
    ox: number
    oy: number
  }> = []

  for (const gc of glyphComps) {
    const runtime = glyphRuntime(gc)
    if (!runtime) continue
    const joints = runtime.getJoints()
    if (!joints || joints.length === 0) {
      instanceManager.releaseTemporaryInstance(gc.uuid)
      continue
    }

    for (const j of joints) {
      const wx = (j.x ?? j._x ?? 0) + (gc.ox || 0)
      minX = Math.min(minX, wx)
      maxX = Math.max(maxX, wx)
    }
    jointDataList.push({
      comp: gc,
      joints,
      ox: gc.ox || 0,
      oy: gc.oy || 0,
    })
    // 释放第一遍的临时实例
    instanceManager.releaseTemporaryInstance(gc.uuid)
  }

  if (minX === Infinity || maxX === -Infinity || maxX - minX === 0) return

  const width = maxX - minX
  const centerX = minX + width / 2

  // 第二遍：对每个字形应用 pow 变换
  for (const { comp, joints, ox, oy } of jointDataList) {
    const runtime = glyphRuntime(comp)
    if (!runtime) continue

    const pointsMap: Record<string, { x: number; y: number }> = {}
    const firstJointIndex =
      joints.findIndex((j: any) => !(j.name || '').includes('_ref')) || 0

    for (let i = 0; i < joints.length; i++) {
      const j = joints[i]
      const jx = j.x ?? j._x ?? 0
      const jy = j.y ?? j._y ?? 0
      const x = jx + ox
      const y = jy + oy
      const d = x - centerX
      const absD = Math.abs(d)
      const D = Math.pow(absD * 2 / width, contrastValue)
      let newX = x
      if (D > 0.1 && absD > 20) {
        newX = centerX + (d > 0 ? 1 : -1) * D * width / 2
      }

      if (i === firstJointIndex) {
        comp.ox = ox + (newX - x)
      }

      pointsMap[j.name || `joint_${i}`] = {
        x: newX - (comp.ox || 0),
        y: y - (comp.oy || 0),
      }
    }

    // 通过 strokeFnMap 或实例方法重新计算参数
    const glyph = comp.value as ICustomGlyph
    const strokeName = glyph.name as string

    const instAny = runtime as unknown as {
      computeParamsByJoints?: (m: typeof pointsMap) => unknown
      updateParamsByJoints?: (p: unknown) => void
    }

    let updated = false
    if (typeof instAny.computeParamsByJoints === 'function') {
      try {
        const params = instAny.computeParamsByJoints(pointsMap)
        if (typeof instAny.updateParamsByJoints === 'function') {
          instAny.updateParamsByJoints(params)
          updated = true
        }
      } catch { /* fallback */ }
    }

    if (!updated) {
      const fn = (strokeFnMap as any)[strokeName]
      if (fn?.computeParamsByJoints && fn?.updateParamsByJoints) {
        try {
          const params = fn.computeParamsByJoints(pointsMap, runtime)
          fn.updateParamsByJoints(params, runtime)
          updated = true
        } catch { /* skip */ }
      }
    }

    // 重新执行脚本以应用新参数
    if (updated) {
      try {
        executeGlyphScript(glyph, comp.uuid, { ignoreTempDataGuard: true })
      } catch { /* skip */ }
    }

    // 释放第二遍的临时实例
    instanceManager.releaseTemporaryInstance(comp.uuid)
  }
}

/**
 * 为自由布局变体构建 grid 对象
 */
function buildLayoutGrid(dy2: number, dy4: number) {
  const initialGrid = defaultGridItem()
  const currentGrid = {
    ...defaultGridItem(),
    dy2,
    dy4,
  }
  return { initialGrid, currentGrid }
}

/**
 * 将字符渲染到离屏 canvas 并导出为 PNG Uint8Array
 */
function renderCharToPngData(
  orderedComps: IComponent[],
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1000
    canvas.height = 1000

    try {
      const contours = ContourConverter.componentsToContoursEditing(orderedComps, {
        x: 0,
        y: 0,
      })

      RenderEngine.renderPreview(canvas, contours, {
        fillColor: '#000',
        backgroundColor: 'rgba(0,0,0,0)',
        previewStyle: 'black',
        scale: 1,
        offset: { x: 0, y: 0 },
      })

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('canvas.toBlob returned null'))
          return
        }
        blob.arrayBuffer().then((buf) => {
          resolve(new Uint8Array(buf))
        }).catch(reject)
      }, 'image/png')
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * 主入口：生成训练数据 v1
 *
 * 流程：
 * 1. 让用户选择输出根目录
 * 2. 遍历工程中所有字符
 * 3. 对每个字符应用 5×3×3 变体组合
 * 4. 渲染为 PNG 并保存到对应文件夹
 */
export async function generateTrainingDataV1() {
  const projectStore = useProjectStore()
  const file = projectStore.selectedFile

  if (!file || !file.characterList?.length) {
    alert('当前工程没有字符')
    return
  }

  // 检查笔画风格可用性
  const advStore = useAdvancedEditStore()
  const availableStyles = STYLE_PRESETS.filter((s) => {
    if (s.uuid === 'default') return false
    return advStore.projectHasStrokeStyle(s.strokeStyle)
  })

  if (availableStyles.length === 0) {
    alert('当前工程没有可用的笔画风格（需要字玩标准黑体/楷体/隶书/宋体/仿宋的笔画字形）')
    return
  }

  if (import.meta.env.DEV) {
    console.log('[TrainingDataV1] Available styles:', availableStyles.map((s) => s.name))
  }

  // 选择输出根目录
  const { open } = await import('@tauri-apps/plugin-dialog')
  const rootPath = await open({ directory: true, title: '选择训练数据输出根目录' })
  if (!rootPath) return

  const { mkdir } = await import('@tauri-apps/plugin-fs')

  // 创建根目录
  const rootDir = `${rootPath}/training_data_v1`
  await mkdir(rootDir, { recursive: true })

  const charList = file.characterList
  const totalChars = charList.length
  const totalStyles = availableStyles.length
  const totalContrasts = CONTRAST_VALUES.length
  const totalLayouts = LAYOUT_VARIANTS.length
  const totalVariants = totalStyles * totalContrasts * totalLayouts
  const totalSteps = totalChars * totalVariants

  projectStore.loading = true
  projectStore.loadingTotal = totalSteps
  projectStore.loadingProgress = 0
  projectStore.loadingMessage = '准备生成训练数据…'

  let completed = 0
  let lastYield = performance.now()

  try {
    for (let charIdx = 0; charIdx < totalChars; charIdx++) {
      const meta = charList[charIdx]
      const charText = meta.character?.text || `char_${charIdx}`
      const safeCharName = charText.replace(/[\/\\:*?"<>|]/g, '_')

      // 加载原始字符数据
      const originalChar = await characterDataManager.loadCharacter(file.uuid, meta.uuid)
      if (!originalChar) {
        // 跳过无法加载的字符，但推进进度
        completed += totalVariants
        projectStore.loadingProgress = completed
        continue
      }

      // 克隆原始字符并执行字符脚本（所有风格变体的起点）
      const baseChar = R.clone(originalChar) as ICharacterFileLite
      try {
        executeCharacterScript(baseChar, baseChar.uuid)
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn(`[TrainingDataV1] Character script failed for "${charText}":`, e)
        }
      }

      for (let styleIdx = 0; styleIdx < totalStyles; styleIdx++) {
        const stylePreset = availableStyles[styleIdx]

        // 构建风格专属的全局常量映射（对齐 refreshStyleSwitchPreviews / applyStyleToEntireProject）
        const fileConstants = R.clone(projectStore.selectedFile?.constants || []) as any[]
        // mergeStyleConstantsInto：将风格预设常量写入工程常量
        for (const c of fileConstants) {
          for (const sc of stylePreset.constants) {
            if (c.name === sc.name) c.value = sc.value
          }
        }
        // 衬线字体（宋/仿宋/楷/隶）需要额外的全局常量补丁
        if (isSerifStylePreset(stylePreset)) {
          applySharedSerifConstantsPatch(fileConstants)
        }
        const tempConstantsMap = ConstantsMap.createLocal(fileConstants)
        const prevConstantsMap = getGlobalConstantsMap()
        setGlobalConstantsMap(tempConstantsMap)

        try {
          // 克隆并应用风格
          const styleChar = R.clone(baseChar) as ICharacterFileLite

          // 仿宋/楷体/隶书：风格替换前的预处理
          if (stylePreset.uuid === 'ss-fangsong') {
            processCharacterBeforeSerifStyleSwitch(styleChar, fileConstants, 'fangsong')
          } else if (stylePreset.uuid === 'ss-kai') {
            processCharacterBeforeSerifStyleSwitch(styleChar, fileConstants, 'kai')
          } else if (stylePreset.uuid === 'ss-li') {
            processCharacterBeforeSerifStyleSwitch(styleChar, fileConstants, 'li')
          }

          // 替换笔画并执行脚本
          try {
            advStore.switchStyle2OnCharacterWithScripts(styleChar, stylePreset)
          } catch (e) {
            if (import.meta.env.DEV) {
              console.warn(
                `[TrainingDataV1] Style switch failed for "${charText}" style="${stylePreset.name}":`,
                e,
              )
            }
          }

          // 宋体：风格替换后的后处理
          if (stylePreset.uuid === 'ss-song') {
            processCharacterAfterSongStyleSwitch(styleChar, fileConstants)
          }

          // 确保网格设置存在（自由布局需要）
          ensureCharacterInfoGridSettings(styleChar)

        for (let contrastIdx = 0; contrastIdx < totalContrasts; contrastIdx++) {
          const contrastValue = CONTRAST_VALUES[contrastIdx]

          // 克隆并应用对比度
          const contrastChar = R.clone(styleChar) as ICharacterFileLite
          if (contrastValue !== 1.0) {
            try {
              applySimpleWidthContrast(contrastChar, contrastValue)
            } catch (e) {
              if (import.meta.env.DEV) {
                console.warn(
                  `[TrainingDataV1] Contrast failed for "${charText}" value=${contrastValue}:`,
                  e,
                )
              }
            }
          }

          // 展开字形组件为原始组件（自由布局网格变换需要）
          try {
            formatContainerGlyphComponents(contrastChar)
          } catch (e) {
            if (import.meta.env.DEV) {
              console.warn(
                `[TrainingDataV1] formatContainerGlyphComponents failed for "${charText}":`,
                e,
              )
            }
          }

          const expandedComps = orderedListWithItemsForCharacterFile(contrastChar)

          for (let layoutIdx = 0; layoutIdx < totalLayouts; layoutIdx++) {
            const layoutVariant = LAYOUT_VARIANTS[layoutIdx]
            const folderName = `风格_${styleIdx + 1}-${contrastIdx + 1}-${layoutIdx + 1}`
            const variantDir = `${rootDir}/${folderName}`
            const variantIndex = `${styleIdx + 1}-${contrastIdx + 1}-${layoutIdx + 1}`

            // 确保文件夹存在（每个变体组合一个文件夹）
            try {
              await mkdir(variantDir, { recursive: true })
            } catch {
              // 文件夹可能已存在
            }

            // 为每个布局变体克隆组件并应用网格变换
            const layoutComps = R.clone(expandedComps) as IComponent[]
            const grid = buildLayoutGrid(layoutVariant.dy2, layoutVariant.dy4)

            try {
              formatGridComponents(layoutComps, {
                grid,
                offset: { x: 0, y: 0 },
                useSkeletonGrid: false,
              })
            } catch (e) {
              if (import.meta.env.DEV) {
                console.warn(
                  `[TrainingDataV1] formatGridComponents failed for "${charText}" layout=${variantIndex}:`,
                  e,
                )
              }
            }

            // 渲染并保存 PNG
            try {
              const pngData = await renderCharToPngData(layoutComps)
              const { writeFile } = await import('@tauri-apps/plugin-fs')
              await writeFile(`${variantDir}/${safeCharName}.png`, pngData)
            } catch (e) {
              if (import.meta.env.DEV) {
                console.warn(
                  `[TrainingDataV1] Render/save failed for "${charText}" variant=${variantIndex}:`,
                  e,
                )
              }
            }

            // 更新进度
            completed++
            projectStore.loadingProgress = completed
            projectStore.loadingMessage =
              `生成训练数据 ${completed}/${totalSteps} — ` +
              `「${charText}」风格${styleIdx + 1}/${totalStyles} ` +
              `对比度${contrastIdx + 1}/${totalContrasts} ` +
              `布局${layoutIdx + 1}/${totalLayouts}`

            // 定期让出事件循环，保持 UI 响应
            const now = performance.now()
            if (now - lastYield >= 32) {
              await new Promise<void>((r) => setTimeout(r, 0))
              lastYield = performance.now()
            }
          }

          // 释放对比度克隆的实例
          try {
            instanceManager.releaseTemporaryInstance(contrastChar.uuid)
          } catch { /* ignore */ }
        }

        // 释放风格克隆的实例
        try {
          instanceManager.releaseTemporaryInstance(styleChar.uuid)
        } catch { /* ignore */ }
        } finally {
          // 恢复全局常量映射，避免污染下一个风格的脚本执行
          setGlobalConstantsMap(prevConstantsMap)
        }
      }

      // 释放基础克隆的实例
      try {
        instanceManager.releaseTemporaryInstance(baseChar.uuid)
      } catch { /* ignore */ }
    }
  } catch (err) {
    console.error('[TrainingDataV1] Generation failed:', err)
    alert('生成训练数据失败: ' + (err as Error).message)
  } finally {
    projectStore.loading = false
    projectStore.loadingProgress = 0
    projectStore.loadingTotal = 0
    projectStore.loadingMessage = ''
  }

  // 完成提示
  const totalFiles = completed
  alert(
    `训练数据 v1 生成完成！\n` +
    `共生成 ${totalFiles} 个 PNG 文件\n` +
    `输出目录：${rootDir}\n` +
    `文件夹命名：风格_风格序号-对比度序号-布局序号`,
  )

  if (import.meta.env.DEV) {
    console.log(`[TrainingDataV1] Done. ${totalFiles} PNGs saved to ${rootDir}`)
  }
}
