// IDS 操作符
const OPERATORS = ['⿰', '⿱', '⿲', '⿳', '⿴', '⿵', '⿶', '⿷', '⿸', '⿹', '⿺', '⿻']
const THREE_PART_OPS = ['⿲', '⿳']
const TWO_PART_OPS = ['⿰', '⿱', '⿴', '⿵', '⿶', '⿷', '⿸', '⿹', '⿺', '⿻']

// 移除字符串开头的括号（如果存在），返回去除括号后的内容和是否被括号包裹
const removeParentheses = (str) => {
  if (str && str.startsWith('(')) {
    // 找到匹配的右括号
    let depth = 0
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '(') {
        depth++
      } else if (str[i] === ')') {
        depth--
        if (depth === 0) {
          // 找到匹配的右括号
          return {
            content: str.slice(1, i), // 去掉括号的内容
            rest: str.slice(i + 1) // 括号后的剩余部分
          }
        }
      }
    }
  }
  return { content: str, rest: '' }
}

// 递归解析 IDS 分解字符串，提取所有叶节点（基本部件）
const extractLeafParts = (decomp, match = [], ids = []) => {
  if (!decomp || decomp === null) {
    return []
  }

  // 处理括号：如果整个字符串被括号包裹，去掉括号
  const { content } = removeParentheses(decomp)
  decomp = content

  if (!decomp || decomp.length === 0) {
    return []
  }

  // 单个字符（包括"？"和"?"），直接返回
  if (decomp.length === 1) {
    return [{
      name: decomp,
      match: match,
      ids: ids,
    }]
  }

  // 查找第一个操作符
  for (const op of OPERATORS) {
    if (decomp.startsWith(op)) {
      const rest = decomp.slice(op.length)
      
      if (THREE_PART_OPS.includes(op)) {
        // 三个部件的操作符：⿲、⿳
        return extractThreeParts(rest, match, [...ids, op])
      } else if (TWO_PART_OPS.includes(op)) {
        // 两个部件的操作符
        return extractTwoParts(rest, match, [...ids, op])
      }
    }
  }

  // 无法解析，返回空数组
  return []
}

// 找到部件的结束位置
const findPartEnd = (str, startIndex) => {
  if (startIndex >= str.length) {
    return -1
  }

  // 检查是否以括号开始
  if (str[startIndex] === '(') {
    // 找到匹配的右括号
    let depth = 0
    for (let i = startIndex; i < str.length; i++) {
      if (str[i] === '(') {
        depth++
      } else if (str[i] === ')') {
        depth--
        if (depth === 0) {
          // 返回括号结束的位置（包含右括号）
          return i - startIndex + 1
        }
      }
    }
    return -1 // 没有找到匹配的右括号
  }

  // 如果第一个字符不是操作符，就是单字符部件
  if (!OPERATORS.includes(str[startIndex])) {
    return 1
  }

  // 第一个字符是操作符，需要找到完整的嵌套结构
  const op = str[startIndex]
  let i = 1
  const targetPartCount = THREE_PART_OPS.includes(op) ? 3 : 2

  // 需要找到 targetPartCount 个部件
  let partCount = 0
  while (i < str.length && partCount < targetPartCount) {
    if (str[startIndex + i] === '(') {
      // 遇到括号，找到匹配的右括号
      let depth = 0
      let j = startIndex + i
      while (j < str.length) {
        if (str[j] === '(') {
          depth++
        } else if (str[j] === ')') {
          depth--
          if (depth === 0) {
            i = j - startIndex + 1
            partCount++
            break
          }
        }
        j++
      }
      if (depth !== 0) {
        return -1 // 括号不匹配
      }
    } else if (OPERATORS.includes(str[startIndex + i])) {
      // 遇到操作符，递归查找该嵌套结构的长度
      const nextPartLength = findPartEnd(str, startIndex + i)
      if (nextPartLength === -1) {
        return -1
      }
      i += nextPartLength
      partCount++
    } else {
      // 单字符部件（包括"？"）
      i++
      partCount++
    }
  }
  
  return i
}

