'use client'

import { useState } from 'react'
import Link from 'next/link'
import { archiveClass, deleteClass, updateClass } from '@/lib/queries/classes'
import type { Class } from '@/types'

const SUBJECT_COLORS: Record<string, string> = {
  Biology: 'bg-green-100 text-green-700',
  Chemistry: 'bg-yellow-100 text-yellow-700',
  Physics: 'bg-blue-100 text-blue-700',
  Mathematics: 'bg-purple-100 text-purple-700',
  History: 'bg-orange-100 text-orange-700',
  Geography: 'bg-teal-100 text-teal-700',
}

interface Props {
  cls: Class
  onChanged: () => void
}

export default function ClassCard({ cls, onChanged }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(cls.name)
  const [loading, setLoading] = useState(false)

  const subjectColor = SUBJECT_COLORS[cls.subject] ?? 'bg-gray-100 text-gray-700'

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || newName === cls.name) { setRenaming(false); return }
    setLoading(true)
    await updateClass(cls.id, { name: newName.trim() })
    setLoading(false)
    setRenaming(false)
    onChanged()
  }

  async function handleArchive() {
    setMenuOpen(false)
    await archiveClass(cls.id)
    onChanged()
  }

  async function handleDelete() {
    if (!confirm(`Delete "${cls.name}"? This removes all chapters, topics and lessons.`)) return
    setMenuOpen(false)
    await deleteClass(cls.id)
    onChanged()
  }

  return (
    <div className="relative bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      {renaming ? (
        <form onSubmit={handleRename} className="flex gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setRenaming(false)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600"
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <Link href={`/class/${cls.id}`} className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate hover:text-indigo-600 transition-colors">
                {cls.name}
              </h3>
              <p className="mt-1 text-sm text-gray-500">Grade {cls.grade}</p>
            </Link>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              aria-label="Class options"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>
          </div>

          <div className="mt-3">
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${subjectColor}`}>
              {cls.subject}
            </span>
          </div>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-3 top-10 z-20 w-40 rounded-xl border border-gray-200 bg-white shadow-lg py-1">
                <button
                  onClick={() => { setMenuOpen(false); setRenaming(true) }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Rename
                </button>
                <button
                  onClick={handleArchive}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Archive
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
