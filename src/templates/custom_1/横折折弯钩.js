const updateParamsByJoints = (params, glyph) => {
  const {
    heng_horizontalSpan,
    zhe1_verticalSpan,
    zhe2_horizontalSpan,
    wan_verticalSpan,
    gou_horizontalSpan,
  } = params
  glyph.setParam('横-水平延伸', heng_horizontalSpan)
  glyph.setParam('折1-竖直延伸', zhe1_verticalSpan)
  glyph.setParam('折2-水平延伸', zhe2_horizontalSpan)
  glyph.setParam('弯-竖直延伸', wan_verticalSpan)
  glyph.setParam('钩-水平延伸', gou_horizontalSpan)
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
  const { heng_start, heng_end, zhe1_start, zhe1_end, zhe2_start, zhe2_end, wan_start, wan_end, gou_start, gou_end } = jointsMap
  const heng_horizontal_span_range = glyph.getParamRange('横-水平延伸')
  const zhe1_vertical_span_range = glyph.getParamRange('折1-竖直延伸')
  const zhe2_horizontal_span_range = glyph.getParamRange('折2-水平延伸')
  const wan_vertical_span_range = glyph.getParamRange('弯-竖直延伸')
  const gou_horizontal_span_range = glyph.getParamRange('钩-水平延伸')
  const heng_horizontalSpan = range(heng_end.x - heng_start.x, heng_horizontal_span_range)
  const zhe1_verticalSpan = range(zhe1_end.y - zhe1_start.y, zhe1_vertical_span_range)
  const zhe2_horizontalSpan = range(zhe2_end.x - zhe2_start.x, zhe2_horizontal_span_range)
  const wan_verticalSpan = range(wan_end.y - wan_start.y, wan_vertical_span_range)
  const gou_horizontalSpan = range(gou_start.x - gou_end.x, gou_horizontal_span_range)
  return {
    heng_horizontalSpan,
    zhe1_verticalSpan,
    zhe2_horizontalSpan,
    wan_verticalSpan,
    gou_horizontalSpan,
  }
}

export { updateParamsByJoints, computeParamsByJoints }
