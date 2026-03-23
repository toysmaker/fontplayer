import { glyphRuntime } from './glyphRuntime'
import { strokeFnMap } from '@/templates/strokeFnMap'
import { extractLeafParts, findPartByMatch, getDecompositionTree } from '@/features/decomposition/utils'
import type { ICustomGlyph, IGlyphComponent } from '@/core/types'
import { getComponentBound } from './utils'

const flatten = (array) => {
  return array.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatten(val) : val), [])
}

// const getComponentBound = (strokes: Array<IGlyphComponent>) => {
//   const flattened_strokes = flatten(strokes)
//   let minX = Infinity
//   let minY = Infinity
//   let maxX = -Infinity
//   let maxY = -Infinity
//   for (let i = 0; i < flattened_strokes.length; i++) {
//     const stroke = flattened_strokes[i]
//     const ox = stroke.ox
//     const oy = stroke.oy
//     const joints = glyphRuntime(stroke)!.getJoints()
//     for (let j = 0; j < joints.length; j++) {
//       const joint = joints[j]
//       minX = Math.min(minX, joint.x + ox)
//       minY = Math.min(minY, joint.y + oy)
//       maxX = Math.max(maxX, joint.x + ox)
//       maxY = Math.max(maxY, joint.y + oy)
//     }
//   }
//   return {
//     x: minX,
//     y: minY,
//     width: maxX - minX,
//     height: maxY - minY,
//   }
// }

interface ITransformOptions {
  type: 'pow' | 'linear'
  params: Array<number>
}

interface ITransformItem {
  startY: number
  endY: number
  type: 'horizontal' | 'vertical'
}

const transformPoint = (
  point: { x: number, y: number, name: string },
  bounds: { x: number, y: number, width: number, height: number },
  transformSequence: Array<ITransformItem>,
) => {
  const { x, y } = point
  const { x: minX, y: minY, width, height } = bounds
  const targetBounds = Object.assign({}, bounds)
  const delta = 0
  if (transformSequence.length === 0) {
    return point
  }
  let rootHeight = transformSequence[0].type === 'vertical' ? 1000 - delta * 2 : 1000
  let rootY = transformSequence[0].type === 'vertical' ? 0 + delta : 0

  for (let i = 0; i < transformSequence.length; i++) {
    const transformItem = transformSequence[i]
    const { startY, endY } = transformItem
    if (transformItem.type === 'vertical') {
      targetBounds.height = (endY - startY) * rootHeight
      targetBounds.y = startY * rootHeight + rootY
      rootHeight = targetBounds.height - delta
      rootY = targetBounds.y + delta
    } else {
      targetBounds.height = (endY - startY) * rootHeight
      targetBounds.y = startY * rootHeight + rootY
      rootHeight = targetBounds.height
      rootY = targetBounds.y
    }
  }

  return transformPointFromBounds(point, bounds, targetBounds)
}

const transformPointFromBounds = (point, originBounds, targetBounds) => {
  const delta = 0
  const { x, y } = point
  const { x: originMinX, y: originMinY, width: originWidth, height: originHeight } = originBounds
  const { x: targetMinX, y: targetMinY, width: targetWidth, height: targetHeight } = targetBounds
  const yRatio = (targetHeight - delta * 2) / originHeight
  return {
    x: x,
    y: (y - originMinY) * yRatio + targetMinY + delta,
  }
}

const getPartByMatch = (parts, match) => {
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part.match.join(',') === match.join(',')) {
      return part
    }
  }
  return null
}

const mergeBounds = (boundsList) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < boundsList.length; i++) {
    const bounds = boundsList[i]
    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

const getPartBounds = (match, parts, tree) => {
  if (match.length === 0) {
    return {
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
    }
  } else {
    const node = findPartByMatch(tree, match)
    if (!node.children || node.children.length === 0) {
      return getPartByMatch(parts, match).originBounds
    } else {
      const boundsList = []
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        boundsList.push(getPartBounds([...match, i], parts, tree))
      }
      return mergeBounds(boundsList)
    }
  }
}

