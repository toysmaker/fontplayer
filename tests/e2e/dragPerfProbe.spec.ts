/**
 * 拖拽性能探针(临时排查用)
 * 在真实浏览器中测量: 脚本执行 / 画布渲染 / 拖拽每 mousemove 处理耗时
 */
import { test } from '@playwright/test'

test('drag perf probe', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = msg.text()
      if (text.includes('ScriptExecutor') || text.includes('Error') || text.includes('error')) {
        consoleErrors.push(text.slice(0, 300))
      }
    }
  })
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + String(err).slice(0, 300)))

  await page.goto('http://localhost:5173')
  await page.waitForLoadState('networkidle')

  const report = await page.evaluate(async () => {
    const out: string[] = []
    const t = (label: string, fn: () => void, times = 1) => {
      const t0 = performance.now()
      for (let i = 0; i < times; i++) fn()
      const ms = performance.now() - t0
      out.push(`${label}: ${(ms / times).toFixed(2)}ms/call x${times}`)
      return ms / times
    }

    // 1. 真实脚本执行(digit 8)
    const { digits } = await import('/src/templates/digits.ts')
    const d8: any = (digits as any[]).find((d) => d.name === '8')
    const scriptText = await (await fetch('/templates/digits/8.js')).text()
    const params: Record<string, any> = {}
    for (const p of [...(d8.params || []), ...(d8.globalParams || [])]) params[p.name] = p.value ?? p.default

    const glyphValue: any = {
      uuid: 'probe-digit-8',
      name: '8',
      script: `function script_probe_digit_8(glyph, constants, FP) {\n${scriptText}\n}`,
      parameters: Object.entries(params).map(([name, value]) => ({ name, value })),
      components: [],
    }

    const { executeGlyphScript } = await import('/src/core/script/ScriptExecutor.ts')
    const { instanceManager } = await import('/src/core/instance/InstanceManager.ts')

    t('executeGlyphScript digit8', () => {
      executeGlyphScript(glyphValue, 'probe-digit-8')
    }, 3)

    const inst: any = instanceManager.getPooledInstance('probe-digit-8')
    const totalPoints = (inst?._components || []).reduce((n: number, c: any) => n + ((c.points || []).length), 0)
    out.push(`geometry: components=${(inst?._components || []).length} points=${totalPoints}`)

    // 2. 真实画布渲染(整个字符 = 1 个 digit8 字形组件)
    const canvas = document.createElement('canvas')
    canvas.width = 2000
    canvas.height = 2000
    document.body.appendChild(canvas)

    const character: any = {
      uuid: 'probe-char',
      components: [{ type: 'glyph', uuid: 'probe-digit-8', ox: 0, oy: 0, usedInCharacter: true, value: glyphValue }],
      orderedList: [{ type: 'component', uuid: 'probe-digit-8' }],
      info: { gridSettings: null },
    }

    const { render } = await import('/src/core/canvas/EditorCanvasRenderer.ts')
    const { useEditorPreferenceStore } = await import('/src/stores/editorPreference.ts')
    const pref = useEditorPreferenceStore()
    const { useEditorStore } = await import('/src/stores/editor.ts')
    const editorStore = useEditorStore()

    const renderOnce = () => {
      render(canvas, true, false, {
        mode: 'character',
        character,
        components: character.components,
        background: pref.background || { type: 'color', color: '#ffffff' },
        grid: pref.grid || { type: 'none' },
        layoutTransformGrid: undefined as any,
      })
    }

    renderOnce() // 预热
    t('render() character canvas', renderOnce, 20)

    const { renderJoints } = await import('/src/core/script/Joint.ts')
    const selected = character.components[0]
    editorStore.checkJoints = true
    t('render + renderJoints', () => {
      renderOnce()
      renderJoints(selected, canvas)
    }, 20)

    // 3. 真实拖拽器: 每 mousemove 的 handler 耗时(整体拖拽)
    const { CharacterGlyphDragger } = await import('/src/features/tools/glyphDragger/adapters/CharacterGlyphDragger.ts')
    const { computeGlyphComponentBoundingBox } = await import('/src/core/utils/glyphBounds.ts')

    const bbox = computeGlyphComponentBoundingBox(selected, { ox: 0, oy: 0 })
    const cx = bbox ? bbox.x + bbox.w / 2 : 250
    const cy = bbox ? bbox.y + bbox.h / 2 : 250
    out.push(`bbox: x=${bbox?.x?.toFixed(0)} y=${bbox?.y?.toFixed(0)} w=${bbox?.w?.toFixed(0)} h=${bbox?.h?.toFixed(0)} click=(${cx.toFixed(0)},${cy.toFixed(0)})`)

    const moveTimes: number[] = []
    const dragger = new CharacterGlyphDragger({
      canvas,
      context: {
        mode: 'character' as any,
        component: character.components[0],
        componentUUID: 'probe-digit-8',
        glyph: glyphValue,
      },
      onRender: renderOnce,
      onUpdate: () => {},
      characterStore: {
        editingCharacter: character,
        updateComponent: () => {},
      },
      displayWidth: 500,
      displayHeight: 500,
      unitsPerEm: 1000,
      getCoord: (c: number) => c,
      draggable: () => true,
      checkJoints: () => false,
    } as any)
    dragger.activate()

    const fireWin = (type: string, x: number, y: number, buttons = 0) => {
      const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, buttons, view: window })
      const t0 = performance.now()
      window.dispatchEvent(e)
      moveTimes.push(performance.now() - t0)
    }
    const fireCanvas = (type: string, x: number, y: number, buttons = 0) => {
      const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, buttons, view: window })
      const t0 = performance.now()
      canvas.dispatchEvent(e)
      moveTimes.push(performance.now() - t0)
    }

    fireCanvas('mousedown', cx, cy, 1)
    for (let i = 1; i <= 200; i++) {
      fireWin('mousemove', cx + i, cy + i, 1)
    }
    fireWin('mouseup', cx + 200, cy + 200, 0)
    fireCanvas('mouseup', cx + 200, cy + 200, 0)
    dragger.deactivate()

    moveTimes.sort((a, b) => a - b)
    out.push(`mousemove handler (whole-glyph): p50=${moveTimes[100]?.toFixed(3)}ms p95=${moveTimes[190]?.toFixed(3)}ms max=${moveTimes[moveTimes.length - 1]?.toFixed(3)}ms (n=${moveTimes.length})`)

    document.body.removeChild(canvas)
    return out.join('\n')
  })

  console.log('\n[DRAGPERF]\n' + report + '\n')
  if (consoleErrors.length) {
    console.log('[CONSOLE-ERRORS]\n' + consoleErrors.slice(0, 12).join('\n---\n') + '\n')
  }
  test.info().annotations.push({ type: 'perf', description: report })
})

