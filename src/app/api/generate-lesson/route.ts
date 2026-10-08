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

  return `Create an EXCEPTIONAL, fully interactive educational web page for:

Topic: ${ctx.topicTitle}
Chapter: ${ctx.chapterTitle}
Subject: ${ctx.subject}, Grade ${ctx.grade}${notes}${instruction}

═══ OUTPUT RULE ═══
Output ONLY raw HTML starting with <!DOCTYPE html> — NO markdown, NO code fences, NO explanation text before or after.

═══ MANDATORY: THREE.JS 3D INTERACTIVE SCENE ═══
Every lesson MUST have a Three.js 3D scene. Use EXACTLY this boilerplate (copy it, fill in the CUSTOMIZE sections):

HTML structure:
<div id="scene-wrap" style="position:relative;width:100%;height:500px;background:#0a0a1a;border-radius:16px;overflow:hidden;">
  <div id="scene-container" style="width:100%;height:500px;"></div>
  <div id="scene-hint" style="position:absolute;bottom:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.6);color:#aaa;font-size:12px;padding:6px 14px;border-radius:20px;pointer-events:none;">🖱 Drag to rotate · Scroll to zoom · Click to learn</div>
  <div id="info-panel" style="display:none;position:absolute;top:12px;right:12px;background:rgba(15,17,23,0.95);border:1px solid #4ade80;border-radius:12px;padding:16px;max-width:220px;color:#e8eaf6;">
    <div id="info-title" style="font-weight:700;color:#4ade80;margin-bottom:6px;font-size:14px;"></div>
    <div id="info-body" style="font-size:13px;line-height:1.5;"></div>
    <button onclick="document.getElementById('info-panel').style.display='none'" style="margin-top:10px;background:none;border:1px solid #4ade80;color:#4ade80;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;">Close</button>
  </div>
</div>

Scripts (place just before </body>):
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
<script>
(function() {
  var container = document.getElementById('scene-container');
  var W = container.offsetWidth || 800, H = 500;
  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a1a);

  var camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 100);
  camera.position.set(0, 2, 8);  /* CUSTOMIZE: adjust for your scene */
  camera.lookAt(0, 0, 0);

  var controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  var dLight = new THREE.DirectionalLight(0xffffff, 1);
  dLight.position.set(5, 10, 7);
  scene.add(dLight);

  /* ── CUSTOMIZE: create topic-specific 3D objects ──
     Use SphereGeometry, BoxGeometry, TorusGeometry, CylinderGeometry, etc.
     MeshPhongMaterial or MeshStandardMaterial with colors matching the topic.
     Example for a cell: nucleus (large sphere), mitochondria (ellipsoids), membrane (torus)
     Example for solar system: sun (sphere), planets (smaller spheres orbiting)
     Example for atom: nucleus (sphere), electron shells (torus rings), electrons (tiny spheres)
     Add each mesh to scene with: scene.add(mesh) */

  /* ── CUSTOMIZE: clickable objects array ── */
  var clickables = []; /* push { mesh: mesh, label: 'Name', info: 'Description' } */

  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2();
  renderer.domElement.addEventListener('click', function(e) {
    var rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var hits = raycaster.intersectObjects(clickables.map(function(c) { return c.mesh; }));
    if (hits.length > 0) {
      var hit = clickables.find(function(c) { return c.mesh === hits[0].object; });
      if (hit) {
        document.getElementById('info-title').textContent = hit.label;
        document.getElementById('info-body').textContent = hit.info;
        document.getElementById('info-panel').style.display = 'block';
      }
    }
  });

  (function animate() {
    requestAnimationFrame(animate);
    /* CUSTOMIZE: add rotation/orbit animations here, e.g. mesh.rotation.y += 0.005; */
    controls.update();
    renderer.render(scene, camera);
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
2. Hero section (animated CSS — big bold stat, question, or key concept)
3. The Three.js 3D scene (use the boilerplate above, customize objects for the topic)
4. Step-by-step breakdown (3–4 cards with icons, hover effects)
5. "Did you know?" fun facts (click to reveal hidden text)
6. 4-question multiple choice quiz (instant green/red feedback + explanation text)
7. Footer: "Made with ClassAI"

═══ DESIGN ═══
CSS variables: --bg:#0f1117; --text:#e8eaf6; --accent:#4ade80; --card:#1e2130; --muted:#6b7280
Dark theme. Smooth scroll. Card hover: translateY(-4px) + box-shadow. Mobile responsive (320px → desktop).

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
