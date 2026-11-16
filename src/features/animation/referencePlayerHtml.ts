/**
 * 微交互播放器参考实现（单个自包含 HTML）
 *
 * 将状态机数据（含内嵌 Lottie 片段）与一个通用播放器运行时打包进一个 HTML：
 * - 最小 Lottie 子集渲染器（本工具导出结构：shape 图层 + 填充 + 组透明度关键帧）
 * - 输入绑定契约：hover → pointerenter/pointerleave；click → click；
 *   custom → window.setMicroInput(id, value)
 * - 转换条件求值（eq/neq/gt/lt，"与"关系）+ 状态切换 + 片段循环播放
 *
 * 该页面只是参考实现；任何实现同一契约的播放器（如扩展 dotLottie 播放器）都能消费同一份 JSON。
 */

export function buildReferencePlayerHtml(data: Record<string, unknown>): string {
  const json = JSON.stringify(data)
  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>微交互播放器 - ${String((data as { name?: string }).name ?? '')}</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #14161a; color: #eee;
    font-family: -apple-system, "PingFang SC", "Segoe UI", sans-serif; }
  .wrap { display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 100%; gap: 14px; padding: 24px; box-sizing: border-box; }
  h1 { font-size: 18px; font-weight: 600; margin: 0; }
  .stage { width: 280px; height: 280px; background: #fff; border-radius: 12px;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    box-shadow: 0 8px 30px rgba(0,0,0,.5); touch-action: none; }
  .stage canvas { max-width: 100%; max-height: 100%; }
  .hint { font-size: 13px; color: #8a90a0; text-align: center; }
  .panel { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; font-size: 12px; }
  .chip { background: #23262d; border: 1px solid #3a3f4a; border-radius: 6px; padding: 6px 10px; }
  .chip b { color: #7db4ff; }
</style>
</head>
<body>
<div class="wrap">
  <h1 id="title"></h1>
  <div class="stage" id="stage"><canvas id="canvas" width="280" height="280"></canvas></div>
  <div class="hint" id="hint">把鼠标悬停/移出白色区域，或点击它</div>
  <div class="panel" id="panel"></div>
</div>
<script>
(function () {
  var sm = ${json};

  // ================= 最小 Lottie 子集渲染器 =================
  function makeLottiePlayer(anim, canvas) {
    var ctx = canvas.getContext('2d');
    var w = anim.w || 1000, h = anim.h || 1000;
    var fps = anim.fr || 30, op = Math.max(1, anim.op || 1);
    canvas.width = w; canvas.height = h;
    var scale = Math.min(280 / w, 280 / h);
    var ox = (280 - w * scale) / 2, oy = (280 - h * scale) / 2;

    function kfValue(k, frame) {
      if (!k) return 100;
      if (k.a === 0) return k.k;
      var ks = k.k || [];
      if (ks.length === 0) return 0;
      if (frame <= ks[0].t) return ks[0].s[0];
      if (frame >= ks[ks.length - 1].t) return ks[ks.length - 1].s[0];
      for (var i = 0; i < ks.length - 1; i++) {
        var a = ks[i], b = ks[i + 1];
        if (frame >= a.t && frame <= b.t) {
          var t = b.t === a.t ? 0 : (frame - a.t) / (b.t - a.t);
          return a.s[0] + (b.s[0] - a.s[0]) * t;
        }
      }
      return ks[0].s[0];
    }

    function drawShape(p, alpha) {
      var v = p.v, ins = p.i, outs = p.o, n = v.length;
      if (!n) return;
      ctx.beginPath();
      ctx.moveTo(ox + v[0][0] * scale, oy + v[0][1] * scale);
      function segTo(j, x2, y2) {
        var c1x = v[j][0] + outs[j][0], c1y = v[j][1] + outs[j][1];
        var c2x = x2 + ins[(j + 1) % n][0], c2y = y2 + ins[(j + 1) % n][1];
        if ((outs[j][0] || outs[j][1]) || (ins[(j + 1) % n][0] || ins[(j + 1) % n][1])) {
          ctx.bezierCurveTo(ox + c1x * scale, oy + c1y * scale, ox + c2x * scale, oy + c2y * scale, ox + x2 * scale, oy + y2 * scale);
        } else {
          ctx.lineTo(ox + x2 * scale, oy + y2 * scale);
        }
      }
      for (var j = 0; j < n - 1; j++) segTo(j, v[j + 1][0], v[j + 1][1]);
      segTo(n - 1, v[0][0], v[0][1]); // 闭合段
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
      ctx.fill('nonzero');
    }

    function render(frame) {
      ctx.clearRect(0, 0, 280, 280);
      var layers = anim.layers || [];
      for (var li = 0; li < layers.length; li++) {
        var layer = layers[li];
        if (layer.ty !== 4) continue;
        var groups = layer.shapes || [];
        for (var gi = 0; gi < groups.length; gi++) {
          var grp = groups[gi];
          var o = kfValue(grp.o, frame) / 100;
          if (o <= 0.002) continue;
          var items = grp.it || [];
          for (var ii = 0; ii < items.length; ii++) {
            if (items[ii].ty === 'sh') drawShape(items[ii].ks.k, o);
          }
        }
      }
    }
    return { render: render, fps: fps, op: op };
  }

  // ================= 状态机 =================
  var inputVals = {};
  var customBindings = {};
  (sm.inputs || []).forEach(function (i) { inputVals[i.id] = i.defaultValue; });
  var currentId = (sm.states || [])[0] ? sm.states[0].id : null;
  var player = null, playerStateId = null, segStart = 0;

  function stateById(id) {
    for (var i = 0; i < sm.states.length; i++) if (sm.states[i].id === id) return sm.states[i];
    return null;
  }
  function segmentById(id) {
    for (var i = 0; i < sm.segments.length; i++) if (sm.segments[i].id === id) return sm.segments[i];
    return null;
  }
  function condPassed(c) {
    var a = inputVals[c.inputId], b = c.value;
    if (c.operator === 'eq') return a === b;
    if (c.operator === 'neq') return a !== b;
    if (c.operator === 'gt') return Number(a) > Number(b);
    if (c.operator === 'lt') return Number(a) < Number(b);
    return false;
  }
  function evaluate() {
    for (var i = 0; i < sm.transitions.length; i++) {
      var tr = sm.transitions[i];
      if (tr.from !== currentId) continue;
      if (!tr.conditions || tr.conditions.length === 0) continue;
      var ok = true;
      for (var j = 0; j < tr.conditions.length; j++) {
        if (!condPassed(tr.conditions[j])) { ok = false; break; }
      }
      if (ok) { currentId = tr.to; refreshPanel(); return; }
    }
    refreshPanel();
  }
  function setInput(id, v) {
    inputVals[id] = v;
    evaluate();
  }
  // custom 来源：宿主代码调用
  window.setMicroInput = setInput;
  window.setMicroInputs = function (map) {
    for (var k in map) setInput(k, map[k]);
  };

  // ================= 事件绑定契约 =================
  var stage = document.getElementById('stage');
  (sm.inputs || []).forEach(function (i) {
    if (i.source === 'hover') {
      stage.addEventListener('pointerenter', function () { setInput(i.id, true); });
      stage.addEventListener('pointerleave', function () { setInput(i.id, false); });
    } else if (i.source === 'click') {
      stage.addEventListener('click', function () {
        if (i.type === 'trigger') {
          setInput(i.id, true);
          setTimeout(function () { setInput(i.id, false); }, 60);
        } else {
          setInput(i.id, !inputVals[i.id]); // 布尔：点击切换
        }
      });
    }
  });

  // ================= 面板 =================
  var panelEl = document.getElementById('panel');
  document.getElementById('title').textContent = sm.name || 'Micro Interaction';
  function refreshPanel() {
    var state = stateById(currentId);
    var html = '<div class="chip">状态 <b>' + (state ? state.name : '—') + (state && state.loop ? ' ↻' : '') + '</b></div>';
    (sm.inputs || []).forEach(function (i) {
      html += '<div class="chip">' + i.name + ' = <b>' + JSON.stringify(inputVals[i.id]) + '</b></div>';
    });
    panelEl.innerHTML = html;
  }
  refreshPanel();

  // ================= 播放循环 =================
  var canvas = document.getElementById('canvas');
  function tick(now) {
    requestAnimationFrame(tick);
    var state = stateById(currentId);
    if (!state) return;
    if (playerStateId !== state.id) {
      playerStateId = state.id;
      var seg = segmentById(state.segmentId);
      player = seg && seg.animation ? makeLottiePlayer(seg.animation, canvas) : null;
      segStart = now;
    }
    if (!player) return;
    var frame = ((now - segStart) / 1000) * player.fps;
    frame = state.loop ? frame % player.op : Math.min(frame, player.op - 1);
    player.render(frame);
  }
  requestAnimationFrame(tick);
})();
</script>
</body>
</html>
`
}
