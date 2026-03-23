/**
 * IDS 分解、部件匹配与笔画合并（相邻笔分组）工具
 * 由原 advancedEdit/decomposition.ts 与 fileHandlers 笔画规则合并迁入。
 */

import { CustomGlyph } from '@/core/instance/CustomGlyph'
import type { IComponent, ICustomGlyph } from '@/core/types'

// --- 笔画几何：相邻两笔合并（横+竖弯钩 等）---

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

function customGlyphFromCharacterComponent(comp: IComponent): CustomGlyph | null {
  if (comp.type !== 'glyph') return null
  const v = comp.value as unknown as ICustomGlyph
  if (!v || typeof v !== 'object' || typeof v.name !== 'string') return null
  return new CustomGlyph(v)
}

function strokeGlyphName(g: CustomGlyph): string {
  return (g as unknown as { _glyph: ICustomGlyph })._glyph.name
}

export function isStrokeMatchHengzhewangou(stroke1: IComponent, stroke2: IComponent): boolean {
  const delta = 100
  const g1 = customGlyphFromCharacterComponent(stroke1)
  const g2 = customGlyphFromCharacterComponent(stroke2)
  if (!g1 || !g2) return false
  if (strokeGlyphName(g1) !== '横' || strokeGlyphName(g2) !== '竖弯钩') return false
  const heng_end = g1.getJoint('end')
  const shu_start = g2.getJoint('shu_start')
  if (!heng_end || !shu_start) return false
  const _heng_end = {
    x: heng_end.x + (stroke1.ox ?? 0),
    y: heng_end.y + (stroke1.oy ?? 0),
  }
  const _shu_start = {
    x: shu_start.x + (stroke2.ox ?? 0),
    y: shu_start.y + (stroke2.oy ?? 0),
  }
  return distance(_heng_end.x, _heng_end.y, _shu_start.x, _shu_start.y) <= delta
}

export function isStrokeMatchHengzhewan(stroke1: IComponent, stroke2: IComponent): boolean {
  const delta = 100
  const g1 = customGlyphFromCharacterComponent(stroke1)
  const g2 = customGlyphFromCharacterComponent(stroke2)
  if (!g1 || !g2) return false
  if (strokeGlyphName(g1) !== '横' || strokeGlyphName(g2) !== '竖弯') return false
  const heng_end = g1.getJoint('end')
  const shu_start = g2.getJoint('shu_start')
  if (!heng_end || !shu_start) return false
  const _heng_end = {
    x: heng_end.x + (stroke1.ox ?? 0),
    y: heng_end.y + (stroke1.oy ?? 0),
  }
  const _shu_start = {
    x: shu_start.x + (stroke2.ox ?? 0),
    y: shu_start.y + (stroke2.oy ?? 0),
  }
  return distance(_heng_end.x, _heng_end.y, _shu_start.x, _shu_start.y) <= delta
}

export function isStrokeMatchShuzhezhe(stroke1: IComponent, stroke2: IComponent): boolean {
  const delta = 100
  const g1 = customGlyphFromCharacterComponent(stroke1)
  const g2 = customGlyphFromCharacterComponent(stroke2)
  if (!g1 || !g2) return false
  if (strokeGlyphName(g1) !== '竖' || strokeGlyphName(g2) !== '横钩') return false
  const shu_end = g1.getJoint('end')
  const heng_start = g2.getJoint('heng_start')
  const shu_start = g1.getJoint('start')
  if (!shu_end || !heng_start || !shu_start) return false
  const _shu_end = {
    x: shu_end.x + (stroke1.ox ?? 0),
    y: shu_end.y + (stroke1.oy ?? 0),
  }
  const _heng_start = {
    x: heng_start.x + (stroke2.ox ?? 0),
    y: heng_start.y + (stroke2.oy ?? 0),
  }
  const _shu_start = {
    x: shu_start.x + (stroke1.ox ?? 0),
    y: shu_start.y + (stroke1.oy ?? 0),
  }
  if (distance(_shu_end.x, _shu_end.y, _heng_start.x, _heng_start.y) > delta) {
    return false
  }
  return !(
    distance(_shu_start.x, _shu_start.y, _heng_start.x, _heng_start.y) <
    distance(_shu_end.x, _shu_end.y, _heng_start.x, _heng_start.y)
  )
}

