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
import { assembleFinalLesson, stripCodeFences } from '@/lib/lesson/assembler'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

function getModel(systemPrompt: string) {
  return genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
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
  const model = getModel(systemPrompt)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sse(event, data)))
      }

      try {
        // ── Step 1: Generate outline ──────────────────────────────────────
        send('status', { stage: 'outline', message: 'Planning your lesson...' })

        const outlineResult = await model.generateContent(buildOutlinePrompt(ctx))
        const outlineRaw = outlineResult.response.text()

        let outline: OutlineJSON
        try {
          outline = JSON.parse(stripCodeFences(outlineRaw.trim()))
        } catch {
          send('error', { message: 'Failed to parse lesson outline. Please try again.' })
          controller.close()
          return
        }

        send('outline', { outline })

        // ── Step 2: Generate page shell ───────────────────────────────────
        send('status', { stage: 'shell', message: 'Setting up the page design...' })

        const shellStream = await model.generateContentStream(buildPageShellPrompt(ctx, outline))
        let shell = ''
        for await (const chunk of shellStream.stream) {
          const text = chunk.text()
          shell += text
          send('html_chunk', { chunk: text })
        }
        shell = stripCodeFences(shell)

        // ── Step 3: Generate each stage ───────────────────────────────────
        const stageSections: string[] = []
        let accumulatedHtml = shell

        for (const stage of outline.stages as StageOutline[]) {
          send('status', {
            stage: `stage_${stage.id}`,
            message: `Building stage ${stage.id}: ${stage.title}...`,
          })

          const stageStream = await model.generateContentStream(
            buildStagePrompt(ctx, outline, stage, accumulatedHtml)
          )

          let stageHtml = ''
          for await (const chunk of stageStream.stream) {
            const text = chunk.text()
            stageHtml += text
            send('html_chunk', { chunk: text })
          }
          stageHtml = stripCodeFences(stageHtml)
          stageSections.push(stageHtml)
          accumulatedHtml += stageHtml
        }

        // ── Step 4: Generate quiz ─────────────────────────────────────────
        send('status', { stage: 'quiz', message: 'Generating quiz...' })

        const quizStream = await model.generateContentStream(buildQuizPrompt(ctx, outline))
        let quizHtml = ''
        for await (const chunk of quizStream.stream) {
          const text = chunk.text()
          quizHtml += text
          send('html_chunk', { chunk: text })
        }
        quizHtml = stripCodeFences(quizHtml)

        // ── Step 5: Close page ────────────────────────────────────────────
        send('status', { stage: 'close', message: 'Finishing up...' })

        const closeResult = await model.generateContent(buildPageClosePrompt())
        const closeHtml = stripCodeFences(closeResult.response.text())
        send('html_chunk', { chunk: closeHtml })

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
