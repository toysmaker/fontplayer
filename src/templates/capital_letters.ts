import { ParameterType } from '@/core/types'
const xHeight = 500
const ascender = 800
const capitalHeight = 750
const width = 360
const capitalWidth = 500
const descender = -200

let capitalLetters = [
  {
    name: 'a',
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
        value: capitalHeight * 485 / 750,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight * 485 / 750,
      },
      {
        name: 'w1',
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'b',
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
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
      {
        name: 'w2',
        value: capitalWidth * 330 / 500,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth * 330 / 500,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'c',
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
        value: 190,
        min: 0,
        max: 1000,
        step: 1,
        default: 190,
      },
      {
        name: 'w1',
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'd',
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
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'e',
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
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'f',
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
        value: capitalHeight * 300 / 750,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight * 300 / 750,
      },
      {
        name: 'w1',
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'g',
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
        name: 'h3',
        value: 100,
        min: 0,
        max: 1000,
        step: 1,
        default: 100,
      },
      {
        name: 'w1',
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
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
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'h',
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
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'i',
    params: [
      {
        name: 'h1',
        value: capitalHeight,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'j',
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
        value: 80,
        min: 0,
        max: 1000,
        step: 1,
        default: 80,
      },
      {
        name: 'h3',
        value: 150,
        min: 0,
        max: 1000,
        step: 1,
        default: 150,
      },
      {
        name: 'w1',
        value: capitalWidth / 2,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth / 2,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'k',
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
        value: 40,
        min: 0,
        max: 1000,
        step: 1,
        default: 40,
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
        name: 'h4',
        value: capitalHeight * 0.65,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight * 0.65,
      },
      {
        name: 'w1',
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
      {
        name: 'w2',
        value: 150,
        min: 0,
        max: 1000,
        step: 1,
        default: 150,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'l',
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
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'm',
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
        value: capitalHeight * 600 / 750,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight * 600 / 750,
      },
      {
        name: 'w1',
        value: capitalWidth * 1.5,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth * 1.5,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'n',
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
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'o',
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
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'p',
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
        value: capitalHeight * 400 / 750,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight * 400 / 750,
      },
      {
        name: 'w1',
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
      {
        name: 'w2',
        value: capitalWidth * 0.5,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth * 0.5,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'q',
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
        value: 150,
        min: 0,
        max: 1000,
        step: 1,
        default: 150,
      },
      {
        name: 'w1',
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'r',
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
        value: capitalHeight * 0.5,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight * 0.5,
      },
      {
        name: 'w1',
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
      {
        name: 'w2',
        value: capitalWidth * 0.7,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth * 0.7,
      },
      {
        name: 'w3',
        value: capitalWidth * 0.5,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth * 0.5,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 's',
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
        value: 80,
        min: 0,
        max: 1000,
        step: 1,
        default: 80,
      },
      {
        name: 'w1',
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 't',
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
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'u',
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
        value: 290,
        min: 0,
        max: 1000,
        step: 1,
        default: 290,
      },
      {
        name: 'w1',
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'v',
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
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'w',
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
        value: capitalWidth * 1.5,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth * 1.5,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'x',
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
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'y',
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
        value: capitalHeight * 0.4,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalHeight * 0.4,
      },
      {
        name: 'w1',
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
  {
    name: 'z',
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
        value: capitalWidth,
        min: 0,
        max: 1000,
        step: 1,
        default: capitalWidth,
      },
    ],
    globalParams: [
      {
        name: '字重',
        value: 80,
        min: 0,
        max: 100,
        step: 1,
        default:  80,
      },
    ],
  },
]

capitalLetters = capitalLetters.map((letter) => {
  letter.globalParams.push({
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
  letter.globalParams.push({
    name: '衬线大小',
    // @ts-ignore
    type: ParameterType.Number,
    value: 2.0,
    min: 1.0,
    max: 3.0,
    step: 0.1,
    default: 2.0,
  })
  letter.globalParams.push({
    name: '弯曲度',
    // @ts-ignore
    type: ParameterType.Number,
    value: 0.8,
    min: 0,
    max: 2.0,
    step: 0.01,
    default: 0.8,
  })
  letter.globalParams.push({
    name: '笔压',
    // @ts-ignore
    type: ParameterType.Number,
    value: 1,
    min: 0.5,
    max: 1.5,
    step: 0.01,
    default: 1,
  })
  return letter
})

export {
  capitalLetters,
}