const computeTransformSequence = (match, parts, tree, options: ITransformOptions) => {
  if (!match || match.length === 0) {
    return []
  }

  const delta = 50
  const rootWidth = 1000

  const parentSequence = computeTransformSequence(match.slice(0, -1), parts, tree, options)
  const parent = findPartByMatch(tree, match.slice(0, -1))
  const lastPartIndex = match[match.length - 1]

  const parentBounds = match.length === 1 ? { x: 0, y: 0, width: 1000, height: 1000 } : getPartBounds(match.slice(0, -1), parts, tree)
  const parentHeight = parentBounds.height
  const parentOp = parent.ids
  let startY = 0
  let endY = 1
  let type = 'vertical'
  if (parentOp === '⿳') {
    const firstPartBounds = getPartBounds([...match.slice(0, -1), 0], parts, tree)
    const secondPartBounds = getPartBounds([...match.slice(0, -1), 1], parts, tree)
    const thirdPartBounds = getPartBounds([...match.slice(0, -1), 2], parts, tree)
    const a = firstPartBounds.height / parentHeight
    const b = secondPartBounds.height / parentHeight
    const c = thirdPartBounds.height / parentHeight
    const gap0 = firstPartBounds.y - parentBounds.y
    const gap01 = secondPartBounds.y - firstPartBounds.y - firstPartBounds.height
    const gap12 = thirdPartBounds.y - secondPartBounds.y - secondPartBounds.height
    const gap2 = parentBounds.y + parentHeight - thirdPartBounds.y - thirdPartBounds.height
    const d = gap0 / parentHeight
    const e = gap01 / parentHeight
    const f = gap12 / parentHeight
    const g = gap2 / parentHeight
    const aa = Math.pow(a, options.params[0])
    const bb = Math.pow(b, options.params[0])
    const cc = Math.pow(c, options.params[0])
    const aaa = aa / (aa + bb + cc + d + e + f + g)
    const bbb = bb / (aa + bb + cc + d + e + f + g)
    const ccc = cc / (aa + bb + cc + d + e + f + g)
    if (lastPartIndex === 0) {
      startY = d
      endY = aaa + d
    } else if (lastPartIndex === 1) {
      startY = aaa + d + e
      endY = bbb + aaa + d + e
    } else if (lastPartIndex === 2) {
      startY = aaa + bbb + d + e + f
      endY = ccc + aaa + bbb + d + e + f
    }
  } else if (parentOp === '⿱') {
    const firstPartBounds = getPartBounds([...match.slice(0, -1), 0], parts, tree)
    const secondPartBounds = getPartBounds([...match.slice(0, -1), 1], parts, tree)
    const a = firstPartBounds.height / parentHeight
    const b = secondPartBounds.height / parentHeight
    const gap0 = firstPartBounds.y - parentBounds.y
    const gap01 = secondPartBounds.y - firstPartBounds.y - firstPartBounds.height
    const gap1 = parentBounds.y + parentHeight - secondPartBounds.y - secondPartBounds.height
    const d = gap0 / parentHeight
    const e = gap01 / parentHeight
    const f = gap1 / parentHeight
    const aa = Math.pow(a, options.params[0])
    const bb = Math.pow(b, options.params[0])
    const aaa = aa / (aa + bb + d + e + f)
    const bbb = bb / (aa + bb + d + e + f)
    if (lastPartIndex === 0) {
      startY = d
      endY = aaa + d
    } else {
      startY = aaa + d + e
      endY = bbb + aaa + d + e
    }
  } else {
    const bounds = getPartBounds(match, parts, tree)
    startY = (bounds.y - parentBounds.y) / parentHeight
    endY = (bounds.y + bounds.height - parentBounds.y) / parentHeight
    type = 'horizontal'
  }
  return [...parentSequence, { startY, endY, type }]
}