// 提取两个部件的操作符对应的部件
const extractTwoParts = (str, match = [], ids = []) => {
  if (!str || str.length === 0) {
    return []
  }

  const firstPartLength = findPartEnd(str, 0)
  if (firstPartLength === -1 || firstPartLength > str.length) {
    return []
  }

  const firstPart = str.slice(0, firstPartLength)
  const secondPart = str.slice(firstPartLength)

  const firstParts = extractLeafParts(firstPart, [...match, 0], ids)
  const secondParts = extractLeafParts(secondPart, [...match, 1], ids)

  return [...firstParts, ...secondParts]
}

// 提取三个部件的操作符对应的部件
const extractThreeParts = (str, match = [], ids = []) => {
  if (!str || str.length === 0) {
    return []
  }

  const firstPartLength = findPartEnd(str, 0)
  if (firstPartLength === -1 || firstPartLength > str.length) {
    return []
  }

  const firstPart = str.slice(0, firstPartLength)
  const rest = str.slice(firstPartLength)

  const secondPartLength = findPartEnd(rest, 0)
  if (secondPartLength === -1 || secondPartLength > rest.length) {
    return []
  }

  const secondPart = rest.slice(0, secondPartLength)
  const thirdPart = rest.slice(secondPartLength)

  const firstParts = extractLeafParts(firstPart, [...match, 0], ids)
  const secondParts = extractLeafParts(secondPart, [...match, 1], ids)
  const thirdParts = extractLeafParts(thirdPart, [...match, 2], ids)

  return [...firstParts, ...secondParts, ...thirdParts]
}

// 根据 matches 数组和 decomposition，将笔画分配到各个部件
// 返回 Map<部件字符, 笔画索引数组>
const assignStrokesToParts = (decomp, matches) => {
  if (!decomp || decomp === '？' || decomp === null || !matches) {
    return new Map()
  }

  // if (decomp === '⿰⿱厶矢⿱？人') {
  //   debugger
  // }

  const parts = extractLeafParts(decomp)
  if (parts.length === 0) {
    return new Map()
  }

  const partToStrokes = new Map()
  parts.forEach((part, index) => {
    if (part.name === '？' || part.name === '?') {
      partToStrokes.set(`?_${index}`, [])
    } else {
      partToStrokes.set(part.name, [])
    }
  })

  // 遍历 matches，将笔画分配到对应的部件
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    if (match === null || match === undefined) {
      continue
    }

    if (Array.isArray(match) && match.length > 0) {
      const part = parts.find(part => part.match.join(',') === match.join(','))
      let partIndex = 0
      if (!part) {
        console.log(`未找到匹配的部件: ${decomp}`)
      } else {
        partIndex = parts.findIndex(part => part.match.join(',') === match.join(','))
      }
      if (partIndex >= 0 && partIndex < parts.length) {
        let part = parts[partIndex]
        if (part.name === '？' || part.name === '?') {
          part.name = `?_${partIndex}`
        }
        const strokes = partToStrokes.get(part.name) || []
        strokes.push(i) // 存储笔画索引
        partToStrokes.set(part.name, strokes)
      }
    }
  }

  return partToStrokes
}

// 找到括号包裹的内容在原始字符串中的位置范围
const findParenthesesContent = (str) => {
  if (!str || !str.includes('(')) {
    return null
  }

  let depth = 0
  let startIndex = -1
  
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') {
      if (depth === 0) {
        startIndex = i
      }
      depth++
    } else if (str[i] === ')') {
      depth--
      if (depth === 0 && startIndex !== -1) {
        // 找到匹配的括号
        return {
          start: startIndex + 1, // 括号内容开始位置（不包括左括号）
          end: i, // 括号内容结束位置（不包括右括号）
          content: str.slice(startIndex + 1, i) // 括号内的内容
        }
      }
    }
  }
  
  return null
}

