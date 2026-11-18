import { saveAs } from 'file-saver'
import type { IMicroInteraction } from '@/core/types'
import { buildLottieJson } from '@/features/animation/lottieExporter'
import { getCharacterMetrics } from '@/features/animation/render'
import { LOTTIE_PLAYER_JS } from '@/features/animation/referencePlayerHtml'
import { fontRenderStyle } from '@/core/script/globals'
import { computeAllCharPositions } from '../canvas/AppCanvasRenderer'
import type { FontLibrary } from '../fontLibraryService'
import type { ICardAppData, IAppVideoDocument } from '../types'
import { clipDurationSeconds, videoTotalDuration } from '../video/videoData'

/**
 * 应用级微交互导出：状态机的片段 = 应用视频（组合视频）。
 * - JSON：状态机数据 + 每视频的静态布局与每剪辑 Lottie（自包含）
 * - HTML：单文件播放器（静态布局 DOM + Lottie 剪辑 + 子轴调度 + 输入绑定状态机）
 */

interface BuiltVideoSegment {
  id: string
  name: string
  duration: number
  type: 'app-video'
  background: string
  stage: { width: number; height: number }
  staticChars: Array<{ char: string; x: number; y: number; fontSize: number; color?: string; animated: boolean }>
  clips: Array<{
    x: number
    y: number
    size: number
    start: number
    end: number
    charText: string
    animation: unknown
  }>
}

function buildVideoSegment(
  video: IAppVideoDocument,
  cardData: ICardAppData,
  library: FontLibrary,
  scale: number
): BuiltVideoSegment {
  const metrics = getCharacterMetrics()
  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')!
  const charPositions = computeAllCharPositions(cardData, measureCtx, library.family)

  const clips: BuiltVideoSegment['clips'] = []
  const animatedTexts = new Set<string>()
  for (const track of video.tracks) {
    if (!track.layoutPosition) continue
    for (const placed of track.clips) {
      const snapshot = video.snapshots.find(
        (s) => s.charUuid === track.charUuid && s.clipId === placed.clipId
      )
      if (!snapshot) continue
      const duration = clipDurationSeconds(snapshot.clip)
      const charText = snapshot.char.character?.text ?? track.label
      animatedTexts.add(charText)
      clips.push({
        x: track.layoutPosition.x * scale,
        y: track.layoutPosition.y * scale,
        size: Math.max(1, Math.round(track.layoutPosition.fontSize * scale)),
        start: placed.startTime,
        end: placed.startTime + duration,
        charText,
        animation: JSON.parse(
          buildLottieJson({
            clip: snapshot.clip,
            char: snapshot.char,
            metrics,
            style: (snapshot.clip.renderStyle ?? fontRenderStyle.value) as 'contour' | 'black' | 'color',
          })
        ),
      })
    }
  }

  const staticChars = [...charPositions.values()].map((p) => ({
    char: p.char,
    x: p.x * scale,
    y: p.y * scale,
    fontSize: p.fontSize * scale,
    color: p.color,
    animated: animatedTexts.has(p.char),
  }))

  return {
    id: video.id,
    name: video.name,
    duration: videoTotalDuration(video),
    type: 'app-video',
    background: cardData.canvas.background,
    stage: {
      width: Math.round(video.width * scale),
      height: Math.round(video.height * scale),
    },
    staticChars,
    clips,
  }
}

