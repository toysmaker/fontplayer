/**
 * 真实 UI 拖拽性能对比(Chromium vs WebKit)
 * 注入含 digit8 脚本字形组件的工程, 打开字符编辑器, 真鼠标拖拽, 测帧间隔
 */
import { test } from '@playwright/test'

async function seedProject(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    // 统计空闲期画布 clearRect 调用(即整幅画布重绘)
    const w = window as any
    w.__clearCount = 0
    w.__clearStacks = []
    const orig = CanvasRenderingContext2D.prototype.clearRect
    CanvasRenderingContext2D.prototype.clearRect = function (x: number, y: number, wd: number, ht: number) {
      w.__clearCount++
      if (w.__captureClear && w.__clearStacks.length < 8) {
        w.__clearStacks.push(new Error().stack?.split('\n').slice(1, 8).join(' | '))
      }
      return orig.call(this, x, y, wd, ht)
    }
  })
  await page.goto('http://localhost:5173')
  await page.waitForLoadState('networkidle')
  await page.evaluate(async () => {
    const scriptText = await (await fetch('/templates/digits/8.js')).text()
    const glyphValue: any = {
      uuid: 'seed-glyph-8',
      name: '8',
      script: `function script_seed_glyph_8(glyph, constants, FP) {\n${scriptText}\n}`,
      parameters: [
        { name: 'h1', value: 750 },
        { name: 'w1', value: 450 },
        { name: '字重', value: 80 },
        { name: '衬线类型', value: 0 },
        { name: '衬线大小', value: 2.0 },
        { name: '弯曲度', value: 1 },
        { name: '笔压', value: 1 },
      ],
      components: [],
    }
    const character: any = {
      uuid: 'seed-char-8',
      type: 'character',
      character: { text: '8', unicode: 56 },
      components: [{ type: 'glyph', uuid: 'seed-glyph-8', ox: 0, oy: 0, usedInCharacter: true, value: glyphValue }],
      orderedList: [{ type: 'component', uuid: 'seed-glyph-8' }],
      selectedComponentsUUIDs: [],
      view: { zoom: 100, translateX: 0, translateY: 0 },
      info: { gridSettings: null },
    }
    const file: any = {
      uuid: 'seed-file',
      name: 'Perf Seed',
      width: 1000,
      height: 1000,
      saved: true,
      fontSettings: { unitsPerEm: 1000, ascender: 800, descender: -200, tables: { name: [] } },
      characterList: [JSON.parse(JSON.stringify(character))],
      glyphs: [],
      stroke_glyphs: [],
      radical_glyphs: [],
      comp_glyphs: [],
      constants: [],
    }

    const { useProjectStore } = await import('/src/stores/project.ts')
    const projectStore = useProjectStore()
    if (!projectStore.files.find((f: any) => f.uuid === file.uuid)) {
      projectStore.addFile(file)
    }
    projectStore.selectFile(file.uuid)

    const { characterDataManager } = await import('/src/core/storage/CharacterDataManager.ts')
    await characterDataManager.updateCharacter(file.uuid, JSON.parse(JSON.stringify(character)))
  })
}

