/**
 * Assembles the final lesson HTML from the shell, stage sections, and quiz.
 */
export function assembleFinalLesson(
  shell: string,
  stageSections: string[],
  quiz: string,
  close: string
): string {
  return shell + '\n' + stageSections.join('\n') + '\n' + quiz + '\n' + close
}

/**
 * Extracts a complete HTML document from a model response.
 * Handles: bare HTML, code-fenced HTML, and HTML buried after prose.
 */
export function stripCodeFences(text: string): string {
  // Try extracting the HTML document directly (most robust)
  const start = text.search(/<!doctype\s+html|<html[\s>]/i)
  const end = text.lastIndexOf('</html>')
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 7).trim()
  }

  // Fallback: strip code fences if present
  return text
    .replace(/^```[\w]*\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
}

/**
 * Extracts JSON from a model response that may contain extra prose.
 * Tries multiple strategies: strip fences, find first {...}, extract array.
 */
export function extractJSON(raw: string): string {
  // 1. Try stripping code fences first
  const stripped = stripCodeFences(raw)
  if (stripped.startsWith('{') || stripped.startsWith('[')) return stripped

  // 2. Find the first { ... } block
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1)
  }

  return stripped
}
