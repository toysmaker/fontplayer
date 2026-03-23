import { glyphRuntime } from '../glyphRuntime'
import { ParameterType } from "@/core/types"
import { extractLeafParts } from "@/features/decomposition/utils"
import { chainTransformStrokes, flatNewStrokeIndex, getComponentBound, getParentBound, standardTransformStrokes } from "../utils"
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
    name: '衔接位置',
    value: 0, // -1为向上偏移，0为不变，1为向下偏移
    min: -1,
    max: 1,
    type: ParameterType.Number
  },
  {
    name: '对比度',
    value: 0, // 0为不变，-1为不对称，1为完全对称 
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

        // 撇
        {
          const origin_joints = glyphRuntime(origin_strokes[0][0])!.getJoints()
          let originStartX = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 0)])!.getJoints()[0].x + newStrokes[flatNewStrokeIndex(origin_strokes, 0)].ox
          let originEndX = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 0)])!.getJoints()[1].x + newStrokes[flatNewStrokeIndex(origin_strokes, 0)].ox
          let originStartY = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 0)])!.getJoints()[0].y + newStrokes[flatNewStrokeIndex(origin_strokes, 0)].oy
          let originEndY = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 0)])!.getJoints()[1].y + newStrokes[flatNewStrokeIndex(origin_strokes, 0)].oy
          let newStartX = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 0)])!.getJoints()[0].x + newStrokes[flatNewStrokeIndex(origin_strokes, 0)].ox
          let newEndX = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 0)])!.getJoints()[1].x + newStrokes[flatNewStrokeIndex(origin_strokes, 0)].ox
          let newStartY = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 0)])!.getJoints()[0].y + newStrokes[flatNewStrokeIndex(origin_strokes, 0)].oy
          let newEndY = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 0)])!.getJoints()[1].y + newStrokes[flatNewStrokeIndex(origin_strokes, 0)].oy

          const hengzhegouStartX = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 1)])!.getNonRefJoints()[0].x + newStrokes[flatNewStrokeIndex(origin_strokes, 1)].ox
          const hengzhegouStartY = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 1)])!.getNonRefJoints()[1].y + newStrokes[flatNewStrokeIndex(origin_strokes, 1)].oy

          // 曲直度
          newStartX += parameters['曲直度'] * (originStartX - hengzhegouStartX)
          newEndX += parameters['曲直度'] * (originEndX - hengzhegouStartX)

          const originBendDegree = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 0)])!.getParam('弯曲度') as number
          const minBendDegree = -30 * Number(glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 0)])!.getParam('弯曲程度'))
          glyphRuntime(strokes[0][0])!.setParam('弯曲度', originBendDegree + Math.abs(parameters['曲直度']) * (minBendDegree - originBendDegree))

          // 对比度
          newStartY += parameters['对比度'] * (hengzhegouStartY - newStartY)
          newEndY -= parameters['对比度'] * (newEndY - hengzhegouStartY)

          // 衔接位置
          if (parameters['衔接位置'] < 0) {
            newEndY += parameters['衔接位置'] * (newEndY - hengzhegouStartY)
            newStartY += parameters['衔接位置'] * (newEndY - hengzhegouStartY)
          }
          if (parameters['衔接位置'] > 0) {
            newEndY += parameters['衔接位置'] * (hengzhegouStartY - newStartY)
            newStartY += parameters['衔接位置'] * (hengzhegouStartY - newStartY)
          }

          // 更新数值
          glyphRuntime(strokes[0][0])!.setParam('水平延伸', newEndX - newStartX)
          glyphRuntime(strokes[0][0])!.setParam('竖直延伸', newEndY - newStartY)
          strokes[0][0].ox = origin_strokes[0][0].ox + (newStartX - (origin_joints[0].x + origin_strokes[0][0].ox))
          strokes[0][0].oy = origin_strokes[0][0].oy + (newStartY - (origin_joints[0].y + origin_strokes[0][0].oy))
        }

        // 曲直度
        {
          const originZheHorizontalSpan = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 1)])!.getParam('折-水平延伸') as number
          const originGouVerticalSpan = glyphRuntime(newStrokes[flatNewStrokeIndex(origin_strokes, 1)])!.getParam('钩-竖直延伸') as number

          // 折
          glyphRuntime(strokes[1][0])!.setParam('折-水平延伸', originZheHorizontalSpan - originZheHorizontalSpan * Math.abs(parameters['曲直度']))
          // 钩
          glyphRuntime(strokes[1][0])!.setParam('钩-竖直延伸', originGouVerticalSpan - originGouVerticalSpan * Math.abs(parameters['曲直度']))
        }
      }
    }
  }
}

export {
  update,
  parameters,
}