export const getBound = (points: Array<{ x: number; y: number }>) => {
  let minx = Infinity
  let miny = Infinity
  let maxx = -Infinity
  let maxy = -Infinity
  for (let i = 0; i < points.length; i++) {
    if (points[i].x < minx) minx = points[i].x
    if (points[i].x > maxx) maxx = points[i].x
    if (points[i].y < miny) miny = points[i].y
    if (points[i].y > maxy) maxy = points[i].y
  }
  return { x: minx, y: miny, w: maxx - minx, h: maxy - miny }
}

