interface LessonContext {
  grade: number
  subject: string
  chapterTitle: string
  topicTitle: string
  teacherNotes?: string | null
  teacherInstruction?: string
}

export function buildSystemPrompt(ctx: LessonContext): string {
  return `You are ClassAI, an expert educational content creator for grade ${ctx.grade} ${ctx.subject}.

Your job: generate a beautiful, interactive, self-contained HTML lesson page that a teacher can share with students.

ACCURACY RULES (non-negotiable):
- Every fact, formula, diagram, and label must be 100% accurate for grade ${ctx.grade}
- Use age-appropriate language (grade ${ctx.grade} level)
- Do NOT simplify to the point of introducing inaccuracies

VISUAL SELECTION GUIDE — pick the BEST fit:
- Biology (cells, photosynthesis, anatomy): 3D Three.js scene with labeled interactive parts, orbit controls
- Chemistry (reactions, molecules): animated SVG reaction diagram with step-by-step equations
- Physics / Math: animated SVG graphs, formula derivation cards
- History / Geography: illustrated timelines, interactive maps
- Languages: vocabulary flip cards, sentence builders
- General: concept maps, illustrated explainers

3D RULES (use when visual_type is "threejs"):
- Load Three.js from CDN: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
- Use OrbitControls from: https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js
- Render in a <canvas> inside a fixed-height container (min 400px)
- Add labeled HTML overlays (CSS position:absolute) for key parts
- Add play/pause animation button
- Make it beautiful: proper lighting (AmbientLight + DirectionalLight), shadows, smooth colors
- Show a "drag to rotate / scroll to zoom" hint

HTML OUTPUT RULES:
- Single self-contained .html page (all CSS + JS inline; CDN only for Three.js and Google Fonts)
- Dark-friendly: use CSS variables (--bg, --text, --accent, --card)
- Responsive: works on mobile (min 320px) and desktop
- Include a mini-quiz at the end (3–5 multiple-choice questions with instant feedback)
- Smooth CSS transitions and micro-interactions
- Footer: "Made with ClassAI"

STAGE STRUCTURE:
Break the lesson into 3–5 stages:
- Stage 1: Hook / real-world connection
- Stage 2–N-1: Core concept stages with visuals (3D or SVG)
- Stage N: Summary + mini-quiz

IMPORTANT: The lesson is for topic "${ctx.topicTitle}" in chapter "${ctx.chapterTitle}".`
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
