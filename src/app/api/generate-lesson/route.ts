import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { buildSystemPrompt, buildVisualPrompt } from '@/lib/prompts/lesson'
import { stripCodeFences } from '@/lib/lesson/assembler'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

async function generateHtml(system: string, prompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    system,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = message.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
  return stripCodeFences(block.text)
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

  const body = await req.json() as {
    topicId: string
    teacherInstruction?: string
    visualStyle?: string
    includeQuiz?: boolean
    focusNote?: string
  }
  const { topicId, teacherInstruction, visualStyle, includeQuiz, focusNote } = body

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
    visualStyle,
    includeQuiz: includeQuiz ?? true,
    focusNote,
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sse(event, data)))
      }

      try {
        send('status', { stage: 'generating', message: 'Creating your visual…' })

        const system = buildSystemPrompt(ctx)
        const prompt = buildVisualPrompt(ctx)
        const finalHtml = await generateHtml(system, prompt)

        send('html_chunk', { chunk: finalHtml })
        send('status', { stage: 'saving', message: 'Saving…' })

        // Upsert lesson in DB
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
          .update({ html_url: finalHtml.slice(0, 1_000_000) })
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
