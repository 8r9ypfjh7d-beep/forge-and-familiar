// Keyboard helpers: arrow keys inside radio groups, and single-key shortcuts that stay out of the way of typing.

/** Index of the radio to move to, or null when the key does not move. Wraps at both ends. */
export function nextRadioIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null
  switch (key) {
    case 'ArrowRight': case 'ArrowDown': return (index + 1) % count
    case 'ArrowLeft': case 'ArrowUp': return (index - 1 + count) % count
    case 'Home': return 0
    case 'End': return count - 1
    default: return null
  }
}

/** True when a key press belongs to a text field, select, or editable region. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || typeof (el as HTMLElement).tagName !== 'string') return false
  const node = el as HTMLElement
  const tag = node.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable
}

/** A shortcut fires only for a bare key: no Ctrl, Alt or Meta, so browser and screen reader keys keep working. */
export function shortcutKey(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'target'>): string | null {
  if (e.ctrlKey || e.altKey || e.metaKey || isTypingTarget(e.target)) return null
  return e.key.length === 1 ? e.key.toLowerCase() : null
}

/**
 * Lets arrow keys, Home and End move between [role=radio] buttons in any [role=radiogroup],
 * selecting the one they land on, as the ARIA radio pattern expects. Installed once for the whole page.
 */
export function installRadioGroupKeys(doc: Document = document) {
  const onKey = (e: KeyboardEvent) => {
    const radio = (e.target as HTMLElement | null)?.closest?.('[role="radio"]')
    const group = radio?.closest('[role="radiogroup"]')
    if (!radio || !group) return
    const radios = [...group.querySelectorAll<HTMLElement>('[role="radio"]')].filter(r => !(r as HTMLButtonElement).disabled)
    // In right-to-left layouts the next item sits to the left, so the horizontal arrows swap.
    const rtl = getComputedStyle(group).direction === 'rtl'
    const key = rtl && e.key === 'ArrowLeft' ? 'ArrowRight' : rtl && e.key === 'ArrowRight' ? 'ArrowLeft' : e.key
    const to = nextRadioIndex(key, radios.indexOf(radio as HTMLElement), radios.length)
    if (to === null) return
    e.preventDefault()
    radios[to].focus()
    radios[to].click()
  }
  doc.addEventListener('keydown', onKey)
  return () => doc.removeEventListener('keydown', onKey)
}
