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

═══ CRITICAL RULES ═══
1. Output ONLY raw HTML starting with <!DOCTYPE html> — NO markdown, NO code fences, NO explanation
2. All JS/CSS must be inline. ONLY allowed external scripts:
   - Google Fonts: https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap
   - Three.js: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
   - OrbitControls: https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js
3. Scripts MUST load before use — put Three.js + OrbitControls in <head> with defer, initialize in window.onload or DOMContentLoaded
4. ALL animations and interactions must ACTUALLY WORK — test your logic mentally before writing

═══ INTERACTIVITY REQUIREMENTS ═══
For Biology / Photosynthesis / Cell topics — BUILD A THREE.JS 3D SCENE:
  • Create a renderer, scene, camera inside window.addEventListener('DOMContentLoaded', ...)
  • Add OrbitControls: controls = new THREE.OrbitControls(camera, renderer.domElement)
  • Animate with requestAnimationFrame loop
  • Use SphereGeometry, TorusGeometry, CylinderGeometry for molecules/organelles
  • Add smooth rotation animation
  • Add clickable parts: raycaster on click → show info panel
  • Lighting: new THREE.AmbientLight(0xffffff, 0.5) + new THREE.DirectionalLight(0xffffff, 1)
  • Show "🖱 Drag to rotate · Scroll to zoom · Click parts to learn" hint

For other topics — BUILD RICH SVG + CSS ANIMATIONS:
  • Animated flowcharts with SVG paths and CSS stroke-dashoffset animations
  • Step-by-step reveals triggered by scroll (IntersectionObserver)
  • Hover effects that reveal detailed info panels
  • Click-to-expand sections

═══ PAGE STRUCTURE ═══
1. Sticky header (lesson title + subject badge)
2. Hero section (big visual hook — animated stat or question)
3. Interactive 3D scene OR animated diagram (full-width, 500px tall)
4. Step-by-step breakdown (3–4 cards, each with icon + hover effect)
5. "Did you know?" fun facts panel (click to reveal)
6. 4-question quiz (multiple choice, instant color feedback green/red + explanation)
7. Footer "Made with ClassAI"

═══ DESIGN ═══
- CSS variables: --bg:#0f1117, --text:#e8eaf6, --accent:#4ade80, --card:#1e2130, --muted:#6b7280
- Beautiful dark theme by default
- Smooth scroll behavior
- Card hover: translateY(-4px) + box-shadow
- Gradient accents
- Responsive (mobile 320px → desktop)

═══ ACCURACY ═══
All facts 100% correct for Grade ${ctx.grade} ${ctx.subject}. Use proper scientific terminology.`
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
