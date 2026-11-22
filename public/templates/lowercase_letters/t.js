const params = {
  h1: glyph.getParam('h1'),
  h2: glyph.getParam('h2'),
  h3: glyph.getParam('h3'),
  h4: glyph.getParam('h4'),
  w1: glyph.getParam('w1'),
}
const global_params = {
  weight: glyph.getParam('字重') || 40,
  serifType: glyph.getParam('衬线类型') || 0,
  serifSize: glyph.getParam('衬线大小') || 2.0,
  curvature: glyph.getParam('弯曲度') ?? 1,
  pressure: glyph.getParam('笔压') ?? 1,
}
const ascender = 800
const descender = -200
const width = 360
const xHeight = 500
const capitalHeight = 750
const ox = 500
const oy = 500
const x0 = 500
const y0 = ascender - capitalHeight

const getJointsMap = (data) => {
  const { draggingJoint, deltaX, deltaY } = data
  const jointsMap = Object.assign({}, glyph.tempData)
  switch (draggingJoint.name) {
    case 'skeleton_1': {
      jointsMap['skeleton_1'] = {
        x: glyph.tempData['skeleton_1'].x,
        y: glyph.tempData['skeleton_1'].y + deltaY,
      }
      break
    }
    case 'skeleton_2': {
      jointsMap['skeleton_1'] = {
        x: glyph.tempData['skeleton_1'].x,
        y: glyph.tempData['skeleton_1'].y + deltaY,
      }
      jointsMap['skeleton_2'] = {
        x: glyph.tempData['skeleton_2'].x,
        y: glyph.tempData['skeleton_2'].y + deltaY,
      }
      jointsMap['skeleton_3'] = {
        x: glyph.tempData['skeleton_3'].x,
        y: glyph.tempData['skeleton_3'].y + deltaY,
      }
      jointsMap['skeleton_4'] = {
        x: glyph.tempData['skeleton_4'].x,
        y: glyph.tempData['skeleton_4'].y + deltaY,
      }
      break
    }
    case 'skeleton_4': {
      jointsMap['skeleton_4'] = {
        x: glyph.tempData['skeleton_4'].x,
        y: glyph.tempData['skeleton_4'].y + deltaY,
      }
      break
    }
    case 'skeleton_5': {
      jointsMap['skeleton_3'] = {
        x: glyph.tempData['skeleton_3'].x - deltaX,
        y: glyph.tempData['skeleton_3'].y,
      }
      jointsMap['skeleton_4'] = {
        x: glyph.tempData['skeleton_4'].x - deltaX,
        y: glyph.tempData['skeleton_4'].y,
      }
      jointsMap['skeleton_5'] = {
        x: glyph.tempData['skeleton_5'].x + deltaX,
        y: glyph.tempData['skeleton_5'].y + deltaY,
      }
      jointsMap['skeleton_6'] = {
        x: glyph.tempData['skeleton_6'].x - deltaX,
        y: glyph.tempData['skeleton_6'].y + deltaY,
      }
      break
    }
    case 'skeleton_6': {
      jointsMap['skeleton_3'] = {
        x: glyph.tempData['skeleton_3'].x + deltaX,
        y: glyph.tempData['skeleton_3'].y,
      }
      jointsMap['skeleton_4'] = {
        x: glyph.tempData['skeleton_4'].x + deltaX,
        y: glyph.tempData['skeleton_4'].y,
      }
      jointsMap['skeleton_5'] = {
        x: glyph.tempData['skeleton_5'].x - deltaX,
        y: glyph.tempData['skeleton_5'].y + deltaY,
      }
      jointsMap['skeleton_6'] = {
        x: glyph.tempData['skeleton_6'].x + deltaX,
        y: glyph.tempData['skeleton_6'].y + deltaY,
      }
      break
    }
    case 'skeleton_3': {
      jointsMap['skeleton_3'] = {
        x: glyph.tempData['skeleton_3'].x + deltaX,
        y: glyph.tempData['skeleton_3'].y + deltaY,
      }
      jointsMap['skeleton_4'] = {
        x: glyph.tempData['skeleton_4'].x + deltaX,
        y: glyph.tempData['skeleton_4'].y + deltaY,
      }
      jointsMap['skeleton_5'] = {
        x: glyph.tempData['skeleton_5'].x - deltaX,
        y: glyph.tempData['skeleton_5'].y,
      }
      jointsMap['skeleton_6'] = {
        x: glyph.tempData['skeleton_6'].x + deltaX,
        y: glyph.tempData['skeleton_6'].y,
      }
      jointsMap['skeleton_1'] = {
        x: glyph.tempData['skeleton_1'].x,
        y: glyph.tempData['skeleton_1'].y + deltaY,
      }
      jointsMap['skeleton_2'] = {
        x: glyph.tempData['skeleton_2'].x,
        y: glyph.tempData['skeleton_2'].y + deltaY,
      }
      break
    }
  }
  return jointsMap
}

