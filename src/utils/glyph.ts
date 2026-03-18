// Minimal glyph helper utilities used by stroke templates.

export const refline = (p1: { name: string }, p2: { name: string }, type?: string) => {
  const l: any = {
    name: `${p1.name}-${p2.name}`,
    start: p1.name,
    end: p2.name,
  }
  if (type) l.type = type
  return l
}

export const range = (value: number, r: { min: number; max: number }) => {
  if (value < r.min) return r.min
  if (value > r.max) return r.max
  return value
}

