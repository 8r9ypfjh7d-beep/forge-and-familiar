/** One searchable chunk of SRD text: the body under its deepest heading. */
export interface Passage {
  id: string
  /** SRD chapter, e.g. "Combat" or "Conditions". */
  chapter: string
  /** Heading trail inside the chapter, e.g. ["Making an Attack", "Melee Attacks", "Opportunity Attacks"]. */
  path: string[]
  /** SRD markdown (paragraphs, lists, tables, bold/italic). */
  text: string
  /** 0 for the first chunk under a heading, 1+ when a long section was split. */
  part: number
}

export interface RulesCorpus {
  /** Attribution line required by the SRD licence. */
  source: string
  passages: Passage[]
}

export interface SearchHit {
  passage: Passage
  score: number
}

export interface Answer {
  /** Best passage, or null when nothing matched well enough. */
  best: SearchHit | null
  /** The one to three sentences of `best` that most directly address the question. */
  excerpt: string
  /** Further passages worth reading, best first. */
  related: SearchHit[]
  /** True when the match is weak and the UI should hedge. */
  weak: boolean
}