/**
 * 按 orderedList 顺序生成笔画 UUID 分组（单段或相邻合并），对齐原 processCharacters_decomposition。
 */
export function buildStrokeUuidGroupsFromOrderedComponents(
  components: IComponent[],
  orderedList: Array<{ type: string; uuid: string }>,
): string[][] | null {
  const ordered_components: IComponent[] = []
  for (const item of orderedList) {
    const c = components.find((component) => component.uuid === item.uuid)
    if (!c) return null
    ordered_components.push(c)
  }

  const strokes: string[][] = []
  let skip = false
  for (let j = 0; j < ordered_components.length; j++) {
    if (skip) {
      skip = false
      continue
    }
    const component = ordered_components[j]
    const uuid = component.uuid
    if (j < ordered_components.length - 1) {
      const next_component = ordered_components[j + 1]
      const next_uuid = next_component.uuid
      if (isStrokeMatchHengzhewangou(component, next_component)) {
        strokes.push([uuid, next_uuid])
        skip = true
      } else if (isStrokeMatchHengzhewan(component, next_component)) {
        strokes.push([uuid, next_uuid])
        skip = true
      } else if (isStrokeMatchShuzhezhe(component, next_component)) {
        strokes.push([uuid, next_uuid])
        skip = true
      }
    }
    if (!skip) {
      strokes.push([uuid])
    }
  }
  return strokes
}

// --- IDS 操作符与解析 ---

const OPERATORS = ['⿰', '⿱', '⿲', '⿳', '⿴', '⿵', '⿶', '⿷', '⿸', '⿹', '⿺', '⿻'] as const
const THREE_PART_OPS: readonly string[] = ['⿲', '⿳']
const TWO_PART_OPS: readonly string[] = ['⿰', '⿱', '⿴', '⿵', '⿶', '⿷', '⿸', '⿹', '⿺', '⿻']

function isOperatorChar(ch: string | undefined): ch is (typeof OPERATORS)[number] {
  return ch !== undefined && (OPERATORS as readonly string[]).includes(ch)
}

