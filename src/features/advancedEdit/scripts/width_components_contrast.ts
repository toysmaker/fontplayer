import { glyphRuntime } from './glyphRuntime'
import { strokeFnMap } from '@/templates/strokeFnMap'
import { extractLeafParts, findPartByMatch, getDecompositionTree } from '@/features/advancedEdit/decomposition'
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
  startX: number
  endX: number
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
  let rootWidth = transformSequence[0].type === 'vertical' ? 1000 - delta * 2 : 1000
  let rootX = transformSequence[0].type === 'vertical' ? 0 + delta : 0

  for (let i = 0; i < transformSequence.length; i++) {
    const transformItem = transformSequence[i]
    const { startX, endX } = transformItem
    if (transformItem.type === 'vertical') {
      targetBounds.width = (endX - startX) * rootWidth
      targetBounds.x = startX * rootWidth + rootX
      rootWidth = targetBounds.width - delta
      rootX = targetBounds.x + delta
    } else {
      targetBounds.width = (endX - startX) * rootWidth
      targetBounds.x = startX * rootWidth + rootX
      rootWidth = targetBounds.width
      rootX = targetBounds.x
    }
  }

  return transformPointFromBounds(point, bounds, targetBounds)
}

const transformPointFromBounds = (point, originBounds, targetBounds) => {
  const delta = 0
  const { x, y } = point
  const { x: originMinX, y: originMinY, width: originWidth, height: originHeight } = originBounds
  const { x: targetMinX, y: targetMinY, width: targetWidth, height: targetHeight } = targetBounds
  const xRatio = (targetWidth - delta * 2) / originWidth
  return {
    x: (x - originMinX) * xRatio + targetMinX + delta,
    y,
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

  const parentBounds = getPartBounds(match.slice(0, -1), parts, tree)
  const parentWidth = parentBounds.width
  const parentOp = parent.ids
  let startX = 0
  let endX = 1
  let type = 'vertical'
  if (parentOp === '⿳') {
    const firstPartBounds = getPartBounds([...match.slice(0, -1), 0], parts, tree)
    const secondPartBounds = getPartBounds([...match.slice(0, -1), 1], parts, tree)
    const thirdPartBounds = getPartBounds([...match.slice(0, -1), 2], parts, tree)
    const a = firstPartBounds.width / parentWidth
    const b = secondPartBounds.width / parentWidth
    const c = thirdPartBounds.width / parentWidth
    const aa = Math.pow(a, options.params[0])
    const bb = Math.pow(b, options.params[0])
    const cc = Math.pow(c, options.params[0])
    if (lastPartIndex === 0) {
      startX =  (1 - aa) * 0.5
      endX = (1 - aa) * 0.5 + aa
    } else if (lastPartIndex === 1) {
      startX = (1 - bb) * 0.5
      endX = (1 - bb) * 0.5 + bb
    } else if (lastPartIndex === 2) {
      startX = (1 - cc) * 0.5
      endX = (1 - cc) * 0.5 + cc
    }
  } else if (parentOp === '⿱') {
    const firstPartBounds = getPartBounds([...match.slice(0, -1), 0], parts, tree)
    const secondPartBounds = getPartBounds([...match.slice(0, -1), 1], parts, tree)
    const a = firstPartBounds.width / parentWidth
    const b = secondPartBounds.width / parentWidth
    const aa = Math.pow(a, options.params[0])
    const bb = Math.pow(b, options.params[0])
    if (lastPartIndex === 0) {
      startX = (1 - aa) * 0.5
      endX = (1 - aa) * 0.5 + aa
    } else {
      startX = (1 - bb) * 0.5
      endX = (1 - bb) * 0.5 + bb
    }
  } else {
    const bounds = getPartBounds(match, parts, tree)
    startX = (bounds.x - parentBounds.x) / parentWidth
    endX = (bounds.x + bounds.width - parentBounds.x) / parentWidth
    type = 'horizontal'
  }
  return [...parentSequence, { startX, endX, type }]
}

const updateWidthComponentsContrast = (originCharacters, characters, parameters) => {
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
            if (!key.includes('horizon')) {
              new_parameters[key] = origin_parameters[key]
            }
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

export { updateWidthComponentsContrast }