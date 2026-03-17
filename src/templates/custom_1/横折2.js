const updateParamsByJoints = (params, glyph) => {
  const {
    heng_horizontalSpan,
    zhe_length,
  } = params
  glyph.setParam('横-水平延伸', heng_horizontalSpan)
  glyph.setParam('折-长度', zhe_length)
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
  const { heng_start, heng_end, zhe_start, zhe_end } = jointsMap
  const heng_horizontalSpan_range = glyph.getParamRange('横-水平延伸')
  const zhe_length_range = glyph.getParamRange('折-长度')
  const heng_horizontalSpan = range(heng_end.x - heng_start.x, heng_horizontalSpan_range)
  const zhe_length = range(zhe_end.y - zhe_start.y, zhe_length_range)
  return {
    heng_horizontalSpan,
    zhe_length,
    skeletonRefPos: glyph.getParam('参考位置'),
  }
}

export { updateParamsByJoints, computeParamsByJoints }
