import { ParameterType } from '@/core/types'
const xHeight = 500
const ascender = 800
const capitalHeight = 750
const width = 360
const capitalWidth = 500
const descender = -200

let digits = [
  {
    name: '0',
    params: [
      {
        name: 'h1',
        value: capitalHeight,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight,
      },
      {
        name: 'w1',
        value: 352,
        min: 0,
        max: 1000,
        step: 1,
        default: 352,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 1000,
        step: 1,
        default: 80,
      },
    ],
  },
  {
    name: '1',
    params: [
      {
        name: 'h1',
        value: capitalHeight,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight,
      },
      {
        name: 'h2',
        value: 200,
        min: 0,
        max: 1000,
        step: 1,
        default: 200,
      },
      {
        name: 'w1',
        value: 200,
        min: 0,
        max: 1000,
        step: 1,
        default: 200,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 1000,
        step: 1,
        default: 80,
      },
    ],
  },
  {
    name: '2',
    params: [
      {
        name: 'h1',
        value: capitalHeight,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight,
      },
      {
        name: 'h2',
        value: 250,
        min: 0,
        max: 1000,
        step: 1,
        default: 250,
      },
      {
        name: 'h3',
        value: capitalHeight * 0.5,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight * 0.5,
      },
      {
        name: 'w1',
        value: width,
        min: 0,
        max: 1000,
        step: 1,
        default: width,
      },
      {
        name: 'w3',
        value: 400,
        min: 0,
        max: 1000,
        step: 1,
        default: 400,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 1000,
        step: 1,
        default: 80,
      },
    ],
  },
  {
    name: '3',
    params: [
      {
        name: 'h1',
        value: capitalHeight,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight,
      },
      {
        name: 'h2',
        value: 250,
        min: 0,
        max: 1000,
        step: 1,
        default: 250,
      },
      {
        name: 'w1',
        value: width,
        min: 0,
        max: 1000,
        step: 1,
        default: width,
      },
      {
        name: 'w2',
        value: width * 0.6,
        min: 0,
        max: 1000,
        step: 1,
        default: width * 0.6,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 1000,
        step: 1,
        default: 80,
      },
    ],
  },
  {
    name: '4',
    params: [
      {
        name: 'h1',
        value: capitalHeight,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight,
      },
      {
        name: 'h2',
        value: 500,
        min: 0,
        max: 1000,
        step: 1,
        default: 500,
      },
      {
        name: 'h3',
        value: 20,
        min: 0,
        max: 1000,
        step: 1,
        default: 20,
      },
      {
        name: 'w1',
        value: width,
        min: 0,
        max: 1000,
        step: 1,
        default: width,
      },
      {
        name: 'w2',
        value: width * 0.75,
        min: 0,
        max: 1000,
        step: 1,
        default: width * 0.75,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 1000,
        step: 1,
        default: 80,
      },
    ],
  },
  {
    name: '5',
    params: [
      {
        name: 'h1',
        value: capitalHeight,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight,
      },
      {
        name: 'h2',
        value: capitalHeight * 295 / 750,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight * 295 / 750,
      },
      {
        name: 'h3',
        value: 120,
        min: 0,
        max: 1000,
        step: 1,
        default: 120,
      },
      {
        name: 'h4',
        value: 180,
        min: 0,
        max: 1000,
        step: 1,
        default: 180,
      },
      {
        name: 'w1',
        value: width,
        min: 0,
        max: 1000,
        step: 1,
        default: width,
      },
      {
        name: 'w3',
        value: 390,
        min: 0,
        max: 1000,
        step: 1,
        default: 390,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 1000,
        step: 1,
        default: 80,
      },
    ],
  },
  {
    name: '6',
    params: [
      {
        name: 'h1',
        value: capitalHeight,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight,
      },
      {
        name: 'h2',
        value: 400,
        min: 0,
        max: 1000,
        step: 1,
        default: 400,
      },
      {
        name: 'h3',
        value: 200,
        min: 0,
        max: 1000,
        step: 1,
        default: 200,
      },
      {
        name: 'w1',
        value: width,
        min: 0,
        max: 1000,
        step: 1,
        default: width,
      },
      {
        name: 'w2',
        value: width * 0.65,
        min: 0,
        max: 1000,
        step: 1,
        default: width * 0.65,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 1000,
        step: 1,
        default: 80,
      },
    ],
  },
  {
    name: '7',
    params: [
      {
        name: 'h1',
        value: capitalHeight,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight,
      },
      {
        name: 'w1',
        value: width,
        min: 0,
        max: 1000,
        step: 1,
        default: width,
      },
      {
        name: 'w2',
        value: 200,
        min: 0,
        max: 1000,
        step: 1,
        default: 200,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 1000,
        step: 1,
        default: 80,
      },
    ],
  },
  {
    name: '8',
    params: [
      {
        name: 'h1',
        value: capitalHeight,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight,
      },
      {
        name: 'w1',
        value: width,
        min: 0,
        max: 1000,
        step: 1,
        default: width,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 1000,
        step: 1,
        default: 80,
      },
    ],
  },
  {
    name: '9',
    params: [
      {
        name: 'h1',
        value: capitalHeight,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight,
      },
      {
        name: 'h2',
        value: 400,
        min: 0,
        max: 1000,
        step: 1,
        default: 400,
      },
      {
        name: 'h3',
        value: 80,
        min: 0,
        max: 1000,
        step: 1,
        default: 80,
      },
      {
        name: 'w1',
        value: width,
        min: 0,
        max: 1000,
        step: 1,
        default: width,
      },
      {
        name: 'w2',
        value: width * 0.65,
        min: 0,
        max: 1000,
        step: 1,
        default: width * 0.65,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 1000,
        step: 1,
        default: 80,
      },
    ],
  },
]

digits = digits.map((digit) => {
  digit.globalParams.push({
    name: '衬线类型',
    // @ts-ignore
    type: ParameterType.Enum,
    value: 0,
    default: 0,
    options: [
      {
        value: 0,
        label: '无衬线',
      },
      {
        value: 1,
        label: '衬线类型1',
      },
    ]
  })
  digit.globalParams.push({
    name: '衬线大小',
    // @ts-ignore
    type: ParameterType.Number,
    value: 1.5,
    min: 1.0,
    max: 3.0,
    step: 0.1,
    default: 1.5,
  })
  digit.globalParams.push({
    name: '弯曲度',
    // @ts-ignore
    type: ParameterType.Number,
    value: 0.8,
    min: 0,
    max: 2.0,
    step: 0.01,
    default: 0.8,
  })
  digit.globalParams.push({
    name: '笔压',
    // @ts-ignore
    type: ParameterType.Number,
    value: 1,
    min: 0.5,
    max: 1.5,
    step: 0.01,
    default: 1,
  })
  return digit
})

// 数字 0 的转角比其它数字略圆（0.95），其余保持 0.8——必须在 map 追加弯曲度参数之后覆盖
const zeroDigit = digits.find((d) => d.name === '0')
if (zeroDigit) {
  const curvatureParam = zeroDigit.globalParams.find((p) => p.name === '弯曲度')
  if (curvatureParam) {
    curvatureParam.value = 0.95
    curvatureParam.default = 0.95
  }
}

export {
  digits,
}