// Renders the Familiar's markdown (blocks from markdown.ts) with bold / italic / `code` runs. No HTML is ever injected.
import type { ReactNode } from 'react'
import { parseMarkdown } from './markdown'

export function ChatMarkdown({ text }: { text: string }) {
  return (
    <>
      {parseMarkdown(text).map((b, i) => {
        switch (b.type) {
          case 'h': return <p key={i} className="fam-md-h">{inline(b.text)}</p>
          case 'ul': return <ul key={i}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>
          case 'ol': return <ol key={i}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>
          case 'table': return (
            <div key={i} className="fam-md-table">
              <table>
                <thead><tr>{b.head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
                <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{inline(c)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )
          default: return <p key={i}>{inline(b.text)}</p>
        }
      })}
    </>
  )
}

/** Bold, italic and code runs. Unmatched markers are shown as-is. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /`([^`]+)`|\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|\*(\S(?:.*?\S)?)\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = out.length
    if (m[1] !== undefined) out.push(<code key={key}>{m[1]}</code>)
    else if (m[2] !== undefined) out.push(<strong key={key}><em>{m[2]}</em></strong>)
    else if (m[3] !== undefined || m[4] !== undefined) out.push(<strong key={key}>{m[3] ?? m[4]}</strong>)
    else out.push(<em key={key}>{m[5]}</em>)
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
