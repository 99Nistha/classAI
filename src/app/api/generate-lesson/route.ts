import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { stripCodeFences } from '@/lib/lesson/assembler'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

// ── Optional: web search via Brave API ────────────────────────────────────────
async function searchWeb(query: string): Promise<string> {
  const key = process.env.BRAVE_API_KEY
  if (!key) return ''
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
      { headers: { Accept: 'application/json', 'X-Subscription-Token': key } }
    )
    if (!res.ok) return ''
    const data = await res.json()
    const results: any[] = data.web?.results ?? []
    return results
      .map((r) => `- ${r.title}: ${r.description}`)
      .join('\n')
  } catch { return '' }
}

// ── Step 1: research best approach for this specific topic ────────────────────
async function researchTopic(topic: string, subject: string, grade: number): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are helping plan the best interactive educational visualization for:
Topic: "${topic}" | Subject: ${subject} | Grade: ${grade}

Think about what the BEST educational websites (Khan Academy, PhET, BBC Bitesize, CK-12, Visible Body) do for this exact topic. What makes it work visually and interactively?

Return ONLY valid JSON (no fences):
{
  "bestApproach": "1-2 sentences describing the ideal visual format",
  "keyThingsToShow": ["most important concept 1", "concept 2", "concept 3"],
  "interactivity": ["zoom/pan", "orbit 360", "click to expand labels", "animated flow", "highlight on hover"],
  "recommendedTech": "Three.js for 3D | SVG for diagrams | Canvas for animation",
  "colorGuidance": "brief note on colours that work for this topic",
  "ageNote": "1 sentence on what Grade ${grade} students can handle"
}`,
    }],
  })
  const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
  return raw.replace(/^```[\w]*\s*/i, '').replace(/\s*```\s*$/i, '').trim()
}

// ── Step 2: generate the full interactive HTML ────────────────────────────────
async function generateHtml(
  topic: string, subject: string, grade: number, chapter: string,
  teacherInstruction: string | undefined,
  visualStyle: string | undefined,
  includeQuiz: boolean,
  focusNote: string | undefined,
  research: string,
  webContext: string,
): Promise<string> {

  const instr = teacherInstruction ? `\nTeacher's request: "${teacherInstruction}"` : ''
  const focus = focusNote ? `\nFocus on: "${focusNote}"` : ''
  const style = visualStyle ? `\nVisual style chosen: ${visualStyle}` : ''
  const web = webContext ? `\nWeb examples found:\n${webContext}\n` : ''
  const quiz = includeQuiz
    ? '\n- A 3-question quiz section at the bottom with instant feedback (click to reveal answer + explanation)'
    : ''

  const prompt = `Create a stunning, fully interactive educational web page.

Topic: "${topic}" — ${subject}, Grade ${grade}
Chapter: ${chapter}${instr}${focus}${style}

Research insights for this topic:
${research}
${web}
Build the BEST possible version of this for a student. Use your full knowledge of what makes great educational tools for "${topic}":

QUALITY BAR:
- Think of what Visible Body, PhET, or Khan Academy would build for this exact topic
- Every interactive element must ACTUALLY WORK — no broken links, no placeholder buttons
- Labels must appear when clicked or hovered (real popups, not alerts)
- Zoom must work (scroll wheel), pan must work (drag), 3D orbit must work where relevant
- Animations must run smoothly — no janky transitions
- Be creative with the format: 3D scene, animated SVG diagram, interactive cross-section, particle simulation — whatever BEST fits this topic

CONTENT:
- Main visual section (full width, generous height)
- Explanation section below the visual
- 3 interesting facts (click to reveal each)${quiz}
- Footer: "Made with ClassAI"

TECHNICAL:
- Output ONLY complete HTML from <!DOCTYPE html> to </html>
- CDN libraries welcome: Three.js, OrbitControls, GSAP, D3.js, anything you need
- All other CSS and JS inline
- Dark theme: background #060a14, cards #0f172a, text #e2e8f0, accent #7c3aed
- Works on mobile (responsive)
- Every single button, link, and interactive element must be wired up and functional
- 100% accurate for Grade ${grade} ${subject}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',    // Sonnet for complex interactive HTML
    max_tokens: 16000,              // Enough room for Three.js + full page
    system: 'You are building interactive educational web pages. Output ONLY complete HTML. No markdown, no explanation, no code fences.',
    messages: [{ role: 'user', content: prompt }],
  })

  const block = message.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')
  return stripCodeFences(block.text)
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json() as {
    topicId: string
    teacherInstruction?: string
    visualStyle?: string
    includeQuiz?: boolean
    focusNote?: string
  }
  const { topicId, teacherInstruction, visualStyle, includeQuiz = true, focusNote } = body

  const { data: topic } = await supabase
    .from('topics')
    .select('*, chapters(title, classes(name, grade, subject))')
    .eq('id', topicId)
    .single()

  if (!topic) return new Response('Topic not found', { status: 404 })

  const chapter = (topic as any).chapters
  const cls = chapter?.classes
  const grade: number = cls?.grade ?? 10
  const subject: string = cls?.subject ?? 'General'
  const chapterTitle: string = chapter?.title ?? ''
  const topicTitle: string = topic.title

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)))

      try {
        // Step 1: research (skip if teacher gave a specific instruction — trust it directly)
        let research = ''
        let webContext = ''
        if (!teacherInstruction) {
          send('status', { message: 'Figuring out the best approach for this topic…' })
          ;[research, webContext] = await Promise.all([
            researchTopic(topicTitle, subject, grade),
            searchWeb(`${topicTitle} ${subject} interactive educational visualization grade ${grade}`),
          ])
          try {
            const r = JSON.parse(research)
            if (r.recommendedTech) send('status', { message: `Using ${r.recommendedTech} for this visual…` })
          } catch { /* ignore */ }
        }

        // Step 2: generate
        send('status', { message: 'Building the interactive visual…' })
        const finalHtml = await generateHtml(
          topicTitle, subject, grade, chapterTitle,
          teacherInstruction, visualStyle, includeQuiz, focusNote,
          research, webContext,
        )

        send('html_chunk', { chunk: finalHtml })
        send('status', { message: '💾 Saving…' })

        // Upsert lesson
        const { data: existing } = await supabase
          .from('lessons').select('id, share_token')
          .eq('topic_id', topicId).eq('teacher_id', user.id).single()

        let lessonId: string
        let shareToken: string

        if (existing) {
          lessonId = existing.id
          shareToken = existing.share_token
          await supabase.from('lessons')
            .update({ instructions: teacherInstruction ?? null, status: 'draft' })
            .eq('id', lessonId)
        } else {
          const { data: newLesson, error } = await supabase
            .from('lessons')
            .insert({ topic_id: topicId, teacher_id: user.id, instructions: teacherInstruction ?? null, status: 'draft' })
            .select().single()
          if (error || !newLesson) { send('error', { message: 'Failed to save.' }); controller.close(); return }
          lessonId = newLesson.id
          shareToken = newLesson.share_token
        }

        await supabase.from('lessons')
          .update({ html_url: finalHtml.slice(0, 1_000_000) })
          .eq('id', lessonId)

        send('done', { lessonId, shareToken, title: `${topicTitle} — Grade ${grade} ${subject}` })

      } catch (err) {
        send('error', { message: err instanceof Error ? err.message : 'Generation failed' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
