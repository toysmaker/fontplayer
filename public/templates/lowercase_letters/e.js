const params = {
  h1: glyph.getParam('h1'),
  h2: glyph.getParam('h2'),
  w1: glyph.getParam('w1'),
}
const global_params = {
  weight: glyph.getParam('字重') || 40,
  serifType: glyph.getParam('衬线类型') || 0,
  serifSize: glyph.getParam('衬线大小') || 2.0,
  curvature: glyph.getParam('弯曲度') ?? 1,
  pressure: glyph.getParam('笔压') ?? 1,
}
// 弯曲度 → 三次贝塞尔曲线描述：弯曲度为 1 时与原二次贝塞尔（bend）完全一致；
// 弯曲度越大，控制点离对应锚点越远，转角越饱满；为 0 时退化为直线（直角）
const bendToCubic = (start, bend, end, segmentKey) => {
  const k = (2 / 3) * global_params.curvature * (segmentCurvature[segmentKey] ?? 1)
  return {
    start,
    control1: {
      x: start.x + k * (bend.x - start.x),
      y: start.y + k * (bend.y - start.y),
    },
    control2: {
      x: end.x + k * (bend.x - end.x),
      y: end.y + k * (bend.y - end.y),
    },
    end,
  }
}
// 每段曲线的弯曲度系数（段名:序号 → 系数），当前全部为 1（统一跟随全局「弯曲度」参数）；
// 之后要微调某一段转角时，只需改这里的系数，例如 'stroke1:0': 0.8 更平、1.2 更圆
const segmentCurvature = {
  'stroke2:0': 1,
  'stroke2:1': 1,
  'stroke2:2': 1,
  'stroke2:3': 1,
}

const ascender = 800
const descender = -200
const width = 360
const xHeight = 500
const capitalHeight = 750
const ox = 500
const oy = 500
const x0 = 500 - width / 2
const y0 = ascender - xHeight / 2

