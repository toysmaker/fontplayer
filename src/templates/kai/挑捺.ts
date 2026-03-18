import { CustomGlyph } from "@/core/instance/CustomGlyph";
import { instanceManager } from "@/core/instance/InstanceManager";
import { ICustomGlyph } from "@/core/types";
import { refline, range } from "@/utils/glyph";
import { FP } from "@/core/script/FPUtils";
import { applySkeletonTransformation, glyphSkeletonBind } from "@/features/glyphSkeletonBind";
import { updateSkeletonTransformation } from "@/templates/kai/strokeFnMap";
import { minSegment, maxSegment } from "./constants";
// 挑捺的骨架转骨骼函数
export const skeletonToBones_tiao_na = (skeleton: any): any[] => {
  const bones: any[] = [];
  const { tiao_start, tiao_end, na_start, na_end, na_bend } = skeleton;
  
  // 挑的部分 - 直线段
  const tiaoLength = Math.sqrt((tiao_end.x - tiao_start.x) ** 2 + (tiao_end.y - tiao_start.y) ** 2);
  const tiaoSegments = maxSegment//Math.max(minSegment, Math.ceil(tiaoLength / 20));
  
  for (let i = 0; i < tiaoSegments; i++) {
    const t1 = i / tiaoSegments;
    const t2 = (i + 1) / tiaoSegments;
    
    const p1 = {
      x: tiao_start.x + (tiao_end.x - tiao_start.x) * t1,
      y: tiao_start.y + (tiao_end.y - tiao_start.y) * t1
    };
    const p2 = {
      x: tiao_start.x + (tiao_end.x - tiao_start.x) * t2,
      y: tiao_start.y + (tiao_end.y - tiao_start.y) * t2
    };
    
    const bone: any = {
      id: `tiao_segment_${i}`,
      start: p1,
      end: p2,
      length: Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2),
      uAxis: normalize({ x: p2.x - p1.x, y: p2.y - p1.y }),
      vAxis: normalize({ x: -(p2.y - p1.y), y: p2.x - p1.x }),
      children: [],
      bindMatrix: createIdentityMatrix(),
      currentMatrix: createIdentityMatrix()
    };
    
    if (i > 0) {
      bone.parent = `tiao_segment_${i - 1}`;
      bones[i - 1].children.push(bone.id);
    }
    
    bones.push(bone);
  }
  
  // 捺的部分 - 贝塞尔曲线段
  const naSegments = maxSegment;
  for (let i = 0; i < naSegments; i++) {
    const t1 = i / naSegments;
    const t2 = (i + 1) / naSegments;
    
    const p1 = quadraticBezierPoint(na_start, na_bend, na_end, t1);
    const p2 = quadraticBezierPoint(na_start, na_bend, na_end, t2);
    
    const bone: any = {
      id: `na_segment_${i}`,
      start: p1,
      end: p2,
      length: Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2),
      uAxis: normalize({ x: p2.x - p1.x, y: p2.y - p1.y }),
      vAxis: normalize({ x: -(p2.y - p1.y), y: p2.x - p1.x }),
      children: [],
      bindMatrix: createIdentityMatrix(),
      currentMatrix: createIdentityMatrix()
    };
    
    if (i === 0) {
      // 第一个捺段连接到最后一个挑段
      bone.parent = `tiao_segment_${tiaoSegments - 1}`;
      bones[tiaoSegments - 1].children.push(bone.id);
    } else {
      bone.parent = `na_segment_${i - 1}`;
      bones[tiaoSegments + i - 1].children.push(bone.id);
    }
    
    bones.push(bone);
  }
  
  return bones;
};

// 辅助函数
const normalize = (vector: { x: number; y: number }) => {
  const length = Math.sqrt(vector.x ** 2 + vector.y ** 2);
  return length > 0 ? { x: vector.x / length, y: vector.y / length } : { x: 0, y: 0 };
};

const createIdentityMatrix = () => [1, 0, 0, 1, 0, 0];

