import { describe, expect, it } from 'vitest'
import type { IAnimationClip } from '@/core/types'
import type { IAppVideoDocument, IAppVideoTrack } from '@/features/applications/types'
import {
  activePlacedClipAt,
  clipDurationSeconds,
  clipFirstTime,
  quickArrange,
  videoTotalDuration,
} from '@/features/applications/video/videoData'

function makeClip(id: string, first = 0, last = 2): IAnimationClip {
  return {
    id,
    name: `clip-${id}`,
    fps: 30,
    createdAt: 0,
    updatedAt: 0,
    keyframes: [
      { id: 'k1', time: first, hidden: false, params: {}, positions: {} },
      { id: 'k2', time: last, hidden: false, params: {}, positions: {} },
    ],
  }
}

function makeTrack(charUuid: string, label: string, clips: Array<{ clipId: string; startTime: number; id?: string }>): IAppVideoTrack {
  return {
    id: `track-${charUuid}`,
    label,
    charUuid,
    layoutPosition: { x: 0, y: 0, fontSize: 80 },
    clips: clips.map((c, i) => ({ id: c.id ?? `pc-${i}`, clipId: c.clipId, startTime: c.startTime })),
  }
}

function makeVideo(tracks: IAppVideoTrack[]): IAppVideoDocument {
  const snapshots: IAppVideoDocument['snapshots'] = []
  for (const track of tracks) {
    for (const placed of track.clips) {
      snapshots.push({
        charUuid: track.charUuid,
        clipId: placed.clipId,
        clip: makeClip(placed.clipId),
        char: {
          uuid: track.charUuid,
          type: 'character',
          character: { uuid: track.charUuid, text: track.label, unicode: 'U+0000' },
          components: [],
          groups: [],
          orderedList: [],
        } as never,
      })
    }
  }
  return {
    id: 'v1',
    name: 'video',
    fps: 30,
    width: 100,
    height: 100,
    tracks,
    snapshots,
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('clipDurationSeconds / clipFirstTime', () => {
  it('时长 = 末关键帧 - 首关键帧', () => {
    expect(clipDurationSeconds(makeClip('a', 1, 4))).toBe(3)
    expect(clipFirstTime(makeClip('a', 1, 4))).toBe(1)
  })
})

describe('activePlacedClipAt', () => {
  it('在窗口内返回活动剪辑与本地时间', () => {
    const track = makeTrack('c1', '新', [{ clipId: 'a', startTime: 2 }])
    const video = makeVideo([track])
    const active = activePlacedClipAt(track, video.snapshots, 2.5)
    expect(active?.placed.startTime).toBe(2)
    expect(active?.localTime).toBeCloseTo(0.5)
  })

  it('窗口外返回 null', () => {
    const track = makeTrack('c1', '新', [{ clipId: 'a', startTime: 2 }])
    const video = makeVideo([track])
    expect(activePlacedClipAt(track, video.snapshots, 1.9)).toBeNull()
    expect(activePlacedClipAt(track, video.snapshots, 4.0)).toBeNull()
  })
})

describe('videoTotalDuration', () => {
  it('取所有剪辑结束时间最大值，最少 1s', () => {
    const tracks = [
      makeTrack('c1', '新', [{ clipId: 'a', startTime: 0 }]),
      makeTrack('c2', '年', [{ clipId: 'b', startTime: 3 }]),
    ]
    const video = makeVideo(tracks)
    expect(videoTotalDuration(video)).toBeCloseTo(5)
  })
})

describe('quickArrange', () => {
  it('按轨道顺序（字符顺序）展平，间隔依次排开', () => {
    const tracks = [
      makeTrack('c1', '新', [
        { clipId: 'a', startTime: 99 },
        { clipId: 'b', startTime: 99 },
      ]),
      makeTrack('c2', '年', [{ clipId: 'c', startTime: 99 }]),
    ]
    quickArrange(tracks, 1.5)
    const flat = tracks.flatMap((t) => t.clips.map((c) => c.startTime))
    expect(flat).toEqual([0, 1.5, 3])
  })

  it('按出现序号（occurrenceIndex）排序，重复字符按布局顺序排列', () => {
    const tracks = [
      makeTrack('c1', '乐', [{ clipId: 'a', startTime: 99 }]),
      makeTrack('c2', '乐', [{ clipId: 'b', startTime: 99 }]),
    ]
    // 出现顺序与插入顺序相反
    tracks[0].occurrenceIndex = 1
    tracks[1].occurrenceIndex = 0
    quickArrange(tracks, 2)
    const order = [...tracks]
      .sort((a, b) => (a.occurrenceIndex ?? 999) - (b.occurrenceIndex ?? 999))
      .map((t) => t.label)
    expect(order).toEqual(['乐', '乐'])
    const flat = [...tracks]
      .sort((a, b) => (a.occurrenceIndex ?? 999) - (b.occurrenceIndex ?? 999))
      .flatMap((t) => t.clips.map((c) => c.startTime))
    expect(flat).toEqual([0, 2])
  })
})
