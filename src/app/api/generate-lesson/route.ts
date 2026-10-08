import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { buildSystemPrompt } from '@/lib/prompts/lesson'
import { stripCodeFences } from '@/lib/lesson/assembler'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

const MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest']

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function buildFullLessonPrompt(ctx: {
  grade: number
  subject: string
  chapterTitle: string
  topicTitle: string
  teacherNotes?: string | null
  teacherInstruction?: string
}): string {
  const notes = ctx.teacherNotes ? `\nTeacher notes: ${ctx.teacherNotes}` : ''
  const instruction = ctx.teacherInstruction ? `\nTeacher instruction: ${ctx.teacherInstruction}` : ''

  return `Create a fully interactive 3D educational web page.

TOPIC: ${ctx.topicTitle}
CHAPTER: ${ctx.chapterTitle}
SUBJECT: ${ctx.subject}, Grade ${ctx.grade}${notes}
${instruction ? `\n⚡ TEACHER INSTRUCTION — FOLLOW THIS PRECISELY: ${ctx.teacherInstruction}\n` : ''}
═══ OUTPUT RULE ═══
Output ONLY raw HTML starting with <!DOCTYPE html>. No markdown, no code fences, no explanation.

═══ IF TEACHER INSTRUCTION MENTIONS A FLOW / PROCESS / END-TO-END ═══
Visualize THE COMPLETE PROCESS in the 3D scene — every single stage from start to finish.
For Photosynthesis: show Sun (glowing yellow sphere) → Leaf with stomata (flat green mesh) →
  CO2 molecules entering (animated blue spheres floating in) → Water from roots (animated blue
  line rising up) → Chloroplast (green oval inside leaf) → Light reactions producing ATP + NADPH
  → Calvin Cycle producing G3P → Glucose output → O2 molecules floating out.
  Place them in a 3D scene arranged so the viewer sees the whole chain.

═══ MANDATORY: THREE.JS 3D SCENE WITH VISIBLE LABELS ═══
Copy this EXACT boilerplate. Fill in only the /* CUSTOMIZE */ sections.

<!-- SCENE HTML — put in body -->
<div id="scene-wrap" style="position:relative;width:100%;height:560px;background:#060a14;border-radius:16px;overflow:hidden;margin:24px 0;">
  <div id="scene-container" style="width:100%;height:560px;"></div>
  <!-- label layer — floats above canvas -->
  <div id="label-layer" style="position:absolute;top:0;left:0;width:100%;height:560px;pointer-events:none;overflow:hidden;"></div>
  <!-- toggle + hint bar -->
  <div style="position:absolute;bottom:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:rgba(0,0,0,0.5);">
    <span style="color:#888;font-size:12px;">🖱 Drag · Scroll to zoom · Click to learn</span>
    <button id="toggle-labels" style="background:#1e2130;border:1px solid #4ade80;color:#4ade80;padding:5px 14px;border-radius:20px;font-size:12px;cursor:pointer;">Hide Labels</button>
  </div>
  <!-- info panel -->
  <div id="info-panel" style="display:none;position:absolute;top:12px;right:12px;background:rgba(10,12,20,0.97);border:1px solid #4ade80;border-radius:12px;padding:16px;max-width:240px;color:#e8eaf6;z-index:10;">
    <div id="info-title" style="font-weight:700;color:#4ade80;margin-bottom:6px;font-size:15px;"></div>
    <div id="info-body" style="font-size:13px;line-height:1.6;"></div>
    <button onclick="document.getElementById('info-panel').style.display='none'" style="margin-top:10px;background:none;border:1px solid #4ade80;color:#4ade80;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;">✕ Close</button>
  </div>
</div>

<!-- SCRIPTS — place just before </body> -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
<script>
(function() {
  var container = document.getElementById('scene-container');
  var labelLayer = document.getElementById('label-layer');
  var W = container.offsetWidth || 900, H = 560;

  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060a14);

  var camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);
  /* CUSTOMIZE camera position to frame your full scene */
  camera.position.set(0, 4, 18);
  camera.lookAt(0, 0, 0);

  var controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  var sun2 = new THREE.DirectionalLight(0xffffff, 1.2);
  sun2.position.set(10, 20, 10);
  scene.add(sun2);
  var fill = new THREE.DirectionalLight(0x8888ff, 0.4);
  fill.position.set(-10, -5, -10);
  scene.add(fill);

  /* ── LABEL SYSTEM — creates floating HTML labels above each mesh ── */
  var labelElements = [];
  var labelsVisible = true;
  function addLabel(mesh, text, color) {
    color = color || '#4ade80';
    var el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'position:absolute;background:rgba(0,0,0,0.75);color:' + color + ';padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;white-space:nowrap;border:1px solid ' + color + ';font-family:sans-serif;transform:translate(-50%,-50%);';
    labelLayer.appendChild(el);
    labelElements.push({ mesh: mesh, el: el });
    return el;
  }
  document.getElementById('toggle-labels').addEventListener('click', function() {
    labelsVisible = !labelsVisible;
    this.textContent = labelsVisible ? 'Hide Labels' : 'Show Labels';
    labelElements.forEach(function(l) { l.el.style.display = labelsVisible ? 'block' : 'none'; });
  });

  /* ── CLICKABLE OBJECTS ── */
  var clickables = []; /* push { mesh, label, info } */
  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2();
  renderer.domElement.addEventListener('click', function(e) {
    var rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var hits = raycaster.intersectObjects(clickables.map(function(c){return c.mesh;}));
    if (hits.length) {
      var h = clickables.find(function(c){return c.mesh===hits[0].object;});
      if (h) { document.getElementById('info-title').textContent=h.label; document.getElementById('info-body').textContent=h.info; document.getElementById('info-panel').style.display='block'; }
    }
  });

  /* ════════════════════════════════════════════════════
     CUSTOMIZE: Build your topic-specific 3D scene here.

     For Photosynthesis full flow, create objects like:
       - Large glowing yellow sphere for Sun (position far top-left)
       - Flat green plane/box for Leaf (center)
       - Green oval sphere inside leaf for Chloroplast
       - Blue spheres animated floating into leaf for CO2
       - Animated blue line/cylinder rising from bottom for Water
       - Animated particles floating out for O2
       - Small sphere for Glucose output
       - Use arrows (CylinderGeometry thin, rotated) between stages

     After creating each mesh, call:
       addLabel(mesh, 'Name', '#colorHex');
       clickables.push({ mesh, label: 'Name', info: 'Detailed explanation...' });
     ════════════════════════════════════════════════════ */

  var clock = new THREE.Clock();
  var vec3 = new THREE.Vector3();

  (function animate() {
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();

    /* CUSTOMIZE: animations (rotation, oscillation, orbit) using t */

    controls.update();
    renderer.render(scene, camera);

    /* Update label positions */
    if (labelsVisible) {
      labelElements.forEach(function(l) {
        l.mesh.getWorldPosition(vec3);
        vec3.project(camera);
        var x = (vec3.x * 0.5 + 0.5) * W;
        var y = (-vec3.y * 0.5 + 0.5) * H;
        l.el.style.left = x + 'px';
        l.el.style.top = (y - 30) + 'px'; /* offset above mesh */
        l.el.style.display = (vec3.z < 1) ? 'block' : 'none';
      });
    }
  })();

  window.addEventListener('resize', function() {
    W = container.offsetWidth;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
  });
})();
</script>

═══ PAGE STRUCTURE ═══
1. Sticky header (lesson title + subject badge)
2. Hero section (bold animated text — key question or stat)
3. The Three.js scene above (full-width, labels visible, the COMPLETE process flow)
4. Step-by-step breakdown of the process (4–6 cards for a flow topic, with icon + hover effect)
5. "Did you know?" fun facts (click to reveal)
6. 4-question quiz (multiple choice, instant green/red feedback + explanation)
7. Footer: "Made with ClassAI"

═══ DESIGN ═══
CSS vars: --bg:#0f1117; --text:#e8eaf6; --accent:#4ade80; --card:#1e2130; --muted:#6b7280
Dark theme. Smooth scroll. Card hover translateY(-4px). Mobile responsive.

═══ ACCURACY ═══
All facts 100% correct for Grade ${ctx.grade} ${ctx.subject}. Proper scientific terminology.`
}

