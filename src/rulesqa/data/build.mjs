// Regenerates srd-rules.json from the SRD 5.1 text in the 5e-bits/5e-database project.
// Run with: node src/rulesqa/data/build.mjs
import { writeFileSync } from 'node:fs'

const BASE = 'https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/en/5e-SRD-'
const MAX_CHARS = 1800

const get = async name => {
  const res = await fetch(`${BASE}${name}.json`)
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`)
  return res.json()
}

const [chapters, sections, conditions] = await Promise.all([get('Rules'), get('Rule-Sections'), get('Conditions')])

const chapterOf = new Map()
for (const ch of chapters) for (const s of ch.subsections) chapterOf.set(s.index, ch.name)

const passages = []
const push = (sectionId, chapter, path, body) => {
  const text = body.trim()
  if (!text) return
  // Split long passages on paragraph breaks, never inside a table.
  const blocks = text.split(/\n{2,}/)
  let buf = []
  let len = 0
  const flush = () => {
    if (!buf.length) return
    const part = passages.filter(p => p.path.join('/') === path.join('/')).length
    passages.push({ id: `${sectionId}-${passages.length}`, chapter, path: [...path], text: buf.join('\n\n'), part })
    buf = []
    len = 0
  }
  for (const b of blocks) {
    if (len + b.length > MAX_CHARS && len > 0) flush()
    buf.push(b)
    len += b.length
  }
  flush()
}

for (const s of sections) {
  const chapter = chapterOf.get(s.index) ?? 'Rules'
  const path = []
  let body = []
  for (const line of s.desc.split('\n')) {
    const h = /^(#{2,4})\s+(.*)$/.exec(line)
    if (h) {
      push(s.index, chapter, path, body.join('\n'))
      body = []
      const depth = h[1].length - 2
      path.length = depth
      path[depth] = h[2].trim()
    } else body.push(line)
  }
  push(s.index, chapter, path, body.join('\n'))
}

for (const c of conditions) {
  passages.push({ id: `condition-${c.index}`, chapter: 'Conditions', path: [c.name], text: c.desc.join('\n'), part: 0 })
}

const out = {
  source: 'System Reference Document 5.1 by Wizards of the Coast LLC, licensed under CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/legalcode). Text via the 5e-bits/5e-database project.',
  passages,
}
writeFileSync(new URL('./srd-rules.json', import.meta.url), JSON.stringify(out))
console.log(`${passages.length} passages`)
