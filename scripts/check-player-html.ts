// 临时分析器（用后即删）：解剖导出的 player html 内嵌 lottie，打印每层逐帧位移
import { readFileSync } from 'node:fs'

const html = readFileSync(process.argv[2], 'utf-8')
const marker = (html.indexOf('var anim = ') >= 0 ? 'var anim = ' : 'var sm = ')
const start = html.indexOf(marker)
if (start < 0) {
  console.error('no anim found')
  process.exit(1)
}
// 花括号配对提取 JSON（忽略字符串内花括号）
let i = start + marker.length
let depth = 0
let inStr = false
let esc = false
let jsonStart = -1
for (; i < html.length; i++) {
  const c = html[i]
  if (inStr) {
    if (esc) esc = false
    else if (c === '\\') esc = true
    else if (c === '"') inStr = false
    continue
  }
  if (c === '"') inStr = true
  else if (c === '{') {
    if (jsonStart < 0) jsonStart = i
    depth++
  } else if (c === '}') {
    depth--
    if (depth === 0) break
  }
}
const root = JSON.parse(html.slice(jsonStart, i + 1)) as any

const bbox = (v: number[][] | undefined) => {
  if (!v || v.length === 0) return null
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [x, y] of v) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY, n: v.length }
}

// 每层所有 sh 的帧序列（帧号 → 形状）
interface LayerInfo {
  nm: string
  frames: Array<{ t: number; box: ReturnType<typeof bbox> }>
  groups: number
}
function analyzeAnim(anim: any, label: string) {
  console.log('\n===== ' + label + ' =====')
  const layers: LayerInfo[] = []
for (const layer of anim.layers ?? []) {
  if (!layer.shapes) continue
  const info: LayerInfo = { nm: layer.nm ?? '?', frames: [], groups: layer.shapes.length }
  for (const grp of layer.shapes) {
    for (const item of grp.it ?? []) {
      if (item.ty !== 'sh') continue
      const ks = item.ks
      if (ks.a === 0) {
        info.frames.push({ t: 0, box: bbox(ks.k?.v) })
      } else {
        for (const k of ks.k ?? []) {
          info.frames.push({ t: k.t, box: bbox(k.s?.[0]?.v) })
        }
      }
    }
  }
  layers.push(info)
}

console.log(`layers=${layers.length} fr=${anim.fr} op=${anim.op}`)
// 1) 每层帧数与位移量
const moves: Array<{ nm: string; d: number }> = []
for (const l of layers) {
  const boxes = l.frames.map((f) => f.box).filter(Boolean)
  if (boxes.length >= 2) {
    const a = boxes[0]!
    const b = boxes[boxes.length - 1]!
    moves.push({ nm: l.nm, d: Math.hypot(b.cx - a.cx, b.cy - a.cy) })
  }
}
moves.sort((x, y) => y.d - x.d)
const top = moves.slice(0, 12)
const allT = new Set<number>()
for (const l of layers) for (const f of l.frames) allT.add(f.t)
console.log('\n全部时间点: [' + [...allT].sort((a, b) => a - b).join(', ') + ']')
for (const m of top.slice(0, 5)) {
  const l = layers.find((x) => x.nm === m.nm)!
  console.log('  层 ' + m.nm + ' 帧: ' + l.frames.map((f) => `t=${f.t}@(${f.box?.cx?.toFixed(0)},${f.box?.cy?.toFixed(0)})`).join(' '))
}

// 原始结构：top 漂移层 + 一个静止层的所有 sh 项
function rawDump(anim: any, names: string[], label: string) {
  console.log('\n[' + label + '] 原始结构:')
  const want = new Set(names)
  for (const layer of anim.layers ?? []) {
    if (!want.has(layer.nm)) continue
    console.log(' layer ' + layer.nm)
    for (const grp of layer.shapes ?? []) {
      for (const item of grp.it ?? []) {
        if (item.ty !== 'sh') continue
        const ks = item.ks
        const frames = ks.a === 0 ? [{ t: 0, k: ks.k }] : ks.k ?? []
        for (const f of frames) {
          const box = bbox(ks.a === 0 ? f.k?.v : f.s?.[0]?.v)
          console.log(`   sh t=${f.t} n=${box?.n ?? 0} @(${box?.cx?.toFixed(0)},${box?.cy?.toFixed(0)})`)
        }
      }
    }
  }
}
const segs2 = (root as any)?.segments as Array<{ name?: string; animation?: unknown }> | undefined
if (segs2) {
  for (const seg of segs2) {
    if (seg.animation) {
      const an = seg.animation as any
      const moversTop = (an.layers ?? []).slice(0, 0) // placeholder
      rawDump(an, ['glyph-pen#73', 'glyph-pen#71', 'glyph-pen#1', 'glyph-pen#5'], String(seg.name ?? '?'))
    }
  }
}
console.log(`\n最大位移的层（首帧→末帧中心移动距离）:`)
for (const m of top) console.log(`  ${m.nm}: ${m.d.toFixed(1)}px`)
const zero = moves.filter((m) => m.d > 0.5).length
console.log(`\n发生位移的层: ${zero}/${layers.length}`)
// 2) 位移向量是否一致（全局漂移 vs 各自漂移）
const vecs = moves.filter((m) => m.d > 0.5)
if (vecs.length >= 2) {
  const first = vecs[0]
  const sameDir = vecs.filter((m) => Math.abs(m.d - first.d) < 1).length
  console.log(`位移量相近(±1px)的层: ${sameDir}/${vecs.length}（相近=全局漂移，分散=逐组件错位）`)
}
// 3) 多组层的交叉淡化（每组一个形状 → 相邻帧双影）
const multi = layers.filter((l) => l.groups > 1)
console.log(`\n多个形状组的层（交叉淡化，播放时双影）: ${multi.length}/${layers.length}`)
for (const l of multi.slice(0, 8)) {
  console.log(`  ${l.nm}: groups=${l.groups} frames=${l.frames.length}`)
}
// 4) 帧结构：各帧顶点数
const frameN: Record<string, Set<number>> = {}
for (const l of layers) {
  for (const f of l.frames) {
    if (!f.box) continue
    const key = String(f.t)
    ;(frameN[key] ??= new Set()).add(f.box.n)
  }
}
console.log(`\n各帧顶点数集合（顶点数变化=拓扑变化→交叉淡化）:`)
for (const [t, s] of Object.entries(frameN)) {
  console.log(`  t=${t}: [${[...s].join(', ')}]`)
}
}