const updateVerticalComponentsRatio = (originCharacters, characters, parameters) => {
  for (let i = 0; i < characters.length; i++) {
    const character = characters[i]
    const originCharacter = originCharacters[i]
    if (character.decomposition === null) {
      continue
    }
    let parts = extractLeafParts(character.decomposition)
    const ordered_components = character.orderedList.map((item) => character.components.find((component) => component.uuid === item.uuid))
    const origin_ordered_components = originCharacter.orderedList.map((item) => originCharacter.components.find((component) => component.uuid === item.uuid))
    for (let j = 0; j < parts.length; j++) {
      const part = parts[j]
      const strokes_id = part.match === 'null' ? 'null' : part.match.join(',')
      const origin_strokes = []
      const strokes = []
      const strokes_uuids = character.matches.find((item) => item[0] === strokes_id)[1]
      for (let k = 0; k < strokes_uuids.length; k++) {
        const stroke_uuid = strokes_uuids[k]
        const stroke_components = []
        const origin_stroke_components = []
        for (let l = 0; l < stroke_uuid.length; l++) {
          origin_stroke_components.push(origin_ordered_components.find((item) => item.uuid === stroke_uuid[l]))
          stroke_components.push(ordered_components.find((item) => item.uuid === stroke_uuid[l]))
        }
        origin_strokes.push(origin_stroke_components)
        strokes.push(stroke_components)
      }
      const bounds = getComponentBound(strokes)
      const originBounds = getComponentBound(origin_strokes)
      part.bounds = bounds
      part.originBounds = originBounds
      part.strokes = strokes
      part.origin_strokes = origin_strokes
    }

    const tree = getDecompositionTree(character.decomposition)
    for (let j = 0; j < parts.length; j++) {
      const part = parts[j]
      part.transformSequence = computeTransformSequence(part.match, parts, tree, { type: 'pow', params: [parameters[0].value] })
    }

    for (let j = 0; j < parts.length; j++) {
      const part = parts[j]
      const strokes = part.strokes
      const origin_strokes = part.origin_strokes
      for (let k = 0; k < strokes.length; k++) {
        for (let l = 0; l < strokes[k].length; l++) {
          const stroke = strokes[k][l]
          const origin_stroke = origin_strokes[k][l]
          const ox = origin_stroke.ox
          const oy = origin_stroke.oy
          const joints = glyphRuntime(origin_stroke)!.getJoints()
          const pointsMap = {}
          const originJointsMap = {}
          for (let m = 0; m < joints.length; m++) {
            const joint = joints[m]
            const point = {
              x: joint.x + ox,
              y: joint.y + oy,
              name: joint.name,
            }
            originJointsMap[joint.name] = {
              x: joint.x + ox,
              y: joint.y + oy,
              name: joint.name,
            }
            const new_point = transformPoint(point, part.originBounds, part.transformSequence)
            if (m === 0) {
              stroke.ox = ox + (new_point.x - point.x)
              stroke.oy = oy + (new_point.y - point.y)
            }
            pointsMap[joint.name] = {
              x: new_point.x - ox,
              y: new_point.y - oy,
            }
          }
          const origin_parameters = strokeFnMap[origin_stroke.value.name].computeParamsByJoints(originJointsMap, glyphRuntime(origin_stroke)!)
          const new_parameters = strokeFnMap[stroke.value.name].computeParamsByJoints(pointsMap, glyphRuntime(stroke)!)
          Object.keys(new_parameters).forEach((key) => {
            // if (!key.includes('vertical')) {
            //   new_parameters[key] = origin_parameters[key]
            // }
          })
          strokeFnMap[stroke.value.name].updateParamsByJoints(new_parameters, glyphRuntime(stroke)!)
        }
      }
    }
  }
}

const arrToObj = (array) => {
  const map = {}
  for (let i = 0; i < array.length; i++) {
    map[array[i].name] = array[i]
  }
  return map
}

export { updateVerticalComponentsRatio }