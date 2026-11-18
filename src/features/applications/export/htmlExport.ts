import { buildLottieJson } from '@/features/animation/lottieExporter'
import { getCharacterMetrics } from '@/features/animation/render'
import { LOTTIE_PLAYER_JS } from '@/features/animation/referencePlayerHtml'
import { fontRenderStyle } from '@/core/script/globals'
import {
  computeAllCharPositions,
  type CharLayoutPosition,
} from '../canvas/AppCanvasRenderer'
import type { FontLibrary } from '../fontLibraryService'
import type { ICardAppData, IAppVideoDocument } from '../types'
import { clipDurationSeconds } from '../video/videoData'

/**
 * 应用 html 导出：自包含单文件页面（参照 referencePlayerHtml.ts 模式）。
 * - 组合视频：静态布局 DOM + 每剪辑 Lottie 播放器 + 子轴调度器
 * - 静态卡片：@font-face + 绝对定位复刻布局
 */

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface ClipRuntimeInfo {
  x: number
  y: number
  size: number
  start: number
  end: number
  charText: string
  anim: unknown
}

function buildClipRuntimeInfos(
  video: IAppVideoDocument,
  scale: number
): ClipRuntimeInfo[] {
  const metrics = getCharacterMetrics()
  const infos: ClipRuntimeInfo[] = []
  for (const track of video.tracks) {
    if (!track.layoutPosition) continue
    for (const placed of track.clips) {
      const snapshot = video.snapshots.find(
        (s) => s.charUuid === track.charUuid && s.clipId === placed.clipId
      )
      if (!snapshot) continue
      const duration = clipDurationSeconds(snapshot.clip)
      const anim = JSON.parse(
        buildLottieJson({
          clip: snapshot.clip,
          char: snapshot.char,
          metrics,
          style: (snapshot.clip.renderStyle ?? fontRenderStyle.value) as 'contour' | 'black' | 'color',
        })
      )
      const size = Math.max(1, Math.round(track.layoutPosition.fontSize * scale))
      infos.push({
        x: track.layoutPosition.x * scale,
        y: track.layoutPosition.y * scale,
        size,
        start: placed.startTime,
        end: placed.startTime + duration,
        charText: snapshot.char.character?.text ?? track.label,
        anim,
      })
    }
  }
  return infos
}

export function buildAppVideoPlayerHtml(
  video: IAppVideoDocument,
  cardData: ICardAppData,
  library: FontLibrary
): string {
  const stageW = Math.min(video.width, 1200)
  const scale = stageW / video.width

  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')!
  const charPositions = computeAllCharPositions(cardData, measureCtx, library.family)

  const clipInfos = buildClipRuntimeInfos(video, scale)
  const duration = Math.max(
    1,
    ...clipInfos.map((c) => c.end)
  )

  // 静态字符（有动效轨的字符：活动时由 JS 隐藏）
  const staticChars: Array<CharLayoutPosition & { animated: boolean }> = [...charPositions.values()].map(
    (p) => {
      const animated = clipInfos.some((c) => c.charText === p.char)
      return {
        char: p.char,
        x: p.x * scale,
        y: p.y * scale,
        fontSize: p.fontSize * scale,
        animated,
      }
    }
  )

  const fontBase64 = arrayBufferToBase64(library.buffer)
  const name = escapeHtml(video.name || 'video')

  const clipsJson = JSON.stringify(clipInfos).replace(/</g, '\\u003c')
  const staticJson = JSON.stringify(staticChars).replace(/</g, '\\u003c')
  const stageH = Math.round(video.height * scale)

  const staticSpans = staticChars
    .map(
      (c, i) =>
        `<span id="s${i}" data-char="${escapeHtml(c.char)}" style="position:absolute;left:${c.x.toFixed(1)}px;top:${c.y.toFixed(1)}px;font-size:${c.fontSize.toFixed(1)}px;font-family:'appfont',sans-serif;color:${c.color ?? '#000'};white-space:pre;">${escapeHtml(c.char)}</span>`
    )
    .join('\n')

  const clipDivs = clipInfos
    .map(
      (_, i) =>
        `<canvas id="c${i}" style="position:absolute;display:none;"></canvas>`
    )
    .join('\n')

  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${name}</title>
<style>
  @font-face { font-family: 'appfont'; src: url(data:font/opentype;base64,${fontBase64}) format('opentype'); }
  html, body { margin: 0; padding: 0; height: 100%; background: #14161a; display: flex;
    align-items: center; justify-content: center; }
  .stage-wrap { max-width: 100%; overflow: auto; }
  .stage { position: relative; width: ${stageW}px; height: ${stageH}px; background: ${cardData.canvas.background};
    overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,.5); }
