import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { getFileApplications, toJsonDoc } from '@/features/applications/applicationStorage'
import type { IFile } from '@/core/types'
import type { IApplicationDocument } from '@/features/applications/types'

function makeDoc(): IApplicationDocument {
  return {
    schemaVersion: 1,
    type: 'card',
    id: 'app-1',
    name: '测试卡片',
    createdAt: 1,
    updatedAt: 2,
    fontBuffer: new Uint8Array([1, 2, 3, 4]).buffer,
    fontFamily: 'fp-app-card-app-1',
    videos: [],
    micros: [],
    data: {
      canvas: { width: 1920, height: 1080, background: '#fff' },
      components: [
        {
          kind: 'freeText',
          id: 'c1',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          text: '新年',
          fontSize: 40,
          direction: 'horizontal',
          color: '#000',
        },
      ],
    },
  }
}

function makeFile(): IFile {
  return {
    uuid: 'file-1',
    name: '工程',
    width: 1000,
    height: 1000,
    saved: false,
    iconsCount: 0,
    characterList: [],
  }
}

describe('toJsonDoc', () => {
  it('剥离字体二进制并深层剥离 reactive（工程 JSON 安全）', () => {
    const doc = reactive(makeDoc())
    const plain = toJsonDoc(doc)
    expect(plain.fontBuffer).toBeUndefined()
    expect(() => JSON.stringify(plain)).not.toThrow()
  })

  it('深拷贝：修改纯对象不影响原文档', () => {
    const doc = reactive(makeDoc())
    const plain = toJsonDoc(doc) as { data: { components: Array<{ text: string }> } }
    plain.data.components[0].text = '改'
    expect((doc.data as { components: Array<{ text: string }> }).components[0].text).toBe('新年')
  })
})

describe('getFileApplications', () => {
  it('未初始化时创建空列表结构', () => {
    const file = reactive(makeFile())
    const apps = getFileApplications(file)
    expect(apps).toEqual({ card: [], logo: [], avatar: [] })
    expect(file.applications).toBe(apps)
  })
})
