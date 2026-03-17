const updateParamsByJoints = (params, glyph) => {
  const {
    shu_verticalSpan,
    zhe_horizontalSpan,
  } = params
  glyph.setParam('竖-竖直延伸', shu_verticalSpan)
  glyph.setParam('折-水平延伸', zhe_horizontalSpan)
}

const range = (value, range) => {
  if (value < range.min) {
    return range.min
  } else if (value > range.max) {
    return range.max
  }
  return value
}

const computeParamsByJoints = (jointsMap, glyph) => {
  const { shu_start, shu_end, zhe_start, zhe_end } = jointsMap
  const shu_vertical_span_range = glyph.getParamRange('竖-竖直延伸')
  const zhe_horizontal_span_range = glyph.getParamRange('折-水平延伸')
  const shu_verticalSpan = range(shu_end.y - shu_start.y, shu_vertical_span_range)
  const zhe_horizontalSpan = range(zhe_end.x - zhe_start.x, zhe_horizontal_span_range)
  return {
    shu_verticalSpan,
    zhe_horizontalSpan,
    skeletonRefPos: glyph.getParam('参考位置'),
  }
}

export { updateParamsByJoints, computeParamsByJoints }
