'use client'

import { useState, useEffect } from 'react'
import TopicRow from '@/components/topics/TopicRow'
import { updateChapter, deleteChapter } from '@/lib/queries/chapters'
import { addTopic } from '@/lib/queries/topics'
import { createClient } from '@/lib/supabase/client'
import type { Chapter, Topic, Lesson } from '@/types'

interface Props {
  chapter: Chapter
  topics: Topic[]
  classId: string
  onChanged: () => void
}

export default function ChapterSection({ chapter, topics, classId, onChanged }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(chapter.title)
  const [addingTopic, setAddingTopic] = useState(false)
  const [newTopic, setNewTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [lessonsByTopic, setLessonsByTopic] = useState<Record<string, Lesson>>({})

  // Load lessons for all topics in this chapter
  useEffect(() => {
    if (topics.length === 0) return
    const supabase = createClient()
    supabase
      .from('lessons')
      .select('*')
      .in('topic_id', topics.map((t) => t.id))
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, Lesson> = {}
        data.forEach((l) => { map[l.topic_id] = l })
        setLessonsByTopic(map)
      })
  }, [topics])

  async function handleRenameChapter(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || title === chapter.title) { setEditing(false); return }
    setLoading(true)
    await updateChapter(chapter.id, title.trim())
    setLoading(false)
    setEditing(false)
    onChanged()
  }

  async function handleDeleteChapter() {
    if (!confirm(`Delete chapter "${chapter.title}" and all its topics?`)) return
    setMenuOpen(false)
    await deleteChapter(chapter.id)
    onChanged()
  }

  async function handleAddTopic(e: React.FormEvent) {
    e.preventDefault()
    if (!newTopic.trim()) return
    setLoading(true)
    await addTopic(chapter.id, newTopic.trim())
    setNewTopic('')
    setAddingTopic(false)
    setLoading(false)
    onChanged()
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Chapter header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-gray-600"
          aria-label={collapsed ? 'Expand chapter' : 'Collapse chapter'}
        >
          <svg
            className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-90'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {editing ? (
          <form onSubmit={handleRenameChapter} className="flex flex-1 gap-2">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
            />
            <button type="submit" disabled={loading} className="rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-gray-300 px-3 py-1 text-xs">Cancel</button>
          </form>
        ) : (
          <>
            <span className="flex-1 text-sm font-semibold text-gray-800">{chapter.title}</span>
            <span className="text-xs text-gray-400">{topics.length} topic{topics.length !== 1 ? 's' : ''}</span>

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1 rounded text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-7 z-20 w-36 rounded-xl border border-gray-200 bg-white shadow-lg py-1">
                    <button
                      onClick={() => { setMenuOpen(false); setEditing(true) }}
                      className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Rename
                    </button>
                    <button
                      onClick={handleDeleteChapter}
                      className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Topics */}
      {!collapsed && (
        <div className="px-2 py-1">
          {topics.length === 0 && !addingTopic && (
            <p className="text-sm text-gray-400 px-3 py-2">No topics yet.</p>
          )}
          {topics.map((topic) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              classId={classId}
              lesson={lessonsByTopic[topic.id] ?? null}
              onChanged={onChanged}
            />
          ))}

          {addingTopic ? (
            <form onSubmit={handleAddTopic} className="flex gap-2 px-3 py-2">
              <input
                autoFocus
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder="Topic name"
                className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <button type="submit" disabled={loading || !newTopic.trim()} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white disabled:opacity-60">Add</button>
              <button type="button" onClick={() => setAddingTopic(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600">Cancel</button>
            </form>
          ) : (
            <button
              onClick={() => setAddingTopic(true)}
              className="flex items-center gap-1.5 w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add topic
            </button>
          )}
        </div>
      )}
    </div>
  )
}
