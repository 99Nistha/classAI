'use client'

import { useState } from 'react'
import Link from 'next/link'
import { archiveClass, deleteClass, updateClass } from '@/lib/queries/classes'
import type { Class } from '@/types'

const SUBJECT_STYLES: Record<string, { from: string; to: string; badge: string; dot: string }> = {
  Biology:        { from: '#34d399', to: '#059669', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  Chemistry:      { from: '#fcd34d', to: '#f59e0b', badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  Physics:        { from: '#60a5fa', to: '#4f46e5', badge: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  Mathematics:    { from: '#c084fc', to: '#7c3aed', badge: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  History:        { from: '#fb923c', to: '#dc2626', badge: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  Geography:      { from: '#2dd4bf', to: '#0891b2', badge: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  English:        { from: '#f472b6', to: '#db2777', badge: 'bg-pink-50 text-pink-700 border-pink-200', dot: 'bg-pink-500' },
  Literature:     { from: '#fb7185', to: '#e11d48', badge: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  'Computer Science': { from: '#38bdf8', to: '#6366f1', badge: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  Economics:      { from: '#4ade80', to: '#16a34a', badge: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
}

const DEFAULT_STYLE = { from: '#a78bfa', to: '#7c3aed', badge: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' }

interface Props {
  cls: Class
  onChanged: () => void
}

export default function ClassCard({ cls, onChanged }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(cls.name)
  const [loading, setLoading] = useState(false)

  const style = SUBJECT_STYLES[cls.subject] ?? DEFAULT_STYLE

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
    <div className="relative rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-violet-300 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-100/60">
      {renaming ? (
        <>
          <div
            className="h-14 w-full"
            style={{ background: `linear-gradient(135deg, ${style.from}, ${style.to})` }}
          />
          <div className="px-4 py-4">
            <form onSubmit={handleRename} className="flex gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-violet-500"
              />
              <button type="submit" disabled={loading} className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm text-white disabled:opacity-60">
                Save
              </button>
              <button type="button" onClick={() => setRenaming(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-500">
                Cancel
              </button>
            </form>
          </div>
        </>
      ) : (
        <>
          <Link href={`/class/${cls.id}`} className="block">
            <div
              className="h-14 w-full"
              style={{ background: `linear-gradient(135deg, ${style.from}, ${style.to})` }}
            />
            <div className="px-4 py-4 pr-10">
              <h3 className="font-bold text-slate-800 truncate group-hover:text-violet-700 transition-colors">
                {cls.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Grade {cls.grade}</p>
              <div className="mt-3">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${style.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                  {cls.subject}
                </span>
              </div>
            </div>
          </Link>

          {/* Three-dot menu — outside the Link */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen) }}
            className="absolute top-16 right-3 z-10 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-3 top-24 z-20 w-40 rounded-xl border border-slate-200 bg-white shadow-xl py-1">
                <button onClick={() => { setMenuOpen(false); setRenaming(true) }} className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                  Rename
                </button>
                <button onClick={handleArchive} className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                  Archive
                </button>
                <button onClick={handleDelete} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors">
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
