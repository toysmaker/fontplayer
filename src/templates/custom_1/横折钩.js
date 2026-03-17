const updateParamsByJoints = (params, glyph) => {
  const {
    heng_horizontalSpan,
    zhe_verticalSpan,
    gou_horizontalSpan,
  } = params
  glyph.setParam('横-水平延伸', heng_horizontalSpan)
  glyph.setParam('折-竖直延伸', zhe_verticalSpan)
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
  const { heng_start, heng_end, zhe_start, zhe_end, gou_start, gou_end } = jointsMap
  const heng_horizontalSpan_range = glyph.getParamRange('横-水平延伸')
  const zhe_vertical_span_range = glyph.getParamRange('折-竖直延伸')
  const gou_horizontal_span_range = glyph.getParamRange('钩-水平延伸')
  const heng_horizontalSpan = range(heng_end.x - heng_start.x, heng_horizontalSpan_range)
  const zhe_verticalSpan = range(zhe_end.y - zhe_start.y, zhe_vertical_span_range)
  const gou_horizontalSpan = range(gou_start.x - gou_end.x, gou_horizontal_span_range)
  return {
    heng_horizontalSpan,
    zhe_verticalSpan,
    gou_horizontalSpan,
    skeletonRefPos: glyph.getParam('参考位置'),
  }
}

export { updateParamsByJoints, computeParamsByJoints }
