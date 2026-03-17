const updateParamsByJoints = (params, glyph) => {
  const {
    verticalSpan,
  } = params
  glyph.setParam('竖直延伸', verticalSpan)
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
  const { start, end } = jointsMap
  const verticalSpan_range = glyph.getParamRange('竖直延伸')
  const verticalSpan = range(Math.abs(start.y - end.y), verticalSpan_range)
  return {
    verticalSpan,
    skeletonRefPos: glyph.getParam('参考位置'),
  }
}

export { updateParamsByJoints, computeParamsByJoints }