</style>
</head>
<body>
<div class="stage-wrap">
  <div class="stage" id="stage">
${staticSpans}
${clipDivs}
  </div>
</div>
<script>
(function () {
  var CLIPS = ${clipsJson};
  var STATIC = ${staticJson};
  var DURATION = ${duration};
${LOTTIE_PLAYER_JS}
  var players = [];
  var clipEls = [];
  for (var i = 0; i < CLIPS.length; i++) {
    var c = CLIPS[i];
    var el = document.getElementById('c' + i);
    el.width = c.size;
    el.height = c.size;
    el.style.left = c.x + 'px';
    el.style.top = c.y + 'px';
    el.style.width = c.size + 'px';
    el.style.height = c.size + 'px';
    clipEls.push(el);
    players.push(makeLottiePlayer(c.anim, el));
  }
  var staticEls = [];
  for (var j = 0; j < STATIC.length; j++) {
    staticEls.push(document.getElementById('s' + j));
  }
  var start = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    var t = ((now - start) / 1000) % DURATION;
    var activeChars = {};
    for (var i = 0; i < CLIPS.length; i++) {
      var c = CLIPS[i];
      var visible = t >= c.start && t < c.end;
      clipEls[i].style.display = visible ? 'block' : 'none';
      if (visible) {
        activeChars[c.charText] = true;
        players[i].render((t - c.start) * players[i].fps);
      }
    }
    for (var j = 0; j < STATIC.length; j++) {
      var s = STATIC[j];
      staticEls[j].style.visibility = (s.animated && activeChars[s.char]) ? 'hidden' : 'visible';
    }
  }
  requestAnimationFrame(tick);
})();
</script>
</body>
</html>
`
}

/** 静态卡片 html：@font-face + 绝对定位复刻布局（图片 dataURL 内嵌） */
export async function buildStaticCardHtml(
  cardData: ICardAppData,
  library: FontLibrary,
  name: string
): Promise<string> {
  const stageW = Math.min(cardData.canvas.width, 1200)
  const scale = stageW / cardData.canvas.width
  const stageH = Math.round(cardData.canvas.height * scale)
  const fontBase64 = arrayBufferToBase64(library.buffer)

  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')!
  const charPositions = computeAllCharPositions(cardData, measureCtx, library.family)

  // 图片组件：渲染为 dataURL（含内置图样）
  const imageComponents: Array<{ x: number; y: number; w: number; h: number; dataUrl: string; opacity: number }> = []
  for (const comp of cardData.components) {
    if (comp.kind !== 'image') continue
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(comp.width))
    c.height = Math.max(1, Math.round(comp.height))
    const ctx = c.getContext('2d')!
    let src: CanvasImageSource | null = null
    if (comp.source.kind === 'pattern') {
      const { getPatternCanvas } = await import('../canvas/patterns')
      src = getPatternCanvas(comp.source.patternId)
    } else {
      const img = new Image()
      img.src = comp.source.dataUrl
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })
      src = img
    }
    if (src) ctx.drawImage(src, 0, 0, c.width, c.height)
    imageComponents.push({
      x: comp.x * scale,
      y: comp.y * scale,
      w: comp.width * scale,
      h: comp.height * scale,
      dataUrl: c.toDataURL('image/png'),
      opacity: comp.opacity ?? 1,
    })
  }

  const imgDivs = imageComponents
    .map(
      (img) =>
        `<img src="${img.dataUrl}" style="position:absolute;left:${img.x.toFixed(1)}px;top:${img.y.toFixed(1)}px;width:${img.w.toFixed(1)}px;height:${img.h.toFixed(1)}px;opacity:${img.opacity};" />`
    )
    .join('\n')

  const textSpans = [...charPositions.values()]
    .map(
      (p) =>
        `<span style="position:absolute;left:${(p.x * scale).toFixed(1)}px;top:${(p.y * scale).toFixed(1)}px;font-size:${(p.fontSize * scale).toFixed(1)}px;font-family:'appfont',sans-serif;color:${p.color ?? '#000'};white-space:pre;">${escapeHtml(p.char)}</span>`
    )
    .join('\n')

  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(name)}</title>
<style>
  @font-face { font-family: 'appfont'; src: url(data:font/opentype;base64,${fontBase64}) format('opentype'); }
  html, body { margin: 0; padding: 0; height: 100%; background: #14161a; display: flex;
    align-items: center; justify-content: center; }
  .stage { position: relative; width: ${stageW}px; height: ${stageH}px; background: ${cardData.canvas.background};
    overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,.5); }
</style>
</head>
<body>
<div class="stage">
${imgDivs}
${textSpans}
</div>
</body>
</html>
`
}
