const updateParamsByJoints = (params, glyph) => {
  const {
    heng_horizontalSpan,
    pie_horizontalSpan,
    pie_verticalSpan,
  } = params
  glyph.setParam('横-水平延伸', heng_horizontalSpan)
  glyph.setParam('撇-水平延伸', pie_horizontalSpan)
  glyph.setParam('撇-竖直延伸', pie_verticalSpan)
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
  const { heng_start, heng_end, pie_start, pie_bend, pie_end } = jointsMap
  const weight = glyph.getParam('字重') * glyph.getParam('字重比率') || 40
  const heng_horizontalSpan_range = glyph.getParamRange('横-水平延伸')
  const pie_horizontal_span_range = glyph.getParamRange('撇-水平延伸')
  const pie_vertical_span_range = glyph.getParamRange('撇-竖直延伸')
  const heng_horizontalSpan = range(heng_end.x - heng_start.x, heng_horizontalSpan_range)
  const pie_horizontalSpan = range(pie_start.x - pie_end.x - weight * 0.5, pie_horizontal_span_range)
  const pie_verticalSpan = range(pie_end.y - pie_start.y, pie_vertical_span_range)
  return {
    heng_horizontalSpan,
    pie_horizontalSpan,
    pie_verticalSpan,
  }
}

export { updateParamsByJoints, computeParamsByJoints }
