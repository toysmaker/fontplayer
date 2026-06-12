const updateParamsByJoints = (params, glyph) => {
  const {
    shu_verticalSpan,
    tiao_horizontalSpan,
  } = params
  glyph.setParam('竖-竖直延伸', shu_verticalSpan)
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
  const { shu_start, shu_end, tiao_start, tiao_end } = jointsMap
  const shu_vertical_span_range = glyph.getParamRange('竖-竖直延伸')
  const tiao_horizontal_span_range = glyph.getParamRange('挑-水平延伸')
  const shu_verticalSpan = range(shu_end.y - shu_start.y, shu_vertical_span_range)
  const tiao_horizontalSpan = range(tiao_end.x - tiao_start.x, tiao_horizontal_span_range)
  return {
    shu_verticalSpan,
    tiao_horizontalSpan,
    skeletonRefPos: glyph.getParam('参考位置'),
  }
}

export { updateParamsByJoints, computeParamsByJoints }