const getJointsMap = (data) => {
  const { draggingJoint, deltaX, deltaY } = data
  const jointsMap = Object.assign({}, glyph.tempData)
  switch (draggingJoint.name) {
    case 'skeleton_1': {
      jointsMap['skeleton_1'] = {
        x: glyph.tempData['skeleton_1'].x + deltaX,
        y: glyph.tempData['skeleton_1'].y,
      }
      jointsMap['skeleton_2'] = {
        x: glyph.tempData['skeleton_2'].x + deltaX,
        y: glyph.tempData['skeleton_2'].y,
      }
      jointsMap['skeleton_3'] = {
        x: glyph.tempData['skeleton_3'].x + deltaX / 2,
        y: glyph.tempData['skeleton_3'].y,
      }
      jointsMap['skeleton_6'] = {
        x: glyph.tempData['skeleton_6'].x + deltaX / 2,
        y: glyph.tempData['skeleton_6'].y,
      }
      jointsMap['skeleton_7'] = {
        x: glyph.tempData['skeleton_7'].x + deltaX,
        y: glyph.tempData['skeleton_7'].y,
      }
      jointsMap['skeleton_8'] = {
        x: glyph.tempData['skeleton_8'].x + deltaX,
        y: glyph.tempData['skeleton_8'].y,
      }
      break
    }
    case 'skeleton_2': {
      jointsMap['skeleton_1'] = {
        x: glyph.tempData['skeleton_1'].x + deltaX,
        y: glyph.tempData['skeleton_1'].y,
      }
      jointsMap['skeleton_2'] = {
        x: glyph.tempData['skeleton_2'].x + deltaX,
        y: glyph.tempData['skeleton_2'].y + deltaY,
      }
      jointsMap['skeleton_3'] = {
        x: glyph.tempData['skeleton_3'].x + deltaX / 2,
        y: glyph.tempData['skeleton_3'].y + deltaY,
      }
      jointsMap['skeleton_4'] = {
        x: glyph.tempData['skeleton_4'].x,
        y: glyph.tempData['skeleton_4'].y + deltaY,
      }
      jointsMap['skeleton_5'] = {
        x: glyph.tempData['skeleton_5'].x,
        y: glyph.tempData['skeleton_5'].y - deltaY,
      }
      jointsMap['skeleton_6'] = {
        x: glyph.tempData['skeleton_6'].x + deltaX / 2,
        y: glyph.tempData['skeleton_6'].y - deltaY,
      }
      jointsMap['skeleton_7'] = {
        x: glyph.tempData['skeleton_7'].x + deltaX,
        y: glyph.tempData['skeleton_7'].y - deltaY,
      }
      jointsMap['skeleton_8'] = {
        x: glyph.tempData['skeleton_8'].x + deltaX,
        y: glyph.tempData['skeleton_8'].y - deltaY,
      }
      break
    }
    case 'skeleton_3': {
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
      jointsMap['skeleton_5'] = {
        x: glyph.tempData['skeleton_5'].x,
        y: glyph.tempData['skeleton_5'].y - deltaY,
      }
      jointsMap['skeleton_6'] = {
        x: glyph.tempData['skeleton_6'].x,
        y: glyph.tempData['skeleton_6'].y - deltaY,
      }
      jointsMap['skeleton_7'] = {
        x: glyph.tempData['skeleton_7'].x,
        y: glyph.tempData['skeleton_7'].y - deltaY,
      }
      jointsMap['skeleton_8'] = {
        x: glyph.tempData['skeleton_8'].x,
        y: glyph.tempData['skeleton_8'].y - deltaY,
      }
      break
    }
    case 'skeleton_4': {
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
      jointsMap['skeleton_5'] = {
        x: glyph.tempData['skeleton_5'].x,
        y: glyph.tempData['skeleton_5'].y - deltaY,
      }
      jointsMap['skeleton_6'] = {
        x: glyph.tempData['skeleton_6'].x,
        y: glyph.tempData['skeleton_6'].y - deltaY,
      }
      jointsMap['skeleton_7'] = {
        x: glyph.tempData['skeleton_7'].x,
        y: glyph.tempData['skeleton_7'].y - deltaY,
      }
      jointsMap['skeleton_8'] = {
        x: glyph.tempData['skeleton_8'].x,
        y: glyph.tempData['skeleton_8'].y - deltaY,
      }
      break
    }
    case 'skeleton_5': {
      jointsMap['skeleton_2'] = {
        x: glyph.tempData['skeleton_2'].x,
        y: glyph.tempData['skeleton_2'].y - deltaY,
      }
      jointsMap['skeleton_3'] = {
        x: glyph.tempData['skeleton_3'].x,
        y: glyph.tempData['skeleton_3'].y - deltaY,
      }
      jointsMap['skeleton_4'] = {
        x: glyph.tempData['skeleton_4'].x,
        y: glyph.tempData['skeleton_4'].y - deltaY,
      }
      jointsMap['skeleton_5'] = {
        x: glyph.tempData['skeleton_5'].x,
        y: glyph.tempData['skeleton_5'].y + deltaY,
      }
      jointsMap['skeleton_6'] = {
        x: glyph.tempData['skeleton_6'].x,
        y: glyph.tempData['skeleton_6'].y + deltaY,
      }
      jointsMap['skeleton_7'] = {
        x: glyph.tempData['skeleton_7'].x,
        y: glyph.tempData['skeleton_7'].y + deltaY,
      }
      jointsMap['skeleton_8'] = {
        x: glyph.tempData['skeleton_8'].x,
        y: glyph.tempData['skeleton_8'].y + deltaY,
      }
      break
    }
    case 'skeleton_6': {
      jointsMap['skeleton_2'] = {
        x: glyph.tempData['skeleton_2'].x,
        y: glyph.tempData['skeleton_2'].y - deltaY,
      }
      jointsMap['skeleton_3'] = {
        x: glyph.tempData['skeleton_3'].x,
        y: glyph.tempData['skeleton_3'].y - deltaY,
      }
      jointsMap['skeleton_4'] = {
        x: glyph.tempData['skeleton_4'].x,
        y: glyph.tempData['skeleton_4'].y - deltaY,
      }
      jointsMap['skeleton_5'] = {
        x: glyph.tempData['skeleton_5'].x,
        y: glyph.tempData['skeleton_5'].y + deltaY,
      }
      jointsMap['skeleton_6'] = {
        x: glyph.tempData['skeleton_6'].x,
        y: glyph.tempData['skeleton_6'].y + deltaY,
      }
      jointsMap['skeleton_7'] = {
        x: glyph.tempData['skeleton_7'].x,
        y: glyph.tempData['skeleton_7'].y + deltaY,
      }
      jointsMap['skeleton_8'] = {
        x: glyph.tempData['skeleton_8'].x,
        y: glyph.tempData['skeleton_8'].y + deltaY,
      }
      break
    }
    case 'skeleton_7': {
      jointsMap['skeleton_1'] = {
        x: glyph.tempData['skeleton_1'].x + deltaX,
        y: glyph.tempData['skeleton_1'].y,
      }
      jointsMap['skeleton_2'] = {
        x: glyph.tempData['skeleton_2'].x + deltaX,
        y: glyph.tempData['skeleton_2'].y - deltaY,
      }
      jointsMap['skeleton_3'] = {
        x: glyph.tempData['skeleton_3'].x + deltaX / 2,
        y: glyph.tempData['skeleton_3'].y - deltaY,
      }
      jointsMap['skeleton_4'] = {
        x: glyph.tempData['skeleton_4'].x,
        y: glyph.tempData['skeleton_4'].y - deltaY,
      }
      jointsMap['skeleton_5'] = {
        x: glyph.tempData['skeleton_5'].x,
        y: glyph.tempData['skeleton_5'].y + deltaY,
      }
      jointsMap['skeleton_6'] = {
        x: glyph.tempData['skeleton_6'].x + deltaX / 2,
        y: glyph.tempData['skeleton_6'].y + deltaY,
      }
      jointsMap['skeleton_7'] = {
        x: glyph.tempData['skeleton_7'].x + deltaX,
        y: glyph.tempData['skeleton_7'].y + deltaY,
      }
      jointsMap['skeleton_8'] = {
        x: glyph.tempData['skeleton_8'].x + deltaX,
        y: glyph.tempData['skeleton_8'].y + deltaY,
      }
      break
    }
    case 'skeleton_8': {
      jointsMap['skeleton_1'] = {
        x: glyph.tempData['skeleton_1'].x + deltaX,
        y: glyph.tempData['skeleton_1'].y,
      }
      jointsMap['skeleton_2'] = {
        x: glyph.tempData['skeleton_2'].x + deltaX,
        y: glyph.tempData['skeleton_2'].y,
      }
      jointsMap['skeleton_3'] = {
        x: glyph.tempData['skeleton_3'].x + deltaX / 2,
        y: glyph.tempData['skeleton_3'].y,
      }
      jointsMap['skeleton_6'] = {
        x: glyph.tempData['skeleton_6'].x + deltaX / 2,
        y: glyph.tempData['skeleton_6'].y,
      }
      jointsMap['skeleton_7'] = {
        x: glyph.tempData['skeleton_7'].x + deltaX,
        y: glyph.tempData['skeleton_7'].y,
      }
      jointsMap['skeleton_8'] = {
        x: glyph.tempData['skeleton_8'].x + deltaX,
        y: glyph.tempData['skeleton_8'].y + deltaY,
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
  const { skeleton_0, skeleton_1, skeleton_2, skeleton_3, skeleton_4, skeleton_5, skeleton_6, skeleton_7, skeleton_8 } = jointsMap
  const h1_range = glyph.getParamRange('h1')
  const h2_range = glyph.getParamRange('h2')
  const w1_range = glyph.getParamRange('w1')
  const h1 = range(skeleton_5.y - skeleton_4.y, h1_range)
  const h2 = range(skeleton_7.y - skeleton_8.y, h2_range)
  const w1 = range(skeleton_2.x - skeleton_4.x, w1_range)
  return {
    h1,
    h2,
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
  const { h1, h2, h3, h4, h5, w1, w2 } = params
  const { weight, curvature, pressure } = global_params

  const skeleton_0 = new FP.Joint('skeleton_0', {
    x: x0,
    y: y0,
  })
  const skeleton_1 = new FP.Joint('skeleton_1', {
    x: skeleton_0.x + w1,
    y: skeleton_0.y,
  })
  const skeleton_2 = new FP.Joint('skeleton_2', {
    x: skeleton_1.x,
    y: skeleton_1.y - h1 / 2,
  })
  const skeleton_3 = new FP.Joint('skeleton_3', {
    x: skeleton_2.x - w1 / 2,
    y: skeleton_2.y,
  })
  const skeleton_4 = new FP.Joint('skeleton_4', {
    x: skeleton_3.x - w1 / 2,
    y: skeleton_3.y,
  })
  const skeleton_5 = new FP.Joint('skeleton_5', {
    x: skeleton_4.x,
    y: skeleton_4.y + h1,
  })
  const skeleton_6 = new FP.Joint('skeleton_6', {
    x: skeleton_5.x + w1 / 2,
    y: skeleton_5.y,
  })
  const skeleton_7 = new FP.Joint('skeleton_7', {
    x: skeleton_6.x + w1 / 2,
    y: skeleton_6.y,
  })
  const skeleton_8 = new FP.Joint('skeleton_8', {
    x: skeleton_7.x,
    y: skeleton_7.y - h2,
  })
  const skeleton = {
    skeleton_0,
    skeleton_1,
    skeleton_2,
    skeleton_3,
    skeleton_4,
    skeleton_5,
    skeleton_6,
    skeleton_7,
    skeleton_8,
  }
  
  glyph.addJoint(skeleton_0)
  glyph.addJoint(skeleton_1)
  glyph.addJoint(skeleton_2)
  glyph.addJoint(skeleton_3)
  glyph.addJoint(skeleton_4)
  glyph.addJoint(skeleton_5)
  glyph.addJoint(skeleton_6)
  glyph.addJoint(skeleton_7)
  glyph.addJoint(skeleton_8)
  
  glyph.addRefLine(refline(skeleton_0, skeleton_1))
  glyph.addRefLine(refline(skeleton_1, skeleton_2))
  glyph.addRefLine(refline(skeleton_2, skeleton_3))
  glyph.addRefLine(refline(skeleton_3, skeleton_4))
  glyph.addRefLine(refline(skeleton_4, skeleton_5))
  glyph.addRefLine(refline(skeleton_5, skeleton_6))
  glyph.addRefLine(refline(skeleton_6, skeleton_7))
  glyph.addRefLine(refline(skeleton_7, skeleton_8))

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
  const { skeleton_0, skeleton_1, skeleton_2, skeleton_3, skeleton_4, skeleton_5, skeleton_6, skeleton_7, skeleton_8 } = skeleton

  // out指起点右侧轮廓线
  // in指起点左侧轮廓线
  let _stroke1_contours = FP.getLineContours2('stroke1', { stroke1_start: skeleton_0, stroke1_end: skeleton_1 }, weight * (1 - 0.125 * pressure), { weightsVariation: 'bezier', weightsVariationFnType: 'heitiPressureStraight', startWeight: weight * (1 - 0.125 * pressure), endWeight: weight * (1 - 0.125 * pressure) * (1 + 0.25 * pressure) })
  let out_stroke1_curves = FP.fitCurvesByPoints(_stroke1_contours.out_stroke1_points, 1.5).curves
  let in_stroke1_curves = FP.fitCurvesByPoints(_stroke1_contours.in_stroke1_points, 1.5).curves
  let out_stroke1_start = out_stroke1_curves[0].start
  let out_stroke1_end = out_stroke1_curves[out_stroke1_curves.length - 1].end
  let in_stroke1_start = in_stroke1_curves[0].start
  let in_stroke1_end = in_stroke1_curves[in_stroke1_curves.length - 1].end
  let { out_stroke2_curves, out_stroke2_points, in_stroke2_curves, in_stroke2_points } = FP.getCurveContours2('stroke2', [
      // 起笔端保持垂直；仅下弯钩收笔端切线倾斜（端帽随切线垂直）
      bendToCubic(skeleton_1, skeleton_2, skeleton_3, 'stroke2:0'),
      bendToCubic(skeleton_3, skeleton_4, skeleton_0, 'stroke2:1'),
      bendToCubic(skeleton_0, skeleton_5, skeleton_6, 'stroke2:2'),
      bendToCubic(skeleton_6, { x: skeleton_7.x - weight / 2, y: skeleton_7.y }, skeleton_8, 'stroke2:3')
    ], weight,
    // 笔压（参照数字字形）：直线笔画两端捺式加粗
    // 弧：左侧保持字重，前后两端缓动减细（比横稍粗）
    { weightsVariation: 'bezier', weightsVariationFnType: 'heitiPressureELoop', startWeight: weight, endWeight: weight * (1 - 0.0625 * pressure) })
  const out_corner = {
    x: in_stroke2_curves[0].start.x,
    y: in_stroke1_end.y,
  }

  // 创建钢笔组件
  const pen1 = new FP.PenComponent()
  pen1.beginPath()
  // 绘制stroke1
  pen1.moveTo(out_stroke1_start.x, out_stroke1_start.y)
  pen1.lineTo(out_stroke1_end.x, out_stroke1_end.y)
  pen1.lineTo(skeleton_1.x, skeleton_1.y)
  pen1.lineTo(in_stroke2_curves[0].start.x, in_stroke2_curves[0].start.y)
  pen1.lineTo(out_corner.x, out_corner.y)
  pen1.lineTo(in_stroke1_start.x, in_stroke1_start.y)
  pen1.lineTo(out_stroke1_start.x, out_stroke1_start.y)
  pen1.closePath()

  const pen2 = new FP.PenComponent()
  pen2.beginPath()
  // 绘制stroke2
  pen2.moveTo(out_stroke2_curves[0].start.x, out_stroke2_curves[0].start.y)
  for (let i = 0; i < out_stroke2_curves.length; i++) {
    const curve = out_stroke2_curves[i]
    pen2.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
  }
  pen2.lineTo(in_stroke2_curves[in_stroke2_curves.length - 1].end.x, in_stroke2_curves[in_stroke2_curves.length - 1].end.y)
  for (let i = in_stroke2_curves.length - 1; i >= 0; i--) {
    const curve = in_stroke2_curves[i]
    pen2.bezierTo(curve.control2.x, curve.control2.y, curve.control1.x, curve.control1.y, curve.start.x, curve.start.y)
  }
  pen2.lineTo(out_stroke2_curves[0].start.x, out_stroke2_curves[0].start.y)
  pen2.closePath()

  return [ pen1, pen2 ]
}

updateGlyphByParams(params, global_params)