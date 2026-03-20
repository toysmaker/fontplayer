import * as R from 'ramda'
import { getEnv } from '@/utils/env'
import { useProjectStore } from '@/stores/project'
import { useGlyphStore } from '@/stores/glyph'
import { useCharacterStore } from '@/stores/character'
import { useEditorStore } from '@/stores/editor'
import { EditStatus } from '@/core/types'
import { executeGlyphScript } from '@/core/script/ScriptExecutor'
import { getGlyphParametersArray } from './glyphProgrammingUtils'

let hasShowWindow = false
let unsubscribers: Array<() => void> = []
let webMessageHandler: ((e: MessageEvent) => void) | null = null

export function getProgrammingWindowOpen(): boolean {
  return hasShowWindow
}

function onScriptWindowClose() {
  hasShowWindow = false
}

function applySyncFromPayload(payload: {
  __constants?: unknown
  __parameters?: unknown
  __script?: string
}) {
  const projectStore = useProjectStore()
  const glyphStore = useGlyphStore()
  const characterStore = useCharacterStore()
  const editorStore = useEditorStore()
  const file = projectStore.selectedFile
  if (!file) return

  if (typeof payload.__constants !== 'undefined') {
    projectStore.updateFile(file.uuid, {
      constants: R.clone(payload.__constants) as typeof file.constants,
    })
  }

  if (editorStore.editStatus === EditStatus.Glyph && glyphStore.editingGlyph) {
    if (Array.isArray(payload.__parameters)) {
      glyphStore.editingGlyph.parameters = R.clone(payload.__parameters) as typeof glyphStore.editingGlyph.parameters
    }
    if (typeof payload.__script === 'string') {
      glyphStore.editingGlyph.script = payload.__script
    }
  } else if (editorStore.editStatus === EditStatus.Edit && characterStore.editingCharacter) {
    if (typeof payload.__script === 'string') {
      characterStore.editingCharacter.script = payload.__script
    }
  }
}

async function handleWebPostMessage(e: MessageEvent) {
  if (e.origin !== location.origin) return
  if (e.data === 'sync-info') {
    const projectStore = useProjectStore()
    const glyphStore = useGlyphStore()
    const characterStore = useCharacterStore()
    const editorStore = useEditorStore()
    const file = projectStore.selectedFile
    if (!file) return

    const constantsRaw = localStorage.getItem('constants')
    const parametersRaw = localStorage.getItem('parameters')
    const scriptStr = localStorage.getItem('script')

    if (constantsRaw) {
      try {
        projectStore.updateFile(file.uuid, {
          constants: JSON.parse(constantsRaw),
        })
      } catch {
        /* ignore */
      }
    }
    if (editorStore.editStatus === EditStatus.Glyph && glyphStore.editingGlyph && parametersRaw) {
      try {
        glyphStore.editingGlyph.parameters = JSON.parse(parametersRaw)
      } catch {
        /* ignore */
      }
    }
    if (editorStore.editStatus === EditStatus.Glyph && glyphStore.editingGlyph && scriptStr !== null) {
      glyphStore.editingGlyph.script = scriptStr
    } else if (
      editorStore.editStatus === EditStatus.Edit &&
      characterStore.editingCharacter &&
      scriptStr !== null
    ) {
      characterStore.editingCharacter.script = scriptStr
    }
  } else if (e.data === 'execute-script') {
    const glyphStore = useGlyphStore()
    const editorStore = useEditorStore()
    const projectStore = useProjectStore()
    const file = projectStore.selectedFile
    if (!file) return

    if (editorStore.editStatus === EditStatus.Glyph && glyphStore.editingGlyph) {
      try {
        const constantsRaw = localStorage.getItem('constants')
        const parametersRaw = localStorage.getItem('parameters')
        const scriptStr = localStorage.getItem('script')
        if (constantsRaw) {
          projectStore.updateFile(file.uuid, { constants: JSON.parse(constantsRaw) })
        }
        if (parametersRaw) {
          glyphStore.editingGlyph.parameters = JSON.parse(parametersRaw)
        }
        if (scriptStr !== null) {
          glyphStore.editingGlyph.script = scriptStr
        }
      } catch {
        /* ignore */
      }
      executeGlyphScript(glyphStore.editingGlyph, glyphStore.editingGlyph.uuid)
      glyphStore.bumpProgrammingPreview()
    }
  } else if (e.data === 'close-window') {
    onScriptWindowClose()
  }
}

/**
 * 注册主窗口与脚本子窗口的通信（在 ToolBar onMounted 调用一次）
 */
