'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getClasses } from '@/lib/queries/classes'
import ClassCard from '@/components/classes/ClassCard'
import AddClassModal from '@/components/classes/AddClassModal'
import type { Class } from '@/types'

function greeting(name: string | null): string {
  const hour = new Date().getHours()
  const time = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = name?.split(' ')[0] ?? null
  return firstName ? `${time}, ${firstName}` : time
}

export default function HomePage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [teacherName, setTeacherName] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    try {
      const [data, { data: { user } }] = await Promise.all([
        getClasses(),
        supabase.auth.getUser(),
      ])
      setClasses(data)

      if (user) {
        const { data: teacher } = await supabase
          .from('teachers')
          .select('name')
          .eq('id', user.id)
          .single()
        if (teacher?.name) setTeacherName(teacher.name)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <>
      <style>{`
        @keyframes floatA { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-18px) rotate(8deg); } }
        @keyframes floatB { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-12px) rotate(-6deg); } }
        @keyframes floatC { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-22px) rotate(5deg); } }
        .float-a { animation: floatA 7s ease-in-out infinite; }
        .float-b { animation: floatB 9s ease-in-out infinite; }
        .float-c { animation: floatC 11s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 40%, #fff0f9 70%, #f0fdf4 100%)' }}>

        {/* Decorative background blobs */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-30" style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />
          <div className="absolute top-1/2 -left-48 w-96 h-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #60a5fa, transparent 70%)' }} />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-25" style={{ background: 'radial-gradient(circle, #f9a8d4, transparent 70%)' }} />
          <div className="absolute bottom-1/3 -right-16 w-64 h-64 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #34d399, transparent 70%)' }} />
        </div>

        {/* Floating doodle icons */}
        <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
          <div className="float-a absolute top-24 right-20 opacity-20">
            <svg className="w-10 h-10 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="float-b absolute top-40 left-10 opacity-20">
            <svg className="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="float-c absolute bottom-40 left-16 opacity-20">
            <svg className="w-9 h-9 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <div className="float-a absolute bottom-24 right-16 opacity-15" style={{ animationDelay: '2s' }}>
            <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div className="float-b absolute top-1/2 right-8 opacity-15" style={{ animationDelay: '4s' }}>
            <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <div className="float-c absolute top-32 left-1/3 opacity-10" style={{ animationDelay: '1s' }}>
            <svg className="w-12 h-12 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        {/* Header */}
        <header className="relative z-10 bg-white/70 backdrop-blur-md border-b border-white/60 px-6 py-4 shadow-sm">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                {/* Classroom logo: chalkboard + sparkle */}
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24">
                  <rect x="2" y="3" width="20" height="12" rx="1.5" fill="white" fillOpacity="0.9"/>
                  <path d="M5 8h7M5 11h5" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M16.5 5.5l.4 1.2 1.2.4-1.2.4-.4 1.2-.4-1.2-1.2-.4 1.2-.4z" fill="#7c3aed"/>
                  <path d="M8.5 15l-1 3.5M15.5 15l1 3.5" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="text-base font-bold bg-gradient-to-r from-violet-700 to-indigo-600 bg-clip-text text-transparent">ClassAI</span>
            </div>
            <div className="flex items-center gap-4">
              {teacherName && (
                <span className="text-sm text-slate-500 hidden sm:block font-medium">
                  {teacherName}
                </span>
              )}
              <Link href="/lessons" className="text-sm text-violet-600 hover:text-violet-700 font-semibold transition-colors hidden sm:block">
                My lessons
              </Link>
              <Link href="/library" className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold transition-colors hidden sm:block">
                School library
              </Link>
              <button
                onClick={handleSignOut}
                className="text-sm text-slate-400 hover:text-slate-700 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-10 relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{greeting(teacherName)} 👋</h2>
              <p className="text-slate-500 text-sm mt-1">
                {classes.length > 0
                  ? `${classes.length} class${classes.length !== 1 ? 'es' : ''} · select one to manage topics and create visuals`
                  : 'Add your first class and start building interactive lessons.'}
              </p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition-all shadow-md shadow-violet-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              New class
            </button>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-36 rounded-2xl bg-white/60 animate-pulse border border-white" />
              ))}
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-indigo-100 border border-violet-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-800 text-lg">No classes yet</h3>
              <p className="text-slate-500 text-sm mt-2 mb-6">Add your first class and start building interactive lessons.</p>
              <button
                onClick={() => setShowAdd(true)}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition-all shadow-md shadow-violet-200"
              >
                Add your first class
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {classes.map((cls) => (
                <ClassCard key={cls.id} cls={cls} onChanged={load} />
              ))}
            </div>
          )}
        </main>

        {showAdd && (
          <AddClassModal onClose={() => setShowAdd(false)} onAdded={load} />
        )}
      </div>
    </>
  )
}