test('drag UI perf', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push('PAGEERROR: ' + String(err).slice(0, 500)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push('CONSOLE: ' + msg.text().slice(0, 500))
  })
  await seedProject(page)

  // 进入编辑器
  await page.goto('http://localhost:5173/#/editor')
  await page.waitForLoadState('networkidle')

  // 打开字符编辑器(单击)
  const characterItem = page.locator('[data-testid="character-item"]').first()
  await characterItem.waitFor({ state: 'visible', timeout: 15000 })
  await characterItem.click({ timeout: 10000 })
  await page.waitForTimeout(2000)

  const state = await page.evaluate(async () => {
    const { useCharacterStore } = await import('/src/stores/character.ts')
    const cs = useCharacterStore()
    return {
      editingCharacterUUID: cs.editingCharacterUUID,
      hasEditing: !!cs.editingCharacter,
      componentsCount: cs.editingCharacter?.components?.length || 0,
      editStatus: (await import('/src/stores/editor.ts')).useEditorStore().editStatus,
    }
  })
  console.log('[UI-DRAG] editor state:', JSON.stringify(state))

  // 诊断组件列表 DOM
  const domDiag = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[data-testid="component-item"]'))
    const list = document.querySelector('[data-testid="component-list"]')
    const canvas = document.querySelector('canvas.editor-canvas')
    return {
      itemCount: items.length,
      itemTypes: items.map((i) => (i as HTMLElement).dataset.type),
      listExists: !!list,
      listVisible: list ? !!(list as HTMLElement).offsetParent : false,
      canvasExists: !!canvas,
    }
  })
  console.log('[UI-DRAG] dom diag:', JSON.stringify(domDiag))
  if (pageErrors.length) {
    console.log('[UI-DRAG] page errors:\n' + pageErrors.slice(0, 10).join('\n---\n'))
  }

  // 选中字形组件
  const glyphComp = page.locator('[data-testid="component-item"][data-type="glyph"]').first()
  await glyphComp.waitFor({ state: 'visible', timeout: 10000 })
  await glyphComp.click({ timeout: 10000 })
  await page.waitForTimeout(800)

  // 画布
  const canvas = page.locator('canvas.editor-canvas').first()
  await canvas.waitFor({ state: 'visible', timeout: 10000 })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas bounding box not found')

  // 画布中心(display 坐标, digit8 中心在 bbox 内)
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  // 开始 rAF 记录器
  await page.evaluate(() => {
    const w = window as any
    w.__perfFrames = []
    w.__perfRaf = () => {
      w.__perfFrames.push(performance.now())
      w.__perfRafId = requestAnimationFrame(w.__perfRaf)
    }
    w.__perfRafId = requestAnimationFrame(w.__perfRaf)
    w.__perfLongTasks = []
    try {
      w.__perfPO = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__perfLongTasks.push((e as any).duration)
      })
      w.__perfPO.observe({ entryTypes: ['longtask'] })
    } catch { /* WebKit 可能不支持 */ }
  })

  // 拖拽 150 步
  const t0 = Date.now()
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let i = 1; i <= 150; i++) {
    await page.mouse.move(cx + i, cy + i)
  }
  await page.mouse.up()
  const dragWallMs = Date.now() - t0
  await page.waitForTimeout(300)

  const result = await page.evaluate(() => {
    const w = window as any
    cancelAnimationFrame(w.__perfRafId)
    w.__perfPO?.disconnect()
    const frames = w.__perfFrames
    const gaps: number[] = []
    for (let i = 1; i < frames.length; i++) gaps.push(frames[i] - frames[i - 1])
    gaps.sort((a, b) => a - b)
    const p = (q: number) => gaps.length ? gaps[Math.min(gaps.length - 1, Math.floor(q * gaps.length))] : 0
    return {
      frames: gaps.length,
      gapP50: p(0.5).toFixed(1),
      gapP95: p(0.95).toFixed(1),
      gapMax: gaps.length ? gaps[gaps.length - 1].toFixed(1) : '0',
      longTasks: (w.__perfLongTasks || []).map((d: number) => Math.round(d)).slice(0, 20),
    }
  })

  console.log(`[UI-DRAG] engine=${test.info().project.name} dragWallMs=${dragWallMs} perMove=${(dragWallMs / 150).toFixed(1)}ms rAF: frames=${result.frames} gapP50=${result.gapP50}ms gapP95=${result.gapP95}ms gapMax=${result.gapMax}ms longTasks=${JSON.stringify(result.longTasks)}`)

  // 空闲重绘检测: 静止 3 秒, 统计画布 clearRect 次数 + rAF 调度方
  const idleFrames = await page.evaluate(async () => {
    const w = window as any
    w.__clearCount = 0
    w.__clearStacks = []
    w.__captureClear = true
    // 包装 rAF 记录调用方
    w.__rafCallers = {}
    w.__rafCount = 0
    const origRAF = window.requestAnimationFrame
    ;(window as any).requestAnimationFrame = function (cb: FrameRequestCallback) {
      w.__rafCount++
      const s = new Error().stack?.split('\n').slice(1, 7).join(' | ') || 'no-stack'
      w.__rafCallers[s] = (w.__rafCallers[s] || 0) + 1
      return origRAF.call(window, cb)
    }
    await new Promise((r) => setTimeout(r, 3000))
    ;(window as any).requestAnimationFrame = origRAF
    w.__captureClear = false
    const top = Object.entries(w.__rafCallers).sort((a: any, b: any) => b[1] - a[1]).slice(0, 6)
    return { clears: w.__clearCount, stacks: w.__clearStacks, rafCount: w.__rafCount, rafCallers: top }
  })
  console.log(`[UI-DRAG] engine=${test.info().project.name} idle3s: canvasClears=${idleFrames.clears} rafScheduled=${idleFrames.rafCount}`)
  for (const [s, c] of idleFrames.rafCallers as Array<[string, number]>) {
    console.log(`[UI-DRAG] rafCaller x${c}: ${s}`)
  }
  for (const s of idleFrames.stacks) {
    console.log('[UI-DRAG] clearStack: ' + s)
  }
  test.info().annotations.push({ type: 'perf', description: JSON.stringify({ dragWallMs, ...result, idleFrames }) })
})

