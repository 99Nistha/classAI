'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getChapters, addChapter } from '@/lib/queries/chapters'
import { getTopics } from '@/lib/queries/topics'
import ChapterSection from '@/components/chapters/ChapterSection'
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

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: classData } = await supabase.from('classes').select('*').eq('id', classId).single()
    if (!classData) { setLoading(false); return }
    setCls(classData)

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

  const allTopics = Object.values(topicsByChapter).flat()
  const covered = allTopics.filter((t) => t.status === 'covered').length
  const total = allTopics.length
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
          <div className="max-w-3xl mx-auto h-5 w-48 bg-slate-800 animate-pulse rounded" />
        </header>
        <main className="max-w-3xl mx-auto px-6 py-8 space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-40 rounded-2xl bg-slate-900 animate-pulse" />)}
        </main>
      </div>
    )
  }

  if (!cls) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-500">Class not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-slate-500 hover:text-slate-200 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white">{cls.name}</h1>
            <p className="text-xs text-slate-500">Grade {cls.grade} · {cls.subject}</p>
          </div>
          {total > 0 && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-400 mb-1">{covered}/{total} covered</p>
              <div className="w-28 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        {chapters.length === 0 && !addingChapter ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 bg-violet-950/50 border border-violet-900/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="font-bold text-white">No chapters yet</h3>
            <p className="text-sm text-slate-400 mt-1.5 mb-5">Add your first chapter to start building your syllabus.</p>
            <button
              onClick={() => setAddingChapter(true)}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
            >
              Add a chapter
            </button>
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
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-500"
            />
            <button type="submit" disabled={saving || !newChapterTitle.trim()} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Add</button>
            <button type="button" onClick={() => setAddingChapter(false)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400">Cancel</button>
          </form>
        ) : (
          chapters.length > 0 && (
            <button
              onClick={() => setAddingChapter(true)}
              className="flex items-center gap-2 w-full text-sm text-slate-600 hover:text-violet-400 px-2 py-2.5 rounded-xl hover:bg-violet-950/30 transition-colors"
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
  )
}