glyph.onSkeletonDragStart = (data) => {
  // joint数据格式：{x, y, name}
  const { draggingJoint } = data
  glyph.tempData = {}
  glyph.getJoints().map((joint) => {
    const _joint = {
      name: joint.name,
      x: joint.x,
      y: joint.y,
    }
    glyph.tempData[_joint.name] = _joint
  })
}

glyph.onSkeletonDrag = (data) => {
  if (!glyph.tempData) return
  glyph.clear()
  // joint数据格式：{x, y, name}
  const jointsMap = getJointsMap(data)
  const _params = computeParamsByJoints(jointsMap)
  updateGlyphByParams(_params, global_params)
}

glyph.onSkeletonDragEnd = (data) => {
  if (!glyph.tempData) return
  glyph.clear()
  // joint数据格式：{x, y, name}
  const jointsMap = getJointsMap(data)
  const _params = computeParamsByJoints(jointsMap)
  updateGlyphByParams(_params, global_params)
  glyph.setParam('h1', _params.h1)
  glyph.setParam('h2', _params.h2)
  glyph.setParam('h3', _params.h3)
  glyph.setParam('h4', _params.h4)
  glyph.setParam('w1', _params.w1)
  glyph.tempData = null
}

const range = (value, range) => {
  if (value < range.min) {
    return range.min
  } else if (value > range.max) {
    return range.max
  }
  return value
}

const computeParamsByJoints = (jointsMap) => {
  const { skeleton_0, skeleton_1, skeleton_2, skeleton_3, skeleton_4, skeleton_5, skeleton_6 } = jointsMap
  const h1_range = glyph.getParamRange('h1')
  const h2_range = glyph.getParamRange('h2')
  const h3_range = glyph.getParamRange('h3')
  const w1_range = glyph.getParamRange('w1')
  const h4_range = glyph.getParamRange('h4')
  const h1 = range(skeleton_2.y - skeleton_0.y, h1_range)
  const h2 = range(skeleton_6.y - skeleton_0.y, h2_range)
  const h3 = range(skeleton_2.y - skeleton_1.y, h3_range)
  const w1 = range(skeleton_6.x - skeleton_5.x, w1_range)
  const h4 = range(skeleton_3.y - skeleton_4.y, h4_range)
  return {
    h1,
    h2,
    h3,
    h4,
    w1,
  }
}

const refline = (p1, p2, type) => {
  const refline =  {
    name: `${p1.name}-${p2.name}`,
    start: p1.name,
    end: p2.name,
  }
  if (type) {
    refline.type = type
  }
  return refline
}

const updateGlyphByParams = (params, global_params) => {
  const { h1, h2, h3, h4, w1 } = params
  const { weight, curvature, pressure } = global_params

  const skeleton_0 = new FP.Joint('skeleton_0', {
    x: x0,
    y: y0,
  })
  const skeleton_1 = new FP.Joint('skeleton_1', {
    x: skeleton_0.x,
    y: skeleton_0.y + h1 - h3,
  })
  const skeleton_2 = new FP.Joint('skeleton_2', {
    x: skeleton_1.x,
    y: skeleton_1.y + h3,
  })
  const skeleton_3 = new FP.Joint('skeleton_3', {
    x: skeleton_2.x + w1 / 2 - weight / 2,
    y: skeleton_2.y,
  })
  const skeleton_4 = new FP.Joint('skeleton_4', {
    x: skeleton_3.x,
    y: skeleton_3.y - h4,
  })
  const skeleton_5 = new FP.Joint('skeleton_5', {
    x: skeleton_0.x - w1 / 2,
    y: skeleton_0.y + h2,
  })
  const skeleton_6 = new FP.Joint('skeleton_6', {
    x: skeleton_5.x + w1,
    y: skeleton_5.y,
  })
  const skeleton = {
    skeleton_0,
    skeleton_1,
    skeleton_2,
    skeleton_3,
    skeleton_4,
    skeleton_5,
    skeleton_6,
  }
  
  glyph.addJoint(skeleton_0)
  glyph.addJoint(skeleton_1)
  glyph.addJoint(skeleton_2)
  glyph.addJoint(skeleton_3)
  glyph.addJoint(skeleton_4)
  glyph.addJoint(skeleton_5)
  glyph.addJoint(skeleton_6)
  
  glyph.addRefLine(refline(skeleton_0, skeleton_1))
  glyph.addRefLine(refline(skeleton_1, skeleton_2))
  glyph.addRefLine(refline(skeleton_2, skeleton_3))
  glyph.addRefLine(refline(skeleton_3, skeleton_4))

  glyph.addRefLine(refline(skeleton_5, skeleton_6))

  const components = getComponents(skeleton, global_params)
  for (let i = 0; i < components.length; i++) {
    glyph.addComponent(components[i])
  }

  glyph.getSkeleton = () => {
    return skeleton
  }
  glyph.getComponentsBySkeleton = (skeleton) => {
    return getComponents(skeleton, global_params)
  }
}

