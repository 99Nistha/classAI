'use client'

import { useState } from 'react'
import Link from 'next/link'
import { updateTopic, deleteTopic } from '@/lib/queries/topics'
import type { Topic, Lesson } from '@/types'

interface Props {
  topic: Topic
  classId: string
  lesson?: Lesson | null
  onChanged: () => void
}

export default function TopicRow({ topic, classId, lesson, onChanged }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(topic.title)
  const [loading, setLoading] = useState(false)

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || title === topic.title) { setEditing(false); return }
    setLoading(true)
    await updateTopic(topic.id, { title: title.trim() })
    setLoading(false)
    setEditing(false)
    onChanged()
  }

  async function handleDelete() {
    if (!confirm(`Delete topic "${topic.title}"?`)) return
    setMenuOpen(false)
    await deleteTopic(topic.id)
    onChanged()
  }

  return (
    <div className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl hover:bg-slate-50 group transition-colors">
      {editing ? (
        <form onSubmit={handleRename} className="flex flex-1 gap-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-violet-500"
          />
          <button type="submit" disabled={loading} className="rounded-lg bg-violet-600 px-3 py-1 text-xs text-white disabled:opacity-60">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-500">Cancel</button>
        </form>
      ) : (
        <>
          {/* Bullet dot */}
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${lesson ? 'bg-violet-400' : 'bg-slate-300'}`} />

          <div className="flex-1 min-w-0">
            <span className="text-sm text-slate-700 truncate block">{topic.title}</span>
          </div>

          {/* View visual — only if lesson exists */}
          {lesson?.share_token && (
            <Link
              href={`/share/${lesson.share_token}`}
              target="_blank"
              className="hidden group-hover:flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 whitespace-nowrap transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View
            </Link>
          )}

          {/* Create / Edit visual */}
          <Link
            href={`/class/${classId}/topic/${topic.id}/create`}
            className="hidden group-hover:flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 whitespace-nowrap transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {lesson ? 'Edit' : 'Create'}
          </Link>

          {/* Three-dot menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 rounded text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-6 z-20 w-36 rounded-xl border border-slate-200 bg-white shadow-xl py-1">
                  <button onClick={() => { setMenuOpen(false); setEditing(true) }} className="w-full text-left px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                    Rename
                  </button>
                  <button onClick={handleDelete} className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
