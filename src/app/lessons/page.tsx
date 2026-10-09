'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getLessons } from '@/lib/queries/lessons'

interface LessonWithContext {
  id: string
  status: string
  created_at: string
  share_token: string
  topics: {
    title: string
    chapters: {
      title: string
      classes: {
        id: string
        name: string
        grade: number
        subject: string
      }
    }
  } | null
  teachers: { name: string | null } | null
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<LessonWithContext[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLessons().then((data) => {
      setLessons(data as LessonWithContext[])
      setLoading(false)
    })
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Background decoration */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-violet-100/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-100/30 rounded-full blur-3xl" />
      </div>

      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-6 py-4 shadow-sm relative z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-slate-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-bold text-slate-800">Lesson Library</h1>
            <p className="text-xs text-slate-500">All your generated visuals</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 relative z-10">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : lessons.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-violet-50 border border-violet-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-800 text-lg">No lessons yet</h3>
            <p className="text-slate-500 text-sm mt-2 mb-6">Generate your first visual from any topic in a class.</p>
            <Link href="/" className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors">
              Go to classes
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {lessons.map((lesson) => {
              const topic = lesson.topics
              const cls = topic?.chapters?.classes
              const topicId = (lesson as any).topic_id
              const classId = cls?.id

              return (
                <div
                  key={lesson.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-violet-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">
                        {topic?.title ?? 'Untitled topic'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {cls?.name ?? '—'} · Grade {cls?.grade} {cls?.subject}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-slate-400">{topic?.chapters?.title ?? ''}</p>
                        {lesson.teachers?.name && (
                          <>
                            <span className="text-slate-300">·</span>
                            <p className="text-xs text-violet-500 font-medium">{lesson.teachers.name}</p>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${
                        lesson.status === 'shared'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {lesson.status === 'shared' ? 'Shared' : 'Draft'}
                      </span>
                      <p className="text-xs text-slate-400">
                        {new Date(lesson.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {classId && topicId && (
                      <Link
                        href={`/class/${classId}/topic/${topicId}/create`}
                        className="text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors"
                      >
                        Edit visual →
                      </Link>
                    )}
                    <Link
                      href={`/lessons/${lesson.id}/results`}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors ml-auto"
                    >
                      Quiz results
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
