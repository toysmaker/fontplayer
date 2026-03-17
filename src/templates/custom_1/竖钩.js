const updateParamsByJoints = (params, glyph) => {
  const {
    shu_verticalSpan,
    gou_horizontalSpan,
  } = params
  glyph.setParam('竖-竖直延伸', shu_verticalSpan)
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
  const { shu_start, shu_end, gou_start, gou_end } = jointsMap
  const shu_vertical_span_range = glyph.getParamRange('竖-竖直延伸')
  const gou_horizontal_span_range = glyph.getParamRange('钩-水平延伸')
  const shu_verticalSpan = range(shu_end.y - shu_start.y, shu_vertical_span_range)
  const gou_horizontalSpan = range(gou_start.x - gou_end.x, gou_horizontal_span_range)
  return {
    shu_verticalSpan,
    gou_horizontalSpan,
    skeletonRefPos: glyph.getParam('参考位置'),
  }
}

export { updateParamsByJoints, computeParamsByJoints }
