'use client'

import { useState } from 'react'
import Link from 'next/link'
import StatusBadge, { NEXT } from './StatusBadge'
import { setTopicStatus, updateTopic, deleteTopic } from '@/lib/queries/topics'
import type { Topic } from '@/types'

interface Props {
  topic: Topic
  classId: string
  onChanged: () => void
}

export default function TopicRow({ topic, classId, onChanged }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(topic.title)
  const [loading, setLoading] = useState(false)

  async function handleStatusToggle() {
    setLoading(true)
    await setTopicStatus(topic.id, NEXT[topic.status])
    setLoading(false)
    onChanged()
  }

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
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-gray-50 group">
      {editing ? (
        <form onSubmit={handleRename} className="flex flex-1 gap-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <button type="submit" disabled={loading} className="rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white disabled:opacity-60">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-600">Cancel</button>
        </form>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-gray-800 truncate block">{topic.title}</span>
          </div>

          <StatusBadge status={topic.status} onToggle={handleStatusToggle} />

          <Link
            href={`/class/${classId}/topic/${topic.id}/create`}
            className="hidden group-hover:flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Create visual
          </Link>

          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 rounded text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Topic options"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-6 z-20 w-36 rounded-xl border border-gray-200 bg-white shadow-lg py-1">
                  <button
                    onClick={() => { setMenuOpen(false); setEditing(true) }}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Rename
                  </button>
                  <button
                    onClick={handleDelete}
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
  )
}
