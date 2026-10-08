import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const VISUAL_OPTIONS = [
  { id: 'anatomy',     label: 'Labeled Diagram',   icon: '🔬', description: 'Realistic illustration with labeled parts' },
  { id: 'flow',        label: 'Process Flow',       icon: '🔄', description: 'How a process works, step by step' },
  { id: 'mindmap',     label: 'Mind Map',           icon: '🗺️', description: 'Key ideas branching from the main topic' },
  { id: 'steps',       label: 'Step-by-Step',       icon: '📋', description: 'Numbered visual walkthrough' },
  { id: 'timeline',    label: 'Timeline',           icon: '📅', description: 'Events or stages in order' },
  { id: 'comparison',  label: 'Comparison',         icon: '⚖️', description: 'Side-by-side visual comparison' },
  { id: 'graph',       label: 'Graph / Chart',      icon: '📊', description: 'Data or relationships plotted visually' },
  { id: 'infographic', label: 'Infographic',        icon: '🖼️', description: 'Rich visual with icons, facts, and stats' },
]

export async function POST(req: NextRequest) {
  const { messages, topicTitle, subject, grade, chapterTitle } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    topicTitle: string
    subject: string
    grade: number
    chapterTitle: string
  }

  const system = `You are ClassAI, a friendly assistant helping a teacher create a visual lesson.

Topic: "${topicTitle}" (${subject}, Grade ${grade}, Chapter: ${chapterTitle})

Guide the teacher through a short, friendly conversation to understand what they want:

STAGE 1 — first message or if no visual style chosen yet:
Greet warmly and ask what kind of visual they'd like. Return showOptions: true so they can pick from a list.

STAGE 2 — after a visual style has been chosen:
Ask ONE question: "Should I include a short quiz for students at the end? Just say yes or no 😊"

STAGE 3 — after quiz preference:
Ask: "Anything specific you want to focus on or highlight? Or just say 'all good' and I'll get started!"

STAGE 4 — after focus note (or they said all good / no):
Respond with something like "Perfect, creating it now! ✨" and set readyToGenerate: true.

If the teacher is being casual (greeting, thanks, off-topic): respond naturally in 1–2 sentences.

Keep ALL messages short and friendly — 1 or 2 sentences max.
No jargon, no technical terms. These are teachers, not developers.

IMPORTANT: Respond with valid JSON only:
{
  "message": "your friendly message",
  "showOptions": true or false,
  "readyToGenerate": true or false,
  "visualStyle": "anatomy|flow|mindmap|steps|timeline|comparison|graph|infographic or null",
  "includeQuiz": true or false or null,
  "focusNote": "text or null"
}

Extract visualStyle from what the teacher selected or described.
Extract includeQuiz from their yes/no answer.
Extract focusNote from their focus answer (null if they said all good/no).
Once readyToGenerate is true, all three values must be set.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system,
    messages,
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'

  try {
    const parsed = JSON.parse(raw)
    return NextResponse.json({
      message: parsed.message ?? 'How can I help?',
      showOptions: parsed.showOptions ?? false,
      options: parsed.showOptions ? VISUAL_OPTIONS : undefined,
      readyToGenerate: parsed.readyToGenerate ?? false,
      visualStyle: parsed.visualStyle ?? null,
      includeQuiz: parsed.includeQuiz ?? null,
      focusNote: parsed.focusNote ?? null,
    })
  } catch {
    return NextResponse.json({ message: raw, showOptions: false, readyToGenerate: false })
  }
}
