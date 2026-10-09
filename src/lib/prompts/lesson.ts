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

export function buildSystemPrompt(_ctx: LessonContext): string {
  return `You are creating an interactive educational web page. Output ONLY complete HTML from <!DOCTYPE html> to </html>. No explanation, no markdown fences, no code blocks.`
}

export const STYLE_GUIDES: Record<string, string> = {
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
  const focus = ctx.focusNote ? `\nTeacher also says: "${ctx.focusNote}"` : ''
  const instr = ctx.teacherInstruction ? `\n\nTeacher's request: "${ctx.teacherInstruction}"` : ''
  const quizLine = ctx.includeQuiz === false ? '' : '\n- A short 3-question quiz with instant feedback at the end'

  return `Create a beautiful, impressive interactive educational page for a teacher to share with students.

Topic: "${ctx.topicTitle}" — ${ctx.subject}, Grade ${ctx.grade}
Chapter: ${ctx.chapterTitle}${instr}${focus}

Make it genuinely great — the kind of thing you'd see on a top educational website. Be creative with the approach:
- Use Three.js for 3D scenes if the topic suits it (anatomy, molecules, space, geometry…)
- Use SVG for diagrams and illustrations
- Use Canvas for animations
- Use GSAP or CSS animations for smooth motion
- Allow zoom (scroll wheel), pan (mouse drag), and 360° orbit where it makes sense

The page should have:
- A rich interactive main visual (full-width, at least 500px tall)
- Labels that show on hover or click
- A brief step-by-step explanation below the visual
- 3 interesting facts${quizLine}
- Footer: "Made with ClassAI"

Rules:
- Output ONLY complete HTML <!DOCTYPE html> … </html>
- CDN scripts are allowed (Three.js, GSAP, D3, etc.)
- All other CSS and JS inline
- Dark theme: background #060a14, accent #7c3aed
- Works on mobile
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
