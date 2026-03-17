const updateParamsByJoints = (params, glyph) => {
  const {
    heng1_horizontalSpan,
    zhe1_verticalSpan,
    heng2_horizontalSpan,
    zhe2_verticalSpan,
  } = params
  glyph.setParam('横1-水平延伸', heng1_horizontalSpan)
  glyph.setParam('折1-竖直延伸', zhe1_verticalSpan)
  glyph.setParam('横2-水平延伸', heng2_horizontalSpan)
  glyph.setParam('折2-竖直延伸', zhe2_verticalSpan)
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
  const { heng1_start, heng1_end, zhe1_start, zhe1_end, heng2_start, heng2_end, zhe2_start, zhe2_end } = jointsMap
  const heng1_horizontal_span_range = glyph.getParamRange('横1-水平延伸')
  const zhe1_vertical_span_range = glyph.getParamRange('折1-竖直延伸')
  const heng2_horizontal_span_range = glyph.getParamRange('横2-水平延伸')
  const zhe2_vertical_span_range = glyph.getParamRange('折2-竖直延伸')
  const heng1_horizontalSpan = range(heng1_end.x - heng1_start.x, heng1_horizontal_span_range)
  const zhe1_verticalSpan = range(zhe1_end.y - zhe1_start.y, zhe1_vertical_span_range)
  const heng2_horizontalSpan = range(heng2_end.x - heng2_start.x, heng2_horizontal_span_range)
  const zhe2_verticalSpan = range(zhe2_end.y - zhe2_start.y, zhe2_vertical_span_range)
  return {
    heng1_horizontalSpan,
    zhe1_verticalSpan,
    heng2_horizontalSpan,
    zhe2_verticalSpan,
  }
}

export { updateParamsByJoints, computeParamsByJoints }
