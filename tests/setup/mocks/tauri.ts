/**
 * Tauri API 桩，避免在 jsdom 中单测误触桌面专有分支。
 * 在 vitest.setup.ts 中 import './mocks/tauri' 即可全局生效。
 */
import { vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  listen: vi.fn().mockResolvedValue(() => {}),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    setTitle: vi.fn(),
    listen: vi.fn(),
  })),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(null),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn().mockResolvedValue(new Uint8Array()),
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue(''),
}))
