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
- Cite or reference standard curriculum where applicable

VISUAL SELECTION GUIDE (choose the best fit for the topic):
- Biology / Anatomy: labeled SVG diagrams with hover tooltips
- Chemistry: molecular structures, reaction equations with interactive balancing
- Physics / Math: animated SVG graphs, formula cards with step-by-step derivations
- History / Geography: illustrated timelines, interactive maps
- Languages: vocabulary cards with pronunciation cues, sentence builders
- General: concept maps, illustrated explainers with callouts

HTML OUTPUT RULES:
- Single self-contained .html page (all CSS + JS inline, no external dependencies except Google Fonts via CDN)
- Dark-friendly: use CSS variables for colors (--bg, --text, --accent)
- Responsive: works on mobile (min 320px) and desktop
- Accessible: proper heading hierarchy, alt text on all images/SVGs
- Include a mini-quiz at the end (3–5 questions, multiple choice, shows instant feedback)
- Smooth CSS transitions and micro-interactions (hover, click feedback)
- Footer with "Made with ClassAI" and today's date

STAGE STRUCTURE:
Break the lesson into 3–6 stages. Each stage is a section of the page:
- Stage 1: Hook / real-world connection (1 interesting fact or question)
- Stage 2–N-1: Core concept stages with visuals
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
  "visual_type": "svg_diagram | chemistry | physics_math | timeline | vocab | concept_map",
  "accent_color": "#hexcolor (pick something vivid and subject-appropriate)",
  "stages": [
    { "id": 1, "title": "stage title", "description": "what this stage covers (1-2 sentences)", "visual_hint": "what to draw/animate" }
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
  return `You are generating stage ${stage.id} of ${outline.stages.length} for a lesson page.

Lesson: "${outline.title}" — ${outline.tagline}
Visual type: ${outline.visual_type}
Accent color: ${outline.accent_color}
Stage: "${stage.title}" — ${stage.description}
Visual hint: ${stage.visual_hint}

${previousHtml ? `Previously generated HTML sections (DO NOT repeat, just continue):\n---\n${previousHtml.slice(-500)}\n---\n` : ''}

Output ONLY the HTML for this stage section. Rules:
- Use <section class="stage" id="stage-${stage.id}"> wrapper
- Include an SVG or animated element (no <canvas> unless absolutely needed)
- All styles must use CSS variables already defined in the page (--bg, --text, --accent, --card)
- Smooth entrance animation via @keyframes or CSS transition
- No external images; use inline SVG only
- Be visually rich but load instantly`
}

export function buildQuizPrompt(ctx: LessonContext, outline: OutlineJSON): string {
  return `Generate the quiz section for the lesson "${outline.title}" about "${ctx.topicTitle}" (grade ${ctx.grade} ${ctx.subject}).

Output ONLY the HTML for the quiz section. Rules:
- Use <section class="stage quiz-section" id="quiz"> wrapper
- 3–5 multiple-choice questions
- Each question has 4 options (A–D)
- On option click: show ✓ for correct, ✗ for wrong with a brief explanation
- Show score summary when all answered
- Use only inline styles/CSS variables, no external deps
- Questions must be factually accurate for grade ${ctx.grade}`
}

export function buildPageShellPrompt(
  ctx: LessonContext,
  outline: OutlineJSON
): string {
  return `Generate the opening HTML shell for a lesson page. This will have stage content injected inside later.

Lesson title: ${outline.title}
Tagline: ${outline.tagline}
Subject: ${ctx.subject}, Grade ${ctx.grade}
Accent color: ${outline.accent_color}

Output ONLY the HTML from <!DOCTYPE html> through the opening <main> tag (inclusive). Include:
- Full <head> with meta tags, Google Fonts import (Inter), and all CSS in a <style> block
- CSS variables: --bg, --text, --accent (= ${outline.accent_color}), --card, --muted
- Dark mode via @media (prefers-color-scheme: dark)
- Sticky <header> with lesson title and subject badge
- Opening <main class="lesson-content"> tag (DO NOT close it)
- A smooth fade-in animation for .stage elements
- Responsive layout (max-width 860px, centered, padding 1.5rem)`
}

export function buildPageClosePrompt(): string {
  return `Output ONLY the closing HTML: </main> tag, then a <footer> with "Made with ClassAI" and today's date, then </body></html>. Nothing else.`
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
