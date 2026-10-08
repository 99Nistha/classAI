'use client'

import { useEffect, useRef, useState, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ShareModal from '@/components/lesson/ShareModal'
import type { Topic, Chapter, Class } from '@/types'

interface Props {
  params: Promise<{ id: string; topicId: string }>
}

interface ChatMessage {
  role: 'system' | 'assistant'
  content: string
  type?: 'status' | 'done' | 'error'
}

export default function CreateVisualPage({ params }: Props) {
  const { id: classId, topicId } = use(params)

  const [topic, setTopic] = useState<Topic | null>(null)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [cls, setCls] = useState<Class | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasPrevious, setHasPrevious] = useState(false)

  const [instruction, setInstruction] = useState('')
  const [generating, setGenerating] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [liveHtml, setLiveHtml] = useState('')
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isShared, setIsShared] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const abortRef = useRef<(() => void) | null>(null)

  // Load topic + existing lesson
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: topicData }, { data: chapterData0 }] = await Promise.all([
        supabase.from('topics').select('*').eq('id', topicId).single(),
        supabase.from('topics').select('chapter_id').eq('id', topicId).single(),
      ])
      if (!topicData) { setLoading(false); return }
      setTopic(topicData)

      const [{ data: chData }, { data: clsData }] = await Promise.all([
        supabase.from('chapters').select('*').eq('id', topicData.chapter_id).single(),
        supabase.from('classes').select('*').eq('id', classId).single(),
      ])
      if (chData) setChapter(chData)
      if (clsData) setCls(clsData)

      // Load existing lesson if any
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: existing } = await supabase
          .from('lessons')
          .select('id, share_token, html_url, status')
          .eq('topic_id', topicId)
          .eq('teacher_id', user.id)
          .single()

        if (existing?.html_url) {
          setLiveHtml(existing.html_url)
          setLessonId(existing.id)
          setShareToken(existing.share_token)
          setIsShared(existing.status === 'shared')
          setHasPrevious(true)
          setDone(true)
        }
      }

      setLoading(false)
    }
    load()
  }, [topicId, classId])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (iframeRef.current && liveHtml) {
      iframeRef.current.srcdoc = liveHtml
    }
  }, [liveHtml])

  function addMessage(msg: ChatMessage) {
    setMessages((prev) => [...prev, msg])
  }

  async function generate() {
    if (generating) return
    setGenerating(true)
    setDone(false)
    setMessages([])
    setLiveHtml('')
    setLessonId(null)
    setShareToken(null)
    setHasPrevious(false)

    try {
      const response = await fetch('/api/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, teacherInstruction: instruction || undefined }),
      })

      if (!response.ok || !response.body) {
        addMessage({ role: 'assistant', content: 'Failed to start generation. Please try again.', type: 'error' })
        setGenerating(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      abortRef.current = () => reader.cancel()

      let buffer = ''
      let htmlAccumulator = ''

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          if (!part.trim()) continue
          const lines = part.split('\n')
          let eventType = 'message', dataLine = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim()
            if (line.startsWith('data: ')) dataLine = line.slice(6)
          }
          if (!dataLine) continue
          let payload: any
          try { payload = JSON.parse(dataLine) } catch { continue }

          switch (eventType) {
            case 'status':
              addMessage({ role: 'system', content: payload.message, type: 'status' })
              break
            case 'html_chunk':
              htmlAccumulator += payload.chunk
              setLiveHtml(htmlAccumulator)
              break
            case 'done':
              setLessonId(payload.lessonId)
              setShareToken(payload.shareToken)
              setDone(true)
              addMessage({ role: 'assistant', content: `"${payload.title}" is ready!`, type: 'done' })
              break
            case 'error':
              addMessage({ role: 'assistant', content: `Error: ${payload.message}`, type: 'error' })
              break
          }
        }
      }
    } catch (err) {
      addMessage({ role: 'assistant', content: err instanceof Error ? err.message : 'Something went wrong.', type: 'error' })
    } finally {
      setGenerating(false)
      abortRef.current = null
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!topic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-slate-400">Topic not found.</p>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen flex flex-col bg-slate-950">
        {/* Header */}
        <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex-shrink-0">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <Link href={`/class/${classId}`} className="text-slate-500 hover:text-slate-200 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-slate-100 truncate">{topic.title}</h1>
              <p className="text-xs text-slate-500">{chapter?.title} · {cls?.subject} Grade {cls?.grade}</p>
            </div>
            {done && shareToken && lessonId && (
              <div className="flex items-center gap-2">
                <Link
                  href={`/share/${shareToken}`}
                  target="_blank"
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open
                </Link>
                <button
                  onClick={() => setShowShareModal(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Split layout */}
        <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
          {/* Left: Controls */}
          <div className="w-72 flex-shrink-0 flex flex-col bg-slate-900 border-r border-slate-800">
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

              {/* Previous visual indicator */}
              {hasPrevious && messages.length === 0 && (
                <div className="rounded-xl bg-emerald-950 border border-emerald-800 px-3 py-2.5 flex items-start gap-2">
                  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-emerald-400">Previous visual loaded</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Generate to create a new version</p>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {messages.length === 0 && !generating && !hasPrevious && (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-2xl bg-violet-950 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-300">Ready to create</p>
                  <p className="text-xs text-slate-500 mt-1">Describe what you want or just hit Generate</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i}>
                  {msg.type === 'status' && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {generating && <div className="w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
                      <span>{msg.content}</span>
                    </div>
                  )}
                  {msg.type === 'done' && (
                    <div className="rounded-xl bg-emerald-950 border border-emerald-800 px-3 py-2.5 flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-xs text-emerald-300">{msg.content}</p>
                    </div>
                  )}
                  {msg.type === 'error' && (
                    <div className="rounded-xl bg-red-950 border border-red-900 px-3 py-2.5">
                      <p className="text-xs text-red-300">{msg.content}</p>
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-800 p-3 space-y-2.5">
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Optional: describe what you want, e.g. 'Show the full photosynthesis flow with all stages'"
                rows={3}
                disabled={generating}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-none disabled:opacity-50 transition-colors"
              />
              {generating ? (
                <button
                  onClick={() => { abortRef.current?.(); setGenerating(false) }}
                  className="w-full rounded-xl border border-red-800 bg-red-950 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-900 transition-colors"
                >
                  Stop generating
                </button>
              ) : (
                <button
                  onClick={generate}
                  className="w-full rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {done ? 'Regenerate' : 'Generate Visual'}
                </button>
              )}
            </div>
          </div>

          {/* Right: Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {liveHtml ? (
              <iframe
                ref={iframeRef}
                className="flex-1 w-full border-0"
                title="Lesson Preview"
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-slate-950">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-500">Visual will appear here</p>
                  <p className="text-xs text-slate-600 mt-1">Add an instruction and hit Generate</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showShareModal && lessonId && shareToken && (
        <ShareModal
          lessonId={lessonId}
          shareToken={shareToken}
          isShared={isShared}
          onClose={() => setShowShareModal(false)}
          onStatusChange={(s) => setIsShared(s)}
        />
      )}
    </>
  )
}
