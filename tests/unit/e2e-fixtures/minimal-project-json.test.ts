import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(dir, '../../e2e/fixtures/minimal-project-file.json')

describe('E2E minimal project fixture JSON', () => {
  it('parses and has IFile-like keys', () => {
    const data = JSON.parse(readFileSync(fixturePath, 'utf-8')) as Record<string, unknown>
    expect(data.uuid).toBeTruthy()
    expect(data.name).toBeTruthy()
    expect(Array.isArray(data.characterList)).toBe(true)
    expect((data.characterList as unknown[]).length).toBeGreaterThan(0)
  })
})