// 5) 最近邻配对对照：t0 形状各自找最近的 t150 形状（贪婪），对比当前同层配对
function nnPairCheck(anim: any, label: string) {
  interface ShapeRec {
    layer: number
    t: number
    box: NonNullable<ReturnType<typeof bbox>>
  }
  const t0: ShapeRec[] = []
  const t150: ShapeRec[] = []
  let li = 0
  for (const layer of anim.layers ?? []) {
    for (const grp of layer.shapes ?? []) {
      for (const item of grp.it ?? []) {
        if (item.ty !== 'sh') continue
        const ks = item.ks
        const frames = ks.a === 0 ? [{ t: 0, k: ks.k }] : ks.k ?? []
        for (const f of frames) {
          const box = bbox((f.t === 0 || ks.a === 0 ? f.k?.v : f.s?.[0]?.v))
          if (!box) continue
          if (f.t === 0 || ks.a === 0) t0.push({ layer: li, t: f.t, box })
          else if (f.t >= 140) t150.push({ layer: li, t: f.t, box })
        }
      }
    }
    li++
  }
  const used = new Set<number>()
  let currentDist = 0
  let nnDist = 0
  let wrong = 0
  const candidates = [...t150]
  for (const a of t0) {
    // 当前配对 = 同层
    const cur = t150.find((b) => b.layer === a.layer)
    if (cur) currentDist += Math.hypot(cur.box.cx - a.box.cx, cur.box.cy - a.box.cy)
    // 最近邻
    let best = -1
    let bestD = Infinity
    for (let j = 0; j < candidates.length; j++) {
      const d = Math.hypot(candidates[j].box.cx - a.box.cx, candidates[j].box.cy - a.box.cy)
      if (d < bestD) {
        bestD = d
        best = j
      }
    }
    if (best >= 0) {
      nnDist += bestD
      if (candidates[best].layer !== a.layer) wrong++
      candidates.splice(best, 1)
      used.add(best)
    }
  }
  console.log(
    `\n[${label}] 最近邻对照: t0=${t0.length} t150=${t150.length} | 当前配对总位移=${currentDist.toFixed(0)}px, 最近邻总位移=${nnDist.toFixed(0)}px, 与最近邻不一致的层=${wrong}/${t0.length}`,
  )
}

