interface LessonContext {
  grade: number
  subject: string
  chapterTitle: string
  topicTitle: string
  teacherNotes?: string | null
  teacherInstruction?: string
}

export function buildSystemPrompt(ctx: LessonContext): string {
  return `You are an educational content expert helping teachers explain "${ctx.topicTitle}" to Grade ${ctx.grade} ${ctx.subject} students.

Your job is to produce data for a clean, interactive flow diagram — the kind you'd see in a well-designed educational app or textbook.

Think naturally about how this topic is best shown visually. What are the key parts, stages, or concepts? How do they connect? Use colours and icons that feel right for the topic — not generic.

Output only valid JSON. No markdown, no explanation, no code fences.`
}

export function buildOutlinePrompt(ctx: LessonContext): string {
  const notes = ctx.teacherNotes ? `\nTeacher notes: ${ctx.teacherNotes}` : ''
  const instruction = ctx.teacherInstruction
    ? `\nTeacher instruction: ${ctx.teacherInstruction}`
    : ''

  return `Create a lesson plan for:
Topic: ${ctx.topicTitle}
Chapter: ${ctx.chapterTitle}
Subject: ${ctx.subject}, Grade ${ctx.grade}${notes}${instruction}

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "title": "lesson page title",
  "tagline": "one-sentence hook for students",
  "visual_type": "threejs | svg_diagram | chemistry | physics_math | timeline | vocab | concept_map",
  "accent_color": "#hexcolor (vivid, subject-appropriate)",
  "stages": [
    { "id": 1, "title": "stage title", "description": "what this stage covers (1-2 sentences)", "visual_hint": "specific 3D scene or SVG to create" }
  ],
  "quiz": {
    "description": "what the quiz tests"
  }
}`
}

export function buildStagePrompt(
  ctx: LessonContext,
  outline: OutlineJSON,
  stage: StageOutline,
  previousHtml: string
): string {
  const is3D = outline.visual_type === 'threejs'

  return `You are generating stage ${stage.id} of ${outline.stages.length} for a lesson page.

Lesson: "${outline.title}" — ${outline.tagline}
Visual type: ${outline.visual_type}
Accent color: ${outline.accent_color}
Stage: "${stage.title}" — ${stage.description}
Visual hint: ${stage.visual_hint}

${previousHtml ? `Previously generated HTML (DO NOT repeat, just continue):\n---\n${previousHtml.slice(-400)}\n---\n` : ''}

Output ONLY the HTML for this stage section. Rules:
- Wrap in <section class="stage" id="stage-${stage.id}">
- Smooth entrance animation via CSS @keyframes
- Use CSS variables (--bg, --text, --accent, --card) already in the page
${is3D ? `- Use Three.js (already loaded in <head>) to create a 3D interactive scene
- Put the <canvas> in a div with style="position:relative;height:420px;border-radius:16px;overflow:hidden"
- Add HTML label overlays using position:absolute inside that div
- Include OrbitControls for drag-to-rotate
- Add a play/pause button for any animation loop
- Use good lighting: AmbientLight(0xffffff, 0.6) + DirectionalLight(0xffffff, 0.8)` : `- Use inline SVG or CSS animations (no external images)
- Be visually rich but load instantly`}`
}

export function buildQuizPrompt(ctx: LessonContext, outline: OutlineJSON): string {
  return `Generate the quiz section for the lesson "${outline.title}" about "${ctx.topicTitle}" (grade ${ctx.grade} ${ctx.subject}).

Output ONLY the HTML for the quiz section. Rules:
- Wrap in <section class="stage quiz-section" id="quiz">
- 4 multiple-choice questions, 4 options each (A–D)
- On click: show ✓ green for correct, ✗ red for wrong + a one-line explanation
- Show final score when all answered
- Use only inline styles / CSS variables
- All questions must be factually accurate for grade ${ctx.grade}`
}

export function buildPageShellPrompt(
  ctx: LessonContext,
  outline: OutlineJSON
): string {
  const needs3D = outline.visual_type === 'threejs'

  return `Generate the opening HTML shell for a lesson page. Stage content will be injected inside later.

Lesson title: ${outline.title}
Tagline: ${outline.tagline}
Subject: ${ctx.subject}, Grade ${ctx.grade}
Accent color: ${outline.accent_color}
Visual type: ${outline.visual_type}

Output ONLY the HTML from <!DOCTYPE html> through the opening <main> tag (inclusive). Include:
- Full <head> with meta tags, Google Fonts (Inter) import
${needs3D ? `- Three.js CDN: <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
- OrbitControls CDN: <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>` : ''}
- All CSS in a <style> block with CSS variables: --bg, --text, --accent (=${outline.accent_color}), --card, --muted
- Dark mode via @media (prefers-color-scheme: dark)
- Sticky <header> with lesson title and subject badge
- Fade-in animation for .stage elements (opacity 0→1, translateY 20px→0)
- Responsive layout (max-width 880px, centered, padding 1.5rem)
- Opening <main class="lesson-content"> tag — DO NOT close it`
}

export function buildPageClosePrompt(): string {
  return `Output ONLY the closing HTML: </main>, then a <footer style="text-align:center;padding:2rem;color:var(--muted);font-size:0.8rem">Made with ClassAI</footer>, then </body></html>. Nothing else.`
}

export interface OutlineJSON {
  title: string
  tagline: string
  visual_type: string
  accent_color: string
  stages: StageOutline[]
  quiz: { description: string }
}

export interface StageOutline {
  id: number
  title: string
  description: string
  visual_hint: string
}
