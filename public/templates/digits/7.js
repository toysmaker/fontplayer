const params = {
  h1: glyph.getParam('h1'),
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
const x0 = 500 - width / 2
const y0 = ascender - capitalHeight

const getJointsMap = (data) => {
  const { draggingJoint, deltaX, deltaY } = data
  const jointsMap = Object.assign({}, glyph.tempData)
  switch (draggingJoint.name) {
    case 'skeleton_1': {
      jointsMap['skeleton_1'] = {
        x: glyph.tempData['skeleton_1'].x + deltaX,
        y: glyph.tempData['skeleton_1'].y,
      }
      break
    }
    case 'skeleton_2': {
      jointsMap['skeleton_2'] = {
        x: glyph.tempData['skeleton_2'].x + deltaX,
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
  const { skeleton_0, skeleton_1, skeleton_2 } = jointsMap
  const h1_range = glyph.getParamRange('h1')
  const w1_range = glyph.getParamRange('w1')
  const w2_range = glyph.getParamRange('w2')
  const h1 = range(skeleton_2.y - skeleton_0.y, h1_range)
  const w1 = range(skeleton_1.x - skeleton_0.x, w1_range)
  const w2 = range(skeleton_1.x - skeleton_2.x, w2_range)
  return {
    w1,
    w2,
    h1,
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
  const { h1, w1, w2 } = params
  const { weight } = global_params

  const skeleton_0 = new FP.Joint('skeleton_0', {
    x: x0,
    y: y0,
  })
  const skeleton_1 = new FP.Joint('skeleton_1', {
    x: skeleton_0.x + w1,
    // 骨架两端保持同一水平线（顶横上缘压 cap 线）
    y: skeleton_0.y,
  })
  const skeleton_2 = new FP.Joint('skeleton_2', {
    x: skeleton_1.x - w2,
    y: skeleton_1.y + h1,
  })
  const skeleton = {
    skeleton_0,
    skeleton_1,
    skeleton_2,
  }
  
  glyph.addJoint(skeleton_0)
  glyph.addJoint(skeleton_1)
  glyph.addJoint(skeleton_2)
  glyph.addRefLine(refline(skeleton_1, skeleton_0))
  glyph.addRefLine(refline(skeleton_2, skeleton_1))

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
  const { skeleton_0, skeleton_1, skeleton_2 } = skeleton

  // out指上侧（外侧）轮廓线
  // in指下侧（内侧）轮廓线
  // 视错修正：顶横视觉显粗 → 比竖画略细（0.9 倍字重），且顶横上缘压在 cap 线上（骨架下移半个横画宽）
  const horizontalWeight = weight * 0.9
  // 直线笔画同样走带笔压的轮廓管线（起收笔满、中段减细）
  const pressureOpts = (w) => ({
    weightsVariation: 'bezier',
    weightsVariationFnType: 'heitiPressureStraight',
    startWeight: w,
    endWeight: w * (1 + 0.25 * pressure),
  })
  // 顶横轮廓：平顶与圆顶视觉对齐——上缘 = 上层骨架上方再加 0.5×字重（轮廓顶至 cap 线上方 40）
  // 短笔画用紧拟合（容差 1.5），防止拟合曲线把压笔形状吃掉
  const _stroke1_contours = FP.getLineContours2('stroke1', {
    stroke1_start: { x: skeleton_0.x, y: y0 - weight / 2 + horizontalWeight / 2 },
    stroke1_end: { x: skeleton_1.x, y: y0 - weight / 2 + horizontalWeight / 2 },
  }, horizontalWeight, pressureOpts(horizontalWeight))
  const out_stroke1_curves = FP.fitCurvesByPoints(_stroke1_contours.out_stroke1_points, 1.5).curves
  const in_stroke1_curves = FP.fitCurvesByPoints(_stroke1_contours.in_stroke1_points, 1.5).curves
  // 斜笔自然从骨架点起笔（不藏笔头），笔压起收笔快速变化、中段缓动
  const { out_stroke2_curves, in_stroke2_curves } = FP.getLineContours2('stroke2', {
    stroke2_start: skeleton_1,
    stroke2_end: skeleton_2,
  }, weight, pressureOpts(weight))

  const out_stroke1_start = out_stroke1_curves[0].start
  const out_stroke1_end = out_stroke1_curves[out_stroke1_curves.length - 1].end
  const in_stroke1_start = in_stroke1_curves[0].start
  const in_stroke1_end = in_stroke1_curves[in_stroke1_curves.length - 1].end
  const out_stroke2_start = out_stroke2_curves[0].start
  const out_stroke2_end = out_stroke2_curves[out_stroke2_curves.length - 1].end
  const in_stroke2_start = in_stroke2_curves[0].start
  const in_stroke2_end = in_stroke2_curves[in_stroke2_curves.length - 1].end

  const corner_top = {
    x: out_stroke2_start.x,
    y: out_stroke1_end.y,
  }
  const corner_bottom = FP.getIntersection(
    { type: 'line', start: corner_top, end: { x: corner_top.x, y: corner_top.y + 100 } },
    { type: 'curve', points: FP.getCurvesPoints(out_stroke2_curves) },
  ).corner

  const pen1 = new FP.PenComponent()
  pen1.beginPath()
  pen1.moveTo(out_stroke1_start.x, out_stroke1_start.y)
  for (let i = 0; i < out_stroke1_curves.length; i++) {
    const curve = out_stroke1_curves[i]
    pen1.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
  }
  pen1.lineTo(corner_bottom.x, corner_bottom.y)
  pen1.lineTo(skeleton_1.x, skeleton_1.y)
  for (let i = in_stroke1_curves.length - 1; i >= 0; i--) {
    const curve = in_stroke1_curves[i]
    pen1.bezierTo(curve.control2.x, curve.control2.y, curve.control1.x, curve.control1.y, curve.start.x, curve.start.y)
  }
  pen1.lineTo(out_stroke1_start.x, out_stroke1_start.y)
  pen1.closePath()

  const pen2 = new FP.PenComponent()
  pen2.beginPath()
  pen2.moveTo(corner_bottom.x, corner_bottom.y)
  for (let i = 0; i < out_stroke2_curves.length; i++) {
    const curve = out_stroke2_curves[i]
    pen2.bezierTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.end.x, curve.end.y)
  }
  pen2.lineTo(in_stroke2_end.x, in_stroke2_end.y)
  for (let i = in_stroke2_curves.length - 1; i >= 0; i--) {
    const curve = in_stroke2_curves[i]
    pen2.bezierTo(curve.control2.x, curve.control2.y, curve.control1.x, curve.control1.y, curve.start.x, curve.start.y)
  }
  pen2.lineTo(skeleton_1.x, skeleton_1.y)
  pen2.lineTo(corner_bottom.x, corner_bottom.y)
  pen2.closePath()

  return [ pen1, pen2 ]
}

updateGlyphByParams(params, global_params)