/** IDS 叶子节点；脚本会向对象挂载 bounds/strokes 等任意字段，match 也可能与 string 比较 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LeafPart = any

export type DecompositionTree = {
  ids: string | null
  part?: string
  children?: DecompositionTree[]
}

export function removeParentheses(str: string | null | undefined): { content: string; rest: string } {
  if (str && str.startsWith('(')) {
    let depth = 0
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '(') {
        depth++
      } else if (str[i] === ')') {
        depth--
        if (depth === 0) {
          return {
            content: str.slice(1, i),
            rest: str.slice(i + 1),
          }
        }
      }
    }
  }
  return { content: str ?? '', rest: '' }
}

export function extractLeafParts(
  decomp: string | null | undefined,
  match: number[] = [],
  ids: string[] = [],
): LeafPart[] {
  if (!decomp || decomp === null) {
    return []
  }

  const { content } = removeParentheses(decomp)
  decomp = content

  if (!decomp || decomp.length === 0) {
    return []
  }

  if (decomp.length === 1) {
    return [
      {
        name: decomp,
        match: match,
        ids: ids,
      },
    ]
  }

  for (const op of OPERATORS) {
    if (decomp.startsWith(op)) {
      const rest = decomp.slice(op.length)

      if (THREE_PART_OPS.includes(op)) {
        return extractThreeParts(rest, match, [...ids, op])
      }
      if (TWO_PART_OPS.includes(op)) {
        return extractTwoParts(rest, match, [...ids, op])
      }
    }
  }

  return []
}

export function findPartEnd(str: string, startIndex: number): number {
  if (startIndex >= str.length) {
    return -1
  }

  if (str[startIndex] === '(') {
    let depth = 0
    for (let i = startIndex; i < str.length; i++) {
      if (str[i] === '(') {
        depth++
      } else if (str[i] === ')') {
        depth--
        if (depth === 0) {
          return i - startIndex + 1
        }
      }
    }
    return -1
  }

  const ch = str[startIndex]
  if (!isOperatorChar(ch)) {
    return 1
  }

  const op = ch
  let i = 1
  const targetPartCount = THREE_PART_OPS.includes(op) ? 3 : 2

  let partCount = 0
  while (i < str.length && partCount < targetPartCount) {
    if (str[startIndex + i] === '(') {
      let depth = 0
      let j = startIndex + i
      while (j < str.length) {
        if (str[j] === '(') {
          depth++
        } else if (str[j] === ')') {
          depth--
          if (depth === 0) {
            i = j - startIndex + 1
            partCount++
            break
          }
        }
        j++
      }
      if (depth !== 0) {
        return -1
      }
    } else if (isOperatorChar(str[startIndex + i])) {
      const nextPartLength = findPartEnd(str, startIndex + i)
      if (nextPartLength === -1) {
        return -1
      }
      i += nextPartLength
      partCount++
    } else {
      i++
      partCount++
    }
  }

  return i
}

export function extractTwoParts(str: string, match: number[] = [], ids: string[] = []): LeafPart[] {
  if (!str || str.length === 0) {
    return []
  }

  const firstPartLength = findPartEnd(str, 0)
  if (firstPartLength === -1 || firstPartLength > str.length) {
    return []
  }

  const firstPart = str.slice(0, firstPartLength)
  const secondPart = str.slice(firstPartLength)

  const firstParts = extractLeafParts(firstPart, [...match, 0], ids)
  const secondParts = extractLeafParts(secondPart, [...match, 1], ids)

  return [...firstParts, ...secondParts]
}

export function extractThreeParts(str: string, match: number[] = [], ids: string[] = []): LeafPart[] {
  if (!str || str.length === 0) {
    return []
  }

  const firstPartLength = findPartEnd(str, 0)
  if (firstPartLength === -1 || firstPartLength > str.length) {
    return []
  }

  const firstPart = str.slice(0, firstPartLength)
  const rest = str.slice(firstPartLength)

  const secondPartLength = findPartEnd(rest, 0)
  if (secondPartLength === -1 || secondPartLength > rest.length) {
    return []
  }

  const secondPart = rest.slice(0, secondPartLength)
  const thirdPart = rest.slice(secondPartLength)

  const firstParts = extractLeafParts(firstPart, [...match, 0], ids)
  const secondParts = extractLeafParts(secondPart, [...match, 1], ids)
  const thirdParts = extractLeafParts(thirdPart, [...match, 2], ids)

  return [...firstParts, ...secondParts, ...thirdParts]
}

export function assignStrokesToParts(
  decomp: string | null | undefined,
  matches: (number[] | null | undefined)[] | null | undefined,
): Map<string, number[]> {
  if (!decomp || decomp === '？' || decomp === null || !matches) {
    return new Map()
  }

  const parts = extractLeafParts(decomp)
  if (parts.length === 0) {
    return new Map()
  }

  const partToStrokes = new Map<string, number[]>()
  parts.forEach((part, index) => {
    if (part.name === '？' || part.name === '?') {
      partToStrokes.set(`?_${index}`, [])
    } else {
      partToStrokes.set(part.name, [])
    }
  })

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    if (match === null || match === undefined) {
      continue
    }

    if (Array.isArray(match) && match.length > 0) {
      const part = parts.find((p) => p.match.join(',') === match.join(','))
      let partIndex = 0
      if (!part) {
        console.log(`未找到匹配的部件: ${decomp}`)
      } else {
        partIndex = parts.findIndex((p) => p.match.join(',') === match.join(','))
      }
      if (partIndex >= 0 && partIndex < parts.length) {
        const hit = parts[partIndex]
        let nameKey = hit.name
        if (hit.name === '？' || hit.name === '?') {
          nameKey = `?_${partIndex}`
        }
        const strokes = partToStrokes.get(nameKey) || []
        strokes.push(i)
        partToStrokes.set(nameKey, strokes)
      }
    }
  }

  return partToStrokes
}

export function findParenthesesContent(str: string | null | undefined): {
  start: number
  end: number
  content: string
} | null {
  if (!str || !str.includes('(')) {
    return null
  }

  let depth = 0
  let startIndex = -1

  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') {
      if (depth === 0) {
        startIndex = i
      }
      depth++
    } else if (str[i] === ')') {
      depth--
      if (depth === 0 && startIndex !== -1) {
        return {
          start: startIndex + 1,
          end: i,
          content: str.slice(startIndex + 1, i),
        }
      }
    }
  }

  return null
}

export function getQuestionMarkPart(decomp: string | null | undefined): { parts: LeafPart[]; index: number } {
  if (!decomp || decomp === null) {
    return { parts: [], index: -1 }
  }

  const _decomp = decomp.replace('(？)', '*').replace('(?)', '*')
  const parts = extractLeafParts(_decomp)
  const index = parts.findIndex((part) => part.name === '*')

  return { parts, index }
}

export function getDecompositionTree(decomp: string | null | undefined): DecompositionTree | null {
  if (!decomp || decomp === null) {
    return null
  }

  const { content } = removeParentheses(decomp)
  decomp = content

  if (!decomp || decomp.length === 0) {
    return null
  }

  if (decomp.length === 1) {
    return {
      ids: null,
      part: decomp,
    }
  }

  for (const op of OPERATORS) {
    if (decomp.startsWith(op)) {
      const rest = decomp.slice(op.length)

      if (THREE_PART_OPS.includes(op)) {
        const firstPartLength = findPartEnd(rest, 0)
        if (firstPartLength === -1 || firstPartLength > rest.length) {
          return null
        }

        const firstPart = rest.slice(0, firstPartLength)
        const remaining = rest.slice(firstPartLength)

        const secondPartLength = findPartEnd(remaining, 0)
        if (secondPartLength === -1 || secondPartLength > remaining.length) {
          return null
        }

        const secondPart = remaining.slice(0, secondPartLength)
        const thirdPart = remaining.slice(secondPartLength)

        const firstChild = getDecompositionTree(firstPart)
        const secondChild = getDecompositionTree(secondPart)
        const thirdChild = getDecompositionTree(thirdPart)

        if (firstChild === null || secondChild === null || thirdChild === null) {
          return null
        }

        return {
          ids: op,
          children: [firstChild, secondChild, thirdChild],
        }
      }
      if (TWO_PART_OPS.includes(op)) {
        const firstPartLength = findPartEnd(rest, 0)
        if (firstPartLength === -1 || firstPartLength > rest.length) {
          return null
        }

        const firstPart = rest.slice(0, firstPartLength)
        const secondPart = rest.slice(firstPartLength)

        const firstChild = getDecompositionTree(firstPart)
        const secondChild = getDecompositionTree(secondPart)

        if (firstChild === null || secondChild === null) {
          return null
        }

        return {
          ids: op,
          children: [firstChild, secondChild],
        }
      }
    }
  }

  return null
}

export function findPartByMatch(tree: DecompositionTree | null, match: number[]): DecompositionTree | null {
  if (!tree || tree === null) {
    return null
  }

  let root: DecompositionTree = tree
  let part: DecompositionTree = root
  for (let i = 0; i < match.length; i++) {
    const children = root.children
    if (!children) return null
    const next = children[match[i]]
    if (!next) return null
    part = next
    root = part
  }
  return part
}

export function getBracketsMatch(decomp: string | null | undefined): number[] | null {
  if (!decomp || !decomp.includes('(')) {
    return null
  }

  const parenthesesContent = findParenthesesContent(decomp)
  if (!parenthesesContent) {
    return null
  }

  const bracketedContent = parenthesesContent.content

  const decompWithoutBrackets = decomp.replace(`(${bracketedContent})`, bracketedContent)

  const parts = extractLeafParts(decompWithoutBrackets)

  if (bracketedContent.length === 1) {
    const targetPart = parts.find((part) => part.name === bracketedContent)
    return targetPart ? targetPart.match : null
  }

  const bracketedParts = extractLeafParts(bracketedContent)
  if (bracketedParts.length > 0) {
    const firstBracketedPart = bracketedParts[0]
    const targetPart = parts.find((part) => {
      if (part.name !== firstBracketedPart.name) {
        return false
      }
      return (
        part.match.length >= firstBracketedPart.match.length &&
        firstBracketedPart.match.every((m, i) => m === part.match[i])
      )
    })
    return targetPart ? targetPart.match : null
  }

  return null
}

export function addBracketsByMatch(decomp: string | null | undefined, match: number[] | null | undefined): string {
  if (!decomp || !match || match.length === 0) {
    return decomp ?? ''
  }

  const parts = extractLeafParts(decomp)
  const targetPart = parts.find((part) => {
    if (part.match.length !== match.length) {
      return false
    }
    return part.match.every((m, i) => m === match[i])
  })

  if (!targetPart) {
    return decomp
  }

  const addBracketsRecursive = (d: string | null | undefined, currentMatch: number[] = []): string => {
    if (!d || d === null) {
      return ''
    }

    const { content } = removeParentheses(d)
    let inner = content

    if (!inner || inner.length === 0) {
      return ''
    }

    if (inner.length === 1) {
      if (currentMatch.length === match.length && currentMatch.every((m, i) => m === match[i])) {
        return `(${inner})`
      }
      return inner
    }

    for (const op of OPERATORS) {
      if (inner.startsWith(op)) {
        const rest = inner.slice(op.length)

        if (THREE_PART_OPS.includes(op)) {
          const firstPartLength = findPartEnd(rest, 0)
          if (firstPartLength === -1 || firstPartLength > rest.length) {
            return inner
          }

          const firstPart = rest.slice(0, firstPartLength)
          const remaining = rest.slice(firstPartLength)

          const secondPartLength = findPartEnd(remaining, 0)
          if (secondPartLength === -1 || secondPartLength > remaining.length) {
            return inner
          }

          const secondPart = remaining.slice(0, secondPartLength)
          const thirdPart = remaining.slice(secondPartLength)

          const firstResult = addBracketsRecursive(firstPart, [...currentMatch, 0])
          const secondResult = addBracketsRecursive(secondPart, [...currentMatch, 1])
          const thirdResult = addBracketsRecursive(thirdPart, [...currentMatch, 2])

          return op + firstResult + secondResult + thirdResult
        }
        if (TWO_PART_OPS.includes(op)) {
          const firstPartLength = findPartEnd(rest, 0)
          if (firstPartLength === -1 || firstPartLength > rest.length) {
            return inner
          }

          const firstPart = rest.slice(0, firstPartLength)
          const secondPart = rest.slice(firstPartLength)

          const firstResult = addBracketsRecursive(firstPart, [...currentMatch, 0])
          const secondResult = addBracketsRecursive(secondPart, [...currentMatch, 1])

          return op + firstResult + secondResult
        }
      }
    }

    return inner
  }

  return addBracketsRecursive(decomp)
}

export interface CharacterDecompositionListItem {
  match?: unknown[]
  component_id?: string | number
}

export interface CharacterWithDecompositionList {
  decomposition?: string | null
  decomposition_list?: CharacterDecompositionListItem[]
  character?: unknown
}

export function getDecomposition2(character: CharacterWithDecompositionList): string | null {
  const decomposition = character.decomposition
  const decomposition_list = character.decomposition_list || []

  if (!decomposition) {
    console.warn(
      `[getDecomposition2] Missing decomposition for character: ${String(character.character ?? 'unknown')}`,
      character,
    )
    return null
  }

  const matchToComponentId = new Map<string, string | number>()
  for (const item of decomposition_list) {
    if (item.match && item.component_id !== undefined) {
      const m = item.match
      let matchKey: string
      if (Array.isArray(m[0])) {
        matchKey = (m[0] as number[]).join(',')
      } else if (typeof m[0] === 'string') {
        matchKey = m[0]
      } else {
        matchKey = Array.isArray(m) ? (m as number[]).join(',') : String(m)
      }
      matchToComponentId.set(matchKey, item.component_id)
    }
  }

  const buildDecomposition2Recursive = (decomp: string | null | undefined, currentMatch: number[] = []): string => {
    if (!decomp || decomp === null) {
      return ''
    }

    const { content } = removeParentheses(decomp)
    decomp = content

    if (!decomp || decomp.length === 0) {
      return ''
    }

    if (decomp.length === 1) {
      if (decomp === '？' || decomp === '?') {
        const matchKey = currentMatch.join(',')
        const componentId = matchToComponentId.get(matchKey)
        if (componentId !== undefined) {
          return `(${componentId})`
        }
        return `(${decomp})`
      }
      return `(${decomp})`
    }

    for (const op of OPERATORS) {
      if (decomp.startsWith(op)) {
        const rest = decomp.slice(op.length)

        if (THREE_PART_OPS.includes(op)) {
          const firstPartLength = findPartEnd(rest, 0)
          if (firstPartLength === -1 || firstPartLength > rest.length) {
            console.warn(`[getDecomposition2] Failed to parse first part for three-part operator: ${op}, decomp: ${decomp}`)
            return ''
          }

          const firstPart = rest.slice(0, firstPartLength)
          const remaining = rest.slice(firstPartLength)

          const secondPartLength = findPartEnd(remaining, 0)
          if (secondPartLength === -1 || secondPartLength > remaining.length) {
            console.warn(`[getDecomposition2] Failed to parse second part for three-part operator: ${op}, decomp: ${decomp}`)
            return ''
          }

          const secondPart = remaining.slice(0, secondPartLength)
          const thirdPart = remaining.slice(secondPartLength)

          const firstResult = buildDecomposition2Recursive(firstPart, [...currentMatch, 0])
          const secondResult = buildDecomposition2Recursive(secondPart, [...currentMatch, 1])
          const thirdResult = buildDecomposition2Recursive(thirdPart, [...currentMatch, 2])

          if (firstResult === '' || secondResult === '' || thirdResult === '') {
            console.warn(`[getDecomposition2] Empty result for three-part operator: ${op}, decomp: ${decomp}`, {
              firstResult,
              secondResult,
              thirdResult,
            })
            return ''
          }

          return op + firstResult + secondResult + thirdResult
        }
        if (TWO_PART_OPS.includes(op)) {
          const firstPartLength = findPartEnd(rest, 0)
          if (firstPartLength === -1 || firstPartLength > rest.length) {
            console.warn(`[getDecomposition2] Failed to parse first part for two-part operator: ${op}, decomp: ${decomp}`)
            return ''
          }

          const firstPart = rest.slice(0, firstPartLength)
          const secondPart = rest.slice(firstPartLength)

          const firstResult = buildDecomposition2Recursive(firstPart, [...currentMatch, 0])
          const secondResult = buildDecomposition2Recursive(secondPart, [...currentMatch, 1])

          if (firstResult === '' || secondResult === '') {
            console.warn(`[getDecomposition2] Empty result for two-part operator: ${op}, decomp: ${decomp}`, {
              firstResult,
              secondResult,
            })
            return ''
          }

          return op + firstResult + secondResult
        }
      }
    }

    console.warn(`[getDecomposition2] Cannot parse decomposition (no valid operator found): ${decomp}`)
    return ''
  }

  const result = buildDecomposition2Recursive(decomposition)
  if (result === '') {
    console.warn(
      `[getDecomposition2] buildDecomposition2Recursive returned empty string for character: ${String(character.character ?? 'unknown')}`,
      {
        decomposition,
        decomposition_list,
      },
    )
    return null
  }
  return result
}

export function getMatchIndex(decomposition2: string | null | undefined, component_id: string | number): number[][] {
  if (!decomposition2 || decomposition2 === null) {
    return []
  }

  const targetId = String(component_id)

  const allMatches: number[][] = []

  const findMatchRecursive = (decomp: string | null | undefined, currentPath: number[] = []): void => {
    if (!decomp || decomp === null) {
      return
    }

    const { content } = removeParentheses(decomp)
    decomp = content

    if (!decomp || decomp.length === 0) {
      return
    }

    if (decomp === targetId) {
      allMatches.push(currentPath)
      return
    }

    if (decomp.length === 1) {
      return
    }

    for (const op of OPERATORS) {
      if (decomp.startsWith(op)) {
        const rest = decomp.slice(op.length)

        if (THREE_PART_OPS.includes(op)) {
          const firstPartLength = findPartEnd(rest, 0)
          if (firstPartLength === -1 || firstPartLength > rest.length) {
            return
          }

          const firstPart = rest.slice(0, firstPartLength)
          const remaining = rest.slice(firstPartLength)

          const secondPartLength = findPartEnd(remaining, 0)
          if (secondPartLength === -1 || secondPartLength > remaining.length) {
            return
          }

          const secondPart = remaining.slice(0, secondPartLength)
          const thirdPart = remaining.slice(secondPartLength)

          findMatchRecursive(firstPart, [...currentPath, 0])
          findMatchRecursive(secondPart, [...currentPath, 1])
          findMatchRecursive(thirdPart, [...currentPath, 2])

          return
        }
        if (TWO_PART_OPS.includes(op)) {
          const firstPartLength = findPartEnd(rest, 0)
          if (firstPartLength === -1 || firstPartLength > rest.length) {
            return
          }

          const firstPart = rest.slice(0, firstPartLength)
          const secondPart = rest.slice(firstPartLength)

          findMatchRecursive(firstPart, [...currentPath, 0])
          findMatchRecursive(secondPart, [...currentPath, 1])

          return
        }
      }
    }
  }

  findMatchRecursive(decomposition2)
  return allMatches
}
