const updateParamsByJoints = (params, glyph) => {
  const {
    heng_horizontalSpan,
    zhe_verticalSpan,
    wan_length,
  } = params
  glyph.setParam('横-水平延伸', heng_horizontalSpan)
  glyph.setParam('折-竖直延伸', zhe_verticalSpan)
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
  const { heng_start, heng_end, zhe_start, zhe_end, wan_start, wan_end } = jointsMap
  const heng_horizontalSpan_range = glyph.getParamRange('横-水平延伸')
  const zhe_verticalSpan_range = glyph.getParamRange('折-竖直延伸')
  const wan_length_range = glyph.getParamRange('弯-长度')
  const heng_horizontalSpan = range(heng_end.x - heng_start.x, heng_horizontalSpan_range)
  const zhe_verticalSpan = range(zhe_end.y - zhe_start.y, zhe_verticalSpan_range)
  const wan_length = range(wan_end.x - wan_start.x, wan_length_range)
  return {
    heng_horizontalSpan,
    zhe_verticalSpan,
    wan_length,
    skeletonRefPos: glyph.getParam('参考位置'),
  }
}

export { updateParamsByJoints, computeParamsByJoints }
