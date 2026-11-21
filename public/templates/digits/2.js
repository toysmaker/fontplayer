const params = {
  h1: glyph.getParam('h1'),
  h2: glyph.getParam('h2'),
  h3: glyph.getParam('h3'),
  w1: glyph.getParam('w1'),
  w3: glyph.getParam('w3'),
}
const global_params = {
  weight: glyph.getParam('字重') || 40,
  serifType: glyph.getParam('衬线类型') || 0,
  serifSize: glyph.getParam('衬线大小') || 2.0,
  curvature: glyph.getParam('弯曲度') ?? 1,
  pressure: glyph.getParam('笔压') ?? 1,
}
// 每段曲线的弯曲度系数（段名:序号 → 系数），当前全部为 1（统一跟随全局「弯曲度」参数）；
// 之后要微调某一段转角时，只需改这里的系数，例如 'stroke1:0': 0.8 更平、1.2 更圆
const segmentCurvature = {
  'stroke1:0': 1,
  'stroke1:1': 1,
  'stroke1:2': 0.25,
}
// 弯曲度 → 三次贝塞尔曲线描述：最终弯曲度 = 全局弯曲度 × 段系数；
// 弯曲度为 1 时与原二次贝塞尔（bend）完全一致；越大控制点离对应锚点越远、转角越饱满；为 0 时退化为直线（直角）
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
const ascender = 800
const descender = -200
const width = 360
const xHeight = 500
const capitalHeight = 750
const ox = 500
const oy = 500
const x0 = 500 - width / 2
const y0 = ascender - capitalHeight + params.h2

