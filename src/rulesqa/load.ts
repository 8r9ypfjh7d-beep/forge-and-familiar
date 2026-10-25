import { buildIndex, type RulesIndex } from './search'
import type { RulesCorpus } from './types'

let pending: Promise<{ index: RulesIndex; source: string }> | null = null

/** Loads the SRD text (a separate ~220 KB chunk) and indexes it once per page load. */
export function loadRules() {
  pending ??= import('./data/srd-rules.json').then(m => {
    const corpus = m.default as RulesCorpus
    return { index: buildIndex(corpus), source: corpus.source }
  })
  return pending
}