const quadraticBezierPoint = (p0: any, p1: any, p2: any, t: number) => {
  const x = (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x;
  const y = (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y;
  return { x, y };
};



const instanceBasicGlyph_tiao_na = (plainGlyph: ICustomGlyph) => {
  const glyph = instanceManager.getInstance(
    plainGlyph.uuid,
    () => new CustomGlyph(plainGlyph),
    "glyph",
  ) as unknown as CustomGlyph
  glyph._glyph = plainGlyph
  glyph.clear()
  const params = {
    tiao_horizontalSpan: glyph.getParam('挑-水平延伸'),
    tiao_verticalSpan: glyph.getParam('挑-竖直延伸'),
    na_horizontalSpan: glyph.getParam('捺-水平延伸'),
    na_verticalSpan: glyph.getParam('捺-竖直延伸'),
    na_bendCursor: glyph.getParam('捺-弯曲游标'),
    na_bendDegree: Number(glyph.getParam('捺-弯曲度')) + 30 * Number(glyph.getParam('弯曲程度') || 1),
    skeletonRefPos: glyph.getParam('参考位置'),
    weight: glyph.getParam('字重') || 40,
  }

  updateGlyphByParams(params, glyph)

  return
}

const bindSkeletonGlyph_tiao_na = (plainGlyph: ICustomGlyph) => {
  const inst = instanceManager.getInstance(plainGlyph.uuid, () => new CustomGlyph(plainGlyph), 'glyph') as any
  if (!inst) return
  glyphSkeletonBind(inst)
}

const distance = (p1, p2) => {
  return Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y))
}

const getBend = (start, end, bendCursor, bendDegree) => {
  const horizontalSpan = Math.abs(end.x - start.x)
  const verticalSpan = Math.abs(end.y - start.y)
  const cursor_x = start.x + bendCursor * horizontalSpan
  const cursor_y = start.y + bendCursor * verticalSpan
  const angle = Math.atan2(verticalSpan, horizontalSpan)
  
  const bend = {
    x: cursor_x + bendDegree * Math.sin(angle),
    y: cursor_y + bendDegree * Math.cos(angle),
  }

  return bend
}

const updateGlyphByParams = (params, glyph) => {
  const {
    tiao_horizontalSpan,
    tiao_verticalSpan,
    na_horizontalSpan,
    na_verticalSpan,
    na_bendCursor,
    na_bendDegree,
  } = params

  const { ox : _ox, oy : _oy } = glyph._glyph.skeleton

  const ox = 500
  const oy = 500
  const x0 = 200 + _ox || 0
  const y0 = 575 + _oy || 0

  // 挑
  const tiao_start = new FP.Joint(
    'tiao_start',
    {
      x: x0,
      y: y0,
    },
  )
  const tiao_end = new FP.Joint(
    'tiao_end',
    {
      x: tiao_start.x + tiao_horizontalSpan,
      y: tiao_start.y - tiao_verticalSpan,
    },
  )

  // 捺
  const na_start = new FP.Joint(
    'na_start',
    {
      x: tiao_start.x + tiao_horizontalSpan,
      y: tiao_start.y - tiao_verticalSpan,
    },
  )
  const na_end = new FP.Joint(
    'na_end',
    {
      x: na_start.x + na_horizontalSpan,
      y: na_start.y + na_verticalSpan,
    },
  )

  const na_bend = new FP.Joint(
    'na_bend',
    {
      x: na_start.x + na_horizontalSpan * na_bendCursor,
      y: na_start.y + na_bendDegree,
    },
  )

  glyph.addJoint(tiao_start)
  glyph.addJoint(tiao_end)
  glyph.addJoint(na_start)
  glyph.addJoint(na_end)
  glyph.addJoint(na_bend)

  const skeleton = {
    tiao_start,
    tiao_end,
    na_start,
    na_bend,
    na_end,
  }

  glyph.addRefLine(refline(tiao_start, tiao_end))
  glyph.addRefLine(refline(na_start, na_bend))
  glyph.addRefLine(refline(na_bend, na_end))

  glyph.getSkeleton = () => {
    return skeleton
  }
}

