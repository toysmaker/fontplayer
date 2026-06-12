const updateParamsByJoints = (params, glyph) => {
  const {
    pie_horizontalSpan,
    pie_verticalSpan,
    dian_horizontalSpan,
    dian_verticalSpan,
  } = params
  glyph.setParam('撇-水平延伸', pie_horizontalSpan)
  glyph.setParam('撇-竖直延伸', pie_verticalSpan)
  glyph.setParam('点-水平延伸', dian_horizontalSpan)
  glyph.setParam('点-竖直延伸', dian_verticalSpan)
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
  const { pie_start, pie_bend, pie_end, dian_start, dian_bend, dian_end } = jointsMap
  const pie_horizontal_span_range = glyph.getParamRange('撇-水平延伸')
  const pie_vertical_span_range = glyph.getParamRange('撇-竖直延伸')
  const dian_horizontal_span_range = glyph.getParamRange('点-水平延伸')
  const dian_vertical_span_range = glyph.getParamRange('点-竖直延伸')
  const pie_horizontalSpan = range(pie_start.x - pie_end.x, pie_horizontal_span_range)
  const pie_verticalSpan = range(pie_end.y - pie_start.y, pie_vertical_span_range)
  const dian_horizontalSpan = range(dian_end.x - dian_start.x, dian_horizontal_span_range)
  const dian_verticalSpan = range(dian_end.y - dian_start.y, dian_vertical_span_range)
  return {
    pie_horizontalSpan,
    pie_verticalSpan,
    dian_horizontalSpan,
    dian_verticalSpan,
  }
}

export { updateParamsByJoints, computeParamsByJoints }