test('drag with 7000 chars and 8 glyph components', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push('PAGEERROR: ' + String(err).slice(0, 300)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push('CONSOLE: ' + msg.text().slice(0, 300))
  })
  await seedProject(page)

  // 扩展: 7000 字符元数据 + 编辑字符含 8 个 glyph 组件
  await page.evaluate(async () => {
    const scriptText = await (await fetch('/templates/digits/8.js')).text()
    const { useProjectStore } = await import('/src/stores/project.ts')
    const projectStore = useProjectStore()
    const file: any = projectStore.selectedFile
    const base = file.characterList[0]

    // 编辑字符: 8 个脚本字形组件
    const editing = JSON.parse(JSON.stringify(base))
    editing.uuid = 'seed-char-8'
    editing.components = []
    editing.orderedList = []
    for (let i = 0; i < 8; i++) {
      const gv: any = JSON.parse(JSON.stringify(base.components[0].value))
      gv.uuid = `seed-glyph-8-${i}`
      gv.script = `function script_seed_glyph_8_${i}(glyph, constants, FP) {\n${scriptText}\n}`
      gv.name = `stroke${i}`
      editing.components.push({ type: 'glyph', uuid: `seed-glyph-8-${i}`, ox: i * 50 - 175, oy: 0, usedInCharacter: true, value: gv })
      editing.orderedList.push({ type: 'component', uuid: `seed-glyph-8-${i}` })
    }
    file.characterList = [editing]

    // 7000 个元数据字符
    for (let i = 1; i < 7000; i++) {
      file.characterList.push({
        uuid: `bulk-char-${i}`,
        type: 'character',
        character: { text: String.fromCodePoint(0x4e00 + (i % 20000)), unicode: 0x4e00 + (i % 20000) },
      })
    }
    const { characterDataManager } = await import('/src/core/storage/CharacterDataManager.ts')
    await characterDataManager.updateCharacter(file.uuid, JSON.parse(JSON.stringify(editing)))
  })

  await page.goto('http://localhost:5173/#/editor')
  await page.waitForLoadState('networkidle')
  const characterItem = page.locator('[data-testid="character-item"]').first()
  await characterItem.waitFor({ state: 'visible', timeout: 15000 })
  await characterItem.click({ timeout: 10000 })
  await page.waitForTimeout(2000)

  const glyphComp = page.locator('[data-testid="component-item"][data-type="glyph"]').first()
  await glyphComp.waitFor({ state: 'visible', timeout: 10000 })
  await glyphComp.click({ timeout: 10000 })
  await page.waitForTimeout(800)

  const canvas = page.locator('canvas.editor-canvas').first()
  await canvas.waitFor({ state: 'visible', timeout: 10000 })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('no canvas')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  // 拖拽前启动栈采样(区分每帧时间花在谁身上)
  await page.evaluate(() => {
    const w = window as any
    w.__samp = {}
    w.__sampTimer = setInterval(() => {
      const raw = new Error().stack || ''
      const lines = raw.split('\n')
      const top = (lines[1] || lines[0] || '?').trim().slice(0, 140)
      w.__samp[top] = (w.__samp[top] || 0) + 1
    }, 0)
  })

  const t0 = Date.now()
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let i = 1; i <= 150; i++) {
    await page.mouse.move(cx + i, cy + i)
  }
  await page.mouse.up()
  const dragWallMs = Date.now() - t0
  await page.waitForTimeout(200)

  const samp = await page.evaluate(() => {
    const w = window as any
    clearInterval(w.__sampTimer)
    const tot = Object.values(w.__samp).reduce((a: any, b: any) => a + b, 0)
    const top = Object.entries(w.__samp).sort((a: any, b: any) => b[1] - a[1]).slice(0, 8)
      .map(([fn, c]: any) => `${((100 * c) / tot).toFixed(0)}% ${fn}`)
    return top
  })

  console.log(`[UI-DRAG] engine=${test.info().project.name} 7000chars: perMove=${(dragWallMs / 150).toFixed(1)}ms errors=${pageErrors.length}`)
  for (const s of samp) console.log('[UI-DRAG] sample: ' + s)
  if (pageErrors.length) console.log('[UI-DRAG] errors:\n' + pageErrors.slice(0, 4).join('\n---\n'))
  test.info().annotations.push({ type: 'perf', description: JSON.stringify({ dragWallMs, perMove: dragWallMs / 150, samp }) })
})