const getQuestionMarkPart = (decomp) => {
  if (!decomp || decomp === null) {
    return { parts: [], index: -1 }
  }

  const _decomp = decomp.replace('(？)', '*').replace('(?)', '*')
  // 提取所有 parts（去掉括号后）
  const parts = extractLeafParts(_decomp)

  const index = parts.findIndex(part => part.name === '*')

  return { parts, index }
}

const getDecompositionTree = (decomp) => {
  if (!decomp || decomp === null) {
    return null
  }

  // 处理括号：如果整个字符串被括号包裹，去掉括号
  const { content } = removeParentheses(decomp)
  decomp = content

  if (!decomp || decomp.length === 0) {
    return null
  }

  // 单个字符（包括"？"和"?"），返回叶子节点
  if (decomp.length === 1) {
    return {
      ids: null,
      part: decomp
    }
  }

  // 查找第一个操作符
  for (const op of OPERATORS) {
    if (decomp.startsWith(op)) {
      const rest = decomp.slice(op.length)
      
      if (THREE_PART_OPS.includes(op)) {
        // 三个部件的操作符：⿲、⿳
        const firstPartLength = findPartEnd(rest, 0)
        if (firstPartLength === -1 || firstPartLength > rest.length) {
          return null
        }

        const firstPart = rest.slice(0, firstPartLength)
        const remaining = rest.slice(firstPartLength)

        const secondPartLength = findPartEnd(remaining, 0)
        if (secondPartLength === -1 || secondPartLength > remaining.length) {
          return null
        }

        const secondPart = remaining.slice(0, secondPartLength)
        const thirdPart = remaining.slice(secondPartLength)

        const firstChild = getDecompositionTree(firstPart)
        const secondChild = getDecompositionTree(secondPart)
        const thirdChild = getDecompositionTree(thirdPart)

        // 如果任何子部分解析失败，返回 null
        if (firstChild === null || secondChild === null || thirdChild === null) {
          return null
        }

        return {
          ids: op,
          children: [firstChild, secondChild, thirdChild]
        }
      } else if (TWO_PART_OPS.includes(op)) {
        // 两个部件的操作符
        const firstPartLength = findPartEnd(rest, 0)
        if (firstPartLength === -1 || firstPartLength > rest.length) {
          return null
        }

        const firstPart = rest.slice(0, firstPartLength)
        const secondPart = rest.slice(firstPartLength)

        const firstChild = getDecompositionTree(firstPart)
        const secondChild = getDecompositionTree(secondPart)

        // 如果任何子部分解析失败，返回 null
        if (firstChild === null || secondChild === null) {
          return null
        }

        return {
          ids: op,
          children: [firstChild, secondChild]
        }
      }
    }
  }

  // 无法解析，返回 null
  return null
}

const findPartByMatch = (tree, match) => {
  if (!tree || tree === null) {
    return null
  }

  let root = tree
  let part = root
  for(let i = 0; i < match.length; i++) {
    part = root.children[match[i]]
    root = part
  }
  return part
}

const getBracketsMatch = (decomp) => {
  if (!decomp || !decomp.includes('(')) {
    return null
  }

  // 找到括号内的内容
  const parenthesesContent = findParenthesesContent(decomp)
  if (!parenthesesContent) {
    return null
  }

  const bracketedContent = parenthesesContent.content
  
  // 去掉括号后的decomp，用于提取所有叶子节点
  const decompWithoutBrackets = decomp.replace(`(${bracketedContent})`, bracketedContent)
  
  // 提取所有叶子节点
  const parts = extractLeafParts(decompWithoutBrackets)
  
  // 找到括号内内容对应的match
  // 如果bracketedContent是单个字符，直接找到匹配的part
  if (bracketedContent.length === 1) {
    const targetPart = parts.find(part => part.name === bracketedContent)
    return targetPart ? targetPart.match : null
  }
  
  // 如果是复合结构，找到第一个叶子节点对应的match
  const bracketedParts = extractLeafParts(bracketedContent)
  if (bracketedParts.length > 0) {
    const firstBracketedPart = bracketedParts[0]
    // 在parts中找到name相同且match路径匹配的part
    const targetPart = parts.find(part => {
      if (part.name !== firstBracketedPart.name) {
        return false
      }
      // match路径应该匹配（bracketedContent的match应该是parts中某个part的match的前缀）
      return part.match.length >= firstBracketedPart.match.length &&
             firstBracketedPart.match.every((m, i) => m === part.match[i])
    })
    return targetPart ? targetPart.match : null
  }
  
  return null
}

