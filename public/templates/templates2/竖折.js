const shu_horizonalSpan = glyph.getParam('竖-水平延伸')
const shu_verticalSpan = glyph.getParam('竖-竖直延伸')
const zhe_length = glyph.getParam('折-长度')
const weight = glyph.getParam('字重') || 40
const ox = 500
const oy = 500

const refline = (p1, p2) => {
  return {
    name: `${p1.name}-${p2.name}`,
    start: p1.name,
    end: p2.name,
  }
}

const distance = (p1, p2) => {
  return Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y))
}

// 竖
const shu_start = new FP.Joint(
  'shu_start',
  {
    x: ox - (shu_horizonalSpan + zhe_length) / 2,
    y: oy - shu_verticalSpan / 2,
  },
)
const shu_end = new FP.Joint(
  'shu_end',
  {
    x: shu_start.x + shu_horizonalSpan,
    y: shu_start.y + shu_verticalSpan,
  },
)

// 折
const zhe_start = shu_end
const zhe_end = new FP.Joint(
  'zhe_end',
  {
    x: zhe_start.x + zhe_length,
    y: zhe_start.y,
  },
)

glyph.addJoint(shu_start)
glyph.addJoint(shu_end)
glyph.addJoint(zhe_start)
glyph.addJoint(zhe_end)

const skeleton = {
  shu_start,
  shu_end,
  zhe_start,
  zhe_end,
}

glyph.addRefLine(refline(shu_start, shu_end))
glyph.addRefLine(refline(zhe_start, zhe_end))

const start_style_type = glyph.getParam('起笔风格')
const start_style_value = glyph.getParam('起笔数值')
const bending_degree = glyph.getParam('弯曲程度')
const turn_style_type = glyph.getParam('转角风格')
const turn_style_value = glyph.getParam('转角数值')

const getStartStyle = (start_style_type, start_style_value) => {
  if (start_style_type === 1) {
    // 起笔上下凸起长方形
    return {
      start_style_decorator_height: start_style_value * 20,
      start_style_decorator_width: weight * 0.25,
    }
  } else if (start_style_type === 2) {
    // 起笔上下凸起长方形，长方形内侧转角为圆角
    return {
      start_style_decorator_height: start_style_value * 20,
      start_style_decorator_width: weight * 0.25,
      start_style_decorator_radius: 20,
    }
  }
  return {}
}

const start_style = getStartStyle(start_style_type, start_style_value)

const getLength = (horizonalSpan, verticalSpan) => {
  return Math.sqrt(horizonalSpan * horizonalSpan + verticalSpan * verticalSpan)
}

const getDistance = (p1, p2) => {
  if(!p1 || !p2) return 0
  return Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y))
}

const getRadiusPoint = (options) => {
  const { start, end, radius } = options
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  const point = {
    x: start.x + Math.cos(angle) * radius,
    y: start.y + Math.sin(angle) * radius,
  }
  return point
}

