const updateParamsByJoints = (params, glyph) => {
  const {
    wan1_horizontalSpan,
    wan1_verticalSpan,
    wan2_horizontalSpan,
    wan2_verticalSpan,
  } = params
  glyph.setParam('弯1-水平延伸', wan1_horizontalSpan)
  glyph.setParam('弯1-竖直延伸', wan1_verticalSpan)
  glyph.setParam('弯2-水平延伸', wan2_horizontalSpan)
  glyph.setParam('弯2-竖直延伸', wan2_verticalSpan)
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
  const { wan1_start, wan1_end, wan1_bend, wan2_start, wan2_end, wan2_bend } = jointsMap
  const weight = glyph.getParam('字重') * glyph.getParam('字重比率') || 40
  const wan1_horizontalSpan_range = glyph.getParamRange('弯1-水平延伸')
  const wan1_verticalSpan_range = glyph.getParamRange('弯1-竖直延伸')
  const wan2_horizontalSpan_range = glyph.getParamRange('弯2-水平延伸')
  const wan2_verticalSpan_range = glyph.getParamRange('弯2-竖直延伸')
  const wan1_bendDegree_range = glyph.getParamRange('弯1-弯曲度')
  const wan2_bendDegree_range = glyph.getParamRange('弯2-弯曲度')
  const wan1_horizontalSpan = range(Math.abs(wan1_end.x - wan1_start.x) - weight * 0.5, wan1_horizontalSpan_range)
  const wan1_verticalSpan = range(Math.abs(wan1_end.y - wan1_start.y), wan1_verticalSpan_range)
  const wan2_horizontalSpan = range(Math.abs(wan2_end.x - wan2_start.x) - weight * 0.5, wan2_horizontalSpan_range)
  const wan2_verticalSpan = range(Math.abs(wan2_end.y - wan2_start.y), wan2_verticalSpan_range)
  return {
    wan1_horizontalSpan,
    wan1_verticalSpan,
    wan2_horizontalSpan,
    wan2_verticalSpan,
  }
}

export { updateParamsByJoints, computeParamsByJoints }
