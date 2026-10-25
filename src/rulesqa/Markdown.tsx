import type { ReactNode } from 'react'

/** Renders the small markdown subset the SRD text uses: paragraphs, lists, tables, bold and italic. */
export function Markdown({ text }: { text: string }) {
  return <>{text.split(/\n{2,}/).map((block, i) => <Block key={i} block={block.trim()} />)}</>
}

function Block({ block }: { block: string }) {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return null
  if (lines.every(l => l.startsWith('|'))) {
    const rows = lines.filter(l => !/^\|[\s|:-]+\|$/.test(l)).map(cells)
    const [head, ...body] = rows
    return (
      <div className="table-wrap">
        <table>
          <thead><tr>{head.map((c, i) => <th key={i}>{inline(c)}</th>)}</tr></thead>
          <tbody>{body.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    )
  }
  if (lines.every(l => /^[-*]\s/.test(l))) {
    return <ul>{lines.map((l, i) => <li key={i}>{inline(l.replace(/^[-*]\s+/, ''))}</li>)}</ul>
  }
  return <p>{inline(lines.join(' '))}</p>
}

const cells = (row: string) => row.replace(/^\||\|$/g, '').split('|').map(c => c.trim())

/** Bold-italic, bold and italic runs. Unmatched asterisks are shown as-is. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = out.length
    if (m[1] !== undefined) out.push(<strong key={key}><em>{m[1].trim()}</em> </strong>)
    else if (m[2] !== undefined) out.push(<strong key={key}>{m[2]}</strong>)
    else out.push(<em key={key}>{m[3]}</em>)
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
