import { glyphRuntime } from '../glyphRuntime'
import { ParameterType } from "@/core/types"
import { extractLeafParts } from "@/features/advancedEdit/decomposition"
import { chainTransformStrokes, getComponentBound, getParentBound, standardTransformStrokes } from "../utils"
import * as R from 'ramda'

const parameters = [
  {
    name: '曲直度',
    value: 0, // -1为竖向，0为不变，1为横向 
    min: -1,
    max: 1,
    type: ParameterType.Number
  },
  {
    name: '对比度',
    value: 0, // -1为聚拢，0为不变，1为离散
    min: -1,
    max: 1,
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
      if (part.name === '勹') {
        const part = parts[j]
        const strokes_id = part.match === 'null' ? 'null' : part.match.join(',')
        const origin_strokes = []
        const origin_parent_strokes = []
        const strokes = []
        const parentBounds = getParentBound(parts, character, origin_ordered_components, strokes_id)

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
        const bounds = getComponentBound(strokes)
        const originBounds = getComponentBound(origin_strokes)

        const ox = originBounds.x + originBounds.width / 2
        const oy = originBounds.y + originBounds.height / 2

        let globalData = {}

        let scaleX = 1.0
        let scaleY = 1.0
        let xOffset = 0
        let yOffset = 0

        if (parameters['宽度缩放比例'] < 0) {
          scaleX = 1.0 + parameters['宽度缩放比例']
        } else if (parameters['宽度缩放比例'] > 0) {
          scaleX = 1.0 + parameters['宽度缩放比例'] * (parentBounds.width - originBounds.width) / originBounds.width
          xOffset = (parentBounds.x + parentBounds.width / 2 - ox) * parameters['宽度缩放比例']
        }

        if (parameters['高度缩放比例'] < 0) {
          scaleY = 1.0 + parameters['高度缩放比例']
        } else if (parameters['高度缩放比例'] > 0) {
          scaleY = 1.0 + parameters['高度缩放比例'] * (parentBounds.height - originBounds.height) / originBounds.height
          yOffset = (parentBounds.y + parentBounds.height / 2 - oy) * parameters['高度缩放比例']
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

        // 曲直度
        {
          const originPieVerticalSpan = glyphRuntime(newStrokes[0][0])!.getParam('竖直延伸') as number

          if (newStrokes[1][0].value.name === '竖挑') {
            const originTiaoVerticalSpan = glyphRuntime(newStrokes[1][0])!.getParam('挑-竖直延伸') as number
            glyphRuntime(strokes[1][0])!.setParam('挑-竖直延伸', originTiaoVerticalSpan - originTiaoVerticalSpan * Math.abs(parameters['曲直度']))
          } else {
            const originGouHorizontalSpan = glyphRuntime(newStrokes[1][0])!.getParam('钩-水平延伸') as number
            glyphRuntime(strokes[1][0])!.setParam('钩-水平延伸', originGouHorizontalSpan - originGouHorizontalSpan * Math.abs(parameters['曲直度']))
          }

          // 撇
          glyphRuntime(strokes[0][0])!.setParam('竖直延伸', originPieVerticalSpan - originPieVerticalSpan * Math.abs(parameters['曲直度']))
        }

        // 对比度
        {
          const originPieHorizontalSpan = glyphRuntime(newStrokes[0][0])!.getParam('水平延伸') as number
          if (parameters['对比度'] < 0) {
            glyphRuntime(strokes[0][0])!.setParam('水平延伸', originPieHorizontalSpan + (newBound.width - originPieHorizontalSpan) * Math.abs(parameters['对比度']))
          } else {
            glyphRuntime(strokes[0][0])!.setParam('水平延伸', originPieHorizontalSpan * Math.abs(parameters['对比度']))
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