test('session snapshot tick probe', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.waitForLoadState('networkidle')

  const report = await page.evaluate(async () => {
    const out: string[] = []

    const { digits } = await import('/src/templates/digits.ts')
    const d8: any = (digits as any[]).find((d) => d.name === '8')
    const scriptText = await (await fetch('/templates/digits/8.js')).text()
    const params: Record<string, any> = {}
    for (const p of [...(d8.params || []), ...(d8.globalParams || [])]) params[p.name] = p.value ?? p.default

    const makeGlyphValue = (uuid: string) => ({
      uuid,
      name: '8',
      script: `function script_${uuid.replaceAll('-', '_')}(glyph, constants, FP) {\n${scriptText}\n}`,
      parameters: Object.entries(params).map(([name, value]) => ({ name, value })),
      components: [],
    })

    // 构造真实规模工程: 600 个字符, 每个含一个 digit8 字形组件
    const N = 600
    const characters: any[] = []
    for (let i = 0; i < N; i++) {
      const gv = makeGlyphValue(`glyph-${i}`)
      characters.push({
        uuid: `char-${i}`,
        character: { text: String(i) },
        components: [{ type: 'glyph', uuid: `glyph-${i}`, ox: 0, oy: 0, usedInCharacter: true, value: gv }],
        orderedList: [{ type: 'component', uuid: `glyph-${i}` }],
        info: { gridSettings: null },
      })
    }
    const file: any = {
      uuid: 'probe-file',
      name: 'probe',
      width: 1000,
      height: 1000,
      characterList: characters,
      glyphs: [], stroke_glyphs: [], radical_glyphs: [], comp_glyphs: [],
      constants: { k: 1 },
    }

    const { useProjectStore } = await import('/src/stores/project.ts')
    const projectStore = useProjectStore()
    projectStore.files = [file]
    projectStore.selectedFileUUID = file.uuid

    const { useCharacterStore } = await import('/src/stores/character.ts')
    const characterStore = useCharacterStore()
    characterStore.editingCharacter = JSON.parse(JSON.stringify(characters[0]))
    characterStore.editingCharacterUUID = characters[0].uuid

    const { useGlyphStore } = await import('/src/stores/glyph.ts')
    const glyphStore = useGlyphStore()
    glyphStore.editingGlyph = null

    // 组合测量 tick 的各环节(与 SessionSnapshotService.tick 一致)
    const editing = characterStore.editingCharacter

    // 小段: 克隆编辑字符 + updateCharacter(IDB 写入)
    let t0 = performance.now()
    const clone = JSON.parse(JSON.stringify(editing))
    out.push(`flushSmall clone(JSON roundtrip): ${(performance.now() - t0).toFixed(1)}ms size=${(JSON.stringify(editing).length / 1024).toFixed(0)}KB`)
    const { characterDataManager } = await import('/src/core/storage/CharacterDataManager.ts')
    t0 = performance.now()
    await characterDataManager.updateCharacter(file.uuid, clone)
    out.push(`characterDataManager.updateCharacter: ${(performance.now() - t0).toFixed(1)}ms`)

    // 大段: 分节序列化(200ms 预算)
    const { buildFileSections } = await import('/src/features/sessionSnapshot/snapshotSerializer.ts')
    t0 = performance.now()
    const sections = buildFileSections(file, 200)
    out.push(`buildFileSections: ${(performance.now() - t0).toFixed(1)}ms meta=${sections.meta ? 'yes' : 'null'} chars=${sections.chars ? (sections.chars.length / 1024).toFixed(0) + 'KB' : 'null'} glyphs=${sections.glyphs ? (sections.glyphs.length / 1024).toFixed(0) + 'KB' : 'null'}`)

    // IDB 写入大字符串
    const { indexedDBManager } = await import('/src/core/storage/IndexedDBManager.ts')
    if (sections.chars) {
      t0 = performance.now()
      await indexedDBManager.set('probe_ss_chars', sections.chars)
      out.push(`idb set chars: ${(performance.now() - t0).toFixed(1)}ms`)
    }
    if (sections.glyphs) {
      t0 = performance.now()
      await indexedDBManager.set('probe_ss_glyphs', sections.glyphs)
      out.push(`idb set glyphs: ${(performance.now() - t0).toFixed(1)}ms`)
    }
    await indexedDBManager.remove('probe_ss_chars')
    await indexedDBManager.remove('probe_ss_glyphs')

    // 内存
    const mem = (performance as any).memory
    if (mem) {
      out.push(`heap used: ${(mem.usedJSHeapSize / 1048576).toFixed(1)}MB`)
    }

    return out.join('\n')
  })

  console.log('\n[SNAPTICK]\n' + report + '\n')
  test.info().annotations.push({ type: 'perf', description: report })
})
