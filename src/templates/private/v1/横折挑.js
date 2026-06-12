const updateParamsByJoints = (params, glyph) => {
  const {
    heng_horizontalSpan,
    zhe_verticalSpan,
    tiao_horizontalSpan,
  } = params
  glyph.setParam('横-水平延伸', heng_horizontalSpan)
  glyph.setParam('折-竖直延伸', zhe_verticalSpan)
  glyph.setParam('挑-水平延伸', tiao_horizontalSpan)
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
  const { heng_start, heng_end, zhe_start, zhe_end, tiao_start, tiao_end } = jointsMap
  const heng_horizontalSpan_range = glyph.getParamRange('横-水平延伸')
  const zhe_verticalSpan_range = glyph.getParamRange('折-竖直延伸')
  const tiao_horizontal_span_range = glyph.getParamRange('挑-水平延伸')
  const heng_horizontalSpan = range(heng_end.x - heng_start.x, heng_horizontalSpan_range)
  const zhe_verticalSpan = range(zhe_end.y - zhe_start.y, zhe_verticalSpan_range)
  const tiao_horizontalSpan = range(tiao_end.x - tiao_start.x, tiao_horizontal_span_range)
  return {
    heng_horizontalSpan,
    zhe_verticalSpan,
    tiao_horizontalSpan,
    skeletonRefPos: glyph.getParam('参考位置'),
  }
}

export { updateParamsByJoints, computeParamsByJoints }
