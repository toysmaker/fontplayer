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
    name: '离散度',
    value: 0, // -1为聚拢，0为不变，1为离散
    min: -1,
    max: 1,
    type: ParameterType.Number
  },
  {
    name: '对称度',
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
      if (part.name === '八') {
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
        const originGap = Math.abs((glyphRuntime(newStrokes[0][0])!.getJoints()[0].x + newStrokes[0][0].ox) - (glyphRuntime(newStrokes[1][0])!.getJoints()[0].x + newStrokes[1][0].ox))

        // if (parameters['高度缩放比例'] > 0) {
        //   chainTransformStrokes(parts, character, origin_ordered_components, strokes_id, originBounds, newBound)
        // }

        // 左撇
        {
          const origin_joints = glyphRuntime(origin_strokes[0][0])!.getJoints()

          let newStartX = glyphRuntime(newStrokes[0][0])!.getJoints()[0].x + newStrokes[0][0].ox
          let newEndX = glyphRuntime(newStrokes[0][0])!.getJoints()[1].x + newStrokes[0][0].ox

          const delta = (parentBounds.width / 2 - (newStartX - newEndX) - originGap / 2) * parameters['离散度']
          newEndX -= delta
          newStartX -= delta

          if (newEndX < parentBounds.x) {
            newEndX = parentBounds.x
          }
          if (parameters['对称度'] < 0) {
            newStartX -= parameters['对称度'] * (newStartX - newEndX)
          }
          if (parameters['曲直度'] < 0) {
            newStartX += parameters['曲直度'] * (newStartX - newEndX)
          }

          let newStartY = glyphRuntime(newStrokes[0][0])!.getJoints()[0].y + newStrokes[0][0].oy
          let newEndY = glyphRuntime(newStrokes[0][0])!.getJoints()[1].y + newStrokes[0][0].oy
          if (parameters['曲直度'] > 0) {
            newStartY -= parameters['曲直度'] * (newStartY - newEndY)
          }

          glyphRuntime(strokes[0][0])!.setParam('水平延伸', newStartX - newEndX)
          glyphRuntime(strokes[0][0])!.setParam('竖直延伸', newEndY - newStartY)
          if (newEndX === newStartX || newEndY === newStartY) {
            glyphRuntime(strokes[0][0])!.setParam('弯曲度', -30 * Number(glyphRuntime(origin_strokes[0][0])!.getParam('弯曲程度')))
          }
          strokes[0][0].ox = origin_strokes[0][0].ox + (newStartX - (origin_joints[0].x + origin_strokes[0][0].ox))
          strokes[0][0].oy = origin_strokes[0][0].oy + (newStartY - (origin_joints[0].y + origin_strokes[0][0].oy))
          globalData['left'] = {
            startX: newStartX,
            endX: newEndX,
            startY: newStartY,
            endY: newEndY,
          }
        }

        // 右捺、点
        {
          const origin_joints = glyphRuntime(origin_strokes[1][0])!.getJoints()

          let newStartX = glyphRuntime(newStrokes[1][0])!.getJoints()[0].x + newStrokes[1][0].ox
          let newEndX = glyphRuntime(newStrokes[1][0])!.getJoints()[1].x + newStrokes[1][0].ox

          const delta = (parentBounds.width / 2 - (newEndX - newStartX) - originGap / 2) * parameters['离散度']
          newEndX += delta
          newStartX += delta

          if (newEndX > parentBounds.x + parentBounds.width) {
            newEndX = parentBounds.x + parentBounds.width
          }
          if (parameters['对称度'] < 0) {
            newStartX -= parameters['对称度'] * (globalData['left'].EndX - newStartX)
          }
          if (parameters['曲直度'] < 0) {
            newStartX += parameters['曲直度'] * (newStartX - newEndX)
          }
          let newStartY = glyphRuntime(newStrokes[1][0])!.getJoints()[0].y + newStrokes[1][0].oy//averageY
          let newEndY = glyphRuntime(newStrokes[1][0])!.getJoints()[1].y + newStrokes[1][0].oy
          if (parameters['倾斜度'] > 0) {
            newEndY -= parameters['倾斜度'] * (newEndY - newStartY)
          }

          glyphRuntime(strokes[1][0])!.setParam('水平延伸', newEndX - newStartX)
          glyphRuntime(strokes[1][0])!.setParam('竖直延伸', newEndY - newStartY)
          if (newEndX === newStartX || newEndY === newStartY && newStrokes[1][0].value.name === '捺') {
            glyphRuntime(strokes[1][0])!.setParam('弯曲度', -30 * Number(glyphRuntime(origin_strokes[1][0])!.getParam('弯曲程度')))
          } else if (newEndX === newStartX || newEndY === newStartY && newStrokes[1][0].value.name === '点') {
            glyphRuntime(strokes[1][0])!.setParam('弯曲度', -10 * Number(glyphRuntime(origin_strokes[1][0])!.getParam('弯曲程度')))
          }
          strokes[1][0].ox = origin_strokes[1][0].ox + (newStartX - (origin_joints[0].x + origin_strokes[1][0].ox))
          strokes[1][0].oy = origin_strokes[1][0].oy + (newStartY - (origin_joints[0].y + origin_strokes[1][0].oy))
          globalData['right'] = {
            startX: newStartX,
            endX: newEndX,
            startY: newStartY,
            endY: newEndY,
          }
        }

        // 后处理
        {
          if (parameters['对称度'] > 0) {
            const startY = Math.min(globalData['left'].startY, globalData['right'].startY)
            let endY = Math.max(globalData['left'].endY, globalData['right'].endY)
            if (parameters['曲直度'] === 1) {
              endY = startY
            }
            const left_horizontal_span = Math.abs(globalData['left'].endX - globalData['left'].startX)
            const right_horizontal_span = Math.abs(globalData['right'].endX - globalData['right'].startX)
            const horizontal_span = Math.max(left_horizontal_span, right_horizontal_span)
            const origin_left_horizontal_span = glyphRuntime(origin_strokes[0][0])!.getParam('水平延伸')
            const origin_right_horizontal_span = glyphRuntime(origin_strokes[1][0])!.getParam('水平延伸')
            const origin_left_vertical_span = glyphRuntime(origin_strokes[0][0])!.getParam('竖直延伸')
            const origin_right_vertical_span = glyphRuntime(origin_strokes[1][0])!.getParam('竖直延伸')
            glyphRuntime(strokes[0][0])!.setParam('水平延伸', origin_left_horizontal_span + (horizontal_span - origin_left_horizontal_span) * parameters['对称度'])
            glyphRuntime(strokes[0][0])!.setParam('竖直延伸', origin_left_vertical_span + (endY - startY - origin_left_vertical_span) * parameters['对称度'])
            glyphRuntime(strokes[1][0])!.setParam('水平延伸', origin_right_horizontal_span + (horizontal_span - origin_right_horizontal_span) * parameters['对称度'])
            glyphRuntime(strokes[1][0])!.setParam('竖直延伸', origin_right_vertical_span + (endY - startY - origin_right_vertical_span) * parameters['对称度'])
            strokes[0][0].oy = strokes[0][0].oy + (startY - (glyphRuntime(strokes[0][0])!.getJoints()[0].y + strokes[0][0].oy)) * parameters['对称度']
            strokes[1][0].oy = strokes[1][0].oy + (startY - (glyphRuntime(strokes[1][0])!.getJoints()[0].y + strokes[1][0].oy)) * parameters['对称度']
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