const computeParamsByJoints = (jointsMap, glyph) => {
  const { tiao_start, tiao_end, na_start, na_end, na_bend } = jointsMap
  const tiao_horizontal_span_range = glyph.getParamRange('挑-水平延伸')
  const tiao_vertical_span_range = glyph.getParamRange('挑-竖直延伸')
  const na_horizontal_span_range = glyph.getParamRange('捺-水平延伸')
  const na_vertical_span_range = glyph.getParamRange('捺-竖直延伸')
  const na_bend_cursor_range = glyph.getParamRange('捺-弯曲游标')
  const na_bend_degree_range = glyph.getParamRange('捺-弯曲度')
  const tiao_horizontalSpan = range(tiao_end.x - tiao_start.x, tiao_horizontal_span_range)
  const tiao_verticalSpan = range(tiao_start.y - tiao_end.y, tiao_vertical_span_range)
  const na_horizontalSpan = range(na_end.x - na_start.x, na_horizontal_span_range)
  const na_verticalSpan = range(na_end.y - na_start.y, na_vertical_span_range)
  const data = FP.distanceAndFootPoint(na_start, na_end, na_bend)
  const na_bendCursor = range(data.percentageFromA, na_bend_cursor_range)
  const na_bendDegree = range(data.distance, na_bend_degree_range)
  return {
    tiao_horizontalSpan,
    tiao_verticalSpan,
    na_horizontalSpan,
    na_verticalSpan,
    na_bendCursor,
    na_bendDegree,
    skeletonRefPos: glyph.getParam('参考位置'),
    weight: glyph.getParam('字重') || 40,
  }
}

