interface LessonContext {
  grade: number
  subject: string
  chapterTitle: string
  topicTitle: string
  teacherNotes?: string | null
  teacherInstruction?: string
  visualStyle?: string
  includeQuiz?: boolean
  focusNote?: string
}

export function buildSystemPrompt(ctx: LessonContext): string {
  return `You are ClassAI, creating beautiful educational visuals for Grade ${ctx.grade} ${ctx.subject} students.
Your visuals are realistic and meaningful — like a well-designed textbook or educational website.
Output only complete self-contained HTML. No explanation, no markdown fences.`
}

const STYLE_GUIDES: Record<string, string> = {
  anatomy: `VISUAL: Realistic SVG anatomical illustration.
Draw the ACTUAL structure — not circles. Use SVG paths/polygons to depict real anatomy:
- e.g. for the eye: draw the white sclera oval, curved cornea at front, coloured iris ring, black pupil, lens shape, clear vitreous humour, curved retina at back, optic nerve disc
- Colour each part naturally (retina = pink, iris = blue/hazel, optic nerve = pale yellow, etc.)
- Thin labelling lines from each part to a side label
- Clicking a part highlights it and shows a popup with its name + one-sentence function`,

  flow: `VISUAL: Illustrated process-flow diagram.
Draw MEANINGFUL SHAPES for each stage — NOT abstract circles:
- Sun: a radiating sun SVG shape ☀
- Leaf/plant part: an actual leaf silhouette
- Molecule: interconnected circles like a chemistry bond diagram
- Cell: an irregular blob with internal shapes
- Energy: lightning bolt or wave shape
Connect stages with thick animated arrows. Hovering a stage shows its explanation.
The overall layout should look like a science textbook flow chart, not a generic node graph.`,

  mindmap: `VISUAL: Visual mind map.
Central concept in an oval in the middle. 5–8 curved branches radiating outward, each ending in a labelled node.
Use different colours per branch. Add a small icon/emoji in each branch node.
Clicking a node expands it to show more detail text.`,

  steps: `VISUAL: Step-by-step illustrated cards.
Show 4–6 large numbered cards in a vertical sequence.
Each card has: a number badge, an SVG illustration relevant to that step, a bold step title, and 2 sentences of explanation.
Include a visual progress bar at the top.`,

  timeline: `VISUAL: Visual timeline.
Horizontal scrollable timeline with illustrated events/eras.
Each event has: a date/period, a small SVG icon, a title, and a short description.
The current event highlights on hover. Navigation arrows to move between events.`,

  comparison: `VISUAL: Side-by-side comparison diagram.
Two or three columns with clear headers. Each row has an SVG illustration + label on each side.
Colour-highlight differences. Clicking a row expands to show full comparison details.`,

  graph: `VISUAL: Interactive graph or chart.
Use Canvas 2D to draw the relevant graph (axes, gridlines, curve/bars/scatter).
Animate the drawing of the curve. Mouse hover shows a crosshair with x/y values.
Include a brief explanation of what the shape of the graph means.`,

  infographic: `VISUAL: Rich infographic layout.
Large SVG illustrations + bold stats + short fact blurbs arranged in a magazine-style layout.
Use icons, arrows, and colour blocks to organise information visually.
The most important concept should be the largest element.`,
}

export function buildVisualPrompt(ctx: LessonContext): string {
  const style = ctx.visualStyle && STYLE_GUIDES[ctx.visualStyle]
    ? STYLE_GUIDES[ctx.visualStyle]
    : STYLE_GUIDES.flow

  const quizSection = ctx.includeQuiz !== false
    ? `\n5. Mini-quiz: 3 multiple-choice questions with instant answer feedback`
    : ''

  const extras = [
    ctx.teacherInstruction ? `Teacher's request: "${ctx.teacherInstruction}"` : '',
    ctx.focusNote ? `Focus on: "${ctx.focusNote}"` : '',
  ].filter(Boolean).join('\n')

  return `Create a complete interactive HTML lesson page.

Topic: "${ctx.topicTitle}" — ${ctx.subject}, Grade ${ctx.grade}
Chapter: ${ctx.chapterTitle}
${extras}

${style}

⚠️  DO NOT use generic circles as placeholder nodes. Draw the actual visual representation of the topic.

PAGE SECTIONS:
1. Main visual (full-width, min 520px tall)
2. 4-step explanation section with emoji icons
3. 3 click-to-reveal fun facts${quizSection}
4. Footer: "Made with ClassAI"

TECHNICAL RULES:
- Output ONLY complete HTML from <!DOCTYPE html> to </html>
- Everything inline — CSS and JS inside the file. Only external allowed: Google Fonts <link>
- Dark theme: background #060a14, cards #0f172a, text #e2e8f0, accent #7c3aed (violet)
- Font: Inter from Google Fonts
- Fully responsive (works at 320px width)
- 100% accurate for Grade ${ctx.grade} ${ctx.subject}`
}

// ── Unused legacy helpers kept for reference ──────────────────────────────────

export function buildOutlinePrompt(ctx: LessonContext): string { return '' }
export function buildStagePrompt(): string { return '' }
export function buildQuizPrompt(): string { return '' }
export function buildPageShellPrompt(): string { return '' }
export function buildPageClosePrompt(): string { return '' }

export interface OutlineJSON {
  title: string; tagline: string; visual_type: string; accent_color: string
  stages: StageOutline[]; quiz: { description: string }
}
export interface StageOutline {
  id: number; title: string; description: string; visual_hint: string
}
