const updateParamsByJoints = (params, glyph) => {
  const {
    heng_horizontalSpan,
    wan_horizontalSpan,
    wan_verticalSpan,
    gou_verticalSpan,
  } = params
  glyph.setParam('横-水平延伸', heng_horizontalSpan)
  glyph.setParam('弯-水平延伸', wan_horizontalSpan)
  glyph.setParam('弯-竖直延伸', wan_verticalSpan)
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
  const { heng_start, heng_end, wan_start, wan_end, wan_bend, gou_start, gou_end } = jointsMap
  const heng_horizontalSpan_range = glyph.getParamRange('横-水平延伸')
  const wan_horizontal_span_range = glyph.getParamRange('弯-水平延伸')
  const wan_vertical_span_range = glyph.getParamRange('弯-竖直延伸')
  const gou_vertical_span_range = glyph.getParamRange('钩-竖直延伸')
  const heng_horizontalSpan = range(heng_end.x - heng_start.x, heng_horizontalSpan_range)
  const wan_horizontalSpan = range(wan_end.x - wan_start.x, wan_horizontal_span_range)
  const wan_verticalSpan = range(wan_end.y - wan_start.y, wan_vertical_span_range)
  const gou_verticalSpan = range(gou_start.y - gou_end.y, gou_vertical_span_range)
  return {
    heng_horizontalSpan,
    wan_horizontalSpan,
    wan_verticalSpan,
    gou_verticalSpan,
  }
}

export { updateParamsByJoints, computeParamsByJoints }
