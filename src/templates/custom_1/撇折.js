const updateParamsByJoints = (params, glyph) => {
  const {
    pie_horizontalSpan,
    pie_verticalSpan,
    zhe_horizontalSpan,
  } = params
  glyph.setParam('撇-水平延伸', pie_horizontalSpan)
  glyph.setParam('撇-竖直延伸', pie_verticalSpan)
  glyph.setParam('折-水平延伸', zhe_horizontalSpan)
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
  const { pie_start, pie_end, pie_bend, zhe_start, zhe_end } = jointsMap
  const weight = glyph.getParam('字重') * glyph.getParam('字重比率') || 40
  const pie_horizontal_span_range = glyph.getParamRange('撇-水平延伸')
  const pie_vertical_span_range = glyph.getParamRange('撇-竖直延伸')
  const zhe_horizontal_span_range = glyph.getParamRange('折-水平延伸')
  const pie_horizontalSpan = range(Math.abs(pie_start.x - pie_end.x) - weight * 0.5, pie_horizontal_span_range)
  const pie_verticalSpan = range(Math.abs(pie_end.y - pie_start.y) - weight * 0.5, pie_vertical_span_range)
  const zhe_horizontalSpan = range(Math.abs(zhe_start.x - zhe_end.x), zhe_horizontal_span_range)
  return {
    pie_horizontalSpan,
    pie_verticalSpan,
    zhe_horizontalSpan,
  }
}

export { updateParamsByJoints, computeParamsByJoints }
