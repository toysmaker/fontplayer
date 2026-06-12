const updateParamsByJoints = (params, glyph) => {
  const {
    shu_verticalSpan,
    wan_length,
  } = params
  glyph.setParam('竖-竖直延伸', shu_verticalSpan)
  glyph.setParam('弯-长度', wan_length)
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
  const { shu_start, shu_end, wan_start, wan_end } = jointsMap
  const shu_vertical_span_range = glyph.getParamRange('竖-竖直延伸')
  const wan_length_range = glyph.getParamRange('弯-长度')
  const shu_verticalSpan = range(shu_end.y - shu_start.y, shu_vertical_span_range)
  const wan_length = range(wan_end.x - wan_start.x, wan_length_range)
  return {
    shu_verticalSpan,
    wan_length,
    skeletonRefPos: glyph.getParam('参考位置'),
  }
}

export { updateParamsByJoints, computeParamsByJoints }
