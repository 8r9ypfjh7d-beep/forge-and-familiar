// Entry text markup, pure. A small markdown: paragraphs, # headings, - lists, > quotes, --- rules,
// **bold**, *italic*, [[Entry title]] links, and ||hidden blocks|| the DM reveals one by one.

export type Inline =
  | { t: 'text'; s: string }
  | { t: 'b'; s: string }
  | { t: 'i'; s: string }
  | { t: 'link'; title: string }
  /** A hidden run inside a paragraph (a name, a place): `index` among the entry's hidden blocks, `open` when revealed. */
  | { t: 'hidden'; index: number; open: boolean; inl: Inline[]; words: number }

/** Inline hidden runs stand in the text as \u0001<index>\u0001 while the blocks are parsed; this maps them back. */
type HiddenRuns = Record<number, { text: string; open: boolean }>
const RUN = '\u0001'

export type Block =
  | { t: 'p'; inl: Inline[] }
  | { t: 'h'; level: number; inl: Inline[] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'quote'; inl: Inline[] }
  | { t: 'hr' }
  /** A hidden block: `index` is its position among the hidden blocks of the entry; `open` says it is revealed. */
  | { t: 'hidden'; index: number; open: boolean; blocks: Block[]; words: number }

/** Bold, italic and [[links]]. Unmatched marks stay as text. */
export function parseInline(text: string, runs: HiddenRuns = {}): Inline[] {
  const out: Inline[] = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[\[([^\]]+?)\]\]|\u0001(\d+)\u0001/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: 'text', s: text.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ t: 'b', s: m[1] })
    else if (m[2] !== undefined) out.push({ t: 'i', s: m[2] })
    else if (m[3] !== undefined) out.push({ t: 'link', title: m[3].trim() })
    else {
      const run = runs[Number(m[4])]
      if (run) out.push({ t: 'hidden', index: Number(m[4]), open: run.open, inl: parseInline(run.text, runs), words: words(run.text) })
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ t: 'text', s: text.slice(last) })
  return out
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

/** Block structure of text without hidden markers. */
export function parseBlocks(text: string, runs: HiddenRuns = {}): Block[] {
  const out: Block[] = []
  for (const raw of text.replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) continue
    if (lines.length === 1 && /^(-{3,}|\*{3,})$/.test(lines[0])) { out.push({ t: 'hr' }); continue }
    const h = lines.length === 1 && /^(#{1,3})\s+(.+)$/.exec(lines[0])
    if (h) { out.push({ t: 'h', level: h[1].length, inl: parseInline(h[2], runs) }); continue }
    if (lines.every(l => /^[-*•]\s/.test(l))) { out.push({ t: 'ul', items: lines.map(l => parseInline(l.replace(/^[-*•]\s+/, ''), runs)) }); continue }
    if (lines.every(l => l.startsWith('>'))) { out.push({ t: 'quote', inl: parseInline(lines.map(l => l.replace(/^>\s?/, '')).join('\n'), runs) }); continue }
    out.push({ t: 'p', inl: parseInline(lines.join('\n'), runs) })
  }
  return out
}

/** Text split at `||` markers: even pieces are plain, odd pieces are hidden blocks numbered from 0. */
export function hiddenSegments(text: string): { hidden: boolean; index: number; text: string }[] {
  const parts = text.split('||')
  const out: { hidden: boolean; index: number; text: string }[] = []
  let index = 0
  parts.forEach((p, i) => {
    const hidden = i % 2 === 1 && i < parts.length - 1
    // An unmatched trailing marker is just text.
    if (i % 2 === 1 && !hidden) { out.push({ hidden: false, index: -1, text: '||' + p }); return }
    if (!p.trim() && hidden) { index++; return }
    out.push({ hidden, index: hidden ? index++ : -1, text: p })
  })
  return out
}

export const hiddenCount = (text: string) => hiddenSegments(text).filter(s => s.hidden).length

/** Whole entry text as blocks. `revealed` lists hidden blocks that are open; 'all' opens everything (the DM's own view).
 * A hidden run inside a paragraph (no blank line around it) stays inline; one on its own lines becomes a hidden block. */
export function parseEntry(text: string, revealed: number[] | 'all'): Block[] {
  const out: Block[] = []
  const runs: HiddenRuns = {}
  let buffer = ''
  const flush = () => { if (buffer.trim()) out.push(...parseBlocks(buffer, runs)); buffer = '' }
  for (const seg of hiddenSegments(text)) {
    if (!seg.hidden) { buffer += seg.text; continue }
    const open = revealed === 'all' || revealed.includes(seg.index)
    const standsAlone = /\n\s*\n/.test(seg.text) || (/^\s*\n/.test(seg.text) && /\n\s*$/.test(seg.text))
    if (standsAlone) {
      flush()
      out.push({ t: 'hidden', index: seg.index, open, blocks: parseBlocks(seg.text), words: words(seg.text) })
    } else {
      runs[seg.index] = { text: seg.text, open }
      buffer += `${RUN}${seg.index}${RUN}`
    }
  }
  flush()
  return out
}

/** Plain text without markup: previews and search. */
export function stripMarkup(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/\[\[([^\]]+?)\]\]/g, '$1')
    .replace(/^\s*(#{1,3}|[-*•]|>)\s+/gm, '').replace(/^\s*(-{3,}|\*{3,})\s*$/gm, '')
}

/** The text a player can read: hidden blocks that are still closed are left out. For search and previews. */
export function readableText(text: string, revealed: number[] | 'all'): string {
  return stripMarkup(hiddenSegments(text)
    .map(s => (!s.hidden || revealed === 'all' || revealed.includes(s.index) ? s.text : '████'))
    .join('')).replace(/\s+/g, ' ').trim()
}