export function buildAppMicroData(
  micro: IMicroInteraction,
  videos: IAppVideoDocument[],
  cardData: ICardAppData,
  library: FontLibrary,
  stageW = 1200
): Record<string, unknown> {
  const referenced = new Set(micro.states.map((s) => s.segmentId))
  const segments = videos
    .filter((v) => referenced.has(v.id))
    .map((v) => buildVideoSegment(v, cardData, library, stageW / v.width))

  return {
    version: 3,
    name: micro.name,
    segments,
    states: micro.states.map((s) => ({
      id: s.id,
      name: s.name,
      segmentId: s.segmentId,
      loop: s.loop,
      position: { x: s.position.x, y: s.position.y },
    })),
    inputs: micro.inputs.map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type,
      source: i.source ?? 'custom',
      defaultValue: i.defaultValue,
    })),
    transitions: micro.transitions.map((t) => ({
      id: t.id,
      from: t.from,
      to: t.to,
      conditions: t.conditions.map((c) => ({
        inputId: c.inputId,
        operator: c.operator,
        value: c.value,
      })),
    })),
  }
}

export function exportAppMicroFile(
  micro: IMicroInteraction,
  videos: IAppVideoDocument[],
  cardData: ICardAppData,
  library: FontLibrary
): void {
  const data = buildAppMicroData(micro, videos, cardData, library)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  saveAs(blob, `${micro.name || 'micro-interaction'}.json`)
}

