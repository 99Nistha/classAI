'use client'

export const dynamic = 'force-dynamic'

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

    const { data: classData } = await supabase
      .from('classes')
      .select('*')
      .eq('id', classId)
      .single()

    if (!classData) { setLoading(false); return }
    setCls(classData)

    const chapterData = await getChapters(classId)
    setChapters(chapterData)

    const topicsMap: Record<string, Topic[]> = {}
    await Promise.all(
      chapterData.map(async (ch) => {
        topicsMap[ch.id] = await getTopics(ch.id)
      })
    )
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

  if (loading) {
    return (
      <div className="min-h-screen">
        <header className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-3xl mx-auto h-5 w-48 bg-gray-100 animate-pulse rounded" />
        </header>
        <main className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />)}
        </main>
      </div>
    )
  }

  if (!cls) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Class not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900">{cls.name}</h1>
            <p className="text-xs text-gray-500">Grade {cls.grade} · {cls.subject}</p>
          </div>
          {/* Progress summary */}
          {Object.keys(topicsByChapter).length > 0 && (() => {
            const allTopics = Object.values(topicsByChapter).flat()
            const covered = allTopics.filter((t) => t.status === 'covered').length
            const total = allTopics.length
            const pct = total > 0 ? Math.round((covered / total) * 100) : 0
            return (
              <div className="text-right hidden sm:block">
                <p className="text-xs text-gray-500">{covered}/{total} covered</p>
                <div className="mt-1 w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })()}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {chapters.length === 0 && !addingChapter ? (
          <div className="text-center py-16">
            <h3 className="font-semibold text-gray-900">No chapters yet</h3>
            <p className="text-sm text-gray-500 mt-1">Add your first chapter to start building your syllabus.</p>
            <button
              onClick={() => setAddingChapter(true)}
              className="mt-4 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
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
              className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <button type="submit" disabled={saving || !newChapterTitle.trim()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-60">Add</button>
            <button type="button" onClick={() => setAddingChapter(false)} className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-600">Cancel</button>
          </form>
        ) : (
          chapters.length > 0 && (
            <button
              onClick={() => setAddingChapter(true)}
              className="flex items-center gap-2 w-full text-sm text-gray-400 hover:text-indigo-600 px-2 py-2 rounded-xl hover:bg-indigo-50 transition-colors"
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
