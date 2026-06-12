const updateParamsByJoints = (params, glyph) => {
  const {
    horizontalSpan,
  } = params
  glyph.setParam('水平延伸', horizontalSpan)
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
  const { start, end } = jointsMap
  const horizontalSpan_range = glyph.getParamRange('水平延伸')
  const horizontalSpan = range(end.x - start.x, horizontalSpan_range)
  return {
    horizontalSpan,
    skeletonRefPos: glyph.getParam('参考位置'),
  }
}

export { updateParamsByJoints, computeParamsByJoints }
