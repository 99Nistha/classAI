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
    <div className="relative rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-violet-300 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-100/50">
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
