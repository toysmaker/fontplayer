const updateParamsByJoints = (params, glyph) => {
  const {
    shu_verticalSpan,
    zhe1_horizontalSpan,
    zhe2_verticalSpan,
    gou_horizontalSpan,
  } = params
  glyph.setParam('竖-竖直延伸', shu_verticalSpan)
  glyph.setParam('折1-水平延伸', zhe1_horizontalSpan)
  glyph.setParam('折2-竖直延伸', zhe2_verticalSpan)
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
  const { shu_start, shu_end, zhe1_start, zhe1_end, zhe2_start, zhe2_end, gou_start, gou_end } = jointsMap
  const shu_vertical_span_range = glyph.getParamRange('竖-竖直延伸')
  const zhe1_horizontal_span_range = glyph.getParamRange('折1-水平延伸')
  const zhe2_vertical_span_range = glyph.getParamRange('折2-竖直延伸')
  const gou_horizontal_span_range = glyph.getParamRange('钩-水平延伸')
  const shu_verticalSpan = range(shu_end.y - shu_start.y, shu_vertical_span_range)
  const zhe1_horizontalSpan = range(zhe1_end.x - zhe1_start.x, zhe1_horizontal_span_range)
  const zhe2_verticalSpan = range(zhe2_end.y - zhe2_start.y, zhe2_vertical_span_range)
  const gou_horizontalSpan = range(gou_start.x - gou_end.x, gou_horizontal_span_range)
  return {
    shu_verticalSpan,
    zhe1_horizontalSpan,
    zhe2_verticalSpan,
    gou_horizontalSpan,
  }
}

export { updateParamsByJoints, computeParamsByJoints }
