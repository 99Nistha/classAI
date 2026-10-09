import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

  const body = await req.json() as {
    lessonId: string
    studentName: string
    questionIndex: number
    questionText: string
    chosenAnswer: string
    correctAnswer: string
    isCorrect: boolean
  }

  const { lessonId, studentName, questionIndex, questionText, chosenAnswer, correctAnswer, isCorrect } = body

  if (!lessonId || !studentName || questionIndex == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { error } = await supabase.from('quiz_responses').insert({
    lesson_id: lessonId,
    student_name: studentName,
    question_index: questionIndex,
    question_text: questionText,
    chosen_answer: chosenAnswer,
    correct_answer: correctAnswer,
    is_correct: isCorrect,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