export function buildAppMicroPlayerHtml(
  micro: IMicroInteraction,
  videos: IAppVideoDocument[],
  cardData: ICardAppData,
  library: FontLibrary,
  name: string
): string {
  const data = buildAppMicroData(micro, videos, cardData, library)
  const json = JSON.stringify(data).replace(/</g, '\\u003c')

  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>微交互 - ${name.replace(/[<>"&]/g, '')}</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #14161a; color: #eee;
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, "PingFang SC", "Segoe UI", sans-serif; }
  .wrap { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .stage-wrap { position: relative; }
  .stage { position: relative; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,.5); }
  .stage span { position: absolute; white-space: pre; }
  .stage canvas { position: absolute; }
  .hint { font-size: 12px; color: #8a90a0; }
</style>
</head>
<body>
<div class="wrap">
  <div class="stage-wrap">
    <div class="stage" id="stage"></div>
  </div>
  <div class="hint">移动鼠标悬停 / 点击画面触发交互</div>
</div>
<script>
(function () {
  var DATA = ${json};
${LOTTIE_PLAYER_JS}
  var stage = document.getElementById('stage');
  var currentStateId = DATA.states.length ? DATA.states[0].id : null;
  var stateStart = performance.now();
  var inputVals = {};
  for (var i = 0; i < DATA.inputs.length; i++) {
    inputVals[DATA.inputs[i].id] = DATA.inputs[i].defaultValue;
  }

  // ---- 片段渲染资源 ----
  var segCache = {};
  function getSeg(segId) {
    if (segCache[segId]) return segCache[segId];
    var seg = null;
    for (var i = 0; i < DATA.segments.length; i++) {
      if (DATA.segments[i].id === segId) { seg = DATA.segments[i]; break; }
    }
    if (!seg) return null;
    var staticEls = [];
    for (var j = 0; j < seg.staticChars.length; j++) {
      var c = seg.staticChars[j];
      var el = document.createElement('span');
      el.style.left = c.x + 'px';
      el.style.top = c.y + 'px';
      el.style.fontSize = c.fontSize + 'px';
      el.style.color = c.color || '#000';
      el.textContent = c.char;
      staticEls.push({ el: el, animated: c.animated });
    }
    var clipRes = [];
    for (var k = 0; k < seg.clips.length; k++) {
      var cl = seg.clips[k];
      var cv = document.createElement('canvas');
      cv.width = cl.size;
      cv.height = cl.size;
      cv.style.left = cl.x + 'px';
      cv.style.top = cl.y + 'px';
      cv.style.width = cl.size + 'px';
      cv.style.height = cl.size + 'px';
      cv.style.display = 'none';
      clipRes.push({ el: cv, player: makeLottiePlayer(cl.animation, cv), clip: cl });
    }
    segCache[segId] = { seg: seg, staticEls: staticEls, clips: clipRes };
    return segCache[segId];
  }

  var activeSeg = null;
  function switchSegment(segId) {
    // 清空舞台
    while (stage.firstChild) stage.removeChild(stage.firstChild);
    activeSeg = getSeg(segId);
    if (!activeSeg) return;
    stage.style.width = activeSeg.seg.stage.width + 'px';
    stage.style.height = activeSeg.seg.stage.height + 'px';
    stage.style.background = activeSeg.seg.background;
    for (var i = 0; i < activeSeg.staticEls.length; i++) stage.appendChild(activeSeg.staticEls[i].el);
    for (var j = 0; j < activeSeg.clips.length; j++) stage.appendChild(activeSeg.clips[j].el);
    stateStart = performance.now();
  }

  function currentState() {
    for (var i = 0; i < DATA.states.length; i++) {
      if (DATA.states[i].id === currentStateId) return DATA.states[i];
    }
    return null;
  }

  function evaluate() {
    var st = currentState();
    if (!st) return;
    for (var i = 0; i < DATA.transitions.length; i++) {
      var tr = DATA.transitions[i];
      if (tr.from !== st.id || tr.conditions.length === 0) continue;
      var pass = true;
      for (var j = 0; j < tr.conditions.length; j++) {
        var c = tr.conditions[j];
        var actual = inputVals[c.inputId];
        var expected = c.value;
        if (c.operator === 'eq') pass = actual === expected;
        else if (c.operator === 'neq') pass = actual !== expected;
        else if (c.operator === 'gt') pass = Number(actual) > Number(expected);
        else if (c.operator === 'lt') pass = Number(actual) < Number(expected);
        if (!pass) break;
      }
      if (pass) {
        currentStateId = tr.to;
        switchSegment(tr.to);
        break;
      }
    }
  }

  function setInput(id, v) { inputVals[id] = v; evaluate(); }

  // ---- 输入绑定（绑定在舞台） ----
  for (var i = 0; i < DATA.inputs.length; i++) {
    (function (input) {
      if (input.source === 'hover') {
        stage.addEventListener('pointerenter', function () { setInput(input.id, true); });
        stage.addEventListener('pointerleave', function () { setInput(input.id, false); });
      } else if (input.source === 'click') {
        stage.addEventListener('click', function () {
          if (input.type === 'trigger') {
            setInput(input.id, true);
            setTimeout(function () { setInput(input.id, false); }, 350);
          } else if (input.type === 'boolean') {
            setInput(input.id, !inputVals[input.id]);
          }
        });
      }
    })(DATA.inputs[i]);
  }

  // ---- 主循环 ----
  function tick(now) {
    requestAnimationFrame(tick);
    var st = currentState();
    if (!st || !activeSeg) return;
    var t = (now - stateStart) / 1000;
    if (!st.loop && t > activeSeg.seg.duration) t = activeSeg.seg.duration;
    else t = t % activeSeg.seg.duration;
    var activeChars = {};
    for (var i = 0; i < activeSeg.clips.length; i++) {
      var c = activeSeg.clips[i].clip;
      var visible = t >= c.start && t < c.end;
      activeSeg.clips[i].el.style.display = visible ? 'block' : 'none';
      if (visible) {
        activeChars[c.charText] = true;
        activeSeg.clips[i].player.render((t - c.start) * activeSeg.clips[i].player.fps);
      }
    }
    for (var j = 0; j < activeSeg.staticEls.length; j++) {
      var s = activeSeg.staticEls[j];
      s.el.style.visibility = (s.animated && activeChars[s.el.textContent]) ? 'hidden' : 'visible';
    }
  }

  switchSegment(currentStateId);
  requestAnimationFrame(tick);
})();
</script>
</body>
</html>
`
}

export function exportAppMicroPlayerPage(
  micro: IMicroInteraction,
  videos: IAppVideoDocument[],
  cardData: ICardAppData,
  library: FontLibrary
): void {
  const html = buildAppMicroPlayerHtml(micro, videos, cardData, library, micro.name)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  saveAs(blob, `${micro.name || 'micro-interaction'}-player.html`)
}
