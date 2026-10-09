'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  params: Promise<{ token: string }>
}

export default function SharePage({ params }: Props) {
  const { token } = use(params)
  const [studentName, setStudentName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [lessonHtml, setLessonHtml] = useState<string | null>(null)
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('lessons')
      .select('id, html_url, status')
      .eq('share_token', token)
      .single()
      .then(({ data }) => {
        if (!data || !data.html_url) {
          setNotFound(true)
        } else {
          setLessonId(data.id)
          setLessonHtml(data.html_url)
        }
        setLoading(false)
      })
  }, [token])

  // Forward quiz answers from iframe to our API
  useEffect(() => {
    if (!studentName || !lessonId) return

    function handleMessage(e: MessageEvent) {
      if (e.data?.type !== 'quizAnswer') return
      fetch('/api/quiz-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          studentName,
          questionIndex: e.data.questionIndex,
          questionText: e.data.questionText,
          chosenAnswer: e.data.chosenAnswer,
          correctAnswer: e.data.correctAnswer,
          isCorrect: e.data.isCorrect,
        }),
      }).catch(() => {})
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [studentName, lessonId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-slate-400">Lesson not found or not shared.</p>
      </div>
    )
  }

  // Name gate
  if (!studentName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center mx-auto mb-5">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-1">Welcome!</h1>
          <p className="text-sm text-slate-400 mb-6">Enter your first name to start the lesson.</p>
          <form onSubmit={(e) => { e.preventDefault(); if (nameInput.trim()) setStudentName(nameInput.trim()) }}>
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your first name"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-violet-500 mb-4 text-center"
            />
            <button
              type="submit"
              disabled={!nameInput.trim()}
              className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
            >
              Start lesson
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      <iframe
        srcDoc={lessonHtml!}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="ClassAI Lesson"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  )
}