// 6) 层叠顺序诊断：按字形作用域分组，检查带 t=0 帧的层是否全部排在组内最前
function zOrderCheck(anim: any, label: string) {
  const scopes = new Map<string, Array<{ nm: string; hasT0: boolean; hasT150: boolean }>>()
  for (const layer of anim.layers ?? []) {
    const nm = String(layer.nm ?? '?')
    const m = nm.match(/^(.*)::/)
    const scope = m ? m[1] : 'root'
    let hasT0 = false
    let hasT150 = false
    for (const grp of layer.shapes ?? []) {
      for (const item of grp.it ?? []) {
        if (item.ty !== 'sh') continue
        const ks = item.ks
        const frames = ks.a === 0 ? [{ t: 0 }] : ks.k ?? []
        for (const f of frames) {
          if (f.t === 0) hasT0 = true
          if (f.t >= 140) hasT150 = true
        }
      }
    }
    if (!scopes.has(scope)) scopes.set(scope, [])
    scopes.get(scope)!.push({ nm, hasT0, hasT150 })
  }
  console.log('\n[' + label + '] 层叠顺序诊断:')
  for (const [scope, list] of scopes) {
    // 组内顺序：first-seen = kf0 叶子在前；反转 = 任何 t0 叶子出现在 t150-only 叶子之后
    let t0Only = 0
    let both = 0
    let t150Only = 0
    let inversions = 0
    for (const l of list) {
      if (l.hasT0 && l.hasT150) both++
      else if (l.hasT0) t0Only++
      else if (l.hasT150) t150Only++
    }
    // 检测：序列中 t150-only 出现在 hasT0 之前的位置数
    let seenT0 = false
    let bad = 0
    for (const l of list) {
      if (!l.hasT0) {
        if (seenT0) bad++
      } else {
        seenT0 = true
      }
    }
    if (bad > 0) inversions = bad
    const s = `${scope}: n=${list.length} (t0-only=${t0Only} both=${both} t150-only=${t150Only}) t0在后=${inversions}`
    if (inversions > 0) console.log('  ⚠️ ' + s)
  }
  console.log('  （无 ⚠️ = 组内顺序与首见顺序一致）')
}
const segs3 = (root as any)?.segments as Array<{ name?: string; animation?: unknown }> | undefined
if (segs3) {
  for (const seg of segs3) {
    if (seg.animation) zOrderCheck(seg.animation, String(seg.name ?? '?'))
  }
}

// 7) 面积顺序：按作用域打印图层数组顺序下 t150 形状的面积（外层花瓣大、内层小）
function areaOrderCheck(anim: any, label: string) {
  console.log('\n[' + label + '] 面积顺序（图层数组序 → t150 面积，t0=首帧已存在）:')
  const scopes = new Map<string, Array<{ nm: string; area: number; hasT0: boolean }>>()
  for (const layer of anim.layers ?? []) {
    const nm = String(layer.nm ?? '?')
    const m = nm.match(/^(.*)::/)
    const scope = m ? m[1] : 'root'
    let area = 0
    let hasT0 = false
    for (const grp of layer.shapes ?? []) {
      for (const item of grp.it ?? []) {
        if (item.ty !== 'sh') continue
        const ks = item.ks
        const frames = ks.a === 0 ? [{ t: 0, k: ks.k }] : ks.k ?? []
        for (const f of frames) {
          const box = bbox(ks.a === 0 ? f.k?.v : f.s?.[0]?.v)
          if (box && f.t >= 140) area += box.w * box.h
          if (f.t === 0) hasT0 = true
        }
      }
    }
    if (!scopes.has(scope)) scopes.set(scope, [])
    scopes.get(scope)!.push({ nm, area, hasT0 })
  }
  // 收集所有顶层花字形（scope 只含一个 / 的为花本体），按其内部花瓣层的数组顺序打印
  const flowerPetalSeqs = new Map<string, string[]>()
  const arrayIdx = new Map<string, number>()
  let idx = 0
  for (const layer of anim.layers ?? []) {
    const nm = String(layer.nm ?? '?')
    const m = nm.match(/^(.*)\/[^/]+::/)
    const flower = m ? m[1] : ''
    const petal = nm.split('/').pop()?.split('::')[0] ?? '?'
    let area = 0
    let hasT0 = false
    for (const grp of layer.shapes ?? []) {
      for (const item of grp.it ?? []) {
        if (item.ty !== 'sh') continue
        const ks = item.ks
        const frames = ks.a === 0 ? [{ t: 0, k: ks.k }] : ks.k ?? []
        for (const f of frames) {
          const box = bbox(ks.a === 0 ? f.k?.v : f.s?.[0]?.v)
          if (box && f.t >= 140) area += box.w * box.h
          if (f.t === 0) hasT0 = true
        }
      }
    }
    if (!flowerPetalSeqs.has(flower)) flowerPetalSeqs.set(flower, [])
    flowerPetalSeqs.get(flower)!.push(`${petal}@${area.toFixed(0)}${hasT0 ? '*' : ''}`)
    arrayIdx.set(nm, idx++)
  }
  for (const [flower, seq] of flowerPetalSeqs) {
    if (!flower.startsWith('花') || seq.length < 4) continue
    console.log(`  ${flower}: ${seq.join(' ')}`)
  }
}
const segs4 = (root as any)?.segments as Array<{ name?: string; animation?: unknown }> | undefined
if (segs4) {
  for (const seg of segs4) {
    if (seg.animation) areaOrderCheck(seg.animation, String(seg.name ?? '?'))
  }
}