const addBracketsByMatch = (decomp, match) => {
  if (!decomp || !match || match.length === 0) {
    return decomp
  }

  // 提取所有叶子节点，找到对应match的部件
  const parts = extractLeafParts(decomp)
  const targetPart = parts.find(part => {
    if (part.match.length !== match.length) {
      return false
    }
    return part.match.every((m, i) => m === match[i])
  })
  
  if (!targetPart) {
    return decomp
  }

  // 递归查找并添加括号
  const addBracketsRecursive = (decomp, currentMatch = []) => {
    if (!decomp || decomp === null) {
      return ''
    }

    // 处理括号：如果整个字符串被括号包裹，去掉括号
    const { content } = removeParentheses(decomp)
    decomp = content

    if (!decomp || decomp.length === 0) {
      return ''
    }

    // 单个字符
    if (decomp.length === 1) {
      // 检查是否匹配目标match
      if (currentMatch.length === match.length && 
          currentMatch.every((m, i) => m === match[i])) {
        return `(${decomp})`
      }
      return decomp
    }

    // 查找第一个操作符
    for (const op of OPERATORS) {
      if (decomp.startsWith(op)) {
        const rest = decomp.slice(op.length)
        
        if (THREE_PART_OPS.includes(op)) {
          // 三个部件的操作符
          const firstPartLength = findPartEnd(rest, 0)
          if (firstPartLength === -1 || firstPartLength > rest.length) {
            return decomp
          }

          const firstPart = rest.slice(0, firstPartLength)
          const remaining = rest.slice(firstPartLength)

          const secondPartLength = findPartEnd(remaining, 0)
          if (secondPartLength === -1 || secondPartLength > remaining.length) {
            return decomp
          }

          const secondPart = remaining.slice(0, secondPartLength)
          const thirdPart = remaining.slice(secondPartLength)

          const firstResult = addBracketsRecursive(firstPart, [...currentMatch, 0])
          const secondResult = addBracketsRecursive(secondPart, [...currentMatch, 1])
          const thirdResult = addBracketsRecursive(thirdPart, [...currentMatch, 2])

          return op + firstResult + secondResult + thirdResult
        } else if (TWO_PART_OPS.includes(op)) {
          // 两个部件的操作符
          const firstPartLength = findPartEnd(rest, 0)
          if (firstPartLength === -1 || firstPartLength > rest.length) {
            return decomp
          }

          const firstPart = rest.slice(0, firstPartLength)
          const secondPart = rest.slice(firstPartLength)

          const firstResult = addBracketsRecursive(firstPart, [...currentMatch, 0])
          const secondResult = addBracketsRecursive(secondPart, [...currentMatch, 1])

          return op + firstResult + secondResult
        }
      }
    }

    return decomp
  }

  return addBracketsRecursive(decomp)
}