const updateSkeletonListener_before_bind_tiao_na = (glyph: CustomGlyph) => {
  const getJointsMap = (data) => {
    const { draggingJoint, deltaX, deltaY } = data
    const jointsMap = Object.assign({}, glyph.tempData)
    switch (draggingJoint.name) {
      case 'tiao_start': {
        const deltaX = data.deltaX
        const deltaY = data.deltaY
        
        if (glyph._glyph.skeleton) {
          glyph._glyph.skeleton.ox = (glyph.tempData.ox || 0) + deltaX
          glyph._glyph.skeleton.oy = (glyph.tempData.oy || 0) + deltaY
        }
        
        Object.keys(jointsMap).forEach(key => {
          jointsMap[key] = {
            x: glyph.tempData[key].x + deltaX,
            y: glyph.tempData[key].y + deltaY,
          }
        })
        break
      }
      case 'tiao_end': {
        jointsMap['tiao_end'] = {
          x: glyph.tempData['tiao_end'].x + deltaX,
          y: glyph.tempData['tiao_end'].y + deltaY,
        }
        jointsMap['na_start'] = {
          x: glyph.tempData['na_start'].x + deltaX,
          y: glyph.tempData['na_start'].y + deltaY,
        }
        jointsMap['na_bend'] = {
          x: glyph.tempData['na_bend'].x + deltaX,
          y: glyph.tempData['na_bend'].y + deltaY,
        }
        jointsMap['na_end'] = {
          x: glyph.tempData['na_end'].x + deltaX,
          y: glyph.tempData['na_end'].y + deltaY,
        }
        break
      }
      case 'na_start': {
        jointsMap['tiao_end'] = {
          x: glyph.tempData['tiao_end'].x + deltaX,
          y: glyph.tempData['tiao_end'].y + deltaY,
        }
        jointsMap['na_start'] = {
          x: glyph.tempData['na_start'].x + deltaX,
          y: glyph.tempData['na_start'].y + deltaY,
        }
        jointsMap['na_bend'] = {
          x: glyph.tempData['na_bend'].x + deltaX,
          y: glyph.tempData['na_bend'].y + deltaY,
        }
        jointsMap['na_end'] = {
          x: glyph.tempData['na_end'].x + deltaX,
          y: glyph.tempData['na_end'].y + deltaY,
        }
        break
      }
      case 'na_bend': {
        jointsMap['na_bend'] = {
          x: glyph.tempData['na_bend'].x + deltaX,
          y: glyph.tempData['na_bend'].y + deltaY,
        }
        break
      }
      case 'na_end': {
        jointsMap['na_end'] = {
          x: glyph.tempData['na_end'].x + deltaX,
          y: glyph.tempData['na_end'].y + deltaY,
        }
        const newBend = getBend(jointsMap['na_start'], jointsMap['na_end'], glyph.tempData.na_bendCursor, glyph.tempData.na_bendDegree)
        jointsMap['na_bend'] = {
          x: newBend.x,
          y: newBend.y,
        }
        break
      }
    }
    return jointsMap
  }

  glyph.onSkeletonDragStart = (data) => {
    const { draggingJoint } = data
    glyph.tempData = {}
    glyph.tempData.ox = glyph._glyph.skeleton.ox
    glyph.tempData.oy = glyph._glyph.skeleton.oy
    glyph.tempData.na_bendCursor = glyph.getParam('捺-弯曲游标')
    glyph.tempData.na_bendDegree = Number(glyph.getParam('捺-弯曲度')) + 30 * Number(glyph.getParam('弯曲程度') || 1)
    glyph.getJoints().map((joint) => {
      const _joint = {
        name: joint.name,
        x: joint.x,
        y: joint.y,
      }
      glyph.tempData[_joint.name] = _joint
    })
  }
  
  glyph.onSkeletonDrag = (data) => {
    if (!glyph.tempData) return
    glyph.clear()
    const jointsMap = getJointsMap(data)
    const _params = computeParamsByJoints(jointsMap, glyph)
    updateGlyphByParams(_params, glyph)
  }
  
  glyph.onSkeletonDragEnd = (data) => {
    if (!glyph.tempData) return
    glyph.clear()
    const jointsMap = getJointsMap(data)
    const _params = computeParamsByJoints(jointsMap, glyph)
    updateGlyphByParams(_params, glyph)
    glyph.setParam('挑-水平延伸', _params.tiao_horizontalSpan)
    glyph.setParam('挑-竖直延伸', _params.tiao_verticalSpan)
    glyph.setParam('捺-水平延伸', _params.na_horizontalSpan)
    glyph.setParam('捺-竖直延伸', _params.na_verticalSpan)
    glyph.setParam('捺-弯曲游标', _params.na_bendCursor)
    glyph.setParam('捺-弯曲度', _params.na_bendDegree - 30 * Number(glyph.getParam('弯曲程度') || 1))
    glyph.tempData = null
  }
}

