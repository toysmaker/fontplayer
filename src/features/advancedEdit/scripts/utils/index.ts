import { strokeFnMap } from '@/templates/strokeFnMap'
import { strokeFnMap as custom1StrokeFnMap } from '@/templates/custom_1/strokeFnMap'
import * as R from 'ramda'
import type { ICustomGlyph, IGlyphComponent, ICharacterFileLite } from '@/core/types'
import { FP } from '@/core/script/FPUtils'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { glyphRuntime } from '../glyphRuntime'

const flatten = (array) => {
  return array.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatten(val) : val), [])
}

const strokesFlatten = (array) => {
  const rs = []
  for (let i = 0; i < array.length; i++) {
    rs.push(...array[i])
  }
  return rs
}

const hasVerticalGap = (strokeName, jointName, style) => {
  if (style === '测试笔画模板') {
    return 1
  }
  if (strokeName !== '竖' && !jointName.includes('shu') && style !== '测试笔画模板')
    return 1
  return 0
}

const hasHorizontalGap = (strokeName, jointName, style) => {
  if (style === '测试笔画模板') {
    return 1
  }
  if (strokeName !== '横' && !jointName.includes('heng') && style !== '测试笔画模板')
    return 1
  return 0
}

const getComponentBound = (strokes: Array<Array<IGlyphComponent>> | Array<IGlyphComponent>, weight = 0) => {
  //const weight = constants.value.find((constant) => constant.name === '字重').value as number

  const flattened_strokes = flatten(strokes)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let _minX = Infinity
  let _minY = Infinity
  let _maxX = -Infinity
  let _maxY = -Infinity
  for (let i = 0; i < flattened_strokes.length; i++) {
    const stroke = flattened_strokes[i]
    const ox = stroke.ox
    const oy = stroke.oy
    const inst = glyphRuntime(stroke as IGlyphComponent)
    if (!inst) continue
    const joints = inst.getJoints()
    for (let j = 0; j < joints.length; j++) {
      const joint = joints[j]
      minX = Math.min(minX, joint.x + ox - weight / 2 * hasHorizontalGap(stroke.value.name, joint.name, stroke.value.style))
      minY = Math.min(minY, joint.y + oy - weight / 2 * hasVerticalGap(stroke.value.name, joint.name, stroke.value.style))
      maxX = Math.max(maxX, joint.x + ox + weight / 2 * hasHorizontalGap(stroke.value.name, joint.name, stroke.value.style))
      maxY = Math.max(maxY, joint.y + oy + weight / 2 * hasVerticalGap(stroke.value.name, joint.name, stroke.value.style))
      _minX = Math.min(_minX, joint.x + ox)
      _minY = Math.min(_minY, joint.y + oy)
      _maxX = Math.max(_maxX, joint.x + ox)
      _maxY = Math.max(_maxY, joint.y + oy)
    }
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

interface ITransform {
  xScale: number,
  yScale: number,
  xOffset: number,
  yOffset: number,
}

interface IBound {
  x: number
  y: number
  width: number
  height: number
}

const standardTransformPoint = (point, originBound, newBound) => {
  const { x, y } = point
  let { x: originMinX, y: originMinY, width: originWidth, height: originHeight } = originBound
  let { x: newMinX, y: newMinY, width: newWidth, height: newHeight } = newBound

  originWidth = Math.max(0, originWidth)
  originHeight = Math.max(0, originHeight)
  newWidth = Math.max(0, newWidth)
  newHeight = Math.max(0, newHeight)

  const xRatio = originWidth ? newWidth / originWidth : 0
  const yRatio = originHeight ? newHeight / originHeight : 0

  return {
    x: (x - originMinX) * xRatio + newMinX,
    y: (y - originMinY) * yRatio + newMinY,
  }
}

const getTransformByBounds = (originBound, newBound) => {
  // xOffset 和 yOffset 是相对于中心点的
  const { x: originMinX, y: originMinY, width: originWidth, height: originHeight } = originBound
  const { x: newMinX, y: newMinY, width: newWidth, height: newHeight } = newBound
  return {
    xScale: newWidth / originWidth,
    yScale: newHeight / originHeight,
    xOffset: newMinX + newWidth / 2 - originMinX - originWidth / 2,
    yOffset: newMinY + newHeight / 2 - originMinY - originHeight / 2,
  }
}

const getCompnentFromCharacter = (character: ICharacterFileLite, uuid: string) => {
  return character.components.find((component) => component.uuid === uuid)
}

/**
 * `standardTransformStrokes` 返回 R.flatten 后的一维数组。此处求原二维 `originStrokes[groupIndex]` 这一笔里
 * 「第一个」组件在扁平结果中的下标（旧代码误写为 `newStrokes[groupIndex][0]`）。
 */
export function flatNewStrokeIndex(
  originStrokes: ReadonlyArray<ReadonlyArray<unknown>>,
  groupIndex: number,
): number {
  let idx = 0
  const n = Math.min(groupIndex, originStrokes.length)
  for (let g = 0; g < n; g++) {
    const row = originStrokes[g]
    idx += Array.isArray(row) ? row.length : 0
  }
  return idx
}

const standardTransformStrokes = (strokes: Array<Array<IGlyphComponent>>, transform: ITransform, originCharacter?: ICharacterFileLite, updateStrokes = false) => {
  const { xScale, yScale, xOffset, yOffset } = transform
  const tempStrokes = R.flatten(updateStrokes ? strokes : R.clone(strokes))
  const originBound = getComponentBound(tempStrokes)
  const newBound = {
    width: originBound.width * xScale,
    height: originBound.height * yScale,
    x: originBound.x + originBound.width / 2 - originBound.width * xScale / 2 + xOffset,
    y: originBound.y + originBound.height / 2 - originBound.height * yScale / 2 + yOffset,
  }
  tempStrokes.forEach((_component) => {
    const component = originCharacter ? getCompnentFromCharacter(originCharacter, _component.uuid) : _component
    const gc = component as IGlyphComponent
    const { ox, oy } = gc
    const inst = glyphRuntime(gc)
    if (!inst) return
    const joints = inst.getJoints()
    const pointsMap: Record<string, { x: number; y: number }> = {}
    // 与原版 fontplayer AdvancedEditPanel/scripts/utils/standardTransformStrokes 一致（含历史行为）：
    // 1) firstJointIndex 使用 findIndex(...) || 0（若未找到非 _ref 关节则为 -1，与原版相同）
    // 2) pointsMap 的 y 使用「减 gc.ox」而非减 oy——原版如此，strokeFnMap.computeParamsByJoints 依赖该坐标
    const firstJointIndex =
      joints.findIndex((joint) => !joint.name.includes('_ref')) || 0
    for (let i = 0; i < joints.length; i++) {
      const joint = joints[i]
      const newPoint = standardTransformPoint({ x: joint.x + ox, y: joint.y + oy }, originBound, newBound)
      if (i === firstJointIndex) {
        gc.ox = ox + newPoint.x - (joint.x + ox)
        gc.oy = oy + newPoint.y - (joint.y + oy)
      }
      pointsMap[joint.name] = {
        x: newPoint.x - gc.ox,
        y: newPoint.y - gc.ox,
      }
    }
    const gv = gc.value as ICustomGlyph
    const strokeName = gv.name as string

    // 与原版一致：style===测试笔画模板 时走 templates/custom_1/strokeFnMap（非主 strokeFnMap 的 kai/ 实现）
    if (gv.style === '测试笔画模板') {
      const fn = (custom1StrokeFnMap as Record<string, { computeParamsByJoints: (m: unknown, g: unknown) => unknown; updateParamsByJoints: (p: unknown, g: unknown) => void }>)[strokeName]
      if (fn) {
        try {
          const parameters = fn.computeParamsByJoints(pointsMap, inst)
          fn.updateParamsByJoints(parameters, inst)
          executeGlyphScript(gv, gc.uuid)
        } catch (e) {
          console.warn('[standardTransformStrokes] custom_1 joint/param update failed', strokeName, e)
        }
      } else {
        console.warn('[standardTransformStrokes] custom_1 strokeFnMap missing', strokeName)
      }
    } else {
      const instAny = inst as unknown as {
        computeParamsByJoints?: (m: typeof pointsMap) => unknown
        updateParamsByJoints?: (p: unknown) => void
      }
      if (typeof instAny.computeParamsByJoints === 'function' && typeof instAny.updateParamsByJoints === 'function') {
        try {
          const parameters = instAny.computeParamsByJoints(pointsMap)
          instAny.updateParamsByJoints(parameters)
          executeGlyphScript(gv, gc.uuid)
        } catch (e) {
          console.warn('[standardTransformStrokes] instance joint/param update failed', strokeName, e)
        }
      } else {
        const fn = strokeFnMap[strokeName as keyof typeof strokeFnMap] as
          | { computeParamsByJoints: (m: typeof pointsMap, g: typeof inst) => any; updateParamsByJoints: (p: any, g: typeof inst) => void }
          | undefined
        if (fn) {
          try {
            const parameters = fn.computeParamsByJoints(pointsMap, inst)
            fn.updateParamsByJoints(parameters, inst)
            executeGlyphScript(gv, gc.uuid)
          } catch (e) {
            console.warn('[standardTransformStrokes] kai strokeFnMap joint/param update failed', strokeName, e)
          }
        }
      }
    }
  })
  return tempStrokes
}

const chainTransformStrokes = (parts, character, ordered_components, strokes_id, originBound, newBound) => {
  for (let j = 0; j < parts.length; j++) {
    const part = parts[j]
    if (part.match.join(',') !== strokes_id) {
      continue
    }
    const op = part.ids[part.ids.length - 1]

    // 计算父包围框
    let n = op ? 2 : 0
    if (op === '⿲' || op === '⿳' ) {
      n = 3
    }

    const startX = newBound.x
    const startY = newBound.y
    const endX = newBound.x + newBound.width
    const endY = newBound.y + newBound.height
    let pos = 0
    for (let m = 0; m < n; m++) {
      if ([...part.match.slice(0, -1), m].join(',') === strokes_id) {
        pos = m
      }
    }

    if (op === '⿰') {
      if (pos === 0) {
        // 位置为1处的部件
        const matches = getAllSubMatches(parts, [...part.match.slice(0, -1), 1])
        const _strokes = strokesFlatten(character.matches.filter(
          (item) => matches.map((match) => match.join(',')).includes(item[0])
        )?.map(o => o[1]) || [])
        const strokes = []
        for (let l = 0; l < _strokes.length; l++) {
          const components = []
          const uuids = _strokes[l]
          uuids.map((uuid) => {
            components.push(ordered_components.find((item) => item.uuid === uuid))
          })
          strokes.push(components)
        }
        const bound = getComponentBound(strokes)
        const leftGap = bound.x - (originBound.x + originBound.width)
        const rightGap = 1000 - (bound.x + bound.width)
        const newBound = {
          x: endX + leftGap,
          y: bound.y,
          width: 1000 - endX - leftGap - rightGap,
          height: bound.height
        }
        const transform = getTransformByBounds(bound, newBound)
        standardTransformStrokes(strokes, transform, character)
      } else if (pos === 1) {
        // 位置为0处的部件
        const matches = getAllSubMatches(parts, [...part.match.slice(0, -1), 0])
        const _strokes = strokesFlatten(character.matches.filter(
          (item) => matches.map((match) => match.join(',')).includes(item[0])
        )?.map(o => o[1]) || [])
        const strokes = []
        for (let l = 0; l < _strokes.length; l++) {
          const components = []
          const uuids = _strokes[l]
          uuids.map((uuid) => {
            components.push(ordered_components.find((item) => item.uuid === uuid))
          })
          strokes.push(components)
        }
        const bound = getComponentBound(strokes)
        const leftGap = bound.x
        const rightGap = originBound.x - (bound.x + bound.width)
        const newBound = {
          x: leftGap,
          y: bound.y,
          width: startX - rightGap,
          height: bound.height
        }
        const transform = getTransformByBounds(bound, newBound)
        standardTransformStrokes(strokes, transform, character)
      }
    } else if (op === '⿲') {
      if (pos === 0) {
        // 位置为1处的部件
        const matches1 = getAllSubMatches(parts, [...part.match.slice(0, -1), 1])
        const _strokes1 = strokesFlatten(character.matches.filter(
          (item) => matches1.map((match) => match.join(',')).includes(item[0])
        )?.map(o => o[1]) || [])
        const strokes1 = []
        for (let l = 0; l < _strokes1.length; l++) {
          const components = []
          const uuids = _strokes1[l]
          uuids.map((uuid) => {
            components.push(ordered_components.find((item) => item.uuid === uuid))
          })
          strokes1.push(components)
        }
        const bound1 = getComponentBound(strokes1)

        // 位置为2处的部件
        const matches2 = getAllSubMatches(parts, [...part.match.slice(0, -1), 2])
        const _strokes2 = strokesFlatten(character.matches.filter(
          (item) => matches2.map((match) => match.join(',')).includes(item[0])
        )?.map(o => o[1]) || [])
        const strokes2 = []
        for (let l = 0; l < _strokes2.length; l++) {
          const components = []
          const uuids = _strokes2[l]
          uuids.map((uuid) => {
            components.push(ordered_components.find((item) => item.uuid === uuid))
          })
          strokes2.push(components)
        }
        const bound2 = getComponentBound(strokes2)

        const leftGap1 = bound1.x - (originBound.x + originBound.width)
        const rightGap1 = bound2.x - (bound1.x + bound1.width)
        const leftGap2 = rightGap1
        const rightGap2 = 1000 - (bound2.x + bound2.width)

        const newBound1 = {
          x: endX + leftGap1,
          y: bound1.y,
          width: (1000 - endX - leftGap1 - rightGap1 - rightGap2) * bound1.width / (bound1.width + bound2.width),
          height: bound1.height
        }
        const transform1 = getTransformByBounds(bound1, newBound1)
        standardTransformStrokes(strokes1, transform1, character)

        const newBound2 = {
          x: newBound1.x + bound1.width + leftGap2,
          y: bound2.y,
          width: (1000 - endX - leftGap1 - rightGap1 - leftGap2 - rightGap2) * bound2.width / (bound1.width + bound2.width),
          height: bound2.height
        }
        const transform2 = getTransformByBounds(bound2, newBound2)
        standardTransformStrokes(strokes2, transform2, character)
      } else if (pos === 1) {
        // 位置为0处的部件
        const matches0 = getAllSubMatches(parts, [...part.match.slice(0, -1), 0])
        const _strokes0 = strokesFlatten(character.matches.filter(
          (item) => matches0.map((match) => match.join(',')).includes(item[0])
        )?.map(o => o[1]) || [])
        const strokes0 = []
        for (let l = 0; l < _strokes0.length; l++) {
          const components = []
          const uuids = _strokes0[l]
          uuids.map((uuid) => {
            components.push(ordered_components.find((item) => item.uuid === uuid))
          })
          strokes0.push(components)
        }
        const bound0 = getComponentBound(strokes0)

        // 位置为2处的部件
        const matches2 = getAllSubMatches(parts, [...part.match.slice(0, -1), 2])
        const _strokes2 = strokesFlatten(character.matches.filter(
          (item) => matches2.map((match) => match.join(',')).includes(item[0])
        )?.map(o => o[1]) || [])
        const strokes2 = []
        for (let l = 0; l < _strokes2.length; l++) {
          const components = []
          const uuids = _strokes2[l]
          uuids.map((uuid) => {
            components.push(ordered_components.find((item) => item.uuid === uuid))
          })
          strokes2.push(components)
        }
        const bound2 = getComponentBound(strokes2)

        const leftGap0 = bound0.x
        const rightGap0 = startX - (bound0.x + bound0.width)
        const leftGap2 = bound2.x - endX
        const rightGap2 = 1000 - (bound2.x + bound2.width)

        const newBound0 = {
          x: leftGap0,
          y: bound0.y,
          width: startX - leftGap0 - rightGap0,
          height: bound0.height
        }
        const transform1 = getTransformByBounds(bound0, newBound0)
        standardTransformStrokes(strokes0, transform1, character)

        const newBound2 = {
          x: endX + rightGap2,
          y: bound2.y,
          width: (1000 - endX - leftGap2 - rightGap2),
          height: bound2.height
        }
        const transform2 = getTransformByBounds(bound2, newBound2)
        standardTransformStrokes(strokes2, transform2, character)
      } else if (pos === 2) {
        // 位置为0处的部件
        const matches0 = getAllSubMatches(parts, [...part.match.slice(0, -1), 1])
        const _strokes0 = strokesFlatten(character.matches.filter(
          (item) => matches0.map((match) => match.join(',')).includes(item[0])
        )?.map(o => o[1]) || [])
        const strokes0 = []
        for (let l = 0; l < _strokes0.length; l++) {
          const components = []
          const uuids = _strokes0[l]
          uuids.map((uuid) => {
            components.push(ordered_components.find((item) => item.uuid === uuid))
          })
          strokes0.push(components)
        }
        const bound0 = getComponentBound(strokes0)

        // 位置为1处的部件
        const matches1 = getAllSubMatches(parts, [...part.match.slice(0, -1), 2])
        const _strokes1 = strokesFlatten(character.matches.filter(
          (item) => matches1.map((match) => match.join(',')).includes(item[0])
        )?.map(o => o[1]) || [])
        const strokes1 = []
        for (let l = 0; l < _strokes1.length; l++) {
          const components = []
          const uuids = _strokes1[l]
          uuids.map((uuid) => {
            components.push(ordered_components.find((item) => item.uuid === uuid))
          })
          strokes1.push(components)
        }
        const bound1 = getComponentBound(strokes1)

        const leftGap0 = bound0.x
        const rightGap0 = bound1.x - (bound0.x + bound0.width)
        const leftGap1 = rightGap0
        const rightGap1 = endX - (bound1.x + bound1.width)

        const newBound0 = {
          x: leftGap0,
          y: bound0.y,
          width: (1000 - (endX - startX) - leftGap1 - rightGap0 - rightGap1) * bound0.width / (bound0.width + bound1.width),
          height: bound0.height
        }
        const transform1 = getTransformByBounds(bound1, newBound0)
        standardTransformStrokes(strokes1, transform1, character)

        const newBound1 = {
          x: newBound0.x + newBound0.width + leftGap1,
          y: bound1.y,
          width: (1000 - (endX - startX) - leftGap1 - rightGap0 - rightGap1) * bound1.width / (bound0.width + bound1.width),
          height: bound1.height
        }
        const transform2 = getTransformByBounds(bound1, newBound1)
        standardTransformStrokes(strokes1, transform2, character)
      }
    } else if (op === '⿱') {
      if (pos === 0) {
        // 位置为1处的部件
        const matches = getAllSubMatches(parts, [...part.match.slice(0, -1), 1])
        const _strokes = strokesFlatten(character.matches.filter(
          (item) => matches.map((match) => match.join(',')).includes(item[0])
        )?.map(o => o[1]) || [])
        const strokes = []
        for (let l = 0; l < _strokes.length; l++) {
          const components = []
          const uuids = _strokes[l]
          uuids.map((uuid) => {
            components.push(ordered_components.find((item) => item.uuid === uuid))
          })
          strokes.push(components)
        }
        const bound = getComponentBound(strokes)
        const topGap = bound.y - (originBound.y + originBound.height)
        const bottomGap = 1000 - (bound.y + bound.height)
        const newBound = {
          x: bound.x,
          y: endY + topGap,
          width: bound.width,
          height: 1000 - endY - topGap - bottomGap,
        }
        const transform = getTransformByBounds(bound, newBound)
        standardTransformStrokes(strokes, transform, character)
      } else if (pos === 1) {
        // 位置为0处的部件
        const matches = getAllSubMatches(parts, [...part.match.slice(0, -1), 0])
        const _strokes = strokesFlatten(character.matches.filter(
          (item) => matches.map((match) => match.join(',')).includes(item[0])
        )?.map(o => o[1]) || [])
        const strokes = []
        for (let l = 0; l < _strokes.length; l++) {
          const components = []
          const uuids = _strokes[l]
          uuids.map((uuid) => {
            components.push(ordered_components.find((item) => item.uuid === uuid))
          })
          strokes.push(components)
        }
        const bound = getComponentBound(strokes)
        const topGap = bound.y
        const bottomGap = originBound.y - (bound.y + bound.height)
        const newBound = {
          x: bound.x,
          y: bound.y,
          width: bound.width,
          height: startY - bottomGap,
        }
        const transform = getTransformByBounds(bound, newBound)
        standardTransformStrokes(strokes, transform, character)
      }
    } else if (op === '⿳') {
      if (pos === 0) {
        // 位置为1处的部件
        const matches1 = getAllSubMatches(parts, [...part.match.slice(0, -1), 1])
        const _strokes1 = strokesFlatten(character.matches.filter(
          (item) => matches1.map((match) => match.join(',')).includes(item[0])
        )?.map(o => o[1]) || [])
        const strokes1 = []
        for (let l = 0; l < _strokes1.length; l++) {
          const components = []
          const uuids = _strokes1[l]
          uuids.map((uuid) => {
            components.push(ordered_components.find((item) => item.uuid === uuid))
          })
          strokes1.push(components)
        }
        const bound1 = getComponentBound(strokes1)

        // 位置为2处的部件
        const matches2 = getAllSubMatches(parts, [...part.match.slice(0, -1), 2])
        const _strokes2 = strokesFlatten(character.matches.filter(
          (item) => matches2.map((match) => match.join(',')).includes(item[0])
        )?.map(o => o[1]) || [])
        const strokes2 = []
        for (let l = 0; l < _strokes2.length; l++) {
          const components = []
          const uuids = _strokes2[l]
          uuids.map((uuid) => {
            components.push(ordered_components.find((item) => item.uuid === uuid))
          })
          strokes2.push(components)
        }
        const bound2 = getComponentBound(strokes2)

        const topGap1 = bound1.y - (originBound.y + originBound.height)
        const bottomGap1 = bound2.y - (bound1.y + bound1.height)
        const topGap2 = bottomGap1
        const bottomGap2 = 1000 - (bound2.y + bound2.height)

        const newBound1 = {
          x: bound1.x,
          y: endY + topGap1,
          width: bound1.width,
          height: (1000 - endY - topGap1 - bottomGap1 - bottomGap2) * bound1.height / (bound1.height + bound2.height)
        }
        console.log('newbound1', newBound1)
        console.log('bound1', bound1)
        const transform1 = getTransformByBounds(bound1, newBound1)
        standardTransformStrokes(strokes1, transform1, character)

        const newBound2 = {
          x: bound2.x,
          y: newBound1.y + newBound1.height + topGap2,
          width: bound1.width,
          height: (1000 - endY - topGap1 - bottomGap1 - bottomGap2) * bound2.height / (bound1.height + bound2.height)
        }
        const transform2 = getTransformByBounds(bound2, newBound2)
        standardTransformStrokes(strokes2, transform2, character)
      } else if (pos === 1) {
        // 位置为0处的部件
        const matches0 = getAllSubMatches(parts, [...part.match.slice(0, -1), 0])
        const _strokes0 = strokesFlatten(character.matches.filter(
          (item) => matches0.map((match) => match.join(',')).includes(item[0])
        )?.map(o => o[1]) || [])
        const strokes0 = []
        for (let l = 0; l < _strokes0.length; l++) {
          const components = []
          const uuids = _strokes0[l]
          uuids.map((uuid) => {
            components.push(ordered_components.find((item) => item.uuid === uuid))
          })
          strokes0.push(components)
        }
        const bound0 = getComponentBound(strokes0)

        // 位置为2处的部件
        const matches2 = getAllSubMatches(parts, [...part.match.slice(0, -1), 2])
        const _strokes2 = strokesFlatten(character.matches.filter(
          (item) => matches2.map((match) => match.join(',')).includes(item[0])
        )?.map(o => o[1]) || [])
        const strokes2 = []
        for (let l = 0; l < _strokes2.length; l++) {
          const components = []
          const uuids = _strokes2[l]
          uuids.map((uuid) => {
            components.push(ordered_components.find((item) => item.uuid === uuid))
          })
          strokes2.push(components)
        }
        const bound2 = getComponentBound(strokes2)

        const topGap0 = bound0.y
        const bottomGap0 = startY - (bound0.y + bound0.height)
        const topGap2 = bound2.y - endY
        const bottomGap2 = 1000 - (bound2.y + bound2.height)

        const newBound0 = {
          x: bound0.x,
          y: topGap0,
          width: bound0.width,
          height: startY - topGap0 - bottomGap0
        }
        const transform1 = getTransformByBounds(bound0, newBound0)
        standardTransformStrokes(strokes0, transform1, character)

        const newBound2 = {
          x: bound2.x,
          y: endY + topGap2,
          width: bound2.width,
          height: (1000 - endX - topGap2 - bottomGap2)
        }
        const transform2 = getTransformByBounds(bound2, newBound2)
        standardTransformStrokes(strokes2, transform2, character)
      } else if (pos === 2) {
        // 位置为0处的部件
        const matches0 = getAllSubMatches(parts, [...part.match.slice(0, -1), 1])
        const _strokes0 = strokesFlatten(character.matches.filter(
          (item) => matches0.map((match) => match.join(',')).includes(item[0])
        )?.map(o => o[1]) || [])
        const strokes0 = []
        for (let l = 0; l < _strokes0.length; l++) {
          const components = []
          const uuids = _strokes0[l]
          uuids.map((uuid) => {
            components.push(ordered_components.find((item) => item.uuid === uuid))
          })
          strokes0.push(components)
        }
        const bound0 = getComponentBound(strokes0)

        // 位置为1处的部件
        const matches1 = getAllSubMatches(parts, [...part.match.slice(0, -1), 2])
        const _strokes1 = strokesFlatten(character.matches.filter(
          (item) => matches1.map((match) => match.join(',')).includes(item[0])
        )?.map(o => o[1]) || [])
        const strokes1 = []
        for (let l = 0; l < _strokes1.length; l++) {
          const components = []
          const uuids = _strokes1[l]
          uuids.map((uuid) => {
            components.push(ordered_components.find((item) => item.uuid === uuid))
          })
          strokes1.push(components)
        }
        const bound1 = getComponentBound(strokes1)

        const topGap0 = bound0.y
        const bottomGap0 = bound1.y - (bound0.y + bound0.height)
        const topGap1 = bottomGap0
        const bottomGap1 = endY - (bound1.y + bound1.height)

        const newBound0 = {
          x: bound0.x,
          y: topGap0,
          width: (1000 - (endX - startX) - topGap1 - bottomGap0 - bottomGap1) * bound0.height / (bound0.height + bound1.height),
          height: bound0.height
        }
        const transform1 = getTransformByBounds(bound1, newBound0)
        standardTransformStrokes(strokes1, transform1, character)

        const newBound1 = {
          x: bound1.x,
          y: newBound0.y + newBound0.height + topGap1,
          width: (1000 - (endX - startX) - topGap1 - bottomGap0 - bottomGap1) * bound1.height / (bound0.height + bound1.height),
          height: bound1.height
        }
        const transform2 = getTransformByBounds(bound1, newBound1)
        standardTransformStrokes(strokes1, transform2, character)
      }
    }
  }
}

const getParentBound = (parts, character, ordered_components, strokes_id) => {
  let parentBounds = null
  for (let j = 0; j < parts.length; j++) {
    const part = parts[j]
    if (part.match.join(',') !== strokes_id) {
      continue
    }
    const origin_parent_strokes = []
    const op = part.ids[part.ids.length - 1]

    const parentMatches = getAllParentMatches(parts, part.match)

    for (let i = 0; i < parentMatches.length; i++) {
      const parentMatch = parentMatches[i]
      const parentStrokes = character.matches.find((item) => item[0] === parentMatch.join(','))?.[1] || []
      for (let l = 0; l < parentStrokes.length; l++) {
        const components = []
        const uuids = parentStrokes[l]
        uuids.map((uuid) => {
          components.push(ordered_components.find((item) => item.uuid === uuid))
        })
        origin_parent_strokes.push(components)
      }
    }
    parentBounds = getComponentBound(origin_parent_strokes)
  }
  return parentBounds
}

const getAllParentMatches = (parts, match) => {
  const root = match.slice(0, -1)
  const matches = []
  for (let j = 0; j < parts.length; j++) {
    const part = parts[j]
    if (part.match.length > root.length && part.match.join(',').startsWith(root.join(','))) {
      matches.push(part.match)
    }
  }
  return matches
}

const getAllSubMatches = (parts, match) => {
  const root = match
  const matches = []
  for (let j = 0; j < parts.length; j++) {
    const part = parts[j]
    if (part.match.length >= root.length && part.match.join(',').startsWith(root.join(','))) {
      matches.push(part.match)
    }
  }
  return matches
}

enum POINT_REF {
  START,
  CENTER,
  END
}

interface IBoundTransform {
  xScale?: {
    scale: number,
    origin: POINT_REF
  }
  yScale?: {
    scale: number,
    origin: POINT_REF
  }
  xOffset?: number
  yOffset?: number
}

const applyConstrastTransform = (strokes, contrast, targetBound, character, updateStrokes = true) => {
  const targetStrokes = updateStrokes ? strokes : R.clone(strokes)
  const originBound = getComponentBound(strokes)
  const degree = (contrast[2] - contrast[0]) / (contrast[1] - contrast[0])
  const newBound = {
    x: originBound.x + degree * (targetBound.x - originBound.x),
    y: originBound.y + degree * (targetBound.y - originBound.y),
    width: originBound.width + degree * (targetBound.width - originBound.width),
    height: originBound.height + degree * (targetBound.height - originBound.height),
  }
  standardTransformStrokes(targetStrokes, getTransformByBounds(originBound, newBound), character, updateStrokes)
}

interface ICurvatureTarget {
  FIXLENGTH: boolean
  DIRECTION: 'UP' | 'DOWN'
  ROOTPOINT: 'START' | 'CENTER' | 'END'
  RESTRAINBOUND: IBound
}

interface ITranslateTarget {
  offsetX: number
  offsetY: number
}

const applyCurvatureTransform = (strokes, curvature, target, updataStrokes = true) => {
  const targetStrokes = updataStrokes ? strokes : R.clone(strokes)
  const degree = (curvature[2] - curvature[0]) / (curvature[1] - curvature[0])
  
  const strokeSet1 = '撇捺点挑'

  if (strokeSet1.includes(strokes[0][0].value.name)) {
    const startPoint = glyphRuntime(strokes[0][0])!.getJoints()[0]
    const endPoint = glyphRuntime(strokes[0][0])!.getJoints()[1]
    const middlePoint = {
      x: startPoint.x + (endPoint.x - startPoint.x) / 2,
      y: startPoint.y + (endPoint.y - startPoint.y) / 2,
    }
    const length = Math.sqrt((startPoint.x - endPoint.x) ** 2 + (startPoint.y - endPoint.y) ** 2)
    let newStartPoint = startPoint
    let newEndPoint = endPoint
    if (target.FIXLENGTH) {
      if (target.DIRECTION === 'UP') {
        const totalAngle = FP.getAngle({ x: endPoint.x, y: startPoint.y }, startPoint, endPoint)
        let angle = totalAngle * degree
        if ('撇挑'.includes(strokes[0][0].value.name)) {
          angle = -angle
        }
        if (target.ROOTPOINT === 'START') {
          newEndPoint = FP.turnAngleFromStart(startPoint, endPoint, angle, length)
        } else if (target.ROOTPOINT === 'CENTER') {
          newEndPoint = FP.turnAngleFromStart(middlePoint, endPoint, angle, length / 2)
          newStartPoint = FP.turnAngleFromEnd(middlePoint, startPoint, -angle, length / 2)
        } else if (target.ROOTPOINT === 'END') {
          newStartPoint = FP.turnAngleFromEnd(endPoint, startPoint, angle, length)
        }
      } else if (target.DIRECTION === 'DOWN') {
        const totalAngle = FP.getAngle({ x: startPoint.x, y: endPoint.y }, startPoint, endPoint)
        let angle = totalAngle * degree
        if ('捺点'.includes(strokes[0][0].value.name)) {
          angle = -angle
        }
        if (target.ROOTPOINT === 'START') {
          newEndPoint = FP.turnAngleFromStart(startPoint, endPoint, angle, length)
        } else if (target.ROOTPOINT === 'CENTER') {
          newEndPoint = FP.turnAngleFromStart(middlePoint, endPoint, angle, length / 2)
          newStartPoint = FP.turnAngleFromEnd(middlePoint, startPoint, -angle, length / 2)
        } else if (target.ROOTPOINT === 'END') {
          newStartPoint = FP.turnAngleFromEnd(endPoint, startPoint, angle, length)
        }
      }
    } else {
      if (target.DIRECTION === 'UP') {
        if (target.ROOTPOINT === 'START') {
          newEndPoint.y = newEndPoint.y - (endPoint.y - startPoint.y) * degree
        } else if (target.ROOTPOINT === 'CENTER') {
          newEndPoint.y = newEndPoint.y - Math.abs(endPoint.y - middlePoint.y) * degree
          newStartPoint.y = newStartPoint.y + Math.abs(startPoint.y - middlePoint.y) * degree
        } else if (target.ROOTPOINT === 'END') {
          newStartPoint.y = newStartPoint.y + (endPoint.y - startPoint.y) * degree
        }
      } else if (target.DIRECTION === 'DOWN') {
        if (target.ROOTPOINT === 'START') {
          newEndPoint.x = newEndPoint.x - (endPoint.x - startPoint.x) * degree
        } else if (target.ROOTPOINT === 'CENTER') {
          newStartPoint.x = newStartPoint.x - (startPoint.x - middlePoint.x) * degree
          newEndPoint.x = newEndPoint.x + (middlePoint.x - endPoint.x) * degree
        } else if (target.ROOTPOINT === 'END') {
          newStartPoint.x = newStartPoint.x + (endPoint.x - startPoint.x) * degree
        }
      }
    }
    if (newStartPoint.y < target.RESTRAINBOUND.y) {
      newStartPoint.y = target.RESTRAINBOUND.y
    }
    if (newEndPoint.y > target.RESTRAINBOUND.y + target.RESTRAINBOUND.height) {
      newEndPoint.y = target.RESTRAINBOUND.y + target.RESTRAINBOUND.height
    }
    if (newStartPoint.x < target.RESTRAINBOUND.x) {
      newStartPoint.x = target.RESTRAINBOUND.x
    }
    if (newEndPoint.x > target.RESTRAINBOUND.x + target.RESTRAINBOUND.width) {
      newEndPoint.x = target.RESTRAINBOUND.x + target.RESTRAINBOUND.width
    }

    // 更新数值
    glyphRuntime(targetStrokes[0][0])!.setParam('水平延伸', newEndPoint.x - newStartPoint.x)
    glyphRuntime(targetStrokes[0][0])!.setParam('竖直延伸', newEndPoint.y - newStartPoint.y)
    targetStrokes[0][0].ox = targetStrokes[0][0].ox + (newStartPoint.x - (glyphRuntime(targetStrokes[0][0])!.getJoints()[0].x + targetStrokes[0][0].ox))
    targetStrokes[0][0].oy = targetStrokes[0][0].oy + (newStartPoint.y - (glyphRuntime(targetStrokes[0][0])!.getJoints()[0].y + targetStrokes[0][0].oy))
  } else if (strokes[0][0].value.name.includes('钩') || strokes[0][1].value.name.includes('钩')) {
    const originVerticalSpan = glyphRuntime(strokes[0][0])!.getParam('钩-竖直延伸')
    glyphRuntime(targetStrokes[0][0])!.setParam('钩-竖直延伸', originVerticalSpan * degree)
  }
}

const applyTranslateTransform = (strokes, translate, target, updataStrokes = true) => {
  const targetStrokes = updataStrokes ? strokes : R.clone(strokes)
  standardTransformStrokes(targetStrokes, { xScale: 1, yScale: 1, xOffset: translate.offsetX, yOffset: translate.offsetY })
}

const transformBound = (bound, transform, updateBound = false) => {
  let newBound = updateBound ? bound : Object.assign({}, bound)
  if (transform.xScale) {
    const { scale, origin } = transform.xScale
    const { x, y, width, height } = bound
    const newWidth = width * scale
    const newHeight = height
    const newX = origin === POINT_REF.START ? x : origin === POINT_REF.CENTER ? x + width / 2 - newWidth / 2 : x + width - newWidth
    const newY = y
    newBound.x = newX
    newBound.y = newY
    newBound.width = newWidth
    newBound.height = newHeight
  }
  return newBound
}

export type { ICurvatureTarget, ITranslateTarget }

export {
  flatten,
  getComponentBound,
  standardTransformStrokes,
  getParentBound,
  getAllParentMatches,
  getAllSubMatches,
  chainTransformStrokes,
  applyConstrastTransform,
  transformBound,
  POINT_REF,
  applyCurvatureTransform,
  applyTranslateTransform,
  getTransformByBounds,
}