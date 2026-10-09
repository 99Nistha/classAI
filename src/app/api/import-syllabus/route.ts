import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? 'no-key' })
const PROVIDER: 'anthropic' | 'openai' =
  process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai'

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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text, classId } = await req.json() as { text: string; classId: string }
  if (!text?.trim() || !classId) {
    return NextResponse.json({ error: 'Missing text or classId' }, { status: 400 })
  }

  // Verify the class belongs to this teacher
  const { data: cls } = await supabase
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', user.id)
    .single()
  if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

  const parsePrompt = `Parse this syllabus into chapters and topics. Return ONLY valid JSON (no markdown fences):
{
  "chapters": [
    { "title": "Chapter name", "topics": ["Topic 1", "Topic 2"] }
  ]
}

Syllabus:
${text.slice(0, 8000)}`

  let raw: string
  if (PROVIDER === 'anthropic') {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: parsePrompt }],
    })
    raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
  } else {
    const msg = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2048,
      messages: [{ role: 'user', content: parsePrompt }],
    })
    raw = msg.choices[0]?.message?.content ?? '{}'
  }

  raw = raw.replace(/^```[\w]*\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  let parsed: { chapters: { title: string; topics: string[] }[] }
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Failed to parse syllabus — try simplifying the text.' }, { status: 422 })
  }

  if (!parsed.chapters?.length) {
    return NextResponse.json({ error: 'No chapters detected. Try adding chapter headers.' }, { status: 422 })
  }

  let inserted = 0

  for (let ci = 0; ci < parsed.chapters.length; ci++) {
    const ch = parsed.chapters[ci]
    if (!ch.title?.trim()) continue

    const { data: chapter, error: chErr } = await supabase
      .from('chapters')
      .insert({ class_id: classId, title: ch.title.trim(), order: ci })
      .select()
      .single()

    if (chErr || !chapter) continue

    for (let ti = 0; ti < (ch.topics ?? []).length; ti++) {
      const topicTitle = ch.topics[ti]?.trim()
      if (!topicTitle) continue
      await supabase.from('topics').insert({
        chapter_id: chapter.id,
        title: topicTitle,
        order: ti,
      })
      inserted++
    }
  }

  return NextResponse.json({ inserted })
}