const updateSkeletonListener_after_bind_tiao_na = (glyph: CustomGlyph) => {
  const getJointsMap = (data) => {
    const { draggingJoint, deltaX, deltaY } = data
    const jointsMap = Object.assign({}, glyph.tempData)
    switch (draggingJoint.name) {
      case 'tiao_end': {
        jointsMap['tiao_end'] = {
          x: glyph.tempData['tiao_end'].x + deltaX,
          y: glyph.tempData['tiao_end'].y + deltaY,
        }
        jointsMap['na_start'] = {
          x: glyph.tempData['na_start'].x + deltaX,
          y: glyph.tempData['na_start'].y + deltaY,
        }
        jointsMap['na_bend'] = {
          x: glyph.tempData['na_bend'].x + deltaX,
          y: glyph.tempData['na_bend'].y + deltaY,
        }
        jointsMap['na_end'] = {
          x: glyph.tempData['na_end'].x + deltaX,
          y: glyph.tempData['na_end'].y + deltaY,
        }
        break
      }
      case 'na_start': {
        jointsMap['tiao_end'] = {
          x: glyph.tempData['tiao_end'].x + deltaX,
          y: glyph.tempData['tiao_end'].y + deltaY,
        }
        jointsMap['na_start'] = {
          x: glyph.tempData['na_start'].x + deltaX,
          y: glyph.tempData['na_start'].y + deltaY,
        }
        jointsMap['na_bend'] = {
          x: glyph.tempData['na_bend'].x + deltaX,
          y: glyph.tempData['na_bend'].y + deltaY,
        }
        jointsMap['na_end'] = {
          x: glyph.tempData['na_end'].x + deltaX,
          y: glyph.tempData['na_end'].y + deltaY,
        }
        break
      }
      case 'na_bend': {
        jointsMap['na_bend'] = {
          x: glyph.tempData['na_bend'].x + deltaX,
          y: glyph.tempData['na_bend'].y + deltaY,
        }
        break
      }
      case 'na_end': {
        jointsMap['na_end'] = {
          x: glyph.tempData['na_end'].x + deltaX,
          y: glyph.tempData['na_end'].y + deltaY,
        }
        const newBend = getBend(jointsMap['na_start'], jointsMap['na_end'], glyph.tempData.na_bendCursor, glyph.tempData.na_bendDegree)
        jointsMap['na_bend'] = {
          x: newBend.x,
          y: newBend.y,
        }
        break
      }
    }
    return jointsMap
  }

  glyph.onSkeletonDragStart = (data) => {
    const { draggingJoint } = data
    glyph.tempData = {}
    glyph.tempData.na_bendCursor = glyph.getParam('捺-弯曲游标')
    glyph.tempData.na_bendDegree = Number(glyph.getParam('捺-弯曲度')) + 30 * Number(glyph.getParam('弯曲程度') || 1)
    glyph.getJoints().map((joint) => {
      const _joint = {
        name: joint.name,
        x: joint.x,
        y: joint.y,
      }
      glyph.tempData[_joint.name] = _joint
    })
  }
  
  glyph.onSkeletonDrag = (data) => {
    if (!glyph.tempData) return
    glyph.clear()
    const jointsMap = getJointsMap(data)
    const _params = computeParamsByJoints(jointsMap, glyph)
    updateGlyphByParams(_params, glyph)
    updateSkeletonTransformation(glyph)
  }
  
  glyph.onSkeletonDragEnd = (data) => {
    if (!glyph.tempData) return
    glyph.clear()
    const jointsMap = getJointsMap(data)
    const _params = computeParamsByJoints(jointsMap, glyph)
    updateGlyphByParams(_params, glyph)
    updateSkeletonTransformation(glyph)
    glyph.setParam('挑-水平延伸', _params.tiao_horizontalSpan)
    glyph.setParam('挑-竖直延伸', _params.tiao_verticalSpan)
    glyph.setParam('捺-水平延伸', _params.na_horizontalSpan)
    glyph.setParam('捺-竖直延伸', _params.na_verticalSpan)
    glyph.setParam('捺-弯曲游标', _params.na_bendCursor)
    glyph.setParam('捺-弯曲度', _params.na_bendDegree - 30 * Number(glyph.getParam('弯曲程度') || 1))
    glyph.tempData = null
  }
}

const updateParamsByJoints = (_params, glyph) => {
  const { tiao_horizontalSpan, tiao_verticalSpan, na_horizontalSpan, na_verticalSpan, na_bendCursor, na_bendDegree } = _params
  glyph.setParam('挑-水平延伸', tiao_horizontalSpan)
  glyph.setParam('挑-竖直延伸', tiao_verticalSpan)
  glyph.setParam('捺-水平延伸', na_horizontalSpan)
  glyph.setParam('捺-竖直延伸', na_verticalSpan)
  glyph.setParam('捺-弯曲游标', na_bendCursor)
  glyph.setParam('捺-弯曲度', na_bendDegree - 30 * Number(glyph.getParam('弯曲程度') || 1))
}

export {
  instanceBasicGlyph_tiao_na,
  bindSkeletonGlyph_tiao_na,
  updateSkeletonListener_after_bind_tiao_na,
  updateSkeletonListener_before_bind_tiao_na,
  computeParamsByJoints,
  updateParamsByJoints,
}