const getJointsMap = (data) => {
  const { draggingJoint, deltaX, deltaY } = data
  const jointsMap = Object.assign({}, glyph.tempData)
  switch (draggingJoint.name) {
    case 'skeleton_1': {
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
        y: glyph.tempData['skeleton_4'].y + deltaY / 2,
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
        y: glyph.tempData['skeleton_4'].y + deltaY / 2,
      }
      break
    }
    case 'skeleton_3': {
      jointsMap['skeleton_1'] = {
        x: glyph.tempData['skeleton_1'].x,
        y: glyph.tempData['skeleton_1'].y + deltaY,
      }
      jointsMap['skeleton_2'] = {
        x: glyph.tempData['skeleton_2'].x + deltaX / 2,
        y: glyph.tempData['skeleton_2'].y + deltaY,
      }
      jointsMap['skeleton_3'] = {
        x: glyph.tempData['skeleton_3'].x + deltaX,
        y: glyph.tempData['skeleton_3'].y + deltaY,
      }
      jointsMap['skeleton_4'] = {
        x: glyph.tempData['skeleton_4'].x + deltaX,
        y: glyph.tempData['skeleton_4'].y + deltaY / 2,
      }
      jointsMap['skeleton_5'] = {
        x: glyph.tempData['skeleton_5'].x + deltaX,
        y: glyph.tempData['skeleton_5'].y,
      }
      break
    }
    case 'skeleton_4': {
      jointsMap['skeleton_2'] = {
        x: glyph.tempData['skeleton_2'].x + deltaX / 2,
        y: glyph.tempData['skeleton_2'].y,
      }
      jointsMap['skeleton_3'] = {
        x: glyph.tempData['skeleton_3'].x + deltaX,
        y: glyph.tempData['skeleton_3'].y,
      }
      jointsMap['skeleton_4'] = {
        x: glyph.tempData['skeleton_4'].x + deltaX,
        y: glyph.tempData['skeleton_4'].y,
      }
      jointsMap['skeleton_5'] = {
        x: glyph.tempData['skeleton_5'].x + deltaX,
        y: glyph.tempData['skeleton_5'].y,
      }
      break
    }
    case 'skeleton_5': {
      jointsMap['skeleton_2'] = {
        x: glyph.tempData['skeleton_2'].x + deltaX / 2,
        y: glyph.tempData['skeleton_2'].y,
      }
      jointsMap['skeleton_3'] = {
        x: glyph.tempData['skeleton_3'].x + deltaX,
        y: glyph.tempData['skeleton_3'].y,
      }
      jointsMap['skeleton_4'] = {
        x: glyph.tempData['skeleton_4'].x + deltaX,
        y: glyph.tempData['skeleton_4'].y + deltaY / 2,
      }
      jointsMap['skeleton_5'] = {
        x: glyph.tempData['skeleton_5'].x + deltaX,
        y: glyph.tempData['skeleton_5'].y + deltaY,
      }
      break
    }
    case 'skeleton_6': {
      jointsMap['skeleton_6'] = {
        x: glyph.tempData['skeleton_6'].x,
        y: glyph.tempData['skeleton_6'].y + deltaY,
      }
      jointsMap['skeleton_7'] = {
        x: glyph.tempData['skeleton_7'].x,
        y: glyph.tempData['skeleton_7'].y + deltaY,
      }
      break
    }
    case 'skeleton_7': {
      jointsMap['skeleton_2'] = {
        x: glyph.tempData['skeleton_2'].x + deltaX / 2,
        y: glyph.tempData['skeleton_2'].y,
      }
      jointsMap['skeleton_3'] = {
        x: glyph.tempData['skeleton_3'].x + deltaX,
        y: glyph.tempData['skeleton_3'].y,
      }
      jointsMap['skeleton_4'] = {
        x: glyph.tempData['skeleton_4'].x + deltaX,
        y: glyph.tempData['skeleton_4'].y,
      }
      jointsMap['skeleton_5'] = {
        x: glyph.tempData['skeleton_5'].x + deltaX,
        y: glyph.tempData['skeleton_5'].y,
      }
      jointsMap['skeleton_6'] = {
        x: glyph.tempData['skeleton_6'].x,
        y: glyph.tempData['skeleton_6'].y + deltaY,
      }
      jointsMap['skeleton_7'] = {
        x: glyph.tempData['skeleton_7'].x + deltaX,
        y: glyph.tempData['skeleton_7'].y + deltaY,
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
  glyph.setParam('w1', _params.w1)
  glyph.setParam('w3', _params.w3)
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
  const { skeleton_0, skeleton_1, skeleton_2, skeleton_3, skeleton_4, skeleton_5, skeleton_6, skeleton_7 } = jointsMap
  const h1_range = glyph.getParamRange('h1')
  const h2_range = glyph.getParamRange('h2')
  const h3_range = glyph.getParamRange('h3')
  const w1_range = glyph.getParamRange('w1')
  const w3_range = glyph.getParamRange('w3')
  const h1 = range(skeleton_6.y - skeleton_1.y, h1_range)
  const h2 = range(skeleton_0.y - skeleton_1.y, h2_range)
  const h3 = range(skeleton_5.y - skeleton_3.y, h3_range)
  const w1 = range(skeleton_3.x - skeleton_1.x, w1_range)
  const w3 = range(skeleton_7.x - skeleton_6.x, w3_range)
  return {
    h2,
    w1,
    h1,
    h3,
    w3,
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
  const { h1, h2, h3, w1, w3 } = params
  const { weight } = global_params

  const skeleton_0 = new FP.Joint('skeleton_0', {
    x: x0,
    y: y0,
  })
  const skeleton_1 = new FP.Joint('skeleton_1', {
    x: skeleton_0.x,
    y: skeleton_0.y - h2,
  })
  const skeleton_2 = new FP.Joint('skeleton_2', {
    x: skeleton_1.x + w1 / 2,
    y: skeleton_1.y,
  })
  const skeleton_3 = new FP.Joint('skeleton_3', {
    x: skeleton_2.x + w1 / 2,
    y: skeleton_2.y,
  })
  const skeleton_4 = new FP.Joint('skeleton_4', {
    x: skeleton_3.x,
    y: skeleton_3.y + h3 / 2,
  })
  const skeleton_5 = new FP.Joint('skeleton_5', {
    x: skeleton_4.x,
    y: skeleton_4.y + h3 / 2,
  })
  const skeleton_6 = new FP.Joint('skeleton_6', {
    x: skeleton_5.x - w1,
    y: skeleton_1.y + h1,
  })
  const skeleton_7 = new FP.Joint('skeleton_7', {
    x: skeleton_6.x + w3,
    y: skeleton_6.y,
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
  }
  
  glyph.addJoint(skeleton_0)
  glyph.addJoint(skeleton_1)
  glyph.addJoint(skeleton_2)
  glyph.addJoint(skeleton_3)
  glyph.addJoint(skeleton_4)
  glyph.addJoint(skeleton_5)
  glyph.addJoint(skeleton_6)
  glyph.addJoint(skeleton_7)
  glyph.addRefLine(refline(skeleton_1, skeleton_0))
  glyph.addRefLine(refline(skeleton_2, skeleton_1))
  glyph.addRefLine(refline(skeleton_3, skeleton_2))
  glyph.addRefLine(refline(skeleton_4, skeleton_3))
  glyph.addRefLine(refline(skeleton_5, skeleton_4))
  glyph.addRefLine(refline(skeleton_6, skeleton_5))
  glyph.addRefLine(refline(skeleton_7, skeleton_6))

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
  const { weight, serifSize, serifType, pressure } = global_params

  // 根据骨架计算轮廓关键点
  const { skeleton_0, skeleton_1, skeleton_2, skeleton_3, skeleton_4, skeleton_5, skeleton_6, skeleton_7 } = skeleton

  // 视错修正：横画视觉显粗，底横比竖画略细（0.9 倍字重），且底横下缘压在基线上
  const horizontalWeight = weight * 0.9
  // 斜笔单段曲线：bend 取「起笔垂直线 × 收笔水平线」交点——起笔切线垂直、收笔切线水平，
  // 全程平滑无接缝；段系数控制向外弓的程度
  const diagonal_end = { x: skeleton_6.x, y: skeleton_6.y - weight / 2 }
  const diagonal_bend = { x: skeleton_4.x, y: diagonal_end.y }

  let { out_stroke1_curves, out_stroke1_points, in_stroke1_curves, in_stroke1_points } = FP.getCurveContours2(
    'stroke1',
    [
      bendToCubic(skeleton_0, skeleton_1, skeleton_2, 'stroke1:0'),
      bendToCubic(skeleton_2, skeleton_3, skeleton_4, 'stroke1:1'),
      bendToCubic(skeleton_4, diagonal_bend, diagonal_end, 'stroke1:2'),
    ],
    weight,
    // 起笔满字重，仅最上侧弯处（顶弧）局部减细，其余统一原始宽度
    { weightsVariation: 'bezier', weightsVariationFnType: 'heitiPressureTopArc', startWeight: weight, endWeight: weight * (1 - 0.25 * pressure) }
  )
  const _stroke2_contours = FP.getLineContours2('stroke2', {
    stroke2_start: { x: skeleton_6.x, y: skeleton_6.y - horizontalWeight / 2 },
    stroke2_end: { x: skeleton_7.x, y: skeleton_7.y - horizontalWeight / 2 },
  }, horizontalWeight,
  // 横画带笔压：上下两侧对称（两端满、中段减细）
  {
    weightsVariation: 'bezier', weightsVariationFnType: 'heitiPressureStraight',
    startWeight: horizontalWeight, endWeight: horizontalWeight * (1 + 0.25 * pressure),
  })
  // 短笔画用紧拟合（容差 1.5），防止拟合曲线把压笔形状吃掉
  const out_stroke2_curves = FP.fitCurvesByPoints(_stroke2_contours.out_stroke2_points, 1.5).curves
  const in_stroke2_curves = FP.fitCurvesByPoints(_stroke2_contours.in_stroke2_points, 1.5).curves

  const refline_start = {
    x: skeleton_6.x,
    y: skeleton_6.y - 200,
  }
  const refline_end = {
    x: skeleton_6.x,
    y: skeleton_6.y + 200,
  }
  const corner_data = FP.getIntersection(
    { type: 'line', start: refline_start, end: refline_end },
    { type: 'curve', points: in_stroke1_points },
  )
  const corner = corner_data.corner
  const corner_index = corner_data.corner_index
  in_stroke1_points = in_stroke1_points.slice(0, corner_index + 1)
  in_stroke1_curves = FP.fitCurvesByPoints(in_stroke1_points).curves

  const start_serif_size = serifSize ? serifSize * weight : weight
  const start_serif_o = FP.getPointOnLine(out_stroke1_curves[0].start, in_stroke1_curves[0].start, start_serif_size / 2)
  const start_serif_angle = Math.atan2(in_stroke1_curves[0].start.y - out_stroke1_curves[0].y, in_stroke1_curves[0].start.x - out_stroke1_curves[0].start.x)
  const start_serif_curves = FP.getCircle(start_serif_o, start_serif_size / 2, 0)
  const {
    tangent: start_serif_tangent_1,
    final_curves: start_serif_curves_final,
  } = FP.getTangentOnCurves(start_serif_curves, 0.6)
  const start_serif_corner_data = FP.getIntersection({
    type: 'curve',
    points: FP.getCurvesPoints(start_serif_curves),
  }, {
    type: 'curve',
    points: in_stroke1_points,
  })
  const { curves: in_stroke1_curves_final_1 } = FP.fitCurvesByPoints(in_stroke1_points.slice(start_serif_corner_data.corner_index[1]))
  const {
    final_curves: in_stroke1_curves_final_2,
  } = FP.getRadiusPointsOnCurve(FP.getCurvesPoints(in_stroke1_curves_final_1), start_serif_size)
  // 笔压变化后球头与点列可能无交点：衬线数据缺失时回退到无衬线画法
  const serifReady = Array.isArray(in_stroke1_curves_final_2) && in_stroke1_curves_final_2.length > 0
  const start_serif_control_candidate = serifReady ? FP.getIntersection({
    type: 'line',
    start: start_serif_curves_final[start_serif_curves_final.length - 1].control2,
    end: start_serif_curves_final[start_serif_curves_final.length - 1].end,
  }, {
    type: 'line',
    start: in_stroke1_curves_final_2[0].start,
    end: in_stroke1_curves_final_2[0].control1,
  }).corner : null
  // 极端曲率下两条切线近乎平行，交点外推到远处（野点）：距离过远视为失败，回退无衬线
  const start_serif_control = start_serif_control_candidate && Math.hypot(start_serif_control_candidate.x - skeleton_0.x, start_serif_control_candidate.y - skeleton_0.y) < 400
    ? start_serif_control_candidate
    : null
  const serifReady2 = serifReady && !!start_serif_control

  const pen1 = new FP.PenComponent()
  pen1.beginPath()
  if (serifType === 1 && serifReady2) {
    pen1.moveTo(start_serif_curves_final[0].start.x, start_serif_curves_final[0].start.y)
    for (let i = 0; i < start_serif_curves_final.length; i++) {
      const curve = start_serif_curves_final[i]
      pen1.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
    }
    pen1.quadraticBezierTo(start_serif_control.x, start_serif_control.y, in_stroke1_curves_final_2[0].start.x, in_stroke1_curves_final_2[0].start.y)
    for (let i = 0; i < in_stroke1_curves_final_2.length; i++) {
      const curve = in_stroke1_curves_final_2[i]
      pen1.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
    }
    pen1.lineTo(skeleton_6.x, skeleton_6.y)
    pen1.lineTo(out_stroke1_curves[out_stroke1_curves.length - 1].end.x, out_stroke1_curves[out_stroke1_curves.length - 1].end.y)
    for (let i = out_stroke1_curves.length - 1; i >= 0; i--) {
      const curve = out_stroke1_curves[i]
      pen1.bezierTo(curve.control2.x, curve.control2.y, curve.control1.x, curve.control1.y, curve.start.x, curve.start.y)
    }
    pen1.lineTo(start_serif_curves_final[0].start.x, start_serif_curves_final[0].start.y)
  } else if (serifType === 0) {
    pen1.beginPath()
    pen1.moveTo(in_stroke1_curves[0].start.x, in_stroke1_curves[0].start.y)
    for (let i = 0; i < in_stroke1_curves.length; i++) {
      const curve = in_stroke1_curves[i]
      pen1.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
    }
    pen1.lineTo(skeleton_6.x, skeleton_6.y)
    pen1.lineTo(out_stroke1_curves[out_stroke1_curves.length - 1].end.x, out_stroke1_curves[out_stroke1_curves.length - 1].end.y)
    for (let i = out_stroke1_curves.length - 1; i >= 0; i--) {
      const curve = out_stroke1_curves[i]
      pen1.bezierTo(curve.control2.x, curve.control2.y, curve.control1.x, curve.control1.y, curve.start.x, curve.start.y)
    }
    pen1.lineTo(in_stroke1_curves[0].start.x, in_stroke1_curves[0].start.y)
  }
  pen1.closePath()

  const pen2 = new FP.PenComponent()
  pen2.beginPath()
  pen2.moveTo(in_stroke2_curves[0].start.x, in_stroke2_curves[0].start.y)
  for (let i = 0; i < in_stroke2_curves.length; i++) {
    const curve = in_stroke2_curves[i]
    pen2.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
  }
  pen2.lineTo(out_stroke2_curves[out_stroke2_curves.length - 1].end.x, out_stroke2_curves[out_stroke2_curves.length - 1].end.y)
  for (let i = out_stroke2_curves.length - 1; i >= 0; i--) {
    const curve = out_stroke2_curves[i]
    pen2.bezierTo(curve.control2.x, curve.control2.y, curve.control1.x, curve.control1.y, curve.start.x, curve.start.y)
  }
  pen2.lineTo(in_stroke2_curves[0].start.x, in_stroke2_curves[0].start.y)
  pen2.closePath()

  return [ pen1, pen2 ]
}

updateGlyphByParams(params, global_params)