'use client'

import { useEffect, useRef, useState, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ShareModal from '@/components/lesson/ShareModal'
import type { Topic, Chapter, Class } from '@/types'

interface Props {
  params: Promise<{ id: string; topicId: string }>
}

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  options?: { id: string; label: string; icon: string; description: string }[]
  isStatus?: boolean   // dim progress messages
}

// ── localStorage helpers ──────────────────────────────────────────────────────
interface PersistedChat {
  messages: ChatMsg[]
  visualStyle: string | null
  includeQuiz: boolean | null
  originalInstruction: string | null
}

function chatKey(topicId: string) { return `classai_chat_${topicId}` }

function loadPersistedChat(topicId: string): PersistedChat | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(chatKey(topicId))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function persistChat(topicId: string, data: PersistedChat) {
  try { localStorage.setItem(chatKey(topicId), JSON.stringify(data)) } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CreateVisualPage({ params }: Props) {
  const { id: classId, topicId } = use(params)

  const [topic, setTopic] = useState<Topic | null>(null)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [cls, setCls] = useState<Class | null>(null)
  const [loading, setLoading] = useState(true)

  // Chat state — restored from localStorage immediately via lazy initializer
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>(() => loadPersistedChat(topicId)?.messages ?? [])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  // Generation params — also restored from localStorage
  const [visualStyle, setVisualStyle] = useState<string | null>(() => loadPersistedChat(topicId)?.visualStyle ?? null)
  const [includeQuiz, setIncludeQuiz] = useState<boolean | null>(() => loadPersistedChat(topicId)?.includeQuiz ?? null)
  const [focusNote, setFocusNote] = useState<string | null>(null)
  // The teacher's first real content request (preserved across the whole conversation)
  const [originalInstruction, setOriginalInstruction] = useState<string | null>(() => loadPersistedChat(topicId)?.originalInstruction ?? null)

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [liveHtml, setLiveHtml] = useState('')
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isShared, setIsShared] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [statusText, setStatusText] = useState('')

  const chatEndRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const greetingShown = useRef(false)

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: topicData } = await supabase.from('topics').select('*').eq('id', topicId).single()
      if (!topicData) { setLoading(false); return }
      setTopic(topicData)

      const [{ data: chData }, { data: clsData }] = await Promise.all([
        supabase.from('chapters').select('*').eq('id', topicData.chapter_id).single(),
        supabase.from('classes').select('*').eq('id', classId).single(),
      ])
      if (chData) setChapter(chData)
      if (clsData) setCls(clsData)

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
          setDone(true)
        }
      }
      setLoading(false)
    }
    load()
  }, [topicId, classId])

  // Show greeting only if no saved messages (topic must load first for title)
  useEffect(() => {
    if (!topic || !cls || greetingShown.current || chatMessages.length > 0) return
    greetingShown.current = true
    setChatMessages([{
      role: 'assistant',
      content: `What kind of visual for "${topic.title}"?`,
      options: [
        { id: 'anatomy',     label: 'Labeled Diagram',   icon: '🔬', description: 'Realistic illustration with labeled parts' },
        { id: 'flow',        label: 'Process Flow',       icon: '🔄', description: 'How a process works, step by step' },
        { id: 'mindmap',     label: 'Mind Map',           icon: '🗺️', description: 'Key ideas branching from the main topic' },
        { id: 'steps',       label: 'Step-by-Step',       icon: '📋', description: 'Numbered visual walkthrough' },
        { id: 'timeline',    label: 'Timeline',           icon: '📅', description: 'Events or stages in order' },
        { id: 'comparison',  label: 'Comparison',         icon: '⚖️', description: 'Side-by-side visual comparison' },
        { id: 'graph',       label: 'Graph / Chart',      icon: '📊', description: 'Data or relationships plotted visually' },
        { id: 'infographic', label: 'Infographic',        icon: '🖼️', description: 'Rich visual with icons, facts, and stats' },
      ],
    }])
  }, [topic, cls])

  // Persist chat whenever messages change (skip status/progress messages)
  useEffect(() => {
    const toSave = chatMessages.filter(m => !m.isStatus)
    if (toSave.length === 0) return
    persistChat(topicId, { messages: toSave, visualStyle, includeQuiz, originalInstruction })
  }, [chatMessages, visualStyle, includeQuiz, originalInstruction, topicId])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  // srcDoc is set directly on the iframe element — no effect needed

  // ── Chat send ───────────────────────────────────────────────────────────────
  async function sendChat(userText: string) {
    if (!userText.trim() || chatLoading || generating) return
    const userMsg: ChatMsg = { role: 'user', content: userText }
    const updated = [...chatMessages, userMsg]
    setChatMessages(updated)
    setChatInput('')
    setChatLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated.map(m => ({ role: m.role, content: m.content })),
          topicTitle: topic?.title ?? '',
          subject: cls?.subject ?? '',
          grade: cls?.grade ?? 9,
          chapterTitle: chapter?.title ?? '',
        }),
      })
      const data = await res.json()

      const assistantMsg: ChatMsg = {
        role: 'assistant',
        content: data.message,
        options: data.showOptions ? data.options : undefined,
      }
      setChatMessages(prev => [...prev, assistantMsg])

      // Update collected params
      if (data.visualStyle) setVisualStyle(data.visualStyle)
      if (data.includeQuiz !== null) setIncludeQuiz(data.includeQuiz)
      if (data.focusNote !== null) setFocusNote(data.focusNote)

      // Store the teacher's original instruction (first substantive user message)
      if (!originalInstruction && userText.length > 4) {
        setOriginalInstruction(userText)
      }

      // Trigger generation when chat says ready — pass full chat context
      if (data.readyToGenerate) {
        await generate(
          data.visualStyle ?? visualStyle,
          data.includeQuiz ?? includeQuiz ?? true,
          data.focusNote ?? focusNote ?? null,
          buildInstructionFromChat(userText),
        )
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong, please try again.' }])
    } finally {
      setChatLoading(false)
    }
  }

  // ── Build a rich instruction from the full chat history ──────────────────────
  function buildInstructionFromChat(latestUserText?: string): string {
    const msgs = [...chatMessages]
    if (latestUserText) msgs.push({ role: 'user', content: latestUserText })

    const userMsgs = msgs
      .filter(m => m.role === 'user')
      // Skip bare format-selection messages ("I'd like a Flow Chart")
      .filter(m => !/^I'?d like a /i.test(m.content))
      .map(m => m.content.trim())
      .filter(Boolean)

    const parts: string[] = []
    if (userMsgs.length > 0) parts.push(userMsgs.join('. '))
    if (focusNote) parts.push(`Focus on: ${focusNote}`)

    return parts.join('. ') || topic?.title || ''
  }

  // ── Option selection ────────────────────────────────────────────────────────
  function selectOption(option: { id: string; label: string }) {
    setVisualStyle(option.id)
    sendChat(`I'd like a ${option.label}`)
  }

  // ── Generate ────────────────────────────────────────────────────────────────
  async function generate(
    style: string | null,
    quiz: boolean,
    focus: string | null,
    instruction: string,
  ) {
    if (generating) return
    setGenerating(true)
    setDone(false)
    setStatusText('Creating your visual…')

    try {
      const res = await fetch('/api/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId,
          teacherInstruction: instruction || undefined,
          visualStyle: style ?? 'flow',
          includeQuiz: quiz,
          focusNote: focus ?? undefined,
        }),
      })

      if (!res.ok || !res.body) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: 'Failed to start generation. Please try again.' }])
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let htmlAcc = ''

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

          if (eventType === 'status') {
            setStatusText(payload.message)
            setChatMessages(prev => [...prev, { role: 'assistant', content: payload.message, isStatus: true }])
          }
          if (eventType === 'html_chunk') { htmlAcc += payload.chunk; setLiveHtml(htmlAcc) }
          if (eventType === 'done') {
            setLessonId(payload.lessonId)
            setShareToken(payload.shareToken)
            setDone(true)
            setStatusText('')
            setChatMessages(prev => [...prev, {
              role: 'assistant',
              content: `✅ Your visual is ready! You can view it on the right, or share it with your students.`,
            }])
          }
          if (eventType === 'error') {
            setStatusText('')
            setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${payload.message}` }])
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setChatMessages(prev => [...prev, { role: 'assistant', content: msg }])
      setStatusText('')
    } finally {
      setGenerating(false)
    }
  }

  // ── Keyboard ────────────────────────────────────────────────────────────────
  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendChat(chatInput)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

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
                <Link href={`/share/${shareToken}`} target="_blank"
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open
                </Link>
                <button onClick={() => setShowShareModal(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-500 transition-colors">
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

          {/* Left: Chat panel */}
          <div className="w-80 flex-shrink-0 flex flex-col bg-slate-900 border-r border-slate-800">

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
              {(() => {
                // Only show format options on the most recent message that has them
                const lastOptionsIdx = chatMessages.findLastIndex(m => !!m.options)
                return chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[88%] ${msg.role === 'user' ? '' : ''}`}>
                      {/* Bubble */}
                      {msg.isStatus ? (
                        <div className="flex items-center gap-2 text-xs text-slate-500 px-1 py-1">
                          <div className="w-2 h-2 rounded-full bg-violet-600/60 animate-pulse flex-shrink-0" />
                          {msg.content}
                        </div>
                      ) : (
                        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-violet-600 text-white rounded-br-sm'
                            : 'bg-slate-800 text-slate-200 rounded-bl-sm'
                        }`}>
                          {msg.content}
                        </div>
                      )}

                      {/* Visual style options — only on the most recent options message */}
                      {msg.options && i === lastOptionsIdx && (
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          {msg.options.map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => selectOption(opt)}
                              disabled={generating || chatLoading}
                              className={`flex flex-col items-start gap-0.5 rounded-xl border px-2.5 py-2 text-left transition-all hover:border-violet-500 hover:bg-violet-950/40 disabled:opacity-50 ${
                                visualStyle === opt.id
                                  ? 'border-violet-500 bg-violet-950/40'
                                  : 'border-slate-700 bg-slate-800/60'
                              }`}
                            >
                              <span className="text-base">{opt.icon}</span>
                              <span className="text-xs font-semibold text-slate-200">{opt.label}</span>
                              <span className="text-xs text-slate-500 leading-tight">{opt.description}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              })()}

              {/* Typing indicator */}
              {(chatLoading || generating) && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                    {[0, 1, 2].map(n => (
                      <div key={n} className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: `${n * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Status during generation */}
              {statusText && (
                <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
                  <div className="w-3 h-3 border border-violet-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  {statusText}
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-800 p-3 space-y-2">
              {/* Always-visible Start button */}
              <button
                onClick={() => generate(
                  visualStyle ?? 'flow',
                  includeQuiz ?? true,
                  focusNote,
                  buildInstructionFromChat(chatInput.trim() || undefined),
                )}
                disabled={generating || chatLoading}
                className="w-full rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {done ? 'Regenerate' : 'Start'}
                  </>
                )}
              </button>

              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Or chat to customise…"
                  rows={1}
                  disabled={generating || chatLoading}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500 resize-none disabled:opacity-50 transition-colors"
                  style={{ minHeight: 40, maxHeight: 100 }}
                />
                <button
                  onClick={() => sendChat(chatInput)}
                  disabled={!chatInput.trim() || generating || chatLoading}
                  className="flex-shrink-0 w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center hover:bg-slate-600 disabled:opacity-40 transition-colors"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Visual preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {liveHtml ? (
              <iframe
                ref={iframeRef}
                className="flex-1 w-full border-0"
                title="Lesson Preview"
                sandbox="allow-scripts allow-same-origin allow-popups"
                srcDoc={liveHtml}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-slate-950">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-500">Your visual will appear here</p>
                  <p className="text-xs text-slate-600 mt-1">Chat with ClassAI on the left to get started</p>
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
          onStatusChange={s => setIsShared(s)}
        />
      )}
    </>
  )
}
