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
  const horizontal_span_range = glyph.getParamRange('水平延伸')
  const horizontalSpan = range(end.x - start.x, horizontal_span_range)
  return {
    horizontalSpan,
  }
}

export { updateParamsByJoints, computeParamsByJoints }