const getComponents = (skeleton, global_params) => {
  // 获取骨架以外的全局风格变量
  const { weight, serifType, serifSize, curvature, pressure } = global_params

  // 根据骨架计算轮廓关键点
  const { skeleton_0, skeleton_1, skeleton_2, skeleton_3, skeleton_4, skeleton_5, skeleton_6 } = skeleton

  // out指上侧（外侧）轮廓线
  // in指下侧（内侧）轮廓线
  const _stroke2_contours = FP.getLineContours2('stroke2', { stroke2_start: skeleton_6, stroke2_end: skeleton_5 }, weight, { weightsVariation: 'bezier', weightsVariationFnType: 'heitiPressureStraight', startWeight: weight, endWeight: weight * (1 + 0.25 * pressure) })
  const out_stroke2_curves = FP.fitCurvesByPoints(_stroke2_contours.out_stroke2_points, 1.5).curves
  const in_stroke2_curves = FP.fitCurvesByPoints(_stroke2_contours.in_stroke2_points, 1.5).curves
  const out_stroke2_start = out_stroke2_curves[0].start
  const out_stroke2_end = out_stroke2_curves[out_stroke2_curves.length - 1].end
  const in_stroke2_start = in_stroke2_curves[0].start
  const in_stroke2_end = in_stroke2_curves[in_stroke2_curves.length - 1].end
  // 竖钩拆三段笔迹（权重单调限制）：竖（起笔加重→原字重）、钩前半（原字重→钩中减细）、
  // 钩后半（钩中减细→收笔回原字重）；拼接处端帽平行重合，无缝
  const _stroke1_contours = FP.getLineContours2('stroke1', { stroke1_start: skeleton_0, stroke1_end: skeleton_1 }, weight, { weightsVariation: 'bezier', weightsVariationFnType: 'heitiPressureCircleStart', startWeight: weight, endWeight: weight * (1 + 0.25 * pressure) })
  const out_stroke1_curves = FP.fitCurvesByPoints(_stroke1_contours.out_stroke1_points, 1.5).curves
  const in_stroke1_curves = FP.fitCurvesByPoints(_stroke1_contours.in_stroke1_points, 1.5).curves
  const out_stroke1_start = out_stroke1_curves[0].start
  const out_stroke1_end = out_stroke1_curves[out_stroke1_curves.length - 1].end
  const in_stroke1_start = in_stroke1_curves[0].start
  const in_stroke1_end = in_stroke1_curves[in_stroke1_curves.length - 1].end
  // 钩曲线 de Casteljau 切分（t=0.5 处取钩中）
  const hookP0 = skeleton_1
  const hookP1 = skeleton_2
  const hookP2 = skeleton_3
  const hookP3 = skeleton_4
  const hookMid = {
    x: (hookP0.x + 3 * hookP1.x + 3 * hookP2.x + hookP3.x) / 8,
    y: (hookP0.y + 3 * hookP1.y + 3 * hookP2.y + hookP3.y) / 8,
  }
  const hookFirst = {
    start: hookP0,
    control1: { x: (hookP0.x + hookP1.x) / 2, y: (hookP0.y + hookP1.y) / 2 },
    control2: { x: (hookP0.x + 2 * hookP1.x + hookP2.x) / 4, y: (hookP0.y + 2 * hookP1.y + hookP2.y) / 4 },
    end: hookMid,
  }
  const hookSecond = {
    start: hookMid,
    control1: { x: (hookP1.x + 2 * hookP2.x + hookP3.x) / 4, y: (hookP1.y + 2 * hookP2.y + hookP3.y) / 4 },
    // 钩尖收笔：切线倾斜（端帽随切线垂直），不要竖直收笔
    control2: { x: (hookP2.x + hookP3.x) / 2 - weight / 2, y: (hookP2.y + hookP3.y) / 2 },
    end: hookP3,
  }
  const { out_stroke1b_curves, out_stroke1b_points, in_stroke1b_curves, in_stroke1b_points } = FP.getCurveContours2('stroke1b', [hookFirst], weight, { weightsVariation: 'bezier', weightsVariationFnType: 'heitiPressureCircleStart', startWeight: weight * (1 - 0.125 * pressure), endWeight: weight })
  const { out_stroke1c_curves, out_stroke1c_points, in_stroke1c_curves, in_stroke1c_points } = FP.getCurveContours2('stroke1c', [hookSecond], weight, { weightsVariation: 'bezier', weightsVariationFnType: 'heitiPressureCircleStart', startWeight: weight, endWeight: weight * (1 - 0.125 * pressure) })

  // 创建钢笔组件
  const pen1 = new FP.PenComponent()
  pen1.beginPath()
  pen1.moveTo(out_stroke1_curves[0].start.x, out_stroke1_curves[0].start.y)
  for (let i = 0; i < out_stroke1_curves.length; i++) {
    const curve = out_stroke1_curves[i]
    pen1.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
  }
  pen1.lineTo(in_stroke1_curves[in_stroke1_curves.length - 1].end.x, in_stroke1_curves[in_stroke1_curves.length - 1].end.y)
  for (let i = in_stroke1_curves.length - 1; i >= 0; i--) {
    const curve = in_stroke1_curves[i]
    pen1.bezierTo(curve.control2.x, curve.control2.y, curve.control1.x, curve.control1.y, curve.start.x, curve.start.y)
  }
  pen1.lineTo(out_stroke1_curves[0].start.x, out_stroke1_curves[0].start.y)
  pen1.closePath()

  const pen2 = new FP.PenComponent()
  pen2.beginPath()
  pen2.moveTo(out_stroke1b_curves[0].start.x, out_stroke1b_curves[0].start.y)
  for (let i = 0; i < out_stroke1b_curves.length; i++) {
    const curve = out_stroke1b_curves[i]
    pen2.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
  }
  pen2.lineTo(in_stroke1b_curves[in_stroke1b_curves.length - 1].end.x, in_stroke1b_curves[in_stroke1b_curves.length - 1].end.y)
  for (let i = in_stroke1b_curves.length - 1; i >= 0; i--) {
    const curve = in_stroke1b_curves[i]
    pen2.bezierTo(curve.control2.x, curve.control2.y, curve.control1.x, curve.control1.y, curve.start.x, curve.start.y)
  }
  pen2.lineTo(out_stroke1b_curves[0].start.x, out_stroke1b_curves[0].start.y)
  pen2.closePath()

  const pen3 = new FP.PenComponent()
  pen3.beginPath()
  pen3.moveTo(out_stroke1c_curves[0].start.x, out_stroke1c_curves[0].start.y)
  for (let i = 0; i < out_stroke1c_curves.length; i++) {
    const curve = out_stroke1c_curves[i]
    pen3.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
  }
  pen3.lineTo(in_stroke1c_curves[in_stroke1c_curves.length - 1].end.x, in_stroke1c_curves[in_stroke1c_curves.length - 1].end.y)
  for (let i = in_stroke1c_curves.length - 1; i >= 0; i--) {
    const curve = in_stroke1c_curves[i]
    pen3.bezierTo(curve.control2.x, curve.control2.y, curve.control1.x, curve.control1.y, curve.start.x, curve.start.y)
  }
  pen3.lineTo(out_stroke1c_curves[0].start.x, out_stroke1c_curves[0].start.y)
  pen3.closePath()

  const pen4 = new FP.PenComponent()
  pen4.beginPath()
  pen4.moveTo(out_stroke2_start.x, out_stroke2_start.y)
  for (let i = 0; i < out_stroke2_curves.length; i++) {
    const curve = out_stroke2_curves[i]
    pen4.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
  }
  pen4.lineTo(in_stroke2_end.x, in_stroke2_end.y)
  for (let i = in_stroke2_curves.length - 1; i >= 0; i--) {
    const curve = in_stroke2_curves[i]
    pen4.bezierTo(curve.control2.x, curve.control2.y, curve.control1.x, curve.control1.y, curve.start.x, curve.start.y)
  }
  pen4.lineTo(out_stroke2_start.x, out_stroke2_start.y)
  pen4.closePath()

  return [ pen1, pen2, pen3, pen4 ]
}

updateGlyphByParams(params, global_params)