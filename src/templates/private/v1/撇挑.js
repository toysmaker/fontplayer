const updateParamsByJoints = (params, glyph) => {
  const {
    pie_horizontalSpan,
    pie_verticalSpan,
    tiao_horizontalSpan,
  } = params
  glyph.setParam('撇-水平延伸', pie_horizontalSpan)
  glyph.setParam('撇-竖直延伸', pie_verticalSpan)
  glyph.setParam('挑-水平延伸', tiao_horizontalSpan)
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
  const { pie_start, pie_end, tiao_start, tiao_end } = jointsMap
  const pie_horizontal_span_range = glyph.getParamRange('撇-水平延伸')
  const pie_vertical_span_range = glyph.getParamRange('撇-竖直延伸')
  const tiao_horizontal_span_range = glyph.getParamRange('挑-水平延伸')
  const pie_horizontalSpan = range(pie_start.x - pie_end.x, pie_horizontal_span_range)
  const pie_verticalSpan = range(pie_end.y - pie_start.y, pie_vertical_span_range)
  const tiao_horizontalSpan = range(tiao_end.x - tiao_start.x, tiao_horizontal_span_range)
  return {
    pie_horizontalSpan,
    pie_verticalSpan,
    tiao_horizontalSpan,
  }
}

export { updateParamsByJoints, computeParamsByJoints }
