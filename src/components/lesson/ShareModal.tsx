'use client'

import { useState } from 'react'
import { publishLesson, unpublishLesson } from '@/lib/queries/lessons'
import { createClient } from '@/lib/supabase/client'

interface Props {
  lessonId: string
  shareToken: string
  isShared: boolean
  onClose: () => void
  onStatusChange: (shared: boolean) => void
}

export default function ShareModal({ lessonId, shareToken, isShared, onClose, onStatusChange }: Props) {
  const [shared, setShared] = useState(isShared)
  const [copying, setCopying] = useState(false)
  const [toggling, setToggling] = useState(false)
  // School library: default ON (teacher can turn it off)
  const [schoolShared, setSchoolShared] = useState(true)
  const [schoolToggling, setSchoolToggling] = useState(false)

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${shareToken}`

  async function handleToggle() {
    setToggling(true)
    try {
      if (shared) {
        await unpublishLesson(lessonId)
        setShared(false)
        onStatusChange(false)
      } else {
        await publishLesson(lessonId)
        setShared(true)
        onStatusChange(true)
      }
    } finally {
      setToggling(false)
    }
  }

  async function handleSchoolToggle() {
    setSchoolToggling(true)
    try {
      const supabase = createClient()
      await supabase
        .from('lessons')
        .update({ is_school_shared: !schoolShared })
        .eq('id', lessonId)
      setSchoolShared(!schoolShared)
    } finally {
      setSchoolToggling(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl)
    setCopying(true)
    setTimeout(() => setCopying(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Share Lesson</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Public share toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Share with students</p>
              <p className="text-xs text-gray-500 mt-0.5">Anyone with the link can view this lesson</p>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                shared ? 'bg-violet-600' : 'bg-gray-200'
              } ${toggling ? 'opacity-60' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  shared ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Link copy */}
          <div className={`rounded-xl border p-3 space-y-2 transition-opacity ${!shared ? 'opacity-40 pointer-events-none' : ''}`}>
            <p className="text-xs font-medium text-gray-500">Share link</p>
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600 truncate font-mono">
                {shareUrl}
              </div>
              <button
                onClick={handleCopy}
                className={`flex-shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  copying
                    ? 'bg-green-100 text-green-700'
                    : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                }`}
              >
                {copying ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Open in new tab */}
          {shared && (
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open lesson in new tab
            </a>
          )}

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* School library toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Add to school library</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Teachers at your school can discover and use this lesson
              </p>
            </div>
            <button
              onClick={handleSchoolToggle}
              disabled={schoolToggling}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                schoolShared ? 'bg-indigo-500' : 'bg-gray-200'
              } ${schoolToggling ? 'opacity-60' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  schoolShared ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {!schoolShared && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              This lesson won't appear in your school's shared library. You can always turn this back on.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
