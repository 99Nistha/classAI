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

  const system = `You help a teacher pick a visual for "${topicTitle}" (${subject}, Grade ${grade}).

STAGE 1 — no visual style yet: show the format options. Return showOptions: true.
STAGE 2 — style chosen, no quiz preference: ask "Include a quiz?" (that's the entire message).
STAGE 3 — quiz answered: set readyToGenerate: true. Message: "Starting now."

Casual messages: reply in one short sentence.
Keep every message under 8 words. No exclamation marks. No emoji.

Return valid JSON only:
{"message":"","showOptions":false,"readyToGenerate":false,"visualStyle":null,"includeQuiz":null,"focusNote":null}`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system,
    messages,
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'

  // Strip markdown code fences Claude sometimes adds
  const cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned)
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
