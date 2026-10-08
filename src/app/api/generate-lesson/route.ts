import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { buildSystemPrompt } from '@/lib/prompts/lesson'
import { stripCodeFences } from '@/lib/lesson/assembler'
import { buildStructuredPrompt, assembleHtml, type LessonData } from '@/lib/lesson/sceneEngine'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

const MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest']

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

async function callWithFallback(prompt: string, systemPrompt: string): Promise<string> {
  let lastError: any
  for (const modelName of MODEL_FALLBACKS) {
    try {
      console.log(`Trying model: ${modelName}`)
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        generationConfig: { responseMimeType: 'application/json' },
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
        const structuredPrompt = buildStructuredPrompt(ctx)

        const rawText = await callWithFallback(structuredPrompt, systemPrompt)
        const cleaned = stripCodeFences(rawText)

        let lessonData: LessonData
        try {
          lessonData = JSON.parse(cleaned) as LessonData
        } catch {
          // try extracting JSON object from response
          const start = cleaned.indexOf('{')
          const end = cleaned.lastIndexOf('}')
          if (start === -1 || end === -1) throw new Error('Model returned unparseable data')
          lessonData = JSON.parse(cleaned.slice(start, end + 1)) as LessonData
        }

        const finalHtml = assembleHtml(lessonData, ctx)

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
