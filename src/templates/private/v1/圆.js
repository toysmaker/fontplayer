const updateParamsByJoints = (params, glyph) => {
  const {
    radius,
  } = params
  glyph.setParam('半径', radius)
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
  const { start, end, bend } = jointsMap
  const radius_range = glyph.getParamRange('半径')
  const radius = range(end.x - start.x, radius_range)
  return {
    radius,
  }
}

export { updateParamsByJoints, computeParamsByJoints }
