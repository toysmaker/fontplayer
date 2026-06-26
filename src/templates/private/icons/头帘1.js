const params = {
  w1_ratio: {
    name: 'w1_ratio',
    default: 0.7,
    min: 0,
    max: 1,
  },
  w2_ratio: {
    name: 'w2_ratio',
    default: 0.5,
    min: 0,
    max: 1,
  },
  h1_ratio: {
    name: 'h1_ratio',
    default: 0.5,
    min: 0,
    max: 1,
  },
  w1: {
    name: 'w1',
    default: 360,
    min: 200,
    max: 500,
  },
}

export {
  params,
}