const getComponents = (skeleton) => {
  // 根据骨架计算轮廓关键点

  const {
    shu_start,
    shu_end,
    zhe_start,
    zhe_end,
  } = skeleton

  // out指左侧（外侧）轮廓线
  // in指右侧（内侧）轮廓线
  const { out_shu_start, out_shu_end, in_shu_start, in_shu_end } = FP.getLineContours('shu', { shu_start, shu_end }, weight, {
    unticlockwise: true,
  })
  const { out_zhe_start, out_zhe_end, in_zhe_start, in_zhe_end } = FP.getLineContours('zhe', { zhe_start, zhe_end }, weight, {
    unticlockwise: true,
  })
  const { corner: in_corner_shu_zhe } = FP.getIntersection(
    { type: 'line', start: in_shu_start, end: in_shu_end },
    { type: 'line', start: in_zhe_start, end: in_zhe_end },
  )
  const { corner: out_corner_shu_zhe } = FP.getIntersection(
    { type: 'line', start: out_shu_start, end: out_shu_end },
    { type: 'line', start: out_zhe_start, end: out_zhe_end },
  )

  // 计算竖折拐角处内外圆角相关的点与数据
  let in_radius_shu_zhe = bending_degree > 1 ? 60 * (bending_degree - 1) : 0
  let out_radius_shu_zhe = bending_degree > 1 ? 80 * (bending_degree - 1) : 0
  // 如果in_radius超出竖或折长度，取竖或折的最小长度
  const in_radius_min_length_shu_zhe = Math.min(
    getDistance(in_corner_shu_zhe, in_shu_start),
    getDistance(in_corner_shu_zhe, in_zhe_end),
  )
  const out_radius_min_length_shu_zhe = Math.min(
    getDistance(out_zhe_end, out_shu_start),
    getDistance(out_zhe_start, out_zhe_end),
  )
  if (in_radius_shu_zhe >= in_radius_min_length_shu_zhe) {
    in_radius_shu_zhe = in_radius_min_length_shu_zhe
  }
  if (out_radius_shu_zhe >= out_radius_min_length_shu_zhe) {
    out_radius_shu_zhe = out_radius_min_length_shu_zhe
  }
  const in_radius_start_shu_zhe = {
    x: in_corner_shu_zhe.x,
    y: in_corner_shu_zhe.y - in_radius_shu_zhe,
  }
  const in_radius_end_shu_zhe = getRadiusPoint({
    start: in_corner_shu_zhe,
    end: in_zhe_end,
    radius: in_radius_shu_zhe,
  })
  const out_radius_start_shu_zhe = {
    x: out_corner_shu_zhe.x,
    y: out_corner_shu_zhe.y - out_radius_shu_zhe,
  }
  const out_radius_end_shu_zhe = getRadiusPoint({
    start: out_corner_shu_zhe,
    end: out_zhe_end,
    radius: out_radius_shu_zhe,
  })

  let turn_data = {}
  if (turn_style_type === 1) {
    // 计算转角风格1（凸起，圆滑连接）所需要的数据
    const turn_length = 20 * turn_style_value
    const inner_angle = Math.PI / 2
    const mid_angle = Math.PI / 4
    const inner_corner_length = weight
    const corner_radius = (inner_corner_length / 2) / Math.sin(inner_angle / 2)
    const turn_control_1 = getRadiusPoint({
      start: out_corner_shu_zhe,
      end: out_shu_start,
      radius: corner_radius,
    })
    const turn_start_1 = getRadiusPoint({
      start: turn_control_1,
      end: out_shu_start,
      radius: corner_radius,
    })
    const turn_end_1 = {
      x: turn_control_1.x - turn_length * Math.cos(mid_angle),
      y: turn_control_1.y + turn_length * Math.sin(mid_angle),
    }
    const turn_control_2 = {
      x: out_corner_shu_zhe.x + corner_radius,
      y: out_corner_shu_zhe.y,
    }
    const turn_start_2 = {
      x: turn_control_2.x + corner_radius,
      y: turn_control_2.y,
    }
    const turn_end_2 = {
      x: turn_control_2.x - turn_length * Math.cos(mid_angle),
      y: turn_control_2.y + turn_length * Math.sin(mid_angle),
    }
    turn_data = {
      turn_start_1,
      turn_control_1,
      turn_end_1,
      turn_start_2,
      turn_control_2,
      turn_end_2,
    }
  }

  let start_data = {}
  if (start_style_type === 1 || start_style_type === 2) {
    // 计算起笔样式1或2需要的数据
    const angle = Math.atan2(shu_end.x - shu_start.x, shu_end.y - shu_start.x)
    const left_up = {
      x: out_shu_start.x - start_style.start_style_decorator_width * Math.cos(angle),
      y: out_shu_start.y + start_style.start_style_decorator_width * Math.sin(angle),
    }
    const right_up = {
      x: in_shu_start.x + start_style.start_style_decorator_width * Math.cos(angle),
      y: in_shu_start.y - start_style.start_style_decorator_width * Math.sin(angle),
    }
    const left_down = {
      x: left_up.x + start_style.start_style_decorator_height * Math.sin(angle),
      y: left_up.y + start_style.start_style_decorator_height * Math.cos(angle),
    }
    const right_down = {
      x: right_up.x + start_style.start_style_decorator_height * Math.sin(angle),
      y: right_up.y + start_style.start_style_decorator_height * Math.cos(angle),
    }
    const left_control = getRadiusPoint({
      start: out_shu_start,
      end: out_shu_end,
      radius: start_style.start_style_decorator_height,
    })
    const right_control = getRadiusPoint({
      start: in_shu_start,
      end: in_shu_end,
      radius: start_style.start_style_decorator_height,
    })
    const left_end = getRadiusPoint({
      start: out_shu_start,
      end: out_shu_end,
      radius: start_style.start_style_decorator_height + start_style.start_style_decorator_radius,
    })
    const right_end = getRadiusPoint({
      start: in_shu_start,
      end: in_shu_end,
      radius: start_style.start_style_decorator_height + start_style.start_style_decorator_radius,
    })
    start_data = {
      left_up,
      left_down,
      right_up,
      right_down,
      left_control,
      right_control,
      left_end,
      right_end,
    }
  }

  // 创建钢笔组件
  const pen = new FP.PenComponent()
  pen.beginPath()

  // 绘制左侧（外侧）轮廓
  if (start_style_type === 0) {
    // 无起笔样式
    pen.moveTo(out_shu_start.x, out_shu_start.y)
  } else if (start_style_type === 1) {
    // 起笔左右凸起长方形
    pen.moveTo(start_data.left_up.x, start_data.left_up.y)
    pen.lineTo(start_data.left_down.x, start_data.left_down.y)
    pen.lineTo(start_data.left_control.x, start_data.left_control.y)
  } else if (start_style_type === 2) {
    // 起笔左右凸起长方形，长方形内侧转角为圆角
    pen.moveTo(start_data.left_up.x, start_data.left_up.y)
    pen.lineTo(start_data.left_down.x, start_data.left_down.y)
    pen.quadraticBezierTo(start_data.left_control.x, start_data.left_control.y, start_data.left_end.x, start_data.left_end.y)
  }
  if (turn_style_type === 0) {
    // 默认转角样式
    // 绘制外侧竖折圆角
    pen.lineTo(out_radius_start_shu_zhe.x, out_radius_start_shu_zhe.y)
    pen.quadraticBezierTo(out_corner_shu_zhe.x, out_corner_shu_zhe.y, out_radius_end_shu_zhe.x, out_radius_end_shu_zhe.y)
  } else if (turn_style_type === 1) {
    // 转角样式1
    pen.lineTo(turn_data.turn_start_1.x, turn_data.turn_start_1.y)
    pen.quadraticBezierTo(turn_data.turn_control_1.x, turn_data.turn_control_1.y, turn_data.turn_end_1.x, turn_data.turn_end_1.y)
    pen.lineTo(turn_data.turn_end_2.x, turn_data.turn_end_2.y)
    pen.quadraticBezierTo(turn_data.turn_control_2.x, turn_data.turn_control_2.y, turn_data.turn_start_2.x, turn_data.turn_start_2.y)
  }
  // 绘制外侧折
  pen.lineTo(out_zhe_end.x, out_zhe_end.y)

  // 绘制轮廓连接线
  pen.lineTo(in_zhe_end.x, in_zhe_end.y)

  // 绘制右侧（内侧）轮廓
  // 绘制内侧竖折圆角
  pen.lineTo(in_radius_end_shu_zhe.x, in_radius_end_shu_zhe.y)
  pen.quadraticBezierTo(in_corner_shu_zhe.x, in_corner_shu_zhe.y, in_radius_start_shu_zhe.x, in_radius_start_shu_zhe.y)
  if (start_style_type === 0) {
    // 无起笔样式
    pen.lineTo(in_shu_start.x, in_shu_start.y)
  } else if (start_style_type === 1) {
    // 起笔上下凸起长方形
    pen.lineTo(start_data.right_control.x, start_data.right_control.y)
    pen.lineTo(start_data.right_down.x, start_data.right_down.y)
    pen.lineTo(start_data.right_up.x, start_data.right_up.y)
  } else if (start_style_type === 2) {
    // 起笔上下凸起长方形，长方形内侧转角为圆角
    pen.lineTo(start_data.right_end.x, start_data.right_end.y)
    pen.quadraticBezierTo(start_data.right_control.x, start_data.right_control.y, start_data.right_down.x, start_data.right_down.y)
    pen.lineTo(start_data.right_up.x, start_data.right_up.y)
  }

  // 绘制轮廓连接线
  if (start_style_type === 0) {
    // 无起笔样式
    pen.lineTo(out_shu_start.x, out_shu_start.y)
  } else if (start_style_type === 1) {
    // 起笔上下凸起长方形
    pen.lineTo(start_data.left_up.x, start_data.left_up.y)
  } else if (start_style_type === 2) {
    // 起笔上下凸起长方形，长方形内侧转角为圆角
    pen.lineTo(start_data.left_up.x, start_data.left_up.y)
  }

  pen.closePath()
  return [ pen ]
}

const components = getComponents(skeleton)
for (let i = 0; i < components.length; i++) {
  glyph.addComponent(components[i])
}