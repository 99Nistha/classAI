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

  return `Create a fully interactive animated educational web page.

TOPIC: ${ctx.topicTitle}
CHAPTER: ${ctx.chapterTitle}
SUBJECT: ${ctx.subject}, Grade ${ctx.grade}${notes}
${instruction ? `\n⚡ TEACHER INSTRUCTION — HIGHEST PRIORITY: ${ctx.teacherInstruction}\n` : ''}
═══ OUTPUT RULE ═══
Output ONLY raw HTML starting with <!DOCTYPE html>. No markdown, no code fences.

═══ MAIN VISUAL: HTML5 CANVAS ANIMATION (MANDATORY — no external libraries) ═══

Write a complete, self-contained animated canvas visualization using ONLY the Canvas 2D API
and requestAnimationFrame. NO Three.js, NO external scripts for the animation.

The canvas must be 100% width and 600px tall. Write ALL drawing code completely — no TODOs,
no placeholders. Every component must be drawn with real canvas commands.

For PHOTOSYNTHESIS or any FLOW/PROCESS topic, draw the COMPLETE end-to-end flow:

  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │  LAYOUT (left to right across the canvas):                                       │
  │                                                                                  │
  │  SUN ──rays──► LEAF ──── inside: [CHLOROPLAST → LIGHT REACTIONS → CALVIN CYCLE] │
  │   ↑                ↑                                    │          │             │
  │  (yellow glow)   CO₂ molecules floating in            ATP+NADPH  G3P            │
  │                  H₂O line rising from ROOTS             │          │             │
  │                                                         ▼          ▼             │
  │                                              O₂ bubbles out     GLUCOSE out      │
  └──────────────────────────────────────────────────────────────────────────────────┘

  Every element must be:
  - Drawn with ctx.arc / ctx.fillRect / ctx.bezierCurveTo / etc.
  - Labeled with ctx.fillText() right on the canvas (bold, readable)
  - Animated: sun rays rotate, CO₂ floats in, H₂O pulses up, O₂ bubbles rise, particles travel arrows
  - Connected by animated dashed arrows (ctx.setLineDash, lineDashOffset decrements each frame)
  - Clickable: maintain a hitZones array, on canvas click show an overlay info panel

  DRAW EACH of these for photosynthesis (adjust colors to be vivid and distinct):
  • Sun: yellow radial gradient circle, 8 rotating ray lines, r≈60px, position top-left
  • Light rays: yellow dashed lines animating from sun toward leaf
  • Leaf: large rounded green bezier shape, center of canvas, draw 3 veins
  • CO₂ molecules: 3 small blue labeled circles, x-position animated leftward into leaf
  • Roots: brown forked lines at bottom-center
  • Water: blue dashed vertical line animating upward from roots to leaf
  • Chloroplast: green oval inside the leaf, label inside
  • Light Reactions box: purple rounded rect, label "Light Reactions", inside chloroplast area
  • Calvin Cycle box: teal rounded rect below, label "Calvin Cycle", animated circular small arrows
  • ATP/NADPH: small orange label animating between light reactions and calvin cycle
  • O₂: green circles floating upward from top of leaf, each has "O₂" label
  • Glucose: orange hexagon moving rightward from calvin cycle, label "C₆H₁₂O₆"
  • Flow arrows: thick dashed arrows between every stage, animated lineDashOffset

For NON-FLOW topics: create an equally rich animated diagram specific to that topic.

INFO PANEL HTML (place right after the canvas tag, BEFORE the script):
<div id="infoPanel" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#0f1117;border:2px solid #4ade80;border-radius:16px;padding:24px;max-width:340px;width:90%;z-index:9999;color:#e8eaf6;box-shadow:0 20px 60px rgba(0,0,0,0.9);">
  <h3 id="infoPanelTitle" style="color:#4ade80;margin:0 0 12px;font-size:18px;"></h3>
  <p id="infoPanelText" style="margin:0;line-height:1.7;font-size:14px;"></p>
  <button onclick="document.getElementById('infoPanel').style.display='none'" style="margin-top:18px;background:#4ade80;color:#000;border:none;padding:9px 22px;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;">✕ Close</button>
</div>

CANVAS SCRIPT REQUIREMENTS:
- Resize canvas to devicePixelRatio for sharp rendering
- Keep a hitZones array (push { x, y, r, label, info } for each component)
- On canvas 'click', loop through hitZones, show infoPanel for the closest match
- Increment a time variable t each frame for smooth animations
- Use lineDashOffset -= 0.5 on arrows so dashes appear to flow/travel
- Particle dots traveling along arrow paths add life to the scene

═══ PAGE STRUCTURE ═══
1. Sticky header (lesson title + subject badge)
2. The animated canvas scene above (full-width, 600px, with click-to-learn info panel)
3. Step-by-step process breakdown (4–6 numbered cards)
4. "Did you know?" facts (click to expand)
5. 4-question quiz (multiple choice, instant green/red feedback)
6. Footer: "Made with ClassAI"

═══ DESIGN ═══
CSS vars: --bg:#0f1117; --text:#e8eaf6; --accent:#4ade80; --card:#1e2130
Dark theme. Cards with hover effect. Mobile responsive.

═══ ACCURACY ═══
All facts 100% correct for Grade ${ctx.grade} ${ctx.subject}.`
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