async function callWithFallback(prompt: string, systemPrompt: string): Promise<string> {
  let lastError: any
  for (const modelName of MODEL_FALLBACKS) {
    try {
      console.log(`Trying model: ${modelName}`)
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      })
      const result = await model.generateContent(prompt)
      return result.response.text()
    } catch (e: any) {
      console.error(`Model ${modelName} failed:`, e?.message ?? e)
      lastError = e
    }
  }
  throw new Error(`All models failed. Last error: ${lastError?.message ?? 'unknown'}`)
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { topicId, teacherInstruction } = await req.json() as {
    topicId: string
    teacherInstruction?: string
  }

  const { data: topic } = await supabase
    .from('topics')
    .select('*, chapters(title, classes(name, grade, subject))')
    .eq('id', topicId)
    .single()

  if (!topic) return new Response('Topic not found', { status: 404 })

  const chapter = (topic as any).chapters
  const cls = chapter?.classes

  const ctx = {
    grade: cls?.grade ?? 10,
    subject: cls?.subject ?? 'General',
    chapterTitle: chapter?.title ?? '',
    topicTitle: topic.title,
    teacherNotes: topic.notes,
    teacherInstruction,
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sse(event, data)))
      }

      try {
        send('status', { stage: 'generating', message: 'Generating your lesson...' })

        const systemPrompt = buildSystemPrompt(ctx)
        const fullPrompt = buildFullLessonPrompt(ctx)

        const rawHtml = await callWithFallback(fullPrompt, systemPrompt)
        const finalHtml = stripCodeFences(rawHtml)

        // Send in one chunk — client iframe will render it
        send('html_chunk', { chunk: finalHtml })

        send('status', { stage: 'saving', message: 'Saving your lesson...' })

        // Save to DB
        const { data: existingLesson } = await supabase
          .from('lessons')
          .select('id, share_token')
          .eq('topic_id', topicId)
          .eq('teacher_id', user.id)
          .single()

        let lessonId: string
        let shareToken: string

        if (existingLesson) {
          lessonId = existingLesson.id
          shareToken = existingLesson.share_token
          await supabase
            .from('lessons')
            .update({ instructions: teacherInstruction ?? null, status: 'draft' })
            .eq('id', lessonId)
        } else {
          const { data: newLesson, error } = await supabase
            .from('lessons')
            .insert({
              topic_id: topicId,
              teacher_id: user.id,
              instructions: teacherInstruction ?? null,
              status: 'draft',
            })
            .select()
            .single()

          if (error || !newLesson) {
            send('error', { message: 'Failed to save lesson.' })
            controller.close()
            return
          }
          lessonId = newLesson.id
          shareToken = newLesson.share_token
        }

        await supabase
          .from('lessons')
          .update({ html_url: finalHtml.slice(0, 1000000) })
          .eq('id', lessonId)

        send('done', {
          lessonId,
          shareToken,
          title: `${ctx.topicTitle} — Grade ${ctx.grade} ${ctx.subject}`,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Generation failed'
        send('error', { message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
