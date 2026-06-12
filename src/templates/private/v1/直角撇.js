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
  const { start, end, bend } = jointsMap
  const weight = glyph.getParam('字重') * glyph.getParam('字重比率') || 40
  const horizontal_span_range = glyph.getParamRange('水平延伸')
  const vertical_span_range = glyph.getParamRange('竖直延伸')
  const horizontalSpan = range(Math.abs(end.x - bend.x) - weight * 0.5, horizontal_span_range)
  const verticalSpan = range(Math.abs(end.y - start.y) - weight * 0.5, vertical_span_range)
  return {
    horizontalSpan,
    verticalSpan,
  }
}

export { updateParamsByJoints, computeParamsByJoints }
