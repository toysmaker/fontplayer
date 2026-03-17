const updateParamsByJoints = (params, glyph) => {
  const {
    heng_horizontalSpan,
    pie_horizontalSpan,
    pie_verticalSpan,
    wangou_verticalSpan,
    wangou_bendCursor,
    wangou_bendDegree,
  } = params
  glyph.setParam('横-水平延伸', heng_horizontalSpan)
  glyph.setParam('撇-水平延伸', pie_horizontalSpan)
  glyph.setParam('撇-竖直延伸', pie_verticalSpan)
  glyph.setParam('弯钩-竖直延伸', wangou_verticalSpan)
  glyph.setParam('弯钩-弯曲游标', wangou_bendCursor)
  glyph.setParam('弯钩-弯曲度', wangou_bendDegree)
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
  const { heng_start, heng_end, pie_start, pie_end, wangou_start, wangou_bend, wangou_end } = jointsMap
  const heng_horizontalSpan_range = glyph.getParamRange('横-水平延伸')
  const pie_horizontal_span_range = glyph.getParamRange('撇-水平延伸')
  const pie_vertical_span_range = glyph.getParamRange('撇-竖直延伸')
  const wangou_vertical_span_range = glyph.getParamRange('弯钩-竖直延伸')
  const wangou_bend_cursor_range = glyph.getParamRange('弯钩-弯曲游标')
  const wangou_bend_degree_range = glyph.getParamRange('弯钩-弯曲度')
  const heng_horizontalSpan = range(heng_end.x - heng_start.x, heng_horizontalSpan_range)
  const pie_horizontalSpan = range(pie_start.x - pie_end.x, pie_horizontal_span_range)
  const pie_verticalSpan = range(pie_end.y - pie_start.y, pie_vertical_span_range)
  const wangou_verticalSpan = range(wangou_end.y - wangou_start.y, wangou_vertical_span_range)
  const wangou_bendCursor = range((wangou_bend.y - wangou_start.y) / wangou_verticalSpan, wangou_bend_cursor_range)
  const wangou_bendDegree = range(wangou_bend.x - wangou_start.x, wangou_bend_degree_range)
  return {
    heng_horizontalSpan,
    pie_horizontalSpan,
    pie_verticalSpan,
    wangou_verticalSpan,
    wangou_bendCursor,
    wangou_bendDegree,
    skeletonRefPos: glyph.getParam('参考位置'),
  }
}

export { updateParamsByJoints, computeParamsByJoints }
