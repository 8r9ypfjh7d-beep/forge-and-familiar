// Parses the markdown Gemini writes: headings, bullet and numbered lists (also without a blank line before them),
// tables and paragraphs. Pure; ChatMarkdown renders the blocks.

export type MdBlock =
  | { type: 'h'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'p'; text: string }

const BULLET = /^\s*[-*•]\s+/
const NUMBER = /^\s*\d+[.)]\s+/
const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())

/** Splits text into blocks line by line, so a list right under a sentence still becomes a list. */
export function parseMarkdown(text: string): MdBlock[] {
  const out: MdBlock[] = []
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let para: string[] = []
  const flush = () => { if (para.length) out.push({ type: 'p', text: para.join(' ') }); para = [] }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) { flush(); continue }
    const h = /^#{1,6}\s+(.*)$/.exec(line)
    if (h) { flush(); out.push({ type: 'h', text: h[1].replace(/\s*#+$/, '') }); continue }
    if (line.startsWith('|')) {
      flush()
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const r = lines[i].trim()
        if (!/^\|[\s|:-]+\|?$/.test(r)) rows.push(cells(r))
        i++
      }
      i--
      const [head = [], ...body] = rows
      out.push({ type: 'table', head, rows: body })
      continue
    }
    const kind = BULLET.test(line) ? 'ul' : NUMBER.test(line) ? 'ol' : null
    if (kind) {
      flush()
      const prev = out[out.length - 1]
      const item = line.replace(kind === 'ul' ? BULLET : NUMBER, '')
      if (prev && prev.type === kind) prev.items.push(item)
      else out.push({ type: kind, items: [item] })
      continue
    }
    // A line under a list item that is not a new item continues it.
    const prev = out[out.length - 1]
    if (!para.length && prev && (prev.type === 'ul' || prev.type === 'ol') && lines[i - 1]?.trim()) {
      prev.items[prev.items.length - 1] += ` ${line}`
      continue
    }
    para.push(line)
  }
  flush()
  return out
}
