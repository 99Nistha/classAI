import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  buildSystemPrompt,
  buildOutlinePrompt,
  buildPageShellPrompt,
  buildStagePrompt,
  buildQuizPrompt,
  buildPageClosePrompt,
  type OutlineJSON,
  type StageOutline,
} from '@/lib/prompts/lesson'
import { assembleFinalLesson, stripCodeFences, extractJSON } from '@/lib/lesson/assembler'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

// Try models in order until one works
const MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest']

function getModel(systemPrompt: string, modelName = MODEL_FALLBACKS[0]) {
  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
  })
}


function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest) {
  // Auth check
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
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json()
  const { topicId, teacherInstruction } = body as {
    topicId: string
    teacherInstruction?: string
  }

  // Load topic + chapter + class info
  const { data: topic } = await supabase
    .from('topics')
    .select('*, chapters(title, classes(name, grade, subject))')
    .eq('id', topicId)
    .single()

  if (!topic) {
    return new Response('Topic not found', { status: 404 })
  }

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

  const systemPrompt = buildSystemPrompt(ctx)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sse(event, data)))
      }

      try {
        // ── Step 1: Generate outline ──────────────────────────────────────
        send('status', { stage: 'outline', message: 'Planning your lesson...' })

        let outlineRaw = ''
        for (const modelName of MODEL_FALLBACKS) {
          try {
            // Use JSON mime type to force clean JSON output
            const m = genAI.getGenerativeModel({
              model: modelName,
              systemInstruction: systemPrompt,
              generationConfig: { responseMimeType: 'application/json' },
            })
            const r = await m.generateContent(buildOutlinePrompt(ctx))
            outlineRaw = r.response.text()
            break
          } catch (e: any) {
            if (e?.status === 503 || e?.status === 404 || e?.httpStatusCode === 503) continue
            throw e
          }
        }

        let outline: OutlineJSON
        try {
          outline = JSON.parse(extractJSON(outlineRaw))
        } catch {
          // Log raw response to server console for debugging
          console.error('Outline parse failed. Raw response:\n', outlineRaw.slice(0, 500))
          send('error', { message: `Could not parse lesson plan. Model returned: "${outlineRaw.slice(0, 120)}..."` })
          controller.close()
          return
        }

        send('outline', { outline })

        // Helper: generate with fallback (non-streaming to avoid rate limit issues)
        async function generateWithFallback(prompt: string, onChunk: (t: string) => void): Promise<string> {
          let lastError: any
          for (const modelName of MODEL_FALLBACKS) {
            try {
              const m = getModel(systemPrompt, modelName)
              const result = await m.generateContent(prompt)
              const text = stripCodeFences(result.response.text())
              onChunk(text)
              return text
            } catch (e: any) {
              console.error(`Model ${modelName} failed:`, e?.message ?? e)
              lastError = e
              // Always try next model on any error
              continue
            }
          }
          throw new Error(`All models failed. Last error: ${lastError?.message ?? 'unknown'}`)
        }

        // ── Step 2: Generate page shell ───────────────────────────────────
        send('status', { stage: 'shell', message: 'Setting up the page design...' })
        const shell = await generateWithFallback(
          buildPageShellPrompt(ctx, outline),
          (t) => send('html_chunk', { chunk: t })
        )

        // ── Step 3: Generate each stage ───────────────────────────────────
        const stageSections: string[] = []
        let accumulatedHtml = shell

        for (const stage of outline.stages as StageOutline[]) {
          send('status', { stage: `stage_${stage.id}`, message: `Building stage ${stage.id}: ${stage.title}...` })
          const stageHtml = await generateWithFallback(
            buildStagePrompt(ctx, outline, stage, accumulatedHtml),
            (t) => send('html_chunk', { chunk: t })
          )
          stageSections.push(stageHtml)
          accumulatedHtml += stageHtml
        }

        // ── Step 4: Generate quiz ─────────────────────────────────────────
        send('status', { stage: 'quiz', message: 'Generating quiz...' })
        const quizHtml = await generateWithFallback(
          buildQuizPrompt(ctx, outline),
          (t) => send('html_chunk', { chunk: t })
        )

        // ── Step 5: Close page ────────────────────────────────────────────
        send('status', { stage: 'close', message: 'Finishing up...' })
        const closeHtml = await generateWithFallback(
          buildPageClosePrompt(),
          (t) => send('html_chunk', { chunk: t })
        )

        const finalHtml = assembleFinalLesson(shell, stageSections, quizHtml, closeHtml)

        // ── Step 6: Save lesson ───────────────────────────────────────────
        send('status', { stage: 'saving', message: 'Saving your lesson...' })

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
          const { data: newLesson, error: lessonError } = await supabase
            .from('lessons')
            .insert({
              topic_id: topicId,
              teacher_id: user.id,
              instructions: teacherInstruction ?? null,
              status: 'draft',
            })
            .select()
            .single()

          if (lessonError || !newLesson) {
            send('error', { message: 'Failed to save lesson record.' })
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

        send('done', { lessonId, shareToken, title: outline.title })
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
