'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Props {
  params: Promise<{ id: string }>
}

interface QuizResponse {
  id: string
  student_name: string
  question_index: number
  question_text: string
  chosen_answer: string
  correct_answer: string
  is_correct: boolean
  responded_at: string
}

interface QuestionSummary {
  index: number
  text: string
  correctAnswer: string
  totalAnswers: number
  correctCount: number
  wrongAnswers: Record<string, number>
}

export default function QuizResultsPage({ params }: Props) {
  const { id: lessonId } = use(params)
  const [responses, setResponses] = useState<QuizResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [lessonTitle, setLessonTitle] = useState('')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase
        .from('quiz_responses')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('responded_at', { ascending: true }),
      supabase
        .from('lessons')
        .select('*, topics(title)')
        .eq('id', lessonId)
        .single(),
    ]).then(([{ data: resp }, { data: lesson }]) => {
      setResponses(resp ?? [])
      setLessonTitle((lesson as any)?.topics?.title ?? 'Lesson')
      setLoading(false)
    })
  }, [lessonId])

  // Group by question
  const questions = responses.reduce<Record<number, QuestionSummary>>((acc, r) => {
    if (!acc[r.question_index]) {
      acc[r.question_index] = {
        index: r.question_index,
        text: r.question_text,
        correctAnswer: r.correct_answer,
        totalAnswers: 0,
        correctCount: 0,
        wrongAnswers: {},
      }
    }
    acc[r.question_index].totalAnswers++
    if (r.is_correct) {
      acc[r.question_index].correctCount++
    } else {
      const key = r.chosen_answer
      acc[r.question_index].wrongAnswers[key] = (acc[r.question_index].wrongAnswers[key] ?? 0) + 1
    }
    return acc
  }, {})

  const questionList = Object.values(questions).sort((a, b) => a.index - b.index)

  const uniqueStudents = new Set(responses.map((r) => r.student_name)).size

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 40%, #fff0f9 70%, #f0fdf4 100%)' }}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-25" style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #60a5fa, transparent 70%)' }} />
      </div>

      <header className="bg-white/70 backdrop-blur-md border-b border-white/60 px-6 py-4 shadow-sm relative z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/lessons" className="text-slate-400 hover:text-slate-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-bold text-slate-800">Quiz Results</h1>
            <p className="text-xs text-slate-500">{lessonTitle}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 relative z-10 space-y-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-2xl bg-white/60 animate-pulse border border-white" />)}
          </div>
        ) : responses.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-indigo-100 border border-violet-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-800 text-lg">No responses yet</h3>
            <p className="text-slate-500 text-sm mt-2">Share the lesson link with students to collect quiz answers.</p>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center shadow-sm">
                <p className="text-2xl font-bold text-violet-600">{uniqueStudents}</p>
                <p className="text-xs text-slate-500 mt-0.5">Students</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center shadow-sm">
                <p className="text-2xl font-bold text-emerald-600">{responses.filter((r) => r.is_correct).length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Correct answers</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center shadow-sm">
                <p className="text-2xl font-bold text-slate-700">{responses.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Total submissions</p>
              </div>
            </div>

            {/* Per-question breakdown */}
            {questionList.map((q) => {
              const pct = q.totalAnswers > 0 ? Math.round((q.correctCount / q.totalAnswers) * 100) : 0
              const wrongEntries = Object.entries(q.wrongAnswers).sort((a, b) => b[1] - a[1])

              return (
                <div key={q.index} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-violet-600 mb-1">Q{q.index + 1}</p>
                      <p className="text-sm font-medium text-slate-800">{q.text}</p>
                    </div>
                    <div className={`text-right flex-shrink-0 text-sm font-bold ${pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                      {pct}% correct
                    </div>
                  </div>

                  {/* Correct bar */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-emerald-600 font-medium">✓ {q.correctAnswer}</span>
                      <span className="text-xs text-slate-400 ml-auto">{q.correctCount}/{q.totalAnswers}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Wrong answers */}
                  {wrongEntries.length > 0 && (
                    <div className="space-y-1.5">
                      {wrongEntries.map(([answer, count]) => {
                        const wrongPct = q.totalAnswers > 0 ? Math.round((count / q.totalAnswers) * 100) : 0
                        return (
                          <div key={answer}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs text-red-500 truncate flex-1">✗ {answer}</span>
                              <span className="text-xs text-slate-400 flex-shrink-0">{count}/{q.totalAnswers}</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-red-300 transition-all duration-500"
                                style={{ width: `${wrongPct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </main>
    </div>
  )
}
