const updateParamsByJoints = (params, glyph) => {
  const {
    heng_horizontalSpan,
    zhe1_horizontalSpan,
    zhe1_verticalSpan,
    zhe2_horizontalSpan,
    pie_horizontalSpan,
    pie_verticalSpan,
  } = params
  glyph.setParam('横-水平延伸', heng_horizontalSpan)
  glyph.setParam('折1-水平延伸', zhe1_horizontalSpan)
  glyph.setParam('折1-竖直延伸', zhe1_verticalSpan)
  glyph.setParam('折2-水平延伸', zhe2_horizontalSpan)
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
  const { heng_start, heng_end, zhe1_start, zhe1_end, zhe2_start, zhe2_end, pie_start, pie_bend, pie_end } = jointsMap
  const weight = glyph.getParam('字重') * glyph.getParam('字重比率') || 40
  const heng_horizontalSpan_range = glyph.getParamRange('横-水平延伸')
  const zhe1_horizontal_span_range = glyph.getParamRange('折1-水平延伸')
  const zhe1_vertical_span_range = glyph.getParamRange('折1-竖直延伸')
  const zhe2_horizontal_span_range = glyph.getParamRange('折2-水平延伸')
  const pie_horizontal_span_range = glyph.getParamRange('撇-水平延伸')
  const pie_vertical_span_range = glyph.getParamRange('撇-竖直延伸')
  const heng_horizontalSpan = range(heng_end.x - heng_start.x, heng_horizontalSpan_range)
  const zhe1_horizontalSpan = range(zhe1_start.x - zhe1_end.x, zhe1_horizontal_span_range)
  const zhe1_verticalSpan = range(zhe1_end.y - zhe1_start.y, zhe1_vertical_span_range)
  const zhe2_horizontalSpan = range(zhe2_start.x - zhe2_end.x - weight * 0.5, zhe2_horizontal_span_range)
  const pie_horizontalSpan = range(pie_start.x - pie_end.x - weight * 0.5, pie_horizontal_span_range)
  const pie_verticalSpan = range(pie_end.y - pie_start.y, pie_vertical_span_range)
  return {
    heng_horizontalSpan,
    zhe1_horizontalSpan,
    zhe1_verticalSpan,
    zhe2_horizontalSpan,
    pie_horizontalSpan,
    pie_verticalSpan,
  }
}

export { updateParamsByJoints, computeParamsByJoints }
