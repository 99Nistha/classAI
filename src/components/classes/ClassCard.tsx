'use client'

import { useState } from 'react'
import Link from 'next/link'
import { archiveClass, deleteClass, updateClass } from '@/lib/queries/classes'
import type { Class } from '@/types'

const SUBJECT_STYLES: Record<string, { from: string; to: string; badge: string; dot: string }> = {
  Biology:     { from: '#052e16', to: '#14532d', badge: 'bg-emerald-900/60 text-emerald-300 border-emerald-800', dot: 'bg-emerald-400' },
  Chemistry:   { from: '#1c1917', to: '#292524', badge: 'bg-yellow-900/60 text-yellow-300 border-yellow-800', dot: 'bg-yellow-400' },
  Physics:     { from: '#0c1a2e', to: '#172554', badge: 'bg-blue-900/60 text-blue-300 border-blue-800', dot: 'bg-blue-400' },
  Mathematics: { from: '#1e0a4a', to: '#2e1065', badge: 'bg-purple-900/60 text-purple-300 border-purple-800', dot: 'bg-purple-400' },
  History:     { from: '#1c0a00', to: '#431407', badge: 'bg-orange-900/60 text-orange-300 border-orange-800', dot: 'bg-orange-400' },
  Geography:   { from: '#042f2e', to: '#134e4a', badge: 'bg-teal-900/60 text-teal-300 border-teal-800', dot: 'bg-teal-400' },
}

const DEFAULT_STYLE = { from: '#0f172a', to: '#1e293b', badge: 'bg-slate-800 text-slate-300 border-slate-700', dot: 'bg-slate-400' }

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
    <div className="relative rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden hover:border-slate-700 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30">
      {/* Gradient header */}
      <div
        className="h-14 w-full"
        style={{ background: `linear-gradient(135deg, ${style.from}, ${style.to})` }}
      />

      {renaming ? (
        <div className="px-4 py-4">
          <form onSubmit={handleRename} className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-violet-500"
            />
            <button type="submit" disabled={loading} className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm text-white disabled:opacity-60">
              Save
            </button>
            <button type="button" onClick={() => setRenaming(false)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400">
              Cancel
            </button>
          </form>
        </div>
      ) : (
        <div className="px-4 py-4">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/class/${cls.id}`} className="flex-1 min-w-0 group">
              <h3 className="font-bold text-white truncate group-hover:text-violet-300 transition-colors">
                {cls.name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Grade {cls.grade}</p>
            </Link>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>
          </div>

          <div className="mt-3">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${style.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
              {cls.subject}
            </span>
          </div>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-3 top-14 z-20 w-40 rounded-xl border border-slate-700 bg-slate-800 shadow-xl py-1">
                <button onClick={() => { setMenuOpen(false); setRenaming(true) }} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                  Rename
                </button>
                <button onClick={handleArchive} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                  Archive
                </button>
                <button onClick={handleDelete} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-950 transition-colors">
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
