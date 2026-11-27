const updateParamsByJoints = (params, glyph) => {
  const {
    heng_horizontalSpan,
    heng_verticalSpan,
    zhe_horizontalSpan,
    zhe_verticalSpan,
    zhe_bendCursor,
    zhe_bendDegree,
    wan_length,
    gou_horizontalSpan,
    gou_verticalSpan,
  } = params
  glyph.setParam('横-水平延伸', heng_horizontalSpan)
  glyph.setParam('横-竖直延伸', heng_verticalSpan)
  glyph.setParam('折-水平延伸', zhe_horizontalSpan)
  glyph.setParam('折-竖直延伸', zhe_verticalSpan)
  glyph.setParam('折-弯曲游标', zhe_bendCursor)
  glyph.setParam('折-弯曲度', zhe_bendDegree - 30 * Number(glyph.getParam('弯曲程度') || 1))
  glyph.setParam('弯-长度', wan_length)
  glyph.setParam('钩-水平延伸', gou_horizontalSpan)
  glyph.setParam('钩-竖直延伸', gou_verticalSpan)
}

const range = (value, range) => {
  if (value < range.min) {
    return range.min
  } else if (value > range.max) {
    return range.max
  }
  return value
}

// 与 FP.distanceAndFootPoint 语义一致：C 到 AB 直线的垂足比例与垂直距离
const distanceAndFootPoint = (A, B, C) => {
  const dxAB = B.x - A.x
  const dyAB = B.y - A.y
  const length2 = dxAB * dxAB + dyAB * dyAB
  const t = length2 > 0 ? ((C.x - A.x) * dxAB + (C.y - A.y) * dyAB) / length2 : 0
  const percentageFromA = Math.min(1, Math.max(0, t))
  const footPoint = {
    x: A.x + dxAB * percentageFromA,
    y: A.y + dyAB * percentageFromA,
  }
  return {
    percentageFromA,
    distance: Math.sqrt((C.x - footPoint.x) ** 2 + (C.y - footPoint.y) ** 2),
  }
}

const computeParamsByJoints = (jointsMap, glyph) => {
  const { heng_start, heng_end, zhe_start, zhe_end, zhe_bend, wan_start, wan_end, gou_start, gou_end } = jointsMap
  const heng_horizontalSpan = range(heng_end.x - heng_start.x, glyph.getParamRange('横-水平延伸'))
  const heng_verticalSpan = range(heng_start.y - heng_end.y, glyph.getParamRange('横-竖直延伸'))
  const zhe_horizontalSpan = range(zhe_start.x - zhe_end.x, glyph.getParamRange('折-水平延伸'))
  const zhe_verticalSpan = range(zhe_end.y - zhe_start.y, glyph.getParamRange('折-竖直延伸'))
  const zhe_data = distanceAndFootPoint(zhe_start, zhe_end, zhe_bend)
  const zhe_bendCursor = range(zhe_data.percentageFromA, glyph.getParamRange('折-弯曲游标'))
  const zhe_bendDegree = range(zhe_data.distance, glyph.getParamRange('折-弯曲度'))
  const wan_length = range(wan_end.x - wan_start.x, glyph.getParamRange('弯-长度'))
  const gou_horizontalSpan = range(gou_end.x - gou_start.x, glyph.getParamRange('钩-水平延伸'))
  const gou_verticalSpan = range(gou_start.y - gou_end.y, glyph.getParamRange('钩-竖直延伸'))
  return {
    heng_horizontalSpan,
    heng_verticalSpan,
    zhe_horizontalSpan,
    zhe_verticalSpan,
    zhe_bendCursor,
    zhe_bendDegree,
    wan_length,
    gou_horizontalSpan,
    gou_verticalSpan,
    skeletonRefPos: glyph.getParam('参考位置'),
  }
}

export { updateParamsByJoints, computeParamsByJoints }