export async function setupProgrammingWindowBridge(): Promise<() => void> {
  unsubscribers = []

  if (getEnv() === 'tauri') {
    const { listen, emit } = await import('@tauri-apps/api/event')

    const u1 = await listen('on-webview-mounted', async () => {
      const projectStore = useProjectStore()
      const glyphStore = useGlyphStore()
      const characterStore = useCharacterStore()
      const editorStore = useEditorStore()
      const file = projectStore.selectedFile
      if (!file) return

      if (editorStore.editStatus === EditStatus.Edit && characterStore.editingCharacter) {
        await emit('init-data', {
          __constants: R.clone(file.constants ?? []),
          __script: characterStore.editingCharacter.script ?? '',
          __isWeb: false,
          __uuid: characterStore.editingCharacter.uuid,
        })
      } else if (editorStore.editStatus === EditStatus.Glyph && glyphStore.editingGlyph) {
        await emit('init-data', {
          __constants: R.clone(file.constants ?? []),
          __parameters: R.clone(getGlyphParametersArray(glyphStore.editingGlyph)),
          __script: glyphStore.editingGlyph.script ?? '',
          __isWeb: false,
          __uuid: glyphStore.editingGlyph.uuid,
        })
      }
    })

    const u2 = await listen('sync-info', (e) => {
      const p = e.payload as {
        __constants?: unknown
        __parameters?: unknown
        __script?: string
      }
      applySyncFromPayload({
        __constants: p.__constants,
        __parameters: p.__parameters,
        __script: p.__script,
      })
    })

    const u3 = await listen('execute-script', () => {
      const glyphStore = useGlyphStore()
      const editorStore = useEditorStore()
      if (editorStore.editStatus === EditStatus.Glyph && glyphStore.editingGlyph) {
        executeGlyphScript(glyphStore.editingGlyph, glyphStore.editingGlyph.uuid)
        glyphStore.bumpProgrammingPreview()
      }
    })

    const u4 = await listen('on-webview-close', () => {
      onScriptWindowClose()
    })

    unsubscribers.push(u1, u2, u3, u4)
  } else {
    webMessageHandler = handleWebPostMessage
    window.addEventListener('message', webMessageHandler)
    unsubscribers.push(() => {
      if (webMessageHandler) {
        window.removeEventListener('message', webMessageHandler)
        webMessageHandler = null
      }
    })
  }

  return () => {
    unsubscribers.forEach((u) => {
      try {
        u()
      } catch {
        /* noop */
      }
    })
    unsubscribers = []
  }
}

export async function openProgrammingWindow(): Promise<void> {
  if (hasShowWindow) return

  const projectStore = useProjectStore()
  const glyphStore = useGlyphStore()
  const characterStore = useCharacterStore()
  const editorStore = useEditorStore()
  const file = projectStore.selectedFile

  if (!file) return

  const hashBase = `${location.origin}${location.pathname}`
  hasShowWindow = true

  if (getEnv() === 'web') {
    if (editorStore.editStatus === EditStatus.Edit && characterStore.editingCharacter) {
      window.__constants = R.clone(file.constants ?? [])
      window.__uuid = characterStore.editingCharacter.uuid
      window.__script = characterStore.editingCharacter.script ?? ''
      window.__is_web = true
      const popup = window.open(
        `${hashBase}#/character-programming-editor`,
        'character',
        `popup,width=1280,height=800,left=${(screen.width - 1280) / 2}`,
      )
      if (!popup) hasShowWindow = false
    } else if (editorStore.editStatus === EditStatus.Glyph && glyphStore.editingGlyph) {
      window.__constants = R.clone(file.constants ?? [])
      window.__parameters = R.clone(getGlyphParametersArray(glyphStore.editingGlyph))
      window.__uuid = glyphStore.editingGlyph.uuid
      window.__script = glyphStore.editingGlyph.script ?? ''
      window.__is_web = true
      const popup = window.open(
        `${hashBase}#/glyph-programming-editor`,
        'custom-glyph',
        `popup,width=1280,height=800,left=${(screen.width - 1280) / 2}`,
      )
      if (!popup) hasShowWindow = false
    } else {
      hasShowWindow = false
    }
    return
  }

  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')

  if (editorStore.editStatus === EditStatus.Edit && characterStore.editingCharacter) {
    const w = new WebviewWindow('character-script', {
      url: `${hashBase}#/character-programming-editor`,
      width: 1280,
      height: 800,
      x: (screen.width - 1280) / 2,
      y: (screen.height - 800) / 2,
    })
    w.once('tauri://destroyed', () => onScriptWindowClose())
  } else if (editorStore.editStatus === EditStatus.Glyph && glyphStore.editingGlyph) {
    const w = new WebviewWindow('glyph-script', {
      url: `${hashBase}#/glyph-programming-editor`,
      width: 1280,
      height: 800,
      x: (screen.width - 1280) / 2,
      y: (screen.height - 800) / 2,
    })
    w.once('tauri://destroyed', () => onScriptWindowClose())
  } else {
    hasShowWindow = false
  }
}
