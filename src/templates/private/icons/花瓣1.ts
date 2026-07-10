const params = {
  radius: {
    name: 'radius',
    default: 100,
    min: 0,
    max: 500,
  },
  degree: {
    name: 'degree',
    default: 100,
    min: 0,
    max: 360,
  },
  w1: {
    name: 'w1',
    default: 100,
    min: 0,
    max: 500,
  },
  w2: {
    name: 'w2',
    default: 50,
    min: 0,
    max: 500,
  },
  h1: {
    name: 'h1',
    default: 200,
    min: 0,
    max: 1000,
  },
  ratio_1: {
    name: 'ratio_1',
    default: 0.5,
    min: 0,
    max: 1,
  },
  spread_count: {
    name: 'spread_count',
    default: 2,
    min: 0,
    max: 10,
  },
  spread_ratio: {
    name: 'spread_ratio',
    default: 0.5,
    min: 0,
    max: 1,
  }
}

export {
  params,
}