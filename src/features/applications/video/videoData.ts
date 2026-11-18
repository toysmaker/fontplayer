import { genUUID } from '@/utils/uuid'
import type { IAnimationClip, ICharacterFileLite } from '@/core/types'
import type { IAppClipSnapshot, IAppVideoDocument, IAppVideoTrack, IPlacedClip } from '../types'

/**
 * 应用视频文档：纯数据工具（创建、时长、活动剪辑窗口、快速排列、快照固化）。
 */

export function createAppVideoDoc(name: string, width: number, height: number, fps = 30): IAppVideoDocument {
  const now = Date.now()
  return {
    id: genUUID(),
    name,
    fps,
    width,
    height,
    tracks: [],
    snapshots: [],
    createdAt: now,
    updatedAt: now,
  }
}

/** 剪辑时长（秒）：末关键帧 - 首关键帧 */
export function clipDurationSeconds(clip: IAnimationClip): number {
  const kfs = [...clip.keyframes].sort((a, b) => a.time - b.time)
  if (kfs.length === 0) return 1
  return Math.max(0.001, kfs[kfs.length - 1].time - kfs[0].time)
}

/** 剪辑渲染起始时间（首关键帧时间） */
export function clipFirstTime(clip: IAnimationClip): number {
  const kfs = [...clip.keyframes].sort((a, b) => a.time - b.time)
  return kfs.length > 0 ? kfs[0].time : 0
}

/** 某轨在 time 时刻的活动剪辑（含起始/结束） */
export function activePlacedClipAt(
  track: IAppVideoTrack,
  snapshots: IAppClipSnapshot[],
  time: number
): { placed: IPlacedClip; snapshot: IAppClipSnapshot; localTime: number } | null {
  let result: { placed: IPlacedClip; snapshot: IAppClipSnapshot } | null = null
  for (const placed of track.clips) {
    const snapshot = snapshots.find(
      (s) => s.charUuid === track.charUuid && s.clipId === placed.clipId
    )
    if (!snapshot) continue
    const duration = clipDurationSeconds(snapshot.clip)
    if (time >= placed.startTime && time < placed.startTime + duration) {
      result = { placed, snapshot }
    }
  }
  if (!result) return null
  return {
    ...result,
    localTime: clipFirstTime(result.snapshot.clip) + (time - result.placed.startTime),
  }
}

/** 视频总时长（秒）：所有放置剪辑的结束时间最大值，最少 1s */
export function videoTotalDuration(video: IAppVideoDocument): number {
  let max = 1
  for (const track of video.tracks) {
    for (const placed of track.clips) {
      const snapshot = video.snapshots.find(
        (s) => s.charUuid === track.charUuid && s.clipId === placed.clipId
      )
      if (!snapshot) continue
      const end = placed.startTime + clipDurationSeconds(snapshot.clip)
      if (end > max) max = end
    }
  }
  return max
}

/**
 * 快速排列：按卡片布局字符顺序（occurrenceIndex，缺失按原数组序）展平所有剪辑，
 * 第 k 个剪辑 startTime = k * interval。
 */
export function quickArrange(tracks: IAppVideoTrack[], interval: number): void {
  const ordered = [...tracks].sort(
    (a, b) => (a.occurrenceIndex ?? Number.MAX_SAFE_INTEGER) - (b.occurrenceIndex ?? Number.MAX_SAFE_INTEGER)
  )
  const placed: IPlacedClip[] = []
  for (const track of ordered) {
    for (const clip of track.clips) placed.push(clip)
  }
  placed.forEach((clip, index) => {
    clip.startTime = index * interval
  })
}

/** 固化快照（保存/插入时调用）：若已存在则覆盖 */
export function upsertSnapshot(
  video: IAppVideoDocument,
  charUuid: string,
  clipId: string,
  clip: IAnimationClip,
  char: ICharacterFileLite
): void {
  const index = video.snapshots.findIndex(
    (s) => s.charUuid === charUuid && s.clipId === clipId
  )
  // 关键：clip/char 可能来自 Vue reactive ref（Proxy），structuredClone 无法克隆
  // （DataCloneError）。字符与剪辑为纯 JSON 数据，JSON 序列化深拷贝即可。
  const snapshot: IAppClipSnapshot = {
    charUuid,
    clipId,
    clip: JSON.parse(JSON.stringify(clip)),
    char: JSON.parse(JSON.stringify(char)),
  }
  if (index >= 0) video.snapshots[index] = snapshot
  else video.snapshots.push(snapshot)
}

/**
 * 获取或创建「布局字符出现」子轴（重复字符各占一轨，一一对应卡片中的字符）。
 */
export function ensureTrackForOccurrence(
  video: IAppVideoDocument,
  occ: {
    id: string
    char: string
    charUuid: string
    x: number
    y: number
    fontSize: number
  },
  label: string,
  occurrenceIndex: number
): IAppVideoTrack {
  let track = video.tracks.find((t) => t.occurrenceId === occ.id)
  if (!track) {
    track = {
      id: genUUID(),
      label,
      charUuid: occ.charUuid,
      layoutPosition: { x: occ.x, y: occ.y, fontSize: occ.fontSize },
      occurrenceId: occ.id,
      occurrenceIndex,
      clips: [],
    }
    video.tracks.push(track)
  } else {
    // 布局可能变化：刷新位置
    track.layoutPosition = { x: occ.x, y: occ.y, fontSize: occ.fontSize }
  }
  return track
}
