// Another screen (the Familiar while offline) can open the rules page with a question already asked.
const EVENT = 'ff:rules-question'
let pending = ''

/** Opens the rules page and asks `question` there (at once when the page is already open). */
export function searchRulesFor(question: string): void {
  pending = question.trim()
  location.hash = '#/rules'
  window.dispatchEvent(new Event(EVENT))
}

/** The question waiting for the rules page, if any. */
export const pendingRulesQuestion = () => pending
export const clearRulesQuestion = () => { pending = '' }

export function onRulesQuestion(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}
