import { glyphRuntime } from './glyphRuntime'
import { strokeFnMap } from '@/templates/strokeFnMap'
import { extractLeafParts } from '@/features/decomposition/utils'
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
  threshold?: number
  thresholdInRatio?: number
}

const transformPoint = (
  point: { x: number, y: number, name: string },
  bounds: { x: number, y: number, width: number, height: number },
  options: ITransformOptions
) => {
  const { x, y } = point
  const { x: minX, y: minY, width, height } = bounds
  let { threshold, thresholdInRatio } = options
  if (!threshold) {
    threshold = 0
  }
  if (!thresholdInRatio) {
    thresholdInRatio = 0
  }
  if (height === 0) {
    return point
  }

  if (options.type === 'pow') {
    const oy = minY + height / 2
    const d = y - oy
    const D = Math.pow(Math.abs(d) * 2 / height, options.params[0])
    let newY = y
    if (D > thresholdInRatio && Math.abs(d) > threshold) {
      newY = oy + (d > 0 ? 1 : -1) * D * height / 2
    }
    return {
      name: point.name,
      x: x,
      y: newY,
    }
  }

  return point
}

const updateHeightStrokesContrast = (originCharacters, characters, parameters) => {
  for (let i = 0; i < characters.length; i++) {
    const character = characters[i]
    const originCharacter = originCharacters[i]
    let parts = extractLeafParts(character.decomposition)
    if (character.decomposition === null) {
      parts = [{ name: character.character.text, match: 'null' }]
    }
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
            const new_point = transformPoint(point, bounds, { type: 'pow', params: [parameters[0].value], threshold: 20, thresholdInRatio: 0.1 })
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
            if (!key.includes('vertical')) {
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

export { updateHeightStrokesContrast }