/**
 * 效果滤镜 i18n 翻译
 * 注册到 i18n 的 effects 模块下，key 路径为 effects.xxx
 */

const effects = {
  zh: {
    noPenComponents: '当前字符中没有钢笔组件，无法应用效果。',
    noCharacterEditing: '请先进入字符编辑界面。',
    applyingToAll: '正在应用效果到全部字符...',
    applyToAllSuccess: '已成功对 {count} 个字符应用效果。',
    applyToAllNoChange: '当前工程中没有可应用效果的字符。',
    applyToAll: '应用效果到全部字符',
    cancel: '取消',
    effectPanelActive: '效果参数栏处于开启状态，请先点击取消按钮关闭参数栏，再进行后续操作',
    // 效果标题和描述
    adjustWeight: {
      title: '调整字重',
      description: '通过膨胀/收缩轮廓来改变字体的胖瘦',
      params: {
        weight: '字重偏移',
        quality: '棱角精度',
      },
    },
    inkBleed: {
      title: '油墨洇开',
      description: '模拟墨水在纸上渗透，产生边缘毛刺和墨点溅洒',
      params: {
        expandDist: '膨胀距离',
        roughnessScale: '噪声频率',
        roughnessAmp: '毛刺深度',
        splatterDensity: '墨点密度',
        splatterSize: '墨点大小',
        seed: '随机种子',
      },
    },
    roughEdge: {
      title: '粗糙边缘',
      description: '让边缘产生手工撕纸或老旧印刷的毛糙感',
      params: {
        amplitude: '扰动幅度',
        frequency: '噪声频率',
        seed: '随机种子',
      },
    },
    glitch: {
      title: '故障撕裂',
      description: '模拟数字信号干扰，字形被水平切割并随机错位',
      params: {
        sliceHeight: '条带高度',
        maxShift: '最大位移',
        gapProbability: '撕裂概率',
        seed: '随机种子',
      },
    },
    handDrawnJitter: {
      title: '手绘颤动',
      description: '让曲线看起来像手写线条，轻微抖动',
      params: {
        jitterAmplitude: '抖动幅度',
        subdivisions: '细分次数',
        seed: '随机种子',
      },
    },
    melt: {
      title: '液化融化',
      description: '字形像受热融化一样向下流淌，底部出现垂滴',
      params: {
        amplitude: '流动幅度',
        frequency: '波纹频率',
        dripLength: '垂滴长度',
        dripCount: '垂滴数量',
        seed: '随机种子',
      },
    },
    geometricSimplify: {
      title: '几何简化',
      description: '用尽可能少的节点表达字形，使曲线变得硬朗',
      params: {
        tolerance: '简化容差',
        curveError: '拟合误差',
      },
    },
    pixelate: {
      title: '像素化',
      description: '将光滑矢量字形转换为块状像素风格',
      params: {
        cellSize: '像素大小',
      },
    },
  },
  en: {
    noPenComponents: 'No pen components found in the current character.',
    noCharacterEditing: 'Please enter character editing mode first.',
    applyingToAll: 'Applying effect to all characters...',
    applyToAllSuccess: 'Successfully applied effect to {count} character(s).',
    applyToAllNoChange: 'No characters with pen components found.',
    applyToAll: 'Apply to All Characters',
    cancel: 'Cancel',
    effectPanelActive: 'Effect panel is active. Please click Cancel to close it before proceeding.',
    adjustWeight: {
      title: 'Adjust Weight',
      description: 'Change font weight by expanding or contracting contours',
      params: {
        weight: 'Weight Offset',
        quality: 'Corner Precision',
      },
    },
    inkBleed: {
      title: 'Ink Bleed',
      description: 'Simulate ink spreading on paper with edge noise and splatter',
      params: {
        expandDist: 'Expand Distance',
        roughnessScale: 'Noise Frequency',
        roughnessAmp: 'Noise Amplitude',
        splatterDensity: 'Splatter Density',
        splatterSize: 'Splatter Size',
        seed: 'Random Seed',
      },
    },
    roughEdge: {
      title: 'Rough Edge',
      description: 'Add rough, torn-paper texture to edges',
      params: {
        amplitude: 'Amplitude',
        frequency: 'Frequency',
        seed: 'Random Seed',
      },
    },
    glitch: {
      title: 'Glitch',
      description: 'Digital glitch effect with horizontal slice displacement',
      params: {
        sliceHeight: 'Slice Height',
        maxShift: 'Max Shift',
        gapProbability: 'Gap Probability',
        seed: 'Random Seed',
      },
    },
    handDrawnJitter: {
      title: 'Hand-drawn Jitter',
      description: 'Add hand-drawn wobble to curves',
      params: {
        jitterAmplitude: 'Jitter Amplitude',
        subdivisions: 'Subdivisions',
        seed: 'Random Seed',
      },
    },
    melt: {
      title: 'Melt',
      description: 'Melt effect with downward flow and drips',
      params: {
        amplitude: 'Flow Amplitude',
        frequency: 'Wave Frequency',
        dripLength: 'Drip Length',
        dripCount: 'Drip Count',
        seed: 'Random Seed',
      },
    },
    geometricSimplify: {
      title: 'Geometric Simplify',
      description: 'Reduce curve complexity for a geometric look',
      params: {
        tolerance: 'Simplify Tolerance',
        curveError: 'Curve Fit Error',
      },
    },
    pixelate: {
      title: 'Pixelate',
      description: 'Convert smooth vectors to blocky pixel style',
      params: {
        cellSize: 'Pixel Size',
      },
    },
  },
}

export { effects }
