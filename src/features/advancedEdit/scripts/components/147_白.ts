import { glyphRuntime } from '../glyphRuntime'
import { ParameterType } from "@/core/types"
import { extractLeafParts } from "@/features/advancedEdit/decomposition"
import { applyConstrastTransform, applyCurvatureTransform, applyTranslateTransform, chainTransformStrokes, getComponentBound, getParentBound, POINT_REF, standardTransformStrokes, transformBound } from "../utils"
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
  {
    name: '衔接位置',
    value: 0, // 0为不变，-1为往左，1为往右
    min: -1,
    max: 1,
    type: ParameterType.Number
  },
  {
    name: '凸展度',
    value: 0,
    min: 0,
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
      if (part.name === '丷') {
        const part = parts[j]
        const strokes_id = part.match === 'null' ? 'null' : part.match.join(',')
        const origin_strokes = []
        const origin_parent_strokes = []
        const strokes = []
        const op = part.ids[part.ids.length - 1]

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
        let parentBound = bound

        if (op === '⿱' || op === '⿳') {
          parentBound = getParentBound(parts, character, origin_ordered_components, strokes_id)
        }
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

        // 曲直度
        {
          const strokesOfPart0 = [newStrokes[0]]
          if (parameters['曲直度'] < 0) {
            applyCurvatureTransform(strokesOfPart0, [0, -1, parameters['曲直度']], {
              FIXLENGTH: false,
              DIRECTION: 'DOWN',
              ROOTPOINT: 'START',
              RESTRAINBOUND: parentBound
            })
          } else if (parameters['曲直度'] > 0) {
            applyCurvatureTransform(strokesOfPart0, [0, 1, parameters['曲直度']], {
              FIXLENGTH: true,
              DIRECTION: 'UP',
              ROOTPOINT: 'START',
              RESTRAINBOUND: parentBound
            })
          }
        }

        // 对比度
        {
          const strokesOfPart0 = [newStrokes[0]]
          const boundOfPart0 = getComponentBound(strokesOfPart0)
          if (parameters['对比度'] < 0) {
            const targetBound = transformBound(parentBound, {
              yScale: {
                scale: boundOfPart0.height / parentBound.height,
                origin: POINT_REF.START,
              },
            })
            applyConstrastTransform(strokesOfPart0, [0, -1, parameters['对比度']], targetBound, character, true)
          }
          if (parameters['对比度'] > 0) {
            const targetBound = transformBound(boundOfPart0, {
              xScale: {
                scale: 0,
                origin: POINT_REF.CENTER,
              },
            })
            applyConstrastTransform(strokesOfPart0, [0, 1, parameters['对比度']], targetBound, character, true)
          }
        }

        // 衔接位置
        {
          const strokesOfPart0 = [newStrokes[0]]
          const boundOfPart0 = getComponentBound(strokesOfPart0)
          if (parameters['衔接位置'] < 0) {
            const target = {
              offsetX: -(boundOfPart0.x - parentBound.x),
              offsetY: 0,
            }
            applyTranslateTransform(strokesOfPart0, [0, -1, parameters['衔接位置']], target)
          } else if (parameters['衔接位置'] > 0) {
            const target = {
              offsetX: parentBound.x + parentBound.width - boundOfPart0.x - boundOfPart0.width,
              offsetY: 0,
            }
            applyTranslateTransform(strokesOfPart0, [0, 1, parameters['衔接位置']], target)
          }
        }

        // // 撇
        // {
        //   const origin_joints = glyphRuntime(origin_strokes[0][0])!.getJoints()
        //   let originStartX = glyphRuntime(newStrokes[0][0])!.getJoints()[0].x + newStrokes[0][0].ox
        //   let originEndX = glyphRuntime(newStrokes[0][0])!.getJoints()[1].x + newStrokes[0][0].ox
        //   let originStartY = glyphRuntime(newStrokes[0][0])!.getJoints()[0].y + newStrokes[0][0].oy
        //   let originEndY = glyphRuntime(newStrokes[0][0])!.getJoints()[1].y + newStrokes[0][0].oy
        //   let newStartX = glyphRuntime(newStrokes[0][0])!.getJoints()[0].x + newStrokes[0][0].ox
        //   let newEndX = glyphRuntime(newStrokes[0][0])!.getJoints()[1].x + newStrokes[0][0].ox
        //   let newStartY = glyphRuntime(newStrokes[0][0])!.getJoints()[0].y + newStrokes[0][0].oy
        //   let newEndY = glyphRuntime(newStrokes[0][0])!.getJoints()[1].y + newStrokes[0][0].oy

        //   // 曲直度
        //   if (parameters['曲直度'] < 0) {
        //     newEndX += parameters['曲直度'] * (newEndX - newStartX)
        //   }
        //   if (parameters['曲直度'] > 0) {
        //     newEndY -= parameters['曲直度'] * (newEndY - newStartY)
        //   }

        //   const originBendDegree = glyphRuntime(newStrokes[0][0])!.getParam('弯曲度') as number
        //   const minBendDegree = -30 * Number(glyphRuntime(newStrokes[0][0])!.getParam('弯曲程度'))
        //   glyphRuntime(strokes[0][0])!.setParam('弯曲度', originBendDegree + Math.abs(parameters['曲直度']) * (minBendDegree - originBendDegree))

        //   // 衔接位置
        //   if (parameters['衔接位置'] < 0) {
        //     newEndX += parameters['衔接位置'] * (newEndX - parentBound.x)
        //     newStartX += parameters['衔接位置'] * (newEndX - parentBound.x)
        //   }
        //   if (parameters['衔接位置'] > 0) {
        //     newEndX += parameters['衔接位置'] * (parentBound.x + parentBound.width - (newEndX - newStartX) - newStartX)
        //     newStartX += parameters['衔接位置'] * (parentBound.x + parentBound.width - (newEndX - newStartX) - newStartX)
        //   }

        //   // 对比度
        //   if (parameters['对比度'] < 0) {
        //     newStartX += parameters['对比度'] * (newEndX - newStartX)
        //   }
        //   if (parameters['对比度'] > 0) {
        //     newStartX += parameters['对比度'] * (parentBound.x + parentBound.width - newStartX)
        //   }

        //   // 更新数值
        //   glyphRuntime(strokes[0][0])!.setParam('水平延伸', newEndX - newStartX)
        //   glyphRuntime(strokes[0][0])!.setParam('竖直延伸', newEndY - newStartY)
        //   strokes[0][0].ox = origin_strokes[0][0].ox + (newStartX - (origin_joints[0].x + origin_strokes[0][0].ox))
        //   strokes[0][0].oy = origin_strokes[0][0].oy + (newStartY - (origin_joints[0].y + origin_strokes[0][0].oy))
        // }

        // 凸展度
        {
          const originShuStartY = glyphRuntime(newStrokes[1][0])!.getNonRefJoints()[0].y + newStrokes[1][0].oy
          const originHengzheStartY = glyphRuntime(newStrokes[2][0])!.getNonRefJoints()[1].y + newStrokes[2][0].oy
          const originShuEndY = glyphRuntime(newStrokes[1][0])!.getNonRefJoints()[1].y + newStrokes[1][0].oy
          const originHengStartY = glyphRuntime(newStrokes[4][0])!.getNonRefJoints()[0].y + newStrokes[4][0].oy
          const originHengzheEndY = glyphRuntime(newStrokes[2][0])!.getNonRefJoints()[2].y + newStrokes[2][0].oy

          let newShuEndY = originShuEndY
          let newHengzheEndY = originHengzheEndY
          if (parameters['凸展度'] > 0) {
            newShuEndY += parameters['凸展度'] * (originShuEndY - originHengStartY)
            newHengzheEndY += parameters['凸展度'] * (newHengzheEndY - originHengStartY)
          }
          if (parameters['凸展度'] < 0) {
            newShuEndY -= parameters['凸展度'] * (originShuEndY - originHengStartY)
            newHengzheEndY -= parameters['凸展度'] * (newHengzheEndY - originHengStartY)
          }

          // 竖
          glyphRuntime(strokes[1][0])!.setParam('竖直延伸', newShuEndY - originShuStartY)
          // 横折
          glyphRuntime(strokes[2][0])!.setParam('折-竖直延伸', newHengzheEndY - originHengzheStartY)
        }
      }
    }
  }
}

export {
  update,
  parameters,
}