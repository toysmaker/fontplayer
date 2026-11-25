/**
 * DEV-only 内存普查器
 *
 * 用于定位长时间运行后的内存残留/泄漏: 每 CENSUS_INTERVAL_MS 在 console 打一行
 * 各缓存池/数据结构的体积, 手动触发用 window.__memCensus()。
 * 排查方法: 正常使用数小时~一天, 观察哪一列持续单调增长。
 */
import { instanceManager } from '@/core/instance/InstanceManager'
import { CanvasManager } from '@/core/canvas/CanvasManager'
import { useProjectStore } from '@/stores/project'

const CENSUS_INTERVAL_MS = 5 * 60 * 1000

interface CensusRow {
  ts: number
  uptimeMin: number
  /** 实例池体积(应 ≤ maxPoolSize) */
  pool: number
  /** CanvasManager 映射/渲染缓存体积 */
  canvasMap: number
  renderCache: number
  /** 骨架绑定运行时缓存残留: 仍持有 _pointsBonesMap / originalPoints 的绑定数据数 */
  bindRuntimeRetained: number
  /** 骨架绑定数据总数(存在 glyph 数据中的 storedBindData, 属工程数据) */
  bindDataTotal: number
  /** 当前工程数据体积(KB) */
  fileDataKB: number
  /** DOM 节点数与 canvas 数(泄漏粗指标) */
  domNodes: number
  canvases: number
}

function countBindRetained(): { retained: number; total: number } {
  const ps = useProjectStore()
  const file = ps.selectedFile as any
  let retained = 0
  let total = 0
  const lists = [file?.characterList, file?.glyphs, file?.stroke_glyphs, file?.radical_glyphs, file?.comp_glyphs]
  const walk = (obj: any) => {
    if (!obj || typeof obj !== 'object') return
    if (obj.skeleton?.skeletonBindData || obj.skeleton?.glyphSkeletonBindData) {
      total++
      const bd = obj.skeleton.skeletonBindData || obj.skeleton.glyphSkeletonBindData
      if (bd?._sampleBindData?._pointsBonesMap || bd?._sampleBindData?.originalPoints) {
        retained++
      }
    }
    for (const list of lists) {
      if (!list) continue
      for (const item of list) walk(item)
    }
  }
  // 只遍历四个字形列表(字符列表内的 glyph 组件 value 也计入)
  for (const list of lists) {
    if (!list) continue
    for (const item of list) {
      if (item?.components) {
        for (const c of item.components) {
          if (c?.value?.components) {
            for (const inner of c.value.components) walk(inner)
          }
          walk(c?.value)
        }
      }
      walk(item)
    }
  }
  return { retained, total }
}

function collectCensus(): CensusRow {
  const ps = useProjectStore()
  const file = ps.selectedFile as any
  let fileDataKB = 0
  try {
    fileDataKB = Math.round(JSON.stringify(file).length / 1024)
  } catch {
    fileDataKB = -1
  }
  const { retained, total } = countBindRetained()
  return {
    ts: Date.now(),
    uptimeMin: Math.round(performance.now() / 60000),
    pool: (instanceManager as any).instancePool?.size ?? -1,
    canvasMap: (CanvasManager as any).canvasMap?.size ?? -1,
    renderCache: (CanvasManager as any).renderCache?.size ?? -1,
    bindRuntimeRetained: retained,
    bindDataTotal: total,
    fileDataKB,
    domNodes: document.querySelectorAll('*').length,
    canvases: document.querySelectorAll('canvas').length,
  }
}

function logCensus(rows: CensusRow[]): void {
  // 生产环境 console.log/warn 被静音, 普查结果走 console.error 保证可见
  const out = import.meta.env.DEV ? console.log : console.error
  const r = rows[rows.length - 1]
  const head = `[memCensus] up=${r.uptimeMin}m pool=${r.pool} canvasMap=${r.canvasMap} renderCache=${r.renderCache} bindRt=${r.bindRuntimeRetained}/${r.bindDataTotal} file=${r.fileDataKB}KB dom=${r.domNodes} canvases=${r.canvases}`
  out.call(console, head)
  if (rows.length > 1) {
    const first = rows[0]
    out.call(
      console,
      `[memCensus] delta since start: pool ${r.pool - first.pool}, canvasMap ${r.canvasMap - first.canvasMap}, renderCache ${r.renderCache - first.renderCache}, bindRt ${r.bindRuntimeRetained - first.bindRuntimeRetained}, file ${r.fileDataKB - first.fileDataKB}KB, dom ${r.domNodes - first.domNodes}`,
    )
  }
}

/**
 * 启动内存普查:
 * - DEV: 每 5 分钟自动打一行;
 * - 生产: 不自动打, 但挂 window.__memCensus() 手动触发(正式应用用久了卡顿时可随时 dump 一次)。
 */
export function startMemCensus(): void {
  const rows: CensusRow[] = []
  const tick = () => {
    try {
      rows.push(collectCensus())
      logCensus(rows)
    } catch (err) {
      console.warn('[memCensus] collect failed:', err)
    }
  }
  if (import.meta.env.DEV) {
    tick()
    setInterval(tick, CENSUS_INTERVAL_MS)
    // 启动横幅: 用于确认当前运行的代码是否为最新(含 [dragCost] 拖拽开销探针)
    console.log(
      `[probe] 拖拽开销探针已装载 (dragCost) ${new Date().toLocaleTimeString()} — 若拖拽时看不到 [dragCost] 行, 请完全重启 npx tauri dev`,
    )
    console.log(`[memCensus] started, interval ${CENSUS_INTERVAL_MS / 60000}min, manual: window.__memCensus()`)
  }
  ;(window as any).__memCensus = tick
}
