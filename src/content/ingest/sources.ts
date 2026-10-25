// The SRD sources the ingest script knows, and where their upstream JSON lives.
import type { ContentKind, Edition, SourceInfo } from '../types.ts'

const VIA = ' Data via the 5e-bits/5e-database project (https://github.com/5e-bits/5e-database).'

export const SRD_51: SourceInfo = {
  id: 'srd-5.1',
  title: 'System Reference Document 5.1',
  edition: '2014',
  license: 'CC-BY-4.0',
  attribution:
    'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC, ' +
    'available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the ' +
    'Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.' + VIA,
}

export const SRD_52: SourceInfo = {
  id: 'srd-5.2',
  title: 'System Reference Document 5.2',
  edition: '2024',
  license: 'CC-BY-4.0',
  attribution:
    'This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, ' +
    'available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 ' +
    'International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.' + VIA,
}

export const SRD_SOURCES: Record<Edition, SourceInfo> = { '2014': SRD_51, '2024': SRD_52 }

export const UPSTREAM_REPO = '5e-bits/5e-database'

/** Folder of the edition's English JSON inside the upstream repo. */
export const upstreamPath = (edition: Edition) => `src/${edition}/en`

/** Upstream file name for a dataset, e.g. `5e-SRD-Spells.json`. */
export const upstreamFile = (name: UpstreamName) => `5e-SRD-${name}.json`

export type UpstreamName =
  | 'Ability-Scores' | 'Alignments' | 'Backgrounds' | 'Classes' | 'Conditions' | 'Damage-Types'
  | 'Equipment' | 'Feats' | 'Features' | 'Languages' | 'Levels' | 'Magic-Items' | 'Magic-Schools'
  | 'Monsters' | 'Proficiencies' | 'Races' | 'Skills' | 'Spells' | 'Subclasses' | 'Subraces' | 'Traits'
  | 'Weapon-Properties' | 'Species' | 'Subspecies' | 'Weapon-Mastery-Properties'

/** Upstream files each kind is built from. The first is required; a missing optional file is skipped. */
export const UPSTREAM_FOR: Record<Edition, Record<ContentKind, UpstreamName[]>> = {
  '2014': {
    spells: ['Spells'],
    equipment: ['Equipment'],
    'magic-items': ['Magic-Items'],
    classes: ['Classes', 'Levels'],
    subclasses: ['Subclasses', 'Levels'],
    features: ['Features'],
    races: ['Races'],
    subraces: ['Subraces'],
    traits: ['Traits'],
    feats: ['Feats'],
    backgrounds: ['Backgrounds'],
    conditions: ['Conditions'],
    monsters: ['Monsters'],
    languages: ['Languages'],
    proficiencies: ['Proficiencies'],
    glossary: ['Ability-Scores', 'Skills', 'Alignments', 'Damage-Types', 'Magic-Schools', 'Weapon-Properties'],
  },
  '2024': {
    spells: ['Spells'],
    equipment: ['Equipment'],
    'magic-items': ['Magic-Items'],
    classes: ['Classes', 'Levels'],
    subclasses: ['Subclasses', 'Features'],
    features: ['Features', 'Subclasses'],
    races: ['Species'],
    subraces: ['Subspecies'],
    traits: ['Traits'],
    feats: ['Feats'],
    backgrounds: ['Backgrounds'],
    conditions: ['Conditions'],
    monsters: ['Monsters'],
    languages: ['Languages'],
    proficiencies: ['Proficiencies'],
    glossary: ['Ability-Scores', 'Skills', 'Alignments', 'Damage-Types', 'Magic-Schools', 'Weapon-Properties', 'Weapon-Mastery-Properties'],
  },
}