test('joint drag vs whole-glyph drag with 8 glyph components', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push('PAGEERROR: ' + String(err).slice(0, 300)))
  await seedProject(page)

  // 编辑字符扩展为 8 个脚本字形组件
  await page.evaluate(async () => {
    const scriptText = await (await fetch('/templates/digits/8.js')).text()
    const { useProjectStore } = await import('/src/stores/project.ts')
    const projectStore = useProjectStore()
    const file: any = projectStore.selectedFile
    const base = JSON.parse(JSON.stringify(file.characterList[0]))
    base.components = []
    base.orderedList = []
    for (let i = 0; i < 8; i++) {
      if (i === 0) {
        // 第一个用原种子组件
        const orig = JSON.parse(JSON.stringify(file.characterList[0].components[0].value))
        base.components.push({ type: 'glyph', uuid: 'seed-glyph-8', ox: 0, oy: 0, usedInCharacter: true, value: orig })
        base.orderedList.push({ type: 'component', uuid: 'seed-glyph-8' })
        continue
      }
      const gv2: any = JSON.parse(JSON.stringify(file.characterList[0].components[0].value))
      gv2.uuid = `seed-glyph-8-${i}`
      gv2.script = `function script_seed_glyph_8_${i}(glyph, constants, FP) {\n${scriptText}\n}`
      base.components.push({ type: 'glyph', uuid: `seed-glyph-8-${i}`, ox: i * 40 - 140, oy: i * 40 - 140, usedInCharacter: true, value: gv2 })
      base.orderedList.push({ type: 'component', uuid: `seed-glyph-8-${i}` })
    }
    file.characterList[0] = base
    const { characterDataManager } = await import('/src/core/storage/CharacterDataManager.ts')
    await characterDataManager.updateCharacter(file.uuid, base)
  })

  await page.goto('http://localhost:5173/#/editor')
  await page.waitForLoadState('networkidle')
  const characterItem = page.locator('[data-testid="character-item"]').first()
  await characterItem.waitFor({ state: 'visible', timeout: 15000 })
  await characterItem.click({ timeout: 10000 })
  await page.waitForTimeout(2000)
  const glyphComp = page.locator('[data-testid="component-item"][data-type="glyph"]').first()
  await glyphComp.waitFor({ state: 'visible', timeout: 10000 })
  await glyphComp.click({ timeout: 10000 })
  await page.waitForTimeout(800)

  const canvas = page.locator('canvas.editor-canvas').first()
  await canvas.waitFor({ state: 'visible', timeout: 10000 })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('no canvas')

  // 读取第一个字形实例的关节坐标(单位→页面坐标)
  const jointInfo = await page.evaluate(() => {
    return import('/src/core/instance/InstanceManager.ts').then(({ instanceManager }) => {
      const inst: any = instanceManager.getPooledInstance('seed-glyph-8')
      const joints = inst?.getJoints?.() || []
      const withXY = joints.filter((j: any) => typeof j.x === 'number' && typeof j.y === 'number')
      return withXY.slice(0, 3).map((j: any) => ({ name: j.name, x: j.x, y: j.y }))
    })
  })
  console.log('[UI-DRAG] joints:', JSON.stringify(jointInfo))
  if (!jointInfo.length) throw new Error('no joints found')

  const j = jointInfo[0]
  const scaleX = box.width / 1000
  const scaleY = box.height / 1000
  const jx = box.x + j.x * scaleX
  const jy = box.y + j.y * scaleY
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  // 渲染计数(clearRect 次数 = 整幅重绘次数)
  await page.evaluate(() => {
    const w = window as any
    w.__clearCount = 0
    const orig = CanvasRenderingContext2D.prototype.clearRect
    CanvasRenderingContext2D.prototype.clearRect = function (...args: any[]) {
      w.__clearCount++
      return orig.apply(this, args as any)
    }
  })

  // A. 关节拖拽(点中第一个关节)
  let t0 = Date.now()
  await page.mouse.move(jx, jy)
  await page.mouse.down()
  for (let i = 1; i <= 120; i++) {
    await page.mouse.move(jx + i, jy + i)
  }
  await page.mouse.up()
  const jointDragMs = Date.now() - t0
  await page.waitForTimeout(300)
  const clearsAfterJoint = await page.evaluate(() => (window as any).__clearCount)

  // B. 整体拖拽(组件中心)
  t0 = Date.now()
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let i = 1; i <= 120; i++) {
    await page.mouse.move(cx + i, cy + i)
  }
  await page.mouse.up()
  const wholeDragMs = Date.now() - t0
  await page.waitForTimeout(300)
  const clearsAfterWhole = await page.evaluate(() => (window as any).__clearCount)

  console.log(`[UI-DRAG] engine=${test.info().project.name} jointDrag: ${(jointDragMs / 120).toFixed(1)}ms/move renders=${clearsAfterJoint} | wholeDrag: ${(wholeDragMs / 120).toFixed(1)}ms/move renders=${clearsAfterWhole - clearsAfterJoint} errors=${pageErrors.length}`)
  if (pageErrors.length) console.log('[UI-DRAG] errors:\n' + pageErrors.slice(0, 4).join('\n---\n'))
  test.info().annotations.push({ type: 'perf', description: JSON.stringify({ jointDragMs, wholeDragMs, clearsAfterJoint, clearsAfterWhole }) })
})

