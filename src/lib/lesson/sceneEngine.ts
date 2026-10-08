// Pre-built Canvas rendering engine + lesson assembler
// Gemini only provides JSON data — we generate all HTML/CSS/JS

export interface SceneNode {
  id: string
  label: string
  icon?: string
  x: number   // 0–1
  y: number   // 0–1
  r?: number  // 0–1, default 0.06
  color: string
  phase?: number
  info: string
}

export interface SceneEdge {
  from: string
  to: string
  label?: string
  color?: string
  offset?: number
}

export interface LessonStep {
  icon: string
  title: string
  text: string
}

export interface QuizQ {
  q: string
  options: [string, string, string, string]
  answer: number
  explain: string
}

export interface LessonData {
  pageTitle: string
  scene: { nodes: SceneNode[]; edges: SceneEdge[] }
  steps: LessonStep[]
  facts: string[]
  quiz: QuizQ[]
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

export function buildStructuredPrompt(ctx: {
  grade: number
  subject: string
  chapterTitle: string
  topicTitle: string
  teacherNotes?: string | null
  teacherInstruction?: string
}): string {
  const notes = ctx.teacherNotes ? `\nTeacher notes: ${ctx.teacherNotes}` : ''
  const instr = ctx.teacherInstruction
    ? `\n⚡ Teacher instruction (HIGHEST PRIORITY): ${ctx.teacherInstruction}`
    : ''

  return `You are building data for an interactive educational lesson visualization.

Topic: ${ctx.topicTitle}
Chapter: ${ctx.chapterTitle}
Subject: ${ctx.subject}, Grade ${ctx.grade}${notes}${instr}

Output ONLY a single valid JSON object — no markdown, no code fences, no explanation.

{
  "pageTitle": "string",
  "scene": {
    "nodes": [
      {
        "id": "unique_snake_case_id",
        "label": "Short Display Name",
        "icon": "single emoji",
        "x": 0.15,
        "y": 0.20,
        "r": 0.065,
        "color": "#hexcolor",
        "phase": 0.0,
        "info": "2-3 sentence explanation shown when user clicks this node."
      }
    ],
    "edges": [
      {
        "from": "node_id",
        "to": "node_id",
        "label": "short flow label",
        "color": "#hexcolor88",
        "offset": 0.0
      }
    ]
  },
  "steps": [
    { "icon": "emoji", "title": "Step title", "text": "Explanation paragraph." }
  ],
  "facts": ["Interesting fact 1.", "Interesting fact 2.", "Interesting fact 3."],
  "quiz": [
    {
      "q": "Question?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explain": "Why the correct answer is right."
    }
  ]
}

SCENE RULES:
- Create 8–10 nodes covering the key stages: inputs → processes → outputs
- Spread nodes across the canvas: x 0.07–0.90, y 0.08–0.85 (no two nodes closer than 0.15)
- Add 7–10 directed edges forming the complete flow
- Color by role: energy→#FFD700, inputs→#60a5fa, plant parts→#34d399, organelles→#a78bfa, reactions→#c084fc, molecules→#22d3ee, outputs→#fb923c
- phase: stagger 0–5, offset: stagger 0.0–0.9
- info: 1 concise sentence per node, accurate for Grade ${ctx.grade}

STEPS: exactly 4 steps.
FACTS: exactly 3 facts.
QUIZ: exactly 3 questions, one correct answer each (answer = 0-based index).

All content accurate for Grade ${ctx.grade} ${ctx.subject}.`
}

// ─── Rendering Engine (inline JS, no external deps) ──────────────────────────

const ENGINE_JS = `
(function () {
  var canvas = document.getElementById('sceneCanvas');
  var cx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var W, H = 560;
  var scale = 1, panX = 0, panY = 0;
  var dragging = false, lastX = 0, lastY = 0;
  var labelsOn = true;
  var t = 0;

  function resize() {
    W = canvas.parentElement.offsetWidth || 800;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  /* ── Zoom ── */
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var f = e.deltaY < 0 ? 1.15 : 0.87;
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left, my = e.clientY - rect.top;
    panX = mx + (panX - mx) * f;
    panY = my + (panY - my) * f;
    scale = Math.max(0.6, Math.min(2.5, scale * f));
  }, { passive: false });

  /* ── Mouse pan ── */
  canvas.addEventListener('mousedown', function (e) { dragging = true; canvas.style.cursor = 'grabbing'; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mousemove', function (e) { if (!dragging) return; panX += e.clientX - lastX; panY += e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mouseup', function () { dragging = false; canvas.style.cursor = 'grab'; });

  /* ── Touch pan / pinch-zoom ── */
  var lt = [];
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); lt = [].slice.call(e.touches).map(function (t) { return { x: t.clientX, y: t.clientY }; }); }, { passive: false });
  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    var tc = [].slice.call(e.touches).map(function (t) { return { x: t.clientX, y: t.clientY }; });
    if (tc.length === 1 && lt.length === 1) { panX += tc[0].x - lt[0].x; panY += tc[0].y - lt[0].y; }
    else if (tc.length === 2 && lt.length === 2) {
      var d0 = Math.hypot(lt[1].x - lt[0].x, lt[1].y - lt[0].y);
      var d1 = Math.hypot(tc[1].x - tc[0].x, tc[1].y - tc[0].y);
      if (d0 > 0) scale = Math.max(0.6, Math.min(2.5, scale * d1 / d0));
    }
    lt = tc;
  }, { passive: false });

  /* ── Controls ── */
  document.getElementById('btnLabels').addEventListener('click', function () {
    labelsOn = !labelsOn;
    this.textContent = labelsOn ? 'Hide Labels' : 'Show Labels';
  });
  document.getElementById('btnReset').addEventListener('click', function () { scale = 1; panX = 0; panY = 0; });

  /* ── Coord helpers ── */
  function wx(x) { return x * W * scale + panX; }
  function wy(y) { return y * H * scale + panY; }
  function wr(r) { return r * Math.min(W, H) * scale; }
  function hexRgb(h) {
    if (!h || h.length < 7) return '180,180,180';
    var r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return r + ',' + g + ',' + b;
  }

  /* ── Draw node ── */
  function drawNode(n) {
    var x = wx(n.x), y = wy(n.y), r = wr(n.r || 0.06);
    r *= 1 + 0.03 * Math.sin(t * 1.8 + (n.phase || 0));
    var c = n.color || '#4ade80', rgb = hexRgb(c);

    cx.save();
    /* double outer glow */
    cx.beginPath(); cx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    cx.fillStyle = 'rgba(' + rgb + ',0.04)'; cx.fill();
    cx.beginPath(); cx.arc(x, y, r * 1.55, 0, Math.PI * 2);
    cx.fillStyle = 'rgba(' + rgb + ',0.11)'; cx.fill();

    /* sphere gradient */
    cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2);
    var g = cx.createRadialGradient(x - r * 0.3, y - r * 0.36, r * 0.04, x, y, r);
    g.addColorStop(0, 'rgba(' + rgb + ',1)');
    g.addColorStop(0.5, 'rgba(' + rgb + ',0.80)');
    g.addColorStop(1, 'rgba(' + rgb + ',0.16)');
    cx.shadowColor = c; cx.shadowBlur = 30 * scale;
    cx.fillStyle = g; cx.fill();

    /* specular shine */
    cx.save();
    cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.clip();
    var shine = cx.createRadialGradient(x - r * 0.28, y - r * 0.40, 0, x - r * 0.28, y - r * 0.40, r * 0.68);
    shine.addColorStop(0, 'rgba(255,255,255,0.38)');
    shine.addColorStop(0.5, 'rgba(255,255,255,0.09)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = shine; cx.fill();
    cx.restore();

    /* ring */
    cx.shadowBlur = 0;
    cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2);
    cx.strokeStyle = 'rgba(' + rgb + ',0.85)'; cx.lineWidth = Math.max(1.5, 2 * scale); cx.stroke();

    /* icon */
    if (n.icon) {
      cx.shadowBlur = 0;
      cx.font = Math.round(r * 0.85) + 'px serif';
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillStyle = '#ffffff';
      cx.fillText(n.icon, x, y);
    }

    /* label pill */
    if (labelsOn) {
      var fs = Math.max(10, Math.min(14, 12 * scale));
      cx.font = 'bold ' + fs + 'px Inter,system-ui,sans-serif';
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      var lw = cx.measureText(n.label).width;
      var pw = lw + 14 * scale, ph = fs + 8 * scale;
      var plx = x - pw / 2, ply = y + r + 5 * scale;
      var pr2 = Math.min(ph / 2, 5 * scale);
      cx.fillStyle = 'rgba(6,10,22,0.82)';
      cx.beginPath(); cx.roundRect(plx, ply, pw, ph, pr2); cx.fill();
      cx.strokeStyle = 'rgba(' + rgb + ',0.42)'; cx.lineWidth = 1;
      cx.stroke();
      cx.fillStyle = '#f1f5f9';
      cx.fillText(n.label, x, ply + ph / 2);
    }
    cx.restore();
  }

  /* ── Draw edge ── */
  function drawEdge(e) {
    var a = SCENE_DATA.nodes.find(function (n) { return n.id === e.from; });
    var b = SCENE_DATA.nodes.find(function (n) { return n.id === e.to; });
    if (!a || !b) return;
    var ax = wx(a.x), ay = wy(a.y), bx = wx(b.x), by = wy(b.y);
    var mx = (ax + bx) / 2, my = (ay + by) / 2;
    var dx = bx - ax, dy = by - ay;
    var cpx = mx - dy * 0.22, cpy = my + dx * 0.22;
    var col = e.color || 'rgba(74,222,128,0.55)';

    cx.save();
    cx.strokeStyle = col; cx.lineWidth = Math.max(1.5, 2.5 * scale);
    cx.setLineDash([8 * scale, 5 * scale]);
    cx.lineDashOffset = -(t * 42);
    cx.beginPath(); cx.moveTo(ax, ay); cx.quadraticCurveTo(cpx, cpy, bx, by); cx.stroke();
    cx.setLineDash([]);

    /* arrowhead */
    var ang = Math.atan2(by - cpy, bx - cpx), ar = 10 * scale;
    cx.fillStyle = col;
    cx.beginPath(); cx.moveTo(bx, by);
    cx.lineTo(bx - ar * Math.cos(ang - 0.42), by - ar * Math.sin(ang - 0.42));
    cx.lineTo(bx - ar * Math.cos(ang + 0.42), by - ar * Math.sin(ang + 0.42));
    cx.closePath(); cx.fill();

    /* travelling particle */
    var pt = ((t * 0.22) + (e.offset || 0)) % 1;
    var px = (1 - pt) * (1 - pt) * ax + 2 * (1 - pt) * pt * cpx + pt * pt * bx;
    var py = (1 - pt) * (1 - pt) * ay + 2 * (1 - pt) * pt * cpy + pt * pt * by;
    cx.shadowColor = '#ffffff'; cx.shadowBlur = 18;
    cx.fillStyle = 'rgba(255,255,255,0.32)';
    cx.beginPath(); cx.arc(px, py, 6.5 * scale, 0, Math.PI * 2); cx.fill();
    cx.shadowBlur = 8;
    cx.fillStyle = '#ffffff';
    cx.beginPath(); cx.arc(px, py, 2.5 * scale, 0, Math.PI * 2); cx.fill();
    cx.shadowBlur = 0;

    /* edge label */
    if (e.label && labelsOn) {
      var efs = Math.max(9, Math.min(11, 10 * scale));
      cx.font = 'bold ' + efs + 'px Inter,system-ui,sans-serif';
      cx.textAlign = 'center';
      cx.shadowColor = 'rgba(0,0,0,0.9)'; cx.shadowBlur = 5;
      cx.fillStyle = 'rgba(255,255,255,0.72)';
      cx.fillText(e.label, cpx, cpy - 10 * scale);
      cx.shadowBlur = 0;
    }
    cx.restore();
  }

  /* ── Click detection ── */
  canvas.addEventListener('click', function (e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left, my = e.clientY - rect.top;
    var wox = (mx - panX) / (W * scale), woy = (my - panY) / (H * scale);
    for (var i = 0; i < SCENE_DATA.nodes.length; i++) {
      var n = SCENE_DATA.nodes[i];
      var dist = Math.hypot(wox - n.x, woy - n.y) * Math.min(W, H);
      if (dist < (n.r || 0.06) * Math.min(W, H) + 12 / scale) {
        document.getElementById('niTitle').textContent = n.label;
        document.getElementById('niBody').textContent = n.info || '';
        document.getElementById('nodeInfo').style.display = 'block';
        return;
      }
    }
  });

  /* ── Render loop ── */
  function loop() {
    cx.clearRect(0, 0, W, H);
    var bg = cx.createLinearGradient(0, 0, W * 0.6, H);
    bg.addColorStop(0, '#060a14'); bg.addColorStop(1, '#0c1628');
    cx.fillStyle = bg; cx.fillRect(0, 0, W, H);

    /* dot grid */
    cx.save();
    var gs = 48 * scale;
    var ox = ((panX % gs) + gs) % gs, oy = ((panY % gs) + gs) % gs;
    cx.fillStyle = 'rgba(255,255,255,0.025)';
    for (var gx = ox - gs; gx < W + gs; gx += gs)
      for (var gy = oy - gs; gy < H + gs; gy += gs) {
        cx.beginPath(); cx.arc(gx, gy, 1, 0, Math.PI * 2); cx.fill();
      }
    cx.restore();

    if (SCENE_DATA.edges) SCENE_DATA.edges.forEach(drawEdge);
    SCENE_DATA.nodes.forEach(drawNode);
    t += 0.016;
    requestAnimationFrame(loop);
  }
  loop();
})();
`

// ─── HTML assembler ───────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function escJs(s: string): string {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')
}