// 8) 完整作用域序列
function fullScopeOrder(anim: any, label: string) {
  console.log('\n[' + label + '] 完整图层顺序（先画=底层）:')
  const seq: string[] = []
  for (const layer of anim.layers ?? []) {
    const nm = String(layer.nm ?? '?')
    const m = nm.match(/^(.*)::/)
    const scope = m ? m[1] : nm
    seq.push(scope)
  }
  // 压缩连续相同作用域
  const compact: string[] = []
  for (const s of seq) {
    const last = compact[compact.length - 1]
    if (last && last.split(' x')[0] === s) {
      const n = parseInt(last.split(' x')[1] ?? '1') + 1
      compact[compact.length - 1] = `${s} x${n}`
    } else {
      compact.push(s)
    }
  }
  console.log('  ' + compact.join('\n  '))
}
const segs5 = (root as any)?.segments as Array<{ name?: string; animation?: unknown }> | undefined
if (segs5) {
  for (const seg of segs5) {
    if (seg.animation) fullScopeOrder(seg.animation, String(seg.name ?? '?'))
  }
}

// 入口：微交互 sm.segments[].animation 或单个 anim
const segs = (root as any)?.segments as Array<{ name?: string; animation?: unknown }> | undefined
if (segs && segs.length > 0) {
  for (const seg of segs) {
    if (seg.animation) {
      analyzeAnim(seg.animation, String(seg.name ?? 'segment'))
      nnPairCheck(seg.animation, String(seg.name ?? 'segment'))
    }
  }
} else {
  analyzeAnim(root, 'anim')
}

// 9) 修复预览模式：按规范顺序（每朵花内花瓣按索引降序 = 外→内）重排图层并写出新 html
if (process.argv[3]) {
  const out = process.argv[3]
  const segsPatch = (root as any)?.segments as Array<{ name?: string; animation?: { layers?: any[] } }> | undefined
  if (segsPatch) {
    for (const seg of segsPatch) {
      const layers = seg.animation?.layers ?? []
      // 分组：每朵花的花瓣层（顶层作用域 ^花\d+$）
      const groups = new Map<string, number[]>()
      const petalIdx = new Map<number, number>()
      layers.forEach((l, i) => {
        const nm = String(l.nm ?? '')
        const m = nm.match(/^([^/]+)\/(花瓣\d+)::/)
        if (m) {
          const flower = m[1]
          const pn = parseInt(m[2].replace('花瓣', ''))
          if (!groups.has(flower)) groups.set(flower, [])
          groups.get(flower)!.push(i)
          petalIdx.set(i, pn)
        }
      })
      const reordered: any[] = []
      const moved = new Set<number>()
      for (let i = 0; i < layers.length; i++) {
        const nm = String(layers[i].nm ?? '')
        const m = nm.match(/^([^/]+)\/(花瓣\d+)::/)
        if (m && groups.has(m[1]) && !moved.has(m[1])) {
          const idxs = groups.get(m[1])!.slice().sort((a, b) => petalIdx.get(b)! - petalIdx.get(a)!)
          for (const j of idxs) reordered.push(layers[j])
          moved.add(m[1])
        } else if (!m) {
          reordered.push(layers[i])
        }
      }
      seg.animation!.layers = reordered
    }
  }
  const newJson = JSON.stringify(root)
  const patched = html.slice(0, jsonStart) + newJson + html.slice(i + 1)
  const { writeFileSync } = await import('node:fs')
  writeFileSync(out, patched)
  console.log('PATCHED -> ' + out)
}
