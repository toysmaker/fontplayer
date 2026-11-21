const params = {
  h1: glyph.getParam('h1'),
  h2: glyph.getParam('h2'),
  h3: glyph.getParam('h3'),
  w1: glyph.getParam('w1'),
  w2: glyph.getParam('w2'),
}
const global_params = {
  weight: glyph.getParam('字重') || 40,
  serifType: glyph.getParam('衬线类型') || 0,
  serifSize: glyph.getParam('衬线大小') || 2.0,
  pressure: glyph.getParam('笔压') ?? 1,
}
const ascender = 800
const descender = -200
const width = 360
const xHeight = 500
const capitalHeight = 750
const ox = 500
const oy = 500
const x0 = 500 + width / 2 - (params.w1 - params.w2)
const y0 = ascender - capitalHeight

const getJointsMap = (data) => {
  const { draggingJoint, deltaX, deltaY } = data
  const jointsMap = Object.assign({}, glyph.tempData)
  switch (draggingJoint.name) {
    case 'skeleton_1': {
      jointsMap['skeleton_1'] = {
        x: glyph.tempData['skeleton_1'].x + deltaX,
        y: glyph.tempData['skeleton_1'].y + deltaY,
      }
      jointsMap['skeleton_2'] = {
        x: glyph.tempData['skeleton_2'].x,
        y: glyph.tempData['skeleton_2'].y + deltaY,
      }
      break
    }
    case 'skeleton_2': {
      jointsMap['skeleton_1'] = {
        x: glyph.tempData['skeleton_1'].x,
        y: glyph.tempData['skeleton_1'].y + deltaY,
      }
      jointsMap['skeleton_2'] = {
        x: glyph.tempData['skeleton_2'].x + deltaX,
        y: glyph.tempData['skeleton_2'].y + deltaY,
      }
      break
    }
    case 'skeleton_3': {
      jointsMap['skeleton_3'] = {
        x: glyph.tempData['skeleton_3'].x,
        y: glyph.tempData['skeleton_3'].y + deltaY,
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
  glyph.setParam('w2', _params.w2)
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
  const { skeleton_0, skeleton_1, skeleton_2, skeleton_3, skeleton_4 } = jointsMap
  const h1_range = glyph.getParamRange('h1')
  const h2_range = glyph.getParamRange('h2')
  const w1_range = glyph.getParamRange('w1')
  const w2_range = glyph.getParamRange('w2')
  const h3_range = glyph.getParamRange('h3')
  const h1 = range(skeleton_4.y - skeleton_0.y, h1_range)
  const h2 = range(skeleton_1.y - skeleton_0.y, h2_range)
  const w1 = range(skeleton_2.x - skeleton_1.x, w1_range)
  const w2 = range(skeleton_3.x - skeleton_1.x, w2_range)
  const h3 = range(skeleton_3.y - skeleton_0.y, h3_range)
  return {
    h1,
    h2,
    h3,
    w1,
    w2,
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
  const { h1, h2, h3, w1, w2 } = params
  const { weight } = global_params

  const skeleton_0 = new FP.Joint('skeleton_0', {
    x: x0,
    y: y0,
  })
  const skeleton_1 = new FP.Joint('skeleton_1', {
    x: skeleton_0.x - w2,
    y: skeleton_0.y + h2,
  })
  const skeleton_2 = new FP.Joint('skeleton_2', {
    x: skeleton_1.x + w1,
    y: skeleton_1.y,
  })
  const skeleton_3 = new FP.Joint('skeleton_3', {
    x: skeleton_0.x,
    y: skeleton_0.y + h3,
  })
  const skeleton_4 = new FP.Joint('skeleton_4', {
    x: skeleton_3.x,
    y: skeleton_0.y + h1,
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
  glyph.addRefLine(refline(skeleton_1, skeleton_0))
  glyph.addRefLine(refline(skeleton_2, skeleton_1))
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
  const { weight, serifType, serifSize, pressure } = global_params

  // 根据骨架计算轮廓关键点
  const { skeleton_0, skeleton_1, skeleton_2, skeleton_3, skeleton_4 } = skeleton

  // 直线笔画同样走带笔压的轮廓管线（起收笔满、中段减细）
  const pressureOpts = (w) => ({
    weightsVariation: 'bezier',
    weightsVariationFnType: 'heitiPressureStraight',
    startWeight: w,
    endWeight: w * (1 + 0.25 * pressure),
  })
  // 顶点与圆顶数字视觉对齐：斜笔起笔上移 21（切面角点原在 31，上移至 10 ≈ cap 线上方 0.5×字重）
  // 斜笔仅顶点（自由端）加粗，收尾（接交叉横处）保持原始字重等宽衔接
  const { out_stroke1_curves, in_stroke1_curves } = FP.getLineContours2('stroke1', { stroke1_start: { x: skeleton_0.x, y: skeleton_0.y - 21 }, stroke1_end: skeleton_1 }, weight, {
    weightsVariation: 'bezier',
    weightsVariationFnType: 'heitiPressureStraightStart',
    startWeight: weight,
    endWeight: weight * (1 + 0.25 * pressure),
  })
  // 交叉横使用原始字重（细处宽度 = 原始字重）
  const horizontalWeight = weight
  const _stroke2_contours = FP.getLineContours2('stroke2', { stroke2_start: skeleton_1, stroke2_end: skeleton_2 }, horizontalWeight, {
    weightsVariation: 'bezier',
    weightsVariationFnType: 'heitiPressureStraight',
    startWeight: horizontalWeight,
    endWeight: horizontalWeight * (1 + 0.25 * pressure),
  })
  // 短笔画用紧拟合（容差 1.5），防止拟合曲线把压笔形状吃掉
  const out_stroke2_curves = FP.fitCurvesByPoints(_stroke2_contours.out_stroke2_points, 1.5).curves
  const in_stroke2_curves = FP.fitCurvesByPoints(_stroke2_contours.in_stroke2_points, 1.5).curves
  // 竖干顶与斜笔同步上移 21，保持豁口（h3）不变；
  // 上端与斜笔衔接处保持原始字重，仅底部（收笔侧）捺式加粗
  const { out_stroke3_curves, in_stroke3_curves } = FP.getLineContours2('stroke3', { stroke3_start: { x: skeleton_3.x, y: skeleton_3.y - 21 }, stroke3_end: skeleton_4 }, weight, {
    weightsVariation: 'bezier',
    weightsVariationFnType: 'heitiPressureEnd',
    startWeight: weight,
    endWeight: weight * (1 + 0.25 * pressure),
  })

  const out_stroke1_start = out_stroke1_curves[0].start
  const out_stroke1_end = out_stroke1_curves[out_stroke1_curves.length - 1].end
  const in_stroke1_start = in_stroke1_curves[0].start
  const in_stroke1_end = in_stroke1_curves[in_stroke1_curves.length - 1].end
  const out_stroke2_start = out_stroke2_curves[0].start
  const out_stroke2_end = out_stroke2_curves[out_stroke2_curves.length - 1].end
  const in_stroke2_start = in_stroke2_curves[0].start
  const in_stroke2_end = in_stroke2_curves[in_stroke2_curves.length - 1].end
  const out_stroke3_start = out_stroke3_curves[0].start
  const out_stroke3_end = out_stroke3_curves[out_stroke3_curves.length - 1].end
  const in_stroke3_start = in_stroke3_curves[0].start
  const in_stroke3_end = in_stroke3_curves[in_stroke3_curves.length - 1].end

  const corner_bottom = {
    x: in_stroke1_end.x,
    y: in_stroke2_start.y,
  }
  const corner_top = FP.getIntersection(
    { type: 'line', start: corner_bottom, end: { x: corner_bottom.x, y: corner_bottom.y - 100 } },
    { type: 'line', start: in_stroke1_start, end: in_stroke1_end },
  ).corner

  const refline_start = in_stroke3_start
  const refline_end = out_stroke3_start

  const corner = FP.getIntersection(
    { type: 'line', start: refline_start, end: refline_end },
    { type: 'line', start: in_stroke1_start, end: in_stroke1_end },
  ).corner


  // 创建钢笔组件
  const pen1 = new FP.PenComponent()
  if (skeleton_3.y === skeleton_0.y) {
    pen1.beginPath()
    pen1.moveTo(out_stroke1_start.x, out_stroke1_start.y)
    for (let i = 0; i < out_stroke1_curves.length; i++) {
      const curve = out_stroke1_curves[i]
      pen1.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
    }
    pen1.lineTo(skeleton_1.x, skeleton_1.y)
    pen1.lineTo(corner_top.x, corner_top.y)
    pen1.lineTo(corner.x, corner.y)
    pen1.lineTo(skeleton_0.x, skeleton_0.y)
    pen1.lineTo(out_stroke1_start.x, out_stroke1_start.y)
    pen1.closePath()
  } else {
    pen1.beginPath()
    pen1.moveTo(out_stroke1_start.x, out_stroke1_start.y)
    for (let i = 0; i < out_stroke1_curves.length; i++) {
      const curve = out_stroke1_curves[i]
      pen1.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
    }
    pen1.lineTo(skeleton_1.x, skeleton_1.y)
    pen1.lineTo(corner_top.x, corner_top.y)
    for (let i = in_stroke1_curves.length - 1; i >= 0; i--) {
      const curve = in_stroke1_curves[i]
      pen1.bezierTo(curve.control2.x, curve.control2.y, curve.control1.x, curve.control1.y, curve.start.x, curve.start.y)
    }
    pen1.lineTo(out_stroke1_start.x, out_stroke1_start.y)
    pen1.closePath()
  }

  const pen2 = new FP.PenComponent()
  pen2.beginPath()
  pen2.moveTo(corner_top.x, corner_top.y)
  pen2.lineTo(skeleton_1.x, skeleton_1.y)
  pen2.lineTo(out_stroke2_start.x, out_stroke2_start.y)
  for (let i = 0; i < out_stroke2_curves.length; i++) {
    const curve = out_stroke2_curves[i]
    pen2.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
  }
  pen2.lineTo(in_stroke2_end.x, in_stroke2_end.y)
  for (let i = in_stroke2_curves.length - 1; i >= 0; i--) {
    const curve = in_stroke2_curves[i]
    pen2.bezierTo(curve.control2.x, curve.control2.y, curve.control1.x, curve.control1.y, curve.start.x, curve.start.y)
  }
  pen2.lineTo(corner_bottom.x, corner_bottom.y)
  pen2.lineTo(corner_top.x, corner_top.y)
  pen2.closePath()

  const pen3 = new FP.PenComponent()
  pen3.beginPath()
  pen3.moveTo(out_stroke3_start.x, out_stroke3_start.y)
  for (let i = 0; i < out_stroke3_curves.length; i++) {
    const curve = out_stroke3_curves[i]
    pen3.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
  }
  pen3.lineTo(in_stroke3_end.x, in_stroke3_end.y)
  for (let i = in_stroke3_curves.length - 1; i >= 0; i--) {
    const curve = in_stroke3_curves[i]
    pen3.bezierTo(curve.control2.x, curve.control2.y, curve.control1.x, curve.control1.y, curve.start.x, curve.start.y)
  }
  pen3.lineTo(out_stroke3_start.x, out_stroke3_start.y)
  pen3.closePath()

  return [ pen1, pen2, pen3 ]
}

updateGlyphByParams(params, global_params)