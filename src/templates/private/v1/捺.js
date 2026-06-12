const updateParamsByJoints = (params, glyph) => {
  const {
    horizontalSpan,
    verticalSpan,
    bendCursor,
    bendDegree,
  } = params
  glyph.setParam('水平延伸', horizontalSpan)
  glyph.setParam('竖直延伸', verticalSpan)
  glyph.setParam('弯曲游标', bendCursor)
  glyph.setParam('弯曲度', bendDegree)
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
  const horizontal_span_range = glyph.getParamRange('水平延伸')
  const vertical_span_range = glyph.getParamRange('竖直延伸')
  const bend_cursor_range = glyph.getParamRange('弯曲游标')
  const bend_degree_range = glyph.getParamRange('弯曲度')
  const horizontalSpan = range(end.x - start.x, horizontal_span_range)
  const verticalSpan = range(end.y - start.y, vertical_span_range)
  const data = FP.distanceAndFootPoint(start, end, bend)
  const bendCursor = range(data.percentageFromA, bend_cursor_range)
  const bendDegree = range(data.distance, bend_degree_range)
  return {
    horizontalSpan,
    verticalSpan,
    bendCursor,
    bendDegree,
  }
}

export { updateParamsByJoints, computeParamsByJoints }
