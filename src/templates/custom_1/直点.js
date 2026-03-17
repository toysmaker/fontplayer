const updateParamsByJoints = (params, glyph) => {
  const {
    horizontalSpan,
    verticalSpan,
  } = params
  glyph.setParam('水平延伸', horizontalSpan)
  glyph.setParam('竖直延伸', verticalSpan)
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
  const vertical_span_range = glyph.getParamRange('竖直延伸')
  const horizontalSpan = range(end.x - start.x, horizontal_span_range)
  const verticalSpan = range(end.y - start.y, vertical_span_range)
  return {
    horizontalSpan,
    verticalSpan,
  }
}

export { updateParamsByJoints, computeParamsByJoints }
