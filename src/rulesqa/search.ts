import type { Answer, Passage, RulesCorpus, SearchHit } from './types'

// Pure search over SRD passages: BM25 with heading boost, table-talk synonyms and a phrase bonus.
// Answers are extracted, never generated, so every word shown is SRD text.

const STOP = new Set((
  'a an and are as at be been but by can could did do does doing for from get gets got had has have how i if in into is it its ' +
  'me my mine of on or our so than that the their them then there these they this those to too up us was we were what when where ' +
  'which while who whom why will with would you your yours am any some much many happen happens work works rule rules mean means ' +
  'should need needs exactly really just also about does dnd 5e srd explain tell know way ok okay please'
).split(' '))

/** Expansions for table talk and abbreviations the SRD never uses. Keys are lowercase raw words or phrases. */
const SYNONYMS: Record<string, string> = {
  aoo: 'opportunity attack',
  oa: 'opportunity attack',
  hp: 'hit points',
  thp: 'temporary hit points',
  temp: 'temporary',
  ac: 'armor class',
  dc: 'difficulty class',
  str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma',
  crit: 'critical hit', crits: 'critical hit', nat: 'natural roll',
  dying: 'death saving throws 0 hit points',
  die: 'death', dies: 'death',
  'death save': 'death saving throw', 'death saves': 'death saving throw',
  save: 'saving throw', saves: 'saving throw',
  adv: 'advantage', disadv: 'disadvantage',
  'dual wield': 'two-weapon fighting', 'dual wielding': 'two-weapon fighting', dualwield: 'two-weapon fighting',
  offhand: 'two-weapon fighting light weapon', 'off hand': 'two-weapon fighting light weapon',
  sneak: 'hide stealth', hiding: 'hide stealth',
  invisibility: 'invisible',
  knockout: 'knocking out', 'knock out': 'knocking creature out',
  heal: 'healing regain hit points', heals: 'healing regain hit points',
  sleep: 'long rest', sleeping: 'long rest',
  resting: 'rest',
  shove: 'shoving', push: 'shoving',
  grab: 'grapple', grabbed: 'grappled',
  swim: 'swimming', climb: 'climbing', jump: 'jumping', fall: 'falling', drown: 'suffocating', drowning: 'suffocating',
  breath: 'suffocating breath', 'hold breath': 'suffocating breath',
  initative: 'initiative', init: 'initiative',
  conc: 'concentration', concentrating: 'concentration',
  upcast: 'casting spell higher level', upcasting: 'casting spell higher level',
  ritual: 'ritual',
  carry: 'carrying capacity', encumbrance: 'carrying capacity encumbrance', encumbered: 'encumbered',
  dark: 'darkness vision', darkvision: 'darkvision',
  surprised: 'surprise',
  flank: 'flanking', flanking: 'flanking',
  bonus: 'bonus action',
  ready: 'ready action',
  inspiration: 'inspiration',
  money: 'coins exchange rates', gold: 'gold pieces coins', gp: 'gold pieces',
}

/** Crude English stemmer: enough to fold plurals, -ing, -ed and -ation onto one form. */
export function stem(word: string): string {
  let w = word
  if (w.length <= 3) return w
  if (w.endsWith("'s")) w = w.slice(0, -2)
  if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -3) + 'y'
  else if (w.endsWith('sses')) w = w.slice(0, -2)
  else if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) w = w.slice(0, -1)
  if (w.endsWith('ation') && w.length > 7) w = w.slice(0, -3)
  else if (w.endsWith('ment') && w.length > 7) w = w.slice(0, -4)
  else if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3)
  else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2)
  if (w.endsWith('e') && w.length > 3) w = w.slice(0, -1)
  if (w.length > 4 && w.at(-1) === w.at(-2) && !'lsz'.includes(w.at(-1)!)) w = w.slice(0, -1)
  return w
}

