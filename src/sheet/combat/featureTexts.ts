// Names and rules text of a character's class features, racial traits, feats and background feature, in the
// current language. Shared by combat mode's Features tab and the printable sheet so both say the same thing.
import { BUNDLED } from '../../content'
import { explainKey, featExplainKey, optionKey, optionName } from '../../builder/why'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { classOptionById, derive, getBackground, getFeats, rulesEdition, splitTrait, type DerivedStats } from '../../rules'
import { editionOf, sourceFor } from '../../spellbook/access'
import { featureDescription } from './combat'
import type { Library } from './library'

export interface DescribedLine {
  key: string
  name: string
  /** "Fighter 3 · 2 uses" */
  meta?: string
  /** Markdown, or our plain summary. */
  text?: string
}

export interface FeatureTexts {
  features: DescribedLine[]
  traits: DescribedLine[]
  feats: DescribedLine[]
  backgroundFeature?: string
  languages: string[]
  tools: string[]
  /** The SRD's CC-BY line for the edition's library. */
  attribution?: string
}

export function useFeatureTexts(character: Character, lib: Pick<Library, 'features' | 'traits' | 'feats'>, d: DerivedStats = derive(character)): FeatureTexts {
  const { t, term, locale } = useI18n()
  const translated = locale !== 'en'
  const bg = getBackground(character)
  const source = BUNDLED.find(m => m.source.id === sourceFor(editionOf(character)))?.source
  // In another language our translated summary comes first; the SRD text is English.
  const traitText = (name: string) => {
    // Homebrew traits written "Name: what it does".
    if (character.raceId.startsWith('hb:') || character.subraceId?.startsWith('hb:')) {
      const text = splitTrait(name).text
      if (text) return text
    }
    const own = explainKey('trait', name) ?? explainKey('trait', name.replace(/\s*\(.*$/, ''))
    if (translated && own) return t(own)
    const base = name.replace(/\s*\(.*$/, '').toLowerCase()
    return lib.traits.find(x => x.name.toLowerCase() === base)?.description ?? (own ? t(own) : undefined)
  }
  // Our own summary (every official feat has one), then the player's text, then the SRD library.
  const feats = getFeats(character)
  const featText = (f: (typeof feats)[number]) => {
    const key = featExplainKey(f.id, rulesEdition(character))
    return (key ? t(key) : undefined) || f.description || lib.feats.find(x => x.name.toLowerCase() === f.name.toLowerCase())?.description
  }
  // Custom subclass text, then that subclass's own summary or SRD entry (see featureDescription).
  const option = (f: DerivedStats['features'][number]) => (f.optionId ? classOptionById(f.optionId, rulesEdition(character)) : undefined)
  const featureName = (f: DerivedStats['features'][number]) => {
    const o = option(f)
    // A repeated 2024 invocation keeps its cantrip: "Agonizing Blast (Eldritch Blast)".
    return o ? optionName(o, term) + f.name.slice(f.name.startsWith(o.name) ? o.name.length : f.name.length) : term('feature', f.name, f.name)
  }
  const featureText = (f: DerivedStats['features'][number]) => {
    const o = option(f)
    if (o) {
      const k = optionKey(o)
      return f.text || (k ? t(k) : undefined)
    }
    return featureDescription(lib.features, f, t, translated)
  }
  return {
    features: d.features.map(f => ({
      key: `${f.className}-${f.level}-${f.optionId ?? f.name}`,
      name: featureName(f),
      meta: t('cs.featureMeta', { cls: term('class', f.className.toLowerCase(), f.className), level: f.level }) + (f.detail ? ` · ${term('detail', f.detail, f.detail)}` : ''),
      text: featureText(f),
    })),
    traits: d.traits.map(x => ({ key: x, name: term('trait', splitTrait(x).name, splitTrait(x).name), text: traitText(x) })),
    feats: feats.map((f, i) => ({ key: `${f.id}-${i}`, name: term('feat', f.id, f.name), text: featText(f) })),
    backgroundFeature: bg?.feature
      ? bg.feat ? term('feat', bg.feat.id, bg.feature) : term('bgFeature', bg.feature, term('feature', bg.feature, bg.feature))
      : undefined,
    languages: d.languages.map(x => term('language', x, x)),
    tools: d.tools.map(x => term('tool', x, x)),
    attribution: source?.attribution,
  }
}
