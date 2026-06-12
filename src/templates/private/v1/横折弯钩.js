const updateParamsByJoints = (params, glyph) => {
  const {
    heng_horizontalSpan,
    zhe_horizontalSpan,
    zhe_verticalSpan,
    wan_length,
    gou_verticalSpan,
  } = params
  glyph.setParam('横-水平延伸', heng_horizontalSpan)
  glyph.setParam('折-水平延伸', zhe_horizontalSpan)
  glyph.setParam('折-竖直延伸', zhe_verticalSpan)
  glyph.setParam('弯-长度', wan_length)
  glyph.setParam('钩-竖直延伸', gou_verticalSpan)
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
  const { heng_start, heng_end, zhe_start, zhe_end, zhe_bend, wan_start, wan_end, gou_start, gou_end } = jointsMap
  const weight = glyph.getParam('字重') * glyph.getParam('字重比率') || 40
  const heng_horizontalSpan_range = glyph.getParamRange('横-水平延伸')
  const zhe_horizontal_span_range = glyph.getParamRange('折-水平延伸')
  const zhe_vertical_span_range = glyph.getParamRange('折-竖直延伸')
  const wan_length_range = glyph.getParamRange('弯-长度')
  const gou_vertical_span_range = glyph.getParamRange('钩-竖直延伸')
  const heng_horizontalSpan = range(heng_end.x - heng_start.x, heng_horizontalSpan_range)
  const zhe_horizontalSpan = range(zhe_start.x - zhe_end.x - weight * 0.5, zhe_horizontal_span_range)
  const zhe_verticalSpan = range(zhe_end.y - zhe_start.y, zhe_vertical_span_range)
  const wan_length = range(wan_end.x - wan_start.x, wan_length_range)
  const gou_verticalSpan = range(gou_start.y - gou_end.y, gou_vertical_span_range)
  return {
    heng_horizontalSpan,
    zhe_horizontalSpan,
    zhe_verticalSpan,
    wan_length,
    gou_verticalSpan,
  }
}

export { updateParamsByJoints, computeParamsByJoints }
