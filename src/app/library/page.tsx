'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface SharedLesson {
  id: string
  share_token: string
  created_at: string
  topics: {
    title: string
    chapters: {
      title: string
      classes: { name: string; grade: number; subject: string }
    }
  } | null
  teachers: { name: string | null } | null
}

export default function LibraryPage() {
  const [lessons, setLessons] = useState<SharedLesson[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('lessons')
      .select('id, share_token, created_at, topics(title, chapters(title, classes(name, grade, subject))), teachers(name)')
      .eq('is_school_shared', true)
      .eq('status', 'shared')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setLessons((data ?? []) as SharedLesson[])
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 40%, #fff0f9 70%, #f0fdf4 100%)' }}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-25" style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #60a5fa, transparent 70%)' }} />
      </div>

      <header className="bg-white/70 backdrop-blur-md border-b border-white/60 px-6 py-4 shadow-sm relative z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-slate-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-bold text-slate-800">School Library</h1>
            <p className="text-xs text-slate-500">Shared lessons from your school</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 relative z-10">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-white/60 border border-white animate-pulse" />
            ))}
          </div>
        ) : lessons.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-violet-100 border border-indigo-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-800 text-lg">No shared lessons yet</h3>
            <p className="text-slate-500 text-sm mt-2">When teachers at your school share lessons to the library, they'll appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {lessons.map((lesson) => {
              const topic = lesson.topics
              const cls = topic?.chapters?.classes

              return (
                <a
                  key={lesson.id}
                  href={`/share/${lesson.share_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-white rounded-2xl border border-slate-200 p-4 hover:border-violet-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate group-hover:text-violet-700 transition-colors">
                        {topic?.title ?? 'Untitled topic'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {cls?.name ?? '—'} · Grade {cls?.grade} {cls?.subject}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-slate-400">{topic?.chapters?.title}</p>
                        {lesson.teachers?.name && (
                          <>
                            <span className="text-slate-300">·</span>
                            <p className="text-xs text-violet-500 font-medium">{lesson.teachers.name}</p>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 flex-shrink-0 mt-0.5">
                      {new Date(lesson.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