test('drag after font build (memory pressure)', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push('PAGEERROR: ' + String(err).slice(0, 300)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push('CONSOLE: ' + msg.text().slice(0, 300))
  })
  await seedProject(page)

  // 扩充工程: 60 个字符
  await page.evaluate(async () => {
    const scriptText = await (await fetch('/templates/digits/8.js')).text()
    const { useProjectStore } = await import('/src/stores/project.ts')
    const projectStore = useProjectStore()
    const file: any = projectStore.selectedFile
    const base = file.characterList[0]
    for (let i = 1; i < 60; i++) {
      const gv: any = JSON.parse(JSON.stringify(base.components[0].value))
      gv.uuid = `seed-glyph-8-${i}`
      gv.script = `function script_seed_glyph_8_${i}(glyph, constants, FP) {\n${scriptText}\n}`
      const ch: any = JSON.parse(JSON.stringify(base))
      ch.uuid = `seed-char-8-${i}`
      ch.character = { text: String(8 + i), unicode: 56 + i }
      ch.components[0].uuid = `seed-glyph-8-${i}`
      ch.components[0].value = gv
      ch.orderedList[0].uuid = `seed-glyph-8-${i}`
      file.characterList.push(ch)
    }
  })

  // 模拟排版预览的字体重建(全字符 + removeOverlap), 并把 buffer 留在内存里
  const buildInfo = await page.evaluate(async () => {
    const { useProjectStore } = await import('/src/stores/project.ts')
    const projectStore = useProjectStore()
    const { buildExportFontBuffer } = await import('/src/features/editor/services/ExportFontService.ts')
    const t0 = performance.now()
    const buffer = await buildExportFontBuffer(
      JSON.parse(JSON.stringify(projectStore.selectedFile)),
      { editingCharacterUUID: '', editingCharacter: null, onProgress: () => {} },
      { contourStorage: 'cff', removeOverlap: true },
    )
    const ms = performance.now() - t0
    ;(window as any).__fontBuffer = buffer // 常驻内存
    return { ms: Math.round(ms), sizeKB: buffer.byteLength ? Math.round(buffer.byteLength / 1024) : 0 }
  })
  console.log(`[UI-DRAG] fontBuild: ${buildInfo.ms}ms buffer=${buildInfo.sizeKB}KB`)

  // 重新打开编辑器并拖拽
  await page.goto('http://localhost:5173/#/editor')
  await page.waitForLoadState('networkidle')
  const characterItem = page.locator('[data-testid="character-item"]').first()
  await characterItem.waitFor({ state: 'visible', timeout: 15000 })
  await characterItem.click({ timeout: 10000 })
  await page.waitForTimeout(2000)
  const glyphComp = page.locator('[data-testid="component-item"][data-type="glyph"]').first()
  await glyphComp.waitFor({ state: 'visible', timeout: 10000 })
  await glyphComp.click({ timeout: 10000 })
  await page.waitForTimeout(800)

  const canvas = page.locator('canvas.editor-canvas').first()
  await canvas.waitFor({ state: 'visible', timeout: 10000 })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('no canvas')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  const t0 = Date.now()
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let i = 1; i <= 150; i++) {
    await page.mouse.move(cx + i, cy + i)
  }
  await page.mouse.up()
  const dragWallMs = Date.now() - t0

  const lt = await page.evaluate(async () => {
    const w = window as any
    const tasks: number[] = []
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) tasks.push((e as any).duration)
    })
    try { po.observe({ entryTypes: ['longtask'] }) } catch { /* webkit */ }
    w.__ltTasks = tasks
    return 'ok'
  })
  await page.waitForTimeout(500)
  console.log(`[UI-DRAG] engine=${test.info().project.name} afterFontBuild: dragWallMs=${dragWallMs} perMove=${(dragWallMs / 150).toFixed(1)}ms errors=${pageErrors.length}`)
  if (pageErrors.length) console.log('[UI-DRAG] errors:\n' + pageErrors.slice(0, 6).join('\n---\n'))
  test.info().annotations.push({ type: 'perf', description: JSON.stringify({ buildInfo, dragWallMs, perMove: dragWallMs / 150 }) })
})
