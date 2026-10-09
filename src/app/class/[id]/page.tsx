'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getChapters, addChapter } from '@/lib/queries/chapters'
import { getTopics } from '@/lib/queries/topics'
import ChapterSection from '@/components/chapters/ChapterSection'
import ImportSyllabusModal from '@/components/classes/ImportSyllabusModal'
import type { Class, Chapter, Topic } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default function ClassPage({ params }: Props) {
  const { id: classId } = use(params)
  const [cls, setCls] = useState<Class | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [topicsByChapter, setTopicsByChapter] = useState<Record<string, Topic[]>>({})
  const [loading, setLoading] = useState(true)
  const [addingChapter, setAddingChapter] = useState(false)
  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [teacherName, setTeacherName] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: classData } = await supabase.from('classes').select('*').eq('id', classId).single()
    if (!classData) { setLoading(false); return }
    setCls(classData)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: teacher } = await supabase.from('teachers').select('name').eq('id', user.id).single()
      if (teacher?.name) setTeacherName(teacher.name)
    }

    const chapterData = await getChapters(classId)
    setChapters(chapterData)

    const topicsMap: Record<string, Topic[]> = {}
    await Promise.all(chapterData.map(async (ch) => { topicsMap[ch.id] = await getTopics(ch.id) }))
    setTopicsByChapter(topicsMap)
    setLoading(false)
  }, [classId])

  useEffect(() => { load() }, [load])

  async function handleAddChapter(e: React.FormEvent) {
    e.preventDefault()
    if (!newChapterTitle.trim()) return
    setSaving(true)
    await addChapter(classId, newChapterTitle.trim())
    setNewChapterTitle('')
    setAddingChapter(false)
    setSaving(false)
    load()
  }

  const total = Object.values(topicsByChapter).flat().length

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 40%, #fff0f9 70%, #f0fdf4 100%)' }}>
        <header className="bg-white/80 backdrop-blur-sm border-b border-white/60 px-6 py-4 shadow-sm">
          <div className="max-w-3xl mx-auto h-5 w-48 bg-slate-200 animate-pulse rounded" />
        </header>
        <main className="max-w-3xl mx-auto px-6 py-8 space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-40 rounded-2xl bg-white/80 border border-white animate-pulse" />)}
        </main>
      </div>
    )
  }

  if (!cls) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0f4ff, #faf5ff)' }}>
        <p className="text-slate-500">Class not found.</p>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 40%, #fff0f9 70%, #f0fdf4 100%)' }}>
        {/* Background blobs */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #60a5fa, transparent 70%)' }} />
        </div>

        <header className="bg-white/70 backdrop-blur-md border-b border-white/60 px-6 py-4 shadow-sm relative z-10">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-slate-700 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-slate-800">{cls.name}</h1>
              <p className="text-xs text-slate-500">
                Grade {cls.grade} · {cls.subject}
                {teacherName && <span className="ml-1 text-violet-500">· {teacherName}</span>}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowImport(true)}
                className="hidden sm:flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import syllabus
              </button>
              {total > 0 && (
                <span className="text-xs text-slate-400 hidden sm:block">{total} topic{total !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-6 space-y-4 relative z-10">
          {chapters.length === 0 && !addingChapter ? (
            <div className="text-center py-20">
              <div className="w-14 h-14 bg-gradient-to-br from-violet-100 to-indigo-100 border border-violet-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-800">No chapters yet</h3>
              <p className="text-sm text-slate-500 mt-1.5 mb-5">Add chapters manually or import your syllabus in one go.</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setAddingChapter(true)}
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition-all shadow-sm"
                >
                  Add a chapter
                </button>
                <button
                  onClick={() => setShowImport(true)}
                  className="rounded-xl border border-violet-300 bg-white px-5 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50 transition-colors"
                >
                  Import syllabus
                </button>
              </div>
            </div>
          ) : (
            <>
              {chapters.map((ch) => (
                <ChapterSection
                  key={ch.id}
                  chapter={ch}
                  topics={topicsByChapter[ch.id] ?? []}
                  classId={classId}
                  onChanged={load}
                />
              ))}
            </>
          )}

          {addingChapter ? (
            <form onSubmit={handleAddChapter} className="flex gap-2">
              <input
                autoFocus
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                placeholder="Chapter name"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
              <button type="submit" disabled={saving || !newChapterTitle.trim()} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Add</button>
              <button type="button" onClick={() => setAddingChapter(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-500">Cancel</button>
            </form>
          ) : (
            chapters.length > 0 && (
              <button
                onClick={() => setAddingChapter(true)}
                className="flex items-center gap-2 w-full text-sm text-slate-400 hover:text-violet-600 px-2 py-2.5 rounded-xl hover:bg-white/60 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add chapter
              </button>
            )
          )}
        </main>
      </div>

      {showImport && (
        <ImportSyllabusModal
          classId={classId}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); load() }}
        />
      )}
    </>
  )
}