const getDecomposition2 = (character) => {
  const decomposition = character.decomposition
  const decomposition_list = character.decomposition_list || []
  
  if (!decomposition) {
    console.warn(`[getDecomposition2] Missing decomposition for character: ${character.character || 'unknown'}`, character)
    return null
  }

  // 即使 decomposition_list 为空，也继续处理（？会保持为？）
  // 提取所有叶子节点
  const parts = extractLeafParts(decomposition)
  
  // 创建match到component_id的映射
  const matchToComponentId = new Map()
  for (const item of decomposition_list) {
    if (item.match && item.component_id !== undefined) {
      // match是一个数组，格式为 [match_index_string, strokes_uuids]
      // 其中 match_index_string 是字符串（如 "0,1"），或者是数组（如 [0, 1]）
      // 我们需要使用match[0]作为key
      let matchKey
      if (Array.isArray(item.match[0])) {
        // 如果match[0]是数组，join成字符串
        matchKey = item.match[0].join(',')
      } else if (typeof item.match[0] === 'string') {
        // 如果match[0]是字符串，直接使用
        matchKey = item.match[0]
      } else {
        // 如果match本身是数组（旧格式），join整个数组
        matchKey = Array.isArray(item.match) ? item.match.join(',') : String(item.match)
      }
      matchToComponentId.set(matchKey, item.component_id)
    }
  }

  // 构建新的decomposition字符串
  // 需要遍历decomposition，替换"？"或"?"为component_id，然后给所有部件添加括号
  const buildDecomposition2Recursive = (decomp, currentMatch = []) => {
    if (!decomp || decomp === null) {
      return ''
    }

    // 处理括号：如果整个字符串被括号包裹，去掉括号
    const { content } = removeParentheses(decomp)
    decomp = content

    if (!decomp || decomp.length === 0) {
      return ''
    }

    // 单个字符（包括"？"和"?"）
    if (decomp.length === 1) {
      if (decomp === '？' || decomp === '?') {
        // 找到对应的component_id
        const matchKey = currentMatch.join(',')
        const componentId = matchToComponentId.get(matchKey)
        if (componentId !== undefined) {
          return `(${componentId})`
        }
        return `(${decomp})`
      }
      return `(${decomp})`
    }

    // 查找第一个操作符
    for (const op of OPERATORS) {
      if (decomp.startsWith(op)) {
        const rest = decomp.slice(op.length)
        
        if (THREE_PART_OPS.includes(op)) {
          // 三个部件的操作符
          const firstPartLength = findPartEnd(rest, 0)
          if (firstPartLength === -1 || firstPartLength > rest.length) {
            console.warn(`[getDecomposition2] Failed to parse first part for three-part operator: ${op}, decomp: ${decomp}`)
            return ''
          }

          const firstPart = rest.slice(0, firstPartLength)
          const remaining = rest.slice(firstPartLength)

          const secondPartLength = findPartEnd(remaining, 0)
          if (secondPartLength === -1 || secondPartLength > remaining.length) {
            console.warn(`[getDecomposition2] Failed to parse second part for three-part operator: ${op}, decomp: ${decomp}`)
            return ''
          }

          const secondPart = remaining.slice(0, secondPartLength)
          const thirdPart = remaining.slice(secondPartLength)

          const firstResult = buildDecomposition2Recursive(firstPart, [...currentMatch, 0])
          const secondResult = buildDecomposition2Recursive(secondPart, [...currentMatch, 1])
          const thirdResult = buildDecomposition2Recursive(thirdPart, [...currentMatch, 2])

          if (firstResult === '' || secondResult === '' || thirdResult === '') {
            console.warn(`[getDecomposition2] Empty result for three-part operator: ${op}, decomp: ${decomp}`, {
              firstResult,
              secondResult,
              thirdResult
            })
            return ''
          }

          return op + firstResult + secondResult + thirdResult
        } else if (TWO_PART_OPS.includes(op)) {
          // 两个部件的操作符
          const firstPartLength = findPartEnd(rest, 0)
          if (firstPartLength === -1 || firstPartLength > rest.length) {
            console.warn(`[getDecomposition2] Failed to parse first part for two-part operator: ${op}, decomp: ${decomp}`)
            return ''
          }

          const firstPart = rest.slice(0, firstPartLength)
          const secondPart = rest.slice(firstPartLength)

          const firstResult = buildDecomposition2Recursive(firstPart, [...currentMatch, 0])
          const secondResult = buildDecomposition2Recursive(secondPart, [...currentMatch, 1])

          if (firstResult === '' || secondResult === '') {
            console.warn(`[getDecomposition2] Empty result for two-part operator: ${op}, decomp: ${decomp}`, {
              firstResult,
              secondResult
            })
            return ''
          }

          return op + firstResult + secondResult
        }
      }
    }

    // 如果无法解析，可能是格式错误
    console.warn(`[getDecomposition2] Cannot parse decomposition (no valid operator found): ${decomp}`)
    return ''
  }

  const result = buildDecomposition2Recursive(decomposition)
  if (result === '') {
    console.warn(`[getDecomposition2] buildDecomposition2Recursive returned empty string for character: ${character.character || 'unknown'}`, {
      decomposition,
      decomposition_list
    })
    return null
  }
  return result
}

