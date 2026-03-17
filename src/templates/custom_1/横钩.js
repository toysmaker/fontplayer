const updateParamsByJoints = (params, glyph) => {
  const {
    heng_horizontalSpan,
    gou_verticalSpan,
  } = params
  glyph.setParam('横-水平延伸', heng_horizontalSpan)
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
  const { heng_start, heng_end, gou_start, gou_end } = jointsMap
  const heng_horizontalSpan_range = glyph.getParamRange('横-水平延伸')
  const gou_vertical_span_range = glyph.getParamRange('钩-竖直延伸')
  const heng_horizontalSpan = range(heng_end.x - heng_start.x, heng_horizontalSpan_range)
  const gou_verticalSpan = range(gou_end.y - gou_start.y, gou_vertical_span_range)
  return {
    heng_horizontalSpan,
    gou_verticalSpan,
    skeletonRefPos: glyph.getParam('参考位置'),
  }
}

export { updateParamsByJoints, computeParamsByJoints }
