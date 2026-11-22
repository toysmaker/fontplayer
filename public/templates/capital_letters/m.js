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
const ascender = 800
const descender = -200
const width = 360
const xHeight = 500
const capitalHeight = 750
const capitalWidth = 500
const ox = 500
const oy = 500
const x0 = 500 - capitalWidth * 1.5 / 2
const y0 = ascender

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
      break
    }
    case 'skeleton_2': {
      jointsMap['skeleton_2'] = {
        x: glyph.tempData['skeleton_2'].x,
        y: glyph.tempData['skeleton_2'].y + deltaY,
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
        y: glyph.tempData['skeleton_4'].y,
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
  const { skeleton_0, skeleton_1, skeleton_2, skeleton_3, skeleton_4, skeleton_5, skeleton_6, skeleton_7, skeleton_8, skeleton_9, skeleton_10 } = jointsMap
  const h1_range = glyph.getParamRange('h1')
  const h2_range = glyph.getParamRange('h2')
  const w1_range = glyph.getParamRange('w1')
  const h1 = range(skeleton_0.y - skeleton_1.y, h1_range)
  const h2 = range(skeleton_2.y - skeleton_3.y, h2_range)
  const w1 = range(skeleton_3.x - skeleton_1.x, w1_range)
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
  const { h1, h2, w1 } = params
  const { weight, curvature, pressure } = global_params

  const skeleton_0 = new FP.Joint('skeleton_0', {
    x: x0,
    y: y0,
  })
  const skeleton_1 = new FP.Joint('skeleton_1', {
    x: skeleton_0.x,
    y: skeleton_0.y - h1,
  })
  const skeleton_2 = new FP.Joint('skeleton_2', {
    x: skeleton_1.x + w1 / 2,
    y: skeleton_1.y + h2,
  })
  const skeleton_3 = new FP.Joint('skeleton_3', {
    x: skeleton_1.x + w1,
    y: skeleton_1.y,
  })
  const skeleton_4 = new FP.Joint('skeleton_4', {
    x: skeleton_3.x,
    y: skeleton_3.y + h1,
  })
  const skeleton = {
    skeleton_0,
    skeleton_1,
    skeleton_2,
    skeleton_3,
    skeleton_4,
  }
  
  glyph.addJoint(skeleton_0)
  glyph.addJoint(skeleton_1)
  glyph.addJoint(skeleton_2)
  glyph.addJoint(skeleton_3)
  glyph.addJoint(skeleton_4)
  glyph.addRefLine(refline(skeleton_0, skeleton_1))
  glyph.addRefLine(refline(skeleton_1, skeleton_2))
  glyph.addRefLine(refline(skeleton_3, skeleton_2))
  glyph.addRefLine(refline(skeleton_4, skeleton_3))

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
  const { skeleton_0, skeleton_1, skeleton_2, skeleton_3, skeleton_4 } = skeleton

  // out指上侧（外侧）轮廓线
  // in指下侧（内侧）轮廓线
  const _stroke1_contours = FP.getLineContours2('stroke1', { stroke1_start: { x: skeleton_0.x, y: skeleton_0.y + weight / 2 + weight / 8 }, stroke1_end: skeleton_1 }, weight, { weightsVariation: 'bezier', weightsVariationFnType: 'heitiPressureStraight', startWeight: weight, endWeight: weight * (1 + 0.25 * pressure) })
  const out_stroke1_curves = FP.fitCurvesByPoints(_stroke1_contours.out_stroke1_points, 1.5).curves
  const in_stroke1_curves = FP.fitCurvesByPoints(_stroke1_contours.in_stroke1_points, 1.5).curves
  const out_stroke1_start = out_stroke1_curves[0].start
  const out_stroke1_end = out_stroke1_curves[out_stroke1_curves.length - 1].end
  const in_stroke1_start = in_stroke1_curves[0].start
  const in_stroke1_end = in_stroke1_curves[in_stroke1_curves.length - 1].end
  const _stroke2_contours = FP.getLineContours2('stroke2', { stroke2_start: skeleton_2, stroke2_end: skeleton_1 }, weight, { weightsVariation: 'bezier', weightsVariationFnType: 'heitiPressureStraight', startWeight: weight, endWeight: weight * (1 + 0.25 * pressure) })
  const out_stroke2_curves = FP.fitCurvesByPoints(_stroke2_contours.out_stroke2_points, 1.5).curves
  const in_stroke2_curves = FP.fitCurvesByPoints(_stroke2_contours.in_stroke2_points, 1.5).curves
  const out_stroke2_start = out_stroke2_curves[0].start
  const out_stroke2_end = out_stroke2_curves[out_stroke2_curves.length - 1].end
  const in_stroke2_start = in_stroke2_curves[0].start
  const in_stroke2_end = in_stroke2_curves[in_stroke2_curves.length - 1].end
  const _stroke3_contours = FP.getLineContours2('stroke3', { stroke3_start: skeleton_3, stroke3_end: skeleton_2 }, weight, { weightsVariation: 'bezier', weightsVariationFnType: 'heitiPressureStraight', startWeight: weight, endWeight: weight * (1 + 0.25 * pressure) })
  const out_stroke3_curves = FP.fitCurvesByPoints(_stroke3_contours.out_stroke3_points, 1.5).curves
  const in_stroke3_curves = FP.fitCurvesByPoints(_stroke3_contours.in_stroke3_points, 1.5).curves
  const out_stroke3_start = out_stroke3_curves[0].start
  const out_stroke3_end = out_stroke3_curves[out_stroke3_curves.length - 1].end
  const in_stroke3_start = in_stroke3_curves[0].start
  const in_stroke3_end = in_stroke3_curves[in_stroke3_curves.length - 1].end
  const _stroke4_contours = FP.getLineContours2('stroke4', { stroke4_start: { x: skeleton_4.x, y: skeleton_4.y + weight / 2 + weight / 8 }, stroke4_end: skeleton_3 }, weight, { weightsVariation: 'bezier', weightsVariationFnType: 'heitiPressureStraight', startWeight: weight, endWeight: weight * (1 + 0.25 * pressure) })
  const out_stroke4_curves = FP.fitCurvesByPoints(_stroke4_contours.out_stroke4_points, 1.5).curves
  const in_stroke4_curves = FP.fitCurvesByPoints(_stroke4_contours.in_stroke4_points, 1.5).curves
  const out_stroke4_start = out_stroke4_curves[0].start
  const out_stroke4_end = out_stroke4_curves[out_stroke4_curves.length - 1].end
  const in_stroke4_start = in_stroke4_curves[0].start
  const in_stroke4_end = in_stroke4_curves[in_stroke4_curves.length - 1].end

  const refline_start_bottom = {
    x: skeleton_2.x - 200,
    y: skeleton_2.y,
  }
  const refline_end_bottom = {
    x: skeleton_2.x + 200,
    y: skeleton_2.y,
  }
  const refline_start_left = {
    x: skeleton_1.x - 200,
    y: skeleton_1.y,
  }
  const refline_end_left = {
    x: skeleton_1.x + 200,
    y: skeleton_1.y,
  }
  const refline_start_right = {
    x: skeleton_3.x - 200,
    y: skeleton_3.y,
  }
  const refline_end_right = {
    x: skeleton_3.x + 200,
    y: skeleton_3.y,
  }
  const out_corner_bottom_left = FP.getIntersection(
    { type: 'line', start: refline_start_bottom, end: refline_end_bottom },
    { type: 'line', start: in_stroke2_start, end: in_stroke2_end },
  ).corner
  const out_corner_bottom_right = FP.getIntersection(
    { type: 'line', start: refline_start_bottom, end: refline_end_bottom },
    { type: 'line', start: in_stroke3_start, end: in_stroke3_end },
  ).corner
  const out_corner_left_left = FP.getIntersection(
    { type: 'line', start: refline_start_left, end: refline_end_left },
    { type: 'line', start: in_stroke1_start, end: in_stroke1_end },
  ).corner
  const out_corner_left_right = FP.getIntersection(
    { type: 'line', start: refline_start_left, end: refline_end_left },
    { type: 'line', start: out_stroke2_start, end: out_stroke2_end },
  ).corner
  const out_corner_right_left = FP.getIntersection(
    { type: 'line', start: refline_start_right, end: refline_end_right },
    { type: 'line', start: out_stroke3_start, end: out_stroke3_end },
  ).corner
  const out_corner_right_right = FP.getIntersection(
    { type: 'line', start: refline_start_right, end: refline_end_right },
    { type: 'line', start: out_stroke4_start, end: out_stroke4_end },
  ).corner

  const serif_w1 = serifSize * 100
  const serif_h1 = 100
  const serif_h2 = 20
  const serif_c1 = 20
  const serif_c2 = 20
  const stroke1_start_serif_p0 = {
    x: skeleton_1.x - serif_w1 / 2,
    y: skeleton_1.y,
  }
  const stroke1_start_serif_p1 = {
    x: skeleton_1.x + serif_w1 / 2,
    y: skeleton_1.y,
  }
  const stroke1_start_serif_p2 = {
    x: stroke1_start_serif_p0.x,
    y: stroke1_start_serif_p0.y + serif_h2,
  }
  const stroke1_start_serif_p3 = {
    x: stroke1_start_serif_p1.x,
    y: stroke1_start_serif_p1.y + serif_h2,
  }
  const stroke1_start_serif_p4 = FP.getIntersection({
    type: 'line',
    start: stroke1_start_serif_p2,
    end: stroke1_start_serif_p3,
  }, {
    type: 'line',
    start: in_stroke1_end,
    end: in_stroke1_start,
  }).corner
  const stroke1_start_serif_p5 = FP.getIntersection({
    type: 'line',
    start: stroke1_start_serif_p2,
    end: stroke1_start_serif_p3,
  }, {
    type: 'line',
    start: out_stroke1_end,
    end: out_stroke1_start,
  }).corner
  const stroke1_start_serif_p6 = FP.goStraight(in_stroke1_start, stroke1_start_serif_p4, serif_h1)
  const stroke1_start_serif_p7 = FP.goStraight(out_stroke1_start, stroke1_start_serif_p5, serif_h1)
  const stroke1_start_serif_p4_before = FP.getPointOnLine(stroke1_start_serif_p4, stroke1_start_serif_p2, serif_c1)
  const stroke1_start_serif_p4_after = FP.getPointOnLine(stroke1_start_serif_p4, stroke1_start_serif_p6, serif_c2)
  const stroke1_start_serif_p5_before = FP.getPointOnLine(stroke1_start_serif_p5, stroke1_start_serif_p3, serif_c1)
  const stroke1_start_serif_p5_after = FP.getPointOnLine(stroke1_start_serif_p5, stroke1_start_serif_p7, serif_c2)

  const stroke1_end_serif_p0 = {
    x: skeleton_0.x - serif_w1 / 2,
    y: skeleton_0.y,
  }
  const stroke1_end_serif_p1 = {
    x: skeleton_0.x + serif_w1 / 2,
    y: skeleton_0.y,
  }
  const stroke1_end_serif_p2 = {
    x: stroke1_end_serif_p0.x,
    y: stroke1_end_serif_p0.y - serif_h2,
  }
  const stroke1_end_serif_p3 = {
    x: stroke1_end_serif_p1.x,
    y: stroke1_end_serif_p1.y - serif_h2,
  }
  const stroke1_end_serif_p4 = FP.getIntersection({
    type: 'line',
    start: stroke1_end_serif_p2,
    end: stroke1_end_serif_p3,
  }, {
    type: 'line',
    start: in_stroke1_end,
    end: in_stroke1_start,
  }).corner
  const stroke1_end_serif_p5 = FP.getIntersection({
    type: 'line',
    start: stroke1_end_serif_p2,
    end: stroke1_end_serif_p3,
  }, {
    type: 'line',
    start: out_stroke1_end,
    end: out_stroke1_start,
  }).corner
  const stroke1_end_serif_p6 = FP.goStraight(in_stroke1_end, stroke1_end_serif_p4, serif_h1)
  const stroke1_end_serif_p7 = FP.goStraight(out_stroke1_end, stroke1_end_serif_p5, serif_h1)
  const stroke1_end_serif_p4_before = FP.getPointOnLine(stroke1_end_serif_p4, stroke1_end_serif_p2, serif_c1)
  const stroke1_end_serif_p4_after = FP.getPointOnLine(stroke1_end_serif_p4, stroke1_end_serif_p6, serif_c2)
  const stroke1_end_serif_p5_before = FP.getPointOnLine(stroke1_end_serif_p5, stroke1_end_serif_p3, serif_c1)
  const stroke1_end_serif_p5_after = FP.getPointOnLine(stroke1_end_serif_p5, stroke1_end_serif_p7, serif_c2)

  const stroke4_start_serif_p0 = {
    x: skeleton_3.x - serif_w1 / 2,
    y: skeleton_3.y,
  }
  const stroke4_start_serif_p1 = {
    x: skeleton_3.x + serif_w1 / 2,
    y: skeleton_3.y,
  }
  const stroke4_start_serif_p2 = {
    x: stroke4_start_serif_p0.x,
    y: stroke4_start_serif_p0.y + serif_h2,
  }
  const stroke4_start_serif_p3 = {
    x: stroke4_start_serif_p1.x,
    y: stroke4_start_serif_p1.y + serif_h2,
  }
  const stroke4_start_serif_p4 = FP.getIntersection({
    type: 'line',
    start: stroke4_start_serif_p2,
    end: stroke4_start_serif_p3,
  }, {
    type: 'line',
    start: in_stroke4_end,
    end: in_stroke4_start,
  }).corner
  const stroke4_start_serif_p5 = FP.getIntersection({
    type: 'line',
    start: stroke4_start_serif_p2,
    end: stroke4_start_serif_p3,
  }, {
    type: 'line',
    start: out_stroke4_end,
    end: out_stroke4_start,
  }).corner
  const stroke4_start_serif_p6 = FP.goStraight(in_stroke4_start, stroke4_start_serif_p4, serif_h1)
  const stroke4_start_serif_p7 = FP.goStraight(out_stroke4_start, stroke4_start_serif_p5, serif_h1)
  const stroke4_start_serif_p4_before = FP.getPointOnLine(stroke4_start_serif_p4, stroke4_start_serif_p2, serif_c1)
  const stroke4_start_serif_p4_after = FP.getPointOnLine(stroke4_start_serif_p4, stroke4_start_serif_p6, serif_c2)
  const stroke4_start_serif_p5_before = FP.getPointOnLine(stroke4_start_serif_p5, stroke4_start_serif_p3, serif_c1)
  const stroke4_start_serif_p5_after = FP.getPointOnLine(stroke4_start_serif_p5, stroke4_start_serif_p7, serif_c2)

  const stroke4_end_serif_p0 = {
    x: skeleton_4.x - serif_w1 / 2,
    y: skeleton_4.y,
  }
  const stroke4_end_serif_p1 = {
    x: skeleton_4.x + serif_w1 / 2,
    y: skeleton_4.y,
  }
  const stroke4_end_serif_p2 = {
    x: stroke4_end_serif_p0.x,
    y: stroke4_end_serif_p0.y - serif_h2,
  }
  const stroke4_end_serif_p3 = {
    x: stroke4_end_serif_p1.x,
    y: stroke4_end_serif_p1.y - serif_h2,
  }
  const stroke4_end_serif_p4 = FP.getIntersection({
    type: 'line',
    start: stroke4_end_serif_p2,
    end: stroke4_end_serif_p3,
  }, {
    type: 'line',
    start: in_stroke4_end,
    end: in_stroke4_start,
  }).corner
  const stroke4_end_serif_p5 = FP.getIntersection({
    type: 'line',
    start: stroke4_end_serif_p2,
    end: stroke4_end_serif_p3,
  }, {
    type: 'line',
    start: out_stroke4_end,
    end: out_stroke4_start,
  }).corner
  const stroke4_end_serif_p6 = FP.goStraight(in_stroke4_end, stroke4_end_serif_p4, serif_h1)
  const stroke4_end_serif_p7 = FP.goStraight(out_stroke4_end, stroke4_end_serif_p5, serif_h1)
  const stroke4_end_serif_p4_before = FP.getPointOnLine(stroke4_end_serif_p4, stroke4_end_serif_p2, serif_c1)
  const stroke4_end_serif_p4_after = FP.getPointOnLine(stroke4_end_serif_p4, stroke4_end_serif_p6, serif_c2)
  const stroke4_end_serif_p5_before = FP.getPointOnLine(stroke4_end_serif_p5, stroke4_end_serif_p3, serif_c1)
  const stroke4_end_serif_p5_after = FP.getPointOnLine(stroke4_end_serif_p5, stroke4_end_serif_p7, serif_c2)

  const pen1 = new FP.PenComponent()
  pen1.beginPath()
  if (serifType === 0) {
    pen1.moveTo(in_stroke1_start.x, in_stroke1_start.y)
    for (let i = 0; i < in_stroke1_curves.length; i++) {
      const curve = in_stroke1_curves[i]
      pen1.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
    }
    pen1.lineTo(out_stroke1_end.x, out_stroke1_end.y)
    for (let i = out_stroke1_curves.length - 1; i >= 0; i--) {
      const curve = out_stroke1_curves[i]
      pen1.bezierTo(curve.control2.x, curve.control2.y, curve.control1.x, curve.control1.y, curve.start.x, curve.start.y)
    }
    pen1.lineTo(in_stroke1_start.x, in_stroke1_start.y)
  } else if (serifType === 1) {
    pen1.moveTo(stroke1_start_serif_p1.x, stroke1_start_serif_p1.y)
    pen1.lineTo(stroke1_start_serif_p0.x, stroke1_start_serif_p0.y)
    pen1.lineTo(stroke1_start_serif_p2.x, stroke1_start_serif_p2.y)
    pen1.bezierTo(
      stroke1_start_serif_p4_before.x, stroke1_start_serif_p4_before.y,
      stroke1_start_serif_p4_after.x, stroke1_start_serif_p4_after.y,
      stroke1_start_serif_p6.x, stroke1_start_serif_p6.y,
    )
    pen1.lineTo(stroke1_end_serif_p6.x, stroke1_end_serif_p6.y)
    pen1.bezierTo(
      stroke1_end_serif_p4_after.x, stroke1_end_serif_p4_after.y,
      stroke1_end_serif_p4_before.x, stroke1_end_serif_p4_before.y,
      stroke1_end_serif_p2.x, stroke1_end_serif_p2.y,
    )
    pen1.lineTo(stroke1_end_serif_p0.x, stroke1_end_serif_p0.y)
    pen1.lineTo(stroke1_end_serif_p1.x, stroke1_end_serif_p1.y)
    pen1.lineTo(stroke1_end_serif_p3.x, stroke1_end_serif_p3.y)
    pen1.bezierTo(
      stroke1_end_serif_p5_before.x, stroke1_end_serif_p5_before.y,
      stroke1_end_serif_p5_after.x, stroke1_end_serif_p5_after.y,
      stroke1_end_serif_p7.x, stroke1_end_serif_p7.y,
    )
    pen1.lineTo(stroke1_start_serif_p7.x, stroke1_start_serif_p7.y)
    pen1.bezierTo(
      stroke1_start_serif_p5_after.x, stroke1_start_serif_p5_after.y,
      stroke1_start_serif_p5_before.x, stroke1_start_serif_p5_before.y,
      stroke1_start_serif_p3.x, stroke1_start_serif_p3.y
    )
    pen1.lineTo(stroke1_start_serif_p1.x, stroke1_start_serif_p1.y)
  }
  pen1.closePath()

  const pen2 = new FP.PenComponent()
  pen2.beginPath()
  pen2.moveTo(in_stroke2_start.x, in_stroke2_start.y)
  pen2.lineTo(out_corner_bottom_left.x, out_corner_bottom_left.y)
  pen2.lineTo(skeleton_2.x, skeleton_2.y)
  pen2.lineTo(out_stroke2_end.x, out_stroke2_end.y)
  pen2.lineTo(out_corner_left_right.x, out_corner_left_right.y)
  pen2.lineTo(skeleton_1.x, skeleton_1.y)
  pen2.lineTo(in_stroke2_start.x, in_stroke2_start.y)
  pen2.closePath()
  pen2.reversePath()

  const pen3 = new FP.PenComponent()
  pen3.beginPath()
  pen3.moveTo(in_stroke3_end.x, in_stroke3_end.y)
  pen3.lineTo(skeleton_3.x, skeleton_3.y)
  pen3.lineTo(out_corner_right_left.x, out_corner_right_left.y)
  pen3.lineTo(out_stroke3_start.x, out_stroke3_start.y)
  pen3.lineTo(skeleton_2.x, skeleton_2.y)
  pen3.lineTo(out_corner_bottom_right.x, out_corner_bottom_right.y)
  pen3.lineTo(in_stroke3_end.x, in_stroke3_end.y)
  pen3.closePath()
  pen3.reversePath()

  const pen4 = new FP.PenComponent()
  pen4.beginPath()
  if (serifType === 0) {
    pen4.moveTo(in_stroke4_start.x, in_stroke4_start.y)
    for (let i = 0; i < in_stroke4_curves.length; i++) {
      const curve = in_stroke4_curves[i]
      pen4.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
    }
    pen4.lineTo(out_stroke4_end.x, out_stroke4_end.y)
    for (let i = out_stroke4_curves.length - 1; i >= 0; i--) {
      const curve = out_stroke4_curves[i]
      pen4.bezierTo(curve.control2.x, curve.control2.y, curve.control1.x, curve.control1.y, curve.start.x, curve.start.y)
    }
    pen4.lineTo(in_stroke4_start.x, in_stroke4_start.y)
  } else if (serifType === 1) {
    pen4.moveTo(stroke4_start_serif_p1.x, stroke4_start_serif_p1.y)
    pen4.lineTo(stroke4_start_serif_p0.x, stroke4_start_serif_p0.y)
    pen4.lineTo(stroke4_start_serif_p2.x, stroke4_start_serif_p2.y)
    pen4.bezierTo(
      stroke4_start_serif_p4_before.x, stroke4_start_serif_p4_before.y,
      stroke4_start_serif_p4_after.x, stroke4_start_serif_p4_after.y,
      stroke4_start_serif_p6.x, stroke4_start_serif_p6.y,
    )
    pen4.lineTo(stroke4_end_serif_p6.x, stroke4_end_serif_p6.y)
    pen4.bezierTo(
      stroke4_end_serif_p4_after.x, stroke4_end_serif_p4_after.y,
      stroke4_end_serif_p4_before.x, stroke4_end_serif_p4_before.y,
      stroke4_end_serif_p2.x, stroke4_end_serif_p2.y,
    )
    pen4.lineTo(stroke4_end_serif_p0.x, stroke4_end_serif_p0.y)
    pen4.lineTo(stroke4_end_serif_p1.x, stroke4_end_serif_p1.y)
    pen4.lineTo(stroke4_end_serif_p3.x, stroke4_end_serif_p3.y)
    pen4.bezierTo(
      stroke4_end_serif_p5_before.x, stroke4_end_serif_p5_before.y,
      stroke4_end_serif_p5_after.x, stroke4_end_serif_p5_after.y,
      stroke4_end_serif_p7.x, stroke4_end_serif_p7.y,
    )
    pen4.lineTo(stroke4_start_serif_p7.x, stroke4_start_serif_p7.y)
    pen4.bezierTo(
      stroke4_start_serif_p5_after.x, stroke4_start_serif_p5_after.y,
      stroke4_start_serif_p5_before.x, stroke4_start_serif_p5_before.y,
      stroke4_start_serif_p3.x, stroke4_start_serif_p3.y
    )
    pen4.lineTo(stroke4_start_serif_p1.x, stroke4_start_serif_p1.y)
  }
  pen4.closePath()

  return [ pen1, pen2, pen3, pen4 ]
}

updateGlyphByParams(params, global_params)