export function assembleHtml(
  data: LessonData,
  ctx: { topicTitle: string; grade: number; subject: string }
): string {
  const scene = (data.scene && Array.isArray(data.scene.nodes)) ? data.scene : { nodes: [], edges: [] }
  const steps = Array.isArray(data.steps) ? data.steps : []
  const facts = Array.isArray(data.facts) ? data.facts : []
  const quiz  = Array.isArray(data.quiz)  ? data.quiz  : []

  const sceneJson = JSON.stringify(scene)

  const stepsHtml = steps.map((s, i) => `
    <div class="step">
      <div class="step-icon">${esc(s.icon)}</div>
      <div class="step-body">
        <div class="step-num">Step ${i + 1}</div>
        <h3 class="step-title">${esc(s.title)}</h3>
        <p class="step-text">${esc(s.text)}</p>
      </div>
    </div>`).join('')

  const factsHtml = facts.map((f, i) => `
    <div class="fact" onclick="this.classList.toggle('open')">
      <div class="fact-q">💡 Fact ${i + 1} &mdash; click to reveal</div>
      <div class="fact-a">${esc(f)}</div>
    </div>`).join('')

  const quizHtml = quiz.map((q, qi) => `
    <div class="quiz-q" id="qq${qi}">
      <p class="quiz-text">${esc(q.q)}</p>
      <div class="quiz-opts">
        ${q.options.map((opt, oi) => `
        <button class="quiz-opt" onclick="checkA(${qi},${oi},${q.answer},'${escJs(q.explain)}')">
          <span class="opt-ltr">${String.fromCharCode(65 + oi)}</span>${esc(opt)}
        </button>`).join('')}
      </div>
      <div class="quiz-exp" id="exp${qi}"></div>
    </div>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(data.pageTitle ?? ctx.topicTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0b0f1a;--card:#131826;--border:#1d2640;--text:#e2e8f0;--muted:#64748b;--accent:#818cf8;--font:'Inter',system-ui,sans-serif}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:var(--font);line-height:1.6}

/* HEADER */
.hdr{background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 55%,#0f2744 100%);padding:36px 24px 28px;text-align:center}
.hdr-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(129,140,248,.15);border:1px solid rgba(129,140,248,.35);color:#a5b4fc;padding:5px 16px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;margin-bottom:14px}
.hdr-title{font-size:clamp(22px,5vw,40px);font-weight:800;line-height:1.2;background:linear-gradient(135deg,#e2e8f0 30%,#818cf8,#4ade80);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}

/* SCENE */
.scene-wrap{position:relative;background:#060a14;overflow:hidden}
#sceneCanvas{display:block;width:100%;height:560px;cursor:grab}
#sceneCanvas:active{cursor:grabbing}
.scene-ctrls{position:absolute;top:12px;right:12px;display:flex;gap:8px;z-index:10}
.ctrl-btn{background:rgba(10,16,30,.88);border:1px solid rgba(99,102,241,.45);color:#a5b4fc;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font);transition:all .2s;backdrop-filter:blur(8px)}
.ctrl-btn:hover{background:rgba(99,102,241,.2);border-color:rgba(99,102,241,.75);color:#e0e7ff}
.scene-hint{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.6);color:rgba(255,255,255,.35);font-size:11px;padding:5px 15px;border-radius:20px;pointer-events:none;white-space:nowrap}
#nodeInfo{display:none;position:absolute;top:14px;left:14px;background:rgba(8,12,26,.97);border:1px solid rgba(129,140,248,.55);border-radius:14px;padding:18px 18px 14px;max-width:260px;z-index:20;box-shadow:0 20px 50px rgba(0,0,0,.65);animation:niFade .2s ease}
#niTitle{color:#818cf8;font-size:15px;font-weight:700;margin-bottom:8px}
#niBody{font-size:13px;line-height:1.65;color:#cbd5e1}
.ni-close{position:absolute;top:9px;right:11px;background:none;border:none;color:#475569;font-size:15px;cursor:pointer;padding:2px 6px;border-radius:6px;transition:color .15s}
.ni-close:hover{color:#e2e8f0}
@keyframes niFade{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}

/* CONTENT */
.content{max-width:860px;margin:0 auto;padding:44px 20px 72px}
.sec-hdr{font-size:20px;font-weight:700;color:#e2e8f0;margin-bottom:22px;display:flex;align-items:center;gap:10px}
.sec-hdr::after{content:'';flex:1;height:1px;background:var(--border)}

/* STEPS */
.steps{display:flex;flex-direction:column;gap:14px;margin-bottom:52px}
.step{display:flex;gap:16px;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px 22px;transition:transform .2s,box-shadow .2s}
.step:hover{transform:translateY(-3px);box-shadow:0 10px 32px rgba(0,0,0,.35)}
.step-icon{font-size:30px;flex-shrink:0;width:44px;text-align:center;padding-top:2px}
.step-num{font-size:11px;font-weight:700;color:#818cf8;text-transform:uppercase;letter-spacing:.7px;margin-bottom:3px}
.step-title{font-size:16px;font-weight:700;color:#e2e8f0;margin-bottom:5px}
.step-text{font-size:14px;color:#94a3b8;line-height:1.65}

/* FACTS */
.facts{display:flex;flex-direction:column;gap:10px;margin-bottom:52px}
.fact{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:15px 20px;cursor:pointer;transition:border-color .2s}
.fact:hover{border-color:rgba(251,191,36,.45)}
.fact-q{font-size:14px;font-weight:600;color:#fbbf24}
.fact-a{display:none;font-size:14px;color:#94a3b8;margin-top:10px;line-height:1.65;padding-top:10px;border-top:1px solid var(--border)}
.fact.open .fact-a{display:block}
.fact.open{border-color:rgba(251,191,36,.4);background:rgba(251,191,36,.03)}

/* QUIZ */
.quiz{display:flex;flex-direction:column;gap:24px;margin-bottom:52px}
.quiz-q{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:22px}
.quiz-text{font-size:16px;font-weight:600;color:#e2e8f0;margin-bottom:16px}
.quiz-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
@media(max-width:540px){.quiz-opts{grid-template-columns:1fr}}
.quiz-opt{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:10px;padding:11px 14px;font-size:13px;color:#94a3b8;cursor:pointer;text-align:left;transition:all .15s;font-family:var(--font)}
.quiz-opt:hover:not(:disabled){background:rgba(129,140,248,.08);border-color:rgba(129,140,248,.45);color:#e2e8f0}
.quiz-opt.correct{background:rgba(74,222,128,.1);border-color:#4ade80;color:#4ade80}
.quiz-opt.wrong{background:rgba(248,113,113,.1);border-color:#f87171;color:#f87171}
.opt-ltr{width:24px;height:24px;border-radius:50%;background:rgba(129,140,248,.15);color:#818cf8;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.quiz-exp{font-size:13px;color:#94a3b8;margin-top:12px;padding:12px 14px;background:rgba(255,255,255,.03);border-radius:8px;display:none;line-height:1.65}

/* FOOTER */
footer{text-align:center;padding:20px;border-top:1px solid var(--border);color:var(--muted);font-size:12px}
</style>
</head>
<body>

<header class="hdr">
  <div class="hdr-badge">${esc(ctx.subject)} &middot; Grade ${ctx.grade}</div>
  <h1 class="hdr-title">${esc(data.pageTitle ?? ctx.topicTitle)}</h1>
</header>

<div class="scene-wrap">
  <canvas id="sceneCanvas"></canvas>
  <div class="scene-ctrls">
    <button id="btnLabels" class="ctrl-btn">Hide Labels</button>
    <button id="btnReset" class="ctrl-btn">&#8962; Reset View</button>
  </div>
  <div class="scene-hint">Scroll to zoom &middot; Drag to pan &middot; Click any node to learn</div>
  <div id="nodeInfo">
    <button class="ni-close" onclick="document.getElementById('nodeInfo').style.display='none'">&#10005;</button>
    <div id="niTitle"></div>
    <div id="niBody"></div>
  </div>
</div>

<div class="content">
  <h2 class="sec-hdr">How It Works</h2>
  <div class="steps">${stepsHtml}</div>

  <h2 class="sec-hdr">Did You Know?</h2>
  <div class="facts">${factsHtml}</div>

  <h2 class="sec-hdr">Quick Quiz</h2>
  <div class="quiz">${quizHtml}</div>
</div>

<footer>Made with ClassAI &nbsp;&middot;&nbsp; ${esc(ctx.subject)} Grade ${ctx.grade}</footer>

<script>
function checkA(qi, chosen, correct, explain) {
  var qEl = document.getElementById('qq' + qi);
  qEl.querySelectorAll('.quiz-opt').forEach(function (b, i) {
    b.disabled = true;
    if (i === correct) b.classList.add('correct');
    else if (i === chosen) b.classList.add('wrong');
  });
  var exp = document.getElementById('exp' + qi);
  exp.textContent = explain; exp.style.display = 'block';
}
var SCENE_DATA = ${sceneJson};
${ENGINE_JS}
</script>
</body>
</html>`
}