const words = (text: string) =>
  text.toLowerCase().replace(/[’‘]/g, "'").replace(/\*|_|`/g, '').match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? []

/** Content tokens of a passage or question, stemmed, stop words dropped. */
export function tokenize(text: string): string[] {
  return words(text).filter(w => !STOP.has(w)).map(stem)
}

export interface Query {
  /** The user's own content words, unstemmed. */
  raw: string[]
  /** Stemmed content words. */
  own: string[]
  /** Stemmed synonym expansions not already in `own`. */
  extra: string[]
  /** Stemmed words with no synonym entry: the ones a good passage should actually contain. */
  plain: string[]
}

/** Question tokens plus synonym expansions (expansions weigh a little less and don't count toward coverage). */
export function expandQuery(question: string): Query {
  const all = words(question)
  const raw = all.filter(w => !STOP.has(w))
  const own = raw.map(stem)
  const extra: string[] = []
  const translated = new Set<string>()
  for (let i = 0; i < all.length; i++) {
    const pair = i + 1 < all.length ? `${all[i]} ${all[i + 1]}` : ''
    if (pair && SYNONYMS[pair]) {
      extra.push(...tokenize(SYNONYMS[pair]))
      translated.add(all[i]).add(all[i + 1])
    }
    if (SYNONYMS[all[i]]) {
      extra.push(...tokenize(SYNONYMS[all[i]]))
      translated.add(all[i])
    }
  }
  const lower = question.toLowerCase()
  if (/\bnat(ural)?\s*20\b/.test(lower)) { extra.push(...tokenize('rolling 20 critical hit')); translated.add('20') }
  if (/\bnat(ural)?\s*1\b/.test(lower)) { extra.push(...tokenize('rolling 1 miss')); translated.add('1') }
  return {
    raw,
    own,
    extra: [...new Set(extra)].filter(t => !own.includes(t)),
    plain: raw.filter(w => !translated.has(w)).map(stem),
  }
}

interface IndexedDoc {
  passage: Passage
  tokens: string[]
  /** Stemmed tokens of the deepest heading. */
  head: string[]
  /** Lowercase words of the deepest heading, unstemmed. */
  headRaw: string[]
  tf: Map<string, number>
  length: number
}

export interface RulesIndex {
  docs: IndexedDoc[]
  idf: Map<string, number>
  avgLength: number
}

const HEADING_WEIGHT = 4

export function buildIndex(corpus: RulesCorpus): RulesIndex {
  const df = new Map<string, number>()
  const docs = corpus.passages.map(passage => {
    const body = tokenize(passage.text)
    // The deepest heading names what the passage is about; weigh it heavily. Parents count once.
    const head = tokenize(passage.path.at(-1) ?? '')
    const parents = tokenize([passage.chapter, ...passage.path.slice(0, -1)].join(' '))
    const tf = new Map<string, number>()
    const add = (t: string, n: number) => tf.set(t, (tf.get(t) ?? 0) + n)
    for (const t of body) add(t, 1)
    for (const t of head) add(t, HEADING_WEIGHT)
    for (const t of parents) add(t, 1)
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1)
    return { passage, tokens: [...head, ...body], head, headRaw: words(passage.path.at(-1) ?? ''), tf, length: body.length + head.length * HEADING_WEIGHT }
  })
  const n = docs.length
  const idf = new Map<string, number>()
  for (const [t, d] of df) idf.set(t, Math.log(1 + (n - d + 0.5) / (d + 0.5)))
  const avgLength = docs.reduce((s, d) => s + d.length, 0) / Math.max(1, n)
  return { docs, idf, avgLength }
}

const K1 = 1.2
const B = 0.75
const EXTRA_WEIGHT = 0.8
const PHRASE_BONUS = 1.5
/** Scales the bonus for naming every word of a passage's heading ("falling" for "Falling"), by how rare those words are. */
const HEADING_BONUS = 0.5
const HEADING_BONUS_MAX = 3
/** Per question word that matches a heading word exactly, so "grappling" prefers "Grappling" over "Grappled". */
const EXACT_HEADING_BONUS = 1

function bm25(index: RulesIndex, doc: IndexedDoc, term: string): number {
  const f = doc.tf.get(term)
  if (!f) return 0
  const idf = index.idf.get(term) ?? 0
  return idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * doc.length / index.avgLength))
}

/** Passages ranked by relevance to the question. */
export function search(index: RulesIndex, question: string, limit = 6): SearchHit[] {
  const { raw, own, extra } = expandQuery(question)
  if (own.length + extra.length === 0) return []
  const bigrams = own.slice(1).map((t, i) => `${own[i]} ${t}`)
  const hits: SearchHit[] = []
  for (const doc of index.docs) {
    let score = 0
    for (const t of new Set(own)) score += bm25(index, doc, t)
    for (const t of new Set(extra)) score += EXTRA_WEIGHT * bm25(index, doc, t)
    if (score === 0) continue
    if (bigrams.length) {
      const seq = doc.tokens
      for (let i = 1; i < seq.length; i++) {
        if (bigrams.includes(`${seq[i - 1]} ${seq[i]}`)) { score += PHRASE_BONUS; break }
      }
    }
    if (doc.head.length && doc.head.every(t => own.includes(t) || extra.includes(t))) {
      const rarity = doc.head.reduce((sum, t) => sum + (index.idf.get(t) ?? 0), 0)
      score += Math.min(HEADING_BONUS_MAX, HEADING_BONUS * rarity)
    }
    score += EXACT_HEADING_BONUS * raw.filter(w => doc.headRaw.includes(w)).length
    // Prefer the start of a split section: it carries the definition.
    if (doc.passage.part > 0) score *= 0.9
    hits.push({ passage: doc.passage, score })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}

/** Sentences (and table rows / list items) of a passage, markdown kept. */
export function sentences(text: string): string[] {
  const out: string[] = []
  for (const block of text.split(/\n+/)) {
    const line = block.trim()
    if (!line || /^\|?[\s|:-]+\|?$/.test(line)) continue
    if (line.startsWith('|') || /^[-*]\s/.test(line)) { out.push(line); continue }
    out.push(...(line.match(/[^.!?]+(?:[.!?]+["')\]]*|$)\s*/g) ?? [line]).map(s => s.trim()).filter(Boolean))
  }
  return out
}

/** The 1–3 consecutive sentences of a passage that best cover the question. */
export function excerpt(index: RulesIndex, passage: Passage, question: string): string {
  const { own, extra } = expandQuery(question)
  const weight = (t: string) => (index.idf.get(t) ?? 0) * (own.includes(t) ? 1 : extra.includes(t) ? EXTRA_WEIGHT : 0)
  const list = sentences(passage.text)
  if (!list.length) return ''
  const scores = list.map(s => {
    const seen = new Set(tokenize(s))
    let sc = 0
    for (const t of seen) sc += weight(t)
    return sc
  })
  let bestStart = 0
  let bestScore = -1
  for (let i = 0; i < list.length; i++) {
    if (scores[i] > bestScore) { bestScore = scores[i]; bestStart = i }
  }
  if (bestScore <= 0) return list.slice(0, 2).join(' ')
  // Extend forward while the next sentence still talks about the question, up to three sentences.
  let end = bestStart + 1
  while (end < list.length && end - bestStart < 3 && scores[end] > 0 && !list[end].startsWith('|')) end++
  // A lone short sentence reads better with the one after it.
  if (end - bestStart === 1 && list[bestStart].length < 80 && end < list.length && !list[end].startsWith('|')) end++
  const picked = list.slice(bestStart, end)
  if (picked[0].startsWith('|')) {
    // Show a table row under its header so the numbers mean something.
    const header = list.find(l => l.startsWith('|'))
    return header && header !== picked[0] ? `${header}\n${picked.join('\n')}` : picked.join('\n')
  }
  return picked.join(picked[0].startsWith('-') ? '\n' : ' ')
}

const WEAK_SCORE = 4

/** Answer a rules question with SRD text: best passage, its key sentences, and related passages. */
export function answer(index: RulesIndex, question: string): Answer {
  const hits = search(index, question, 6)
  if (!hits.length) return { best: null, excerpt: '', related: [], weak: true }
  const [best, ...rest] = hits
  const { plain } = expandQuery(question)
  const doc = index.docs.find(d => d.passage.id === best.passage.id)!
  const covered = plain.length ? plain.filter(t => doc.tf.has(t)).length / plain.length : 1
  return {
    best,
    excerpt: excerpt(index, best.passage, question),
    related: rest
      .filter(h => h.score >= best.score * 0.5)
      .filter((h, i, a) => a.findIndex(o => breadcrumb(o.passage) === breadcrumb(h.passage)) === i && breadcrumb(h.passage) !== breadcrumb(best.passage))
      .slice(0, 4),
    weak: best.score < WEAK_SCORE || covered < 0.5,
  }
}

/** "Combat › Making an Attack › Opportunity Attacks" style breadcrumb. */
export const breadcrumb = (p: Passage) => [p.chapter, ...p.path].filter((s, i, a) => s && s !== a[i - 1]).join(' › ')
