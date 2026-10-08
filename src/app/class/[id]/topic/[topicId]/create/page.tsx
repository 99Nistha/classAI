'use client'

export const dynamic = 'force-dynamic'

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
  type?: 'status' | 'outline' | 'done' | 'error'
}

interface OutlineStage {
  id: number
  title: string
  description: string
}

export default function CreateVisualPage({ params }: Props) {
  const { id: classId, topicId } = use(params)

  const [topic, setTopic] = useState<Topic | null>(null)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [cls, setCls] = useState<Class | null>(null)
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: topicData } = await supabase
        .from('topics')
        .select('*')
        .eq('id', topicId)
        .single()
      if (!topicData) { setLoading(false); return }
      setTopic(topicData)

      const { data: chapterData } = await supabase
        .from('chapters')
        .select('*')
        .eq('id', topicData.chapter_id)
        .single()
      if (chapterData) setChapter(chapterData)

      const { data: classData } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single()
      if (classData) setCls(classData)

      setLoading(false)
    }
    load()
  }, [topicId, classId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (iframeRef.current && liveHtml) {
      const doc = iframeRef.current.contentDocument
      if (doc) {
        doc.open()
        doc.write(liveHtml)
        doc.close()
      }
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

    let htmlAccumulator = ''

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

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          if (!part.trim()) continue
          const lines = part.split('\n')
          let eventType = 'message'
          let dataLine = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim()
            if (line.startsWith('data: ')) dataLine = line.slice(6)
          }
          if (!dataLine) continue

          let payload: any
          try { payload = JSON.parse(dataLine) } catch { continue }

          switch (eventType) {
            case 'status':
              addMessage({
                role: 'system',
                content: payload.message,
                type: 'status',
              })
              break

            case 'outline':
              addMessage({
                role: 'assistant',
                content: `**${payload.outline.title}**\n${payload.outline.tagline}\n\n${(payload.outline.stages as OutlineStage[])
                  .map((s) => `${s.id}. ${s.title} — ${s.description}`)
                  .join('\n')}`,
                type: 'outline',
              })
              break

            case 'html_chunk':
              htmlAccumulator += payload.chunk
              setLiveHtml(htmlAccumulator)
              break

            case 'done':
              setLessonId(payload.lessonId)
              setShareToken(payload.shareToken)
              setDone(true)
              addMessage({
                role: 'assistant',
                content: `Your lesson "${payload.title}" is ready!`,
                type: 'done',
              })
              break

            case 'error':
              addMessage({
                role: 'assistant',
                content: `Error: ${payload.message}`,
                type: 'error',
              })
              break
          }
        }
      }
    } catch (err) {
      addMessage({
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Something went wrong.',
        type: 'error',
      })
    } finally {
      setGenerating(false)
      abortRef.current = null
    }
  }

  function handleStop() {
    abortRef.current?.()
    setGenerating(false)
    addMessage({ role: 'system', content: 'Generation stopped.', type: 'status' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!topic) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Topic not found.</p>
      </div>
    )
  }

  return (
    <>
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Link
            href={`/class/${classId}`}
            className="text-gray-400 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-gray-900 truncate">{topic.title}</h1>
            <p className="text-xs text-gray-500">
              {chapter?.title} · {cls?.subject} Grade {cls?.grade}
            </p>
          </div>
          {done && shareToken && lessonId && (
            <div className="flex items-center gap-2">
              <Link
                href={`/share/${shareToken}`}
                target="_blank"
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Preview
              </Link>
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
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

      {/* Main split layout */}
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
        {/* Left: Chat panel */}
        <div className="w-80 flex-shrink-0 flex flex-col bg-white border-r border-gray-200">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && !generating && (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700">Ready to create</p>
                <p className="text-xs text-gray-500 mt-1">
                  Add an instruction below or hit Generate
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                {msg.type === 'status' && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {generating && (
                      <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    )}
                    <span>{msg.content}</span>
                  </div>
                )}
                {msg.type === 'outline' && (
                  <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2.5">
                    <p className="text-xs font-semibold text-indigo-700 mb-1.5">Lesson Plan</p>
                    <pre className="text-xs text-indigo-800 whitespace-pre-wrap font-sans leading-relaxed">
                      {msg.content}
                    </pre>
                  </div>
                )}
                {msg.type === 'done' && (
                  <div className="rounded-xl bg-green-50 border border-green-100 px-3 py-2.5 flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-xs text-green-800">{msg.content}</p>
                  </div>
                )}
                {msg.type === 'error' && (
                  <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5">
                    <p className="text-xs text-red-700">{msg.content}</p>
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-gray-200 p-3 space-y-2">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Optional: give Claude a direction e.g. 'Focus on diagrams' or 'Make it story-based'…"
              rows={3}
              disabled={generating}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-700 placeholder-gray-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none disabled:opacity-60"
            />
            <div className="flex gap-2">
              {generating ? (
                <button
                  onClick={handleStop}
                  className="flex-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={generate}
                  className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {done ? 'Regenerate' : 'Generate'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Live preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {liveHtml ? (
            <iframe
              ref={iframeRef}
              className="flex-1 w-full border-0"
              title="Lesson Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500">Your lesson will appear here</p>
                <p className="text-xs text-gray-400 mt-1">Live preview updates as Claude generates</p>
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