const getMatchIndex = (decomposition2, component_id) => {
  if (!decomposition2 || decomposition2 === null) {
    return []
  }

  // 将 component_id 转换为字符串以便比较
  const targetId = String(component_id)

  // 存储所有匹配的路径
  const allMatches = []

  // 递归查找匹配的 component_id
  const findMatchRecursive = (decomp, currentPath = []) => {
    if (!decomp || decomp === null) {
      return
    }

    // 处理括号：如果整个字符串被括号包裹，去掉括号
    const { content } = removeParentheses(decomp)
    decomp = content

    if (!decomp || decomp.length === 0) {
      return
    }

    // 检查是否是单个括号包裹的内容（即一个部件）
    // 如果去掉括号后匹配 targetId，将当前路径添加到结果中
    if (decomp === targetId) {
      allMatches.push(currentPath)
      return
    }

    // 如果去掉括号后是单个字符且不是数字，不匹配
    // 如果是纯数字但不匹配，也不匹配
    if (decomp.length === 1) {
      return
    }

    // 查找第一个操作符
    for (const op of OPERATORS) {
      if (decomp.startsWith(op)) {
        const rest = decomp.slice(op.length)
        
        if (THREE_PART_OPS.includes(op)) {
          // 三个部件的操作符
          const firstPartLength = findPartEnd(rest, 0)
          if (firstPartLength === -1 || firstPartLength > rest.length) {
            return
          }

          const firstPart = rest.slice(0, firstPartLength)
          const remaining = rest.slice(firstPartLength)

          const secondPartLength = findPartEnd(remaining, 0)
          if (secondPartLength === -1 || secondPartLength > remaining.length) {
            return
          }

          const secondPart = remaining.slice(0, secondPartLength)
          const thirdPart = remaining.slice(secondPartLength)

          // 递归查找三个子部分，收集所有匹配
          findMatchRecursive(firstPart, [...currentPath, 0])
          findMatchRecursive(secondPart, [...currentPath, 1])
          findMatchRecursive(thirdPart, [...currentPath, 2])

          return
        } else if (TWO_PART_OPS.includes(op)) {
          // 两个部件的操作符
          const firstPartLength = findPartEnd(rest, 0)
          if (firstPartLength === -1 || firstPartLength > rest.length) {
            return
          }

          const firstPart = rest.slice(0, firstPartLength)
          const secondPart = rest.slice(firstPartLength)

          // 递归查找两个子部分，收集所有匹配
          findMatchRecursive(firstPart, [...currentPath, 0])
          findMatchRecursive(secondPart, [...currentPath, 1])

          return
        }
      }
    }
  }

  findMatchRecursive(decomposition2)
  return allMatches
}

export {
  extractLeafParts,
  assignStrokesToParts,
  getQuestionMarkPart,
  getDecompositionTree,
  findPartByMatch,
  getBracketsMatch,
  addBracketsByMatch,
  getDecomposition2,
  getMatchIndex
}