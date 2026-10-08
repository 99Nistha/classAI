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
 * Strips markdown code fences (```html ... ```) if the model accidentally wraps output.
 */
export function stripCodeFences(html: string): string {
  return html
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
}
