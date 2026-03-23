import { glyphRuntime } from '../glyphRuntime'
import { ParameterType } from "@/core/types"
import { extractLeafParts } from "@/features/decomposition/utils"
import { applyConstrastTransform, chainTransformStrokes, flatNewStrokeIndex, getComponentBound, getParentBound, POINT_REF, standardTransformStrokes, transformBound } from "../utils"
import * as R from 'ramda'

const parameters = [
  {
    name: '衔接位置',
    value: 0, // -1为向上偏移，0为不变，1为向下偏移
    min: -1,
    max: 1,
    type: ParameterType.Number
  },
  {
    name: '对比度',
    value: 0, // 0为不变，-1为不对称，1为完全对称 
    min: -2,
    max: 2,
    type: ParameterType.Number
  },
// -------------------------- 变形参数 --------------------------
  {
    name: '宽度缩放比例',
    value: 0, // 0为不变，-1为缩小为0，1为占满父容器 
    min: -1,
    max: 1,
    type: ParameterType.Number
  },
  {
    name: '高度缩放比例',
    value: 0, // 0为不变，-1为缩小为0，1为占满父容器 
    min: -1,
    max: 1,
    type: ParameterType.Number
  }
]

const update = (originCharacters, characters, _parameters) => {
  const parameters = {}
  for (let i = 0; i < _parameters.length; i++) {
    parameters[_parameters[i].name] = _parameters[i].value
  }
  for (let i = 0; i < characters.length; i++) {
    characters[i] = R.clone(originCharacters[i])
    let character = characters[i]
    const originCharacter = originCharacters[i]
    if (character.decomposition === null) {
      continue
    }
    let parts = extractLeafParts(character.decomposition)
    const ordered_components = character.orderedList.map((item) => character.components.find((component) => component.uuid === item.uuid))
    const origin_ordered_components = originCharacter.orderedList.map((item) => originCharacter.components.find((component) => component.uuid === item.uuid))
    for (let j = 0; j < parts.length; j++) {
      const part = parts[j]
      if (part.name === '贝') {
        const part = parts[j]
        const op = part.ids[part.ids.length - 1]
        const strokes_id = part.match === 'null' ? 'null' : part.match.join(',')
        const origin_strokes = []
        const origin_parent_strokes = []
        const strokes = []
        const parentBound = getParentBound(parts, character, origin_ordered_components, strokes_id)

        // 计算当前部件笔画和包围框
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
        const bound = getComponentBound(strokes)
        const originBound = getComponentBound(origin_strokes)

        const ox = originBound.x + originBound.width / 2
        const oy = originBound.y + originBound.height / 2

        let globalData = {}

        let scaleX = 1.0
        let scaleY = 1.0
        let xOffset = 0
        let yOffset = 0

        if (parameters['宽度缩放比例'] < 0) {
          scaleX = 1.0 + parameters['宽度缩放比例']
        } else if (parameters['宽度缩放比例'] > 0) {
          scaleX = 1.0 + parameters['宽度缩放比例'] * (parentBound.width - originBound.width) / originBound.width
          xOffset = (parentBound.x + parentBound.width / 2 - ox) * parameters['宽度缩放比例']
        }

        if (parameters['高度缩放比例'] < 0) {
          scaleY = 1.0 + parameters['高度缩放比例']
        } else if (parameters['高度缩放比例'] > 0) {
          scaleY = 1.0 + parameters['高度缩放比例'] * (parentBound.height - originBound.height) / originBound.height
          yOffset = (parentBound.y + parentBound.height / 2 - oy) * parameters['高度缩放比例']
        }

        const transform = {
          xScale: scaleX,
          yScale: scaleY,
          xOffset: xOffset,
          yOffset: yOffset,
        }
        const newStrokes = standardTransformStrokes(origin_strokes, transform)
        const newBound = getComponentBound(newStrokes)

        // if (parameters['高度缩放比例'] > 0) {
        //   chainTransformStrokes(parts, character, origin_ordered_components, strokes_id, originBounds, newBound)
        // }

        // 对比度
        {
          const strokesOfPart0 = [newStrokes[0], newStrokes[1]]
          const strokesOfPart1 = [newStrokes[2], newStrokes[3]]
          const boundOfPart0 = getComponentBound(strokesOfPart0)
          const boundOfPart1 = getComponentBound(strokesOfPart1)
          if (parameters['对比度'] < 0 && parameters['对比度'] >= -1) {
            let targetBoundOfPart0 = boundOfPart0
            if (op === '⿱' || op === '⿳') {
              targetBoundOfPart0 = Object.assign({}, boundOfPart0, {
                width: parentBound.width,
                x: parentBound.x,
              })
            }
            const targetBoundOfPart1 = transformBound(boundOfPart1, {
              xScale: {
                scale: 0.5,
                origin: POINT_REF.CENTER,
              },
            })
            applyConstrastTransform(strokesOfPart0, [0, -1, parameters['对比度']], targetBoundOfPart0, character)
            applyConstrastTransform(strokesOfPart1, [0, -1, parameters['对比度']], targetBoundOfPart1, character)
          } else if (parameters['对比度'] > 0 && parameters['对比度'] <= 1) {
            const targetBoundOfPart0 = transformBound(boundOfPart0, {
              xScale: {
                scale: 0.5,
                origin: POINT_REF.CENTER,
              },
            })
            let targetBoundOfPart1 = boundOfPart1
            if (op === '⿱' || op === '⿳') {
              targetBoundOfPart1 = Object.assign({}, boundOfPart1, {
                width: parentBound.width,
                x: parentBound.x,
              })
            }
            applyConstrastTransform(strokesOfPart0, [0, 1, parameters['对比度']], targetBoundOfPart0, character)
            applyConstrastTransform(strokesOfPart1, [0, 1, parameters['对比度']], targetBoundOfPart1, character)
          } else if (Math.abs(parameters['对比度']) > 1) {
            let targetBoundOfPart0 = boundOfPart0
            if (op === '⿱' || op === '⿳') {
              targetBoundOfPart0 = Object.assign({}, boundOfPart0, {
                width: parentBound.width,
                x: parentBound.x,
              })
            }
            let targetBoundOfPart1 = boundOfPart1
            if (op === '⿱' || op === '⿳') {
              targetBoundOfPart1 = Object.assign({}, boundOfPart1, {
                width: parentBound.width,
                x: parentBound.x,
              })
            }
            applyConstrastTransform(strokesOfPart0, [0, 1, Math.abs(parameters['对比度']) - 1], targetBoundOfPart0, character)
            applyConstrastTransform(strokesOfPart1, [0, 1, Math.abs(parameters['对比度']) - 1], targetBoundOfPart1, character)
          }
        }

        // // 对比度
        // {
        //   const originHengHorizontalSpan = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 1)])!.getParam('横-水平延伸') as number
        //   const originPieHorizontalSpan = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 2)])!.getParam('水平延伸') as number
        //   const originDianVerticalSpan = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 3)])!.getParam('水平延伸') as number
        //   const originPieEndX = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 2)])!.getNonRefJoints()[1].x + newStrokes[flatNewStrokeIndex(origin_strokes, 2)].ox
        //   const originDianEndX = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 3)])!.getNonRefJoints()[1].x + newStrokes[flatNewStrokeIndex(origin_strokes, 3)].ox
        //   if (parameters['对比度'] > 0) {
        //     // 上半部分
        //     glyphRuntime(strokes[1][0])!.setParam('横-水平延伸', originHengHorizontalSpan * (0.5 - 0.5 * parameters['对比度']))
        //     strokes[0][0].value.ox = origin_strokes[0][0].ox + originHengHorizontalSpan * (1 - (0.5 - 0.5 * parameters['对比度'])) * 0.5

        //     // 下半部分
        //     glyphRuntime(strokes[2][0])!.setParam('水平延伸', originPieHorizontalSpan + (originPieEndX - newBound.x) * parameters['对比度'])
        //     glyphRuntime(strokes[3][0])!.setParam('水平延伸', originDianVerticalSpan + (newBound.x + newBound.width - originDianEndX) * parameters['对比度'])
        //   }
        //   if (parameters['对比度'] < 0) {
        //     // 上半部分
        //     glyphRuntime(strokes[1][0])!.setParam('横-水平延伸', originHengHorizontalSpan + (newBound.width - originHengHorizontalSpan) * Math.abs(parameters['对比度']))
        //     strokes[0][0].value.ox = origin_strokes[0][0].ox - (newBound.width - originHengHorizontalSpan) * Math.abs(parameters['对比度']) * 0.5

        //     // 下半部分
        //     glyphRuntime(strokes[2][0])!.setParam('水平延伸', originPieHorizontalSpan + (originPieEndX - newBound.x) * Math.abs(parameters['对比度']))
        //     glyphRuntime(strokes[3][0])!.setParam('水平延伸', originDianVerticalSpan + (newBound.x + newBound.width - originDianEndX) * Math.abs(parameters['对比度']))
        //   }
        // }

        // 衔接位置
        {
          if (parameters['衔接位置'] < 0) {
            const bendCursor = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 2)])!.getParam('弯曲游标') as number
            const verticalSpan = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 3)])!.getParam('竖直延伸') as number
            glyphRuntime(strokes[2][0])!.setParam('弯曲游标', bendCursor + parameters['衔接位置'] * 0.3)
            glyphRuntime(strokes[3][0])!.setParam('竖直延伸', verticalSpan + parameters['衔接位置'] * 100)
            strokes[3][0].value.oy = origin_strokes[3][0].oy - verticalSpan + parameters['衔接位置'] * 100
          }
          if (parameters['衔接位置'] > 0) {
            const bendCursor = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 2)])!.getParam('弯曲游标') as number
            const verticalSpan = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 3)])!.getParam('竖直延伸') as number
            glyphRuntime(strokes[2][0])!.setParam('弯曲游标', bendCursor + parameters['衔接位置'] * 0.3)
            glyphRuntime(strokes[3][0])!.setParam('竖直延伸', verticalSpan - parameters['衔接位置'] * 100)
            strokes[3][0].value.oy = origin_strokes[3][0].oy + verticalSpan + parameters['衔接位置'] * 100
          }
        }
      }
    }
  }
}

export {
  update,
  parameters,
}