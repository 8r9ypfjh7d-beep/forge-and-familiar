// Inspiration (2014) or Heroic Inspiration (2024) on the character card: have it or not, use it with a d20,
// and hand it to an ally in the campaign (2014 any time; 2024 only an extra one gained while holding one).
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { rulesEdition } from '../../rules'
import { getCharacter } from '../../storage'
import { fetchPartyCharacters } from '../../party/cloud'
import { updateStash } from '../../party/store'
import type { Party } from '../../party/types'
import { canPassInspiration, dropSpareInspiration, gainInspiration, passInspiration, spendInspiration } from '../boons'
import { useSheetRolls } from '../dice'
import { LastRoll, type Shown } from '../combat/LastRoll'
import { bringsCharacter } from '../combat/liveMap'
import type { Apply } from '../types'

interface Ally { userId: string; characterId: string; name: string; inspired: boolean }

/** The other players' characters in this campaign, with whether each already holds Inspiration. */
function useAllies(party: Party | undefined, characterId: string, enabled: boolean): Ally[] {
  const [allies, setAllies] = useState<Ally[]>([])
  const others = enabled && party ? party.members.filter(m => m.characterId && m.characterId !== characterId && m.userId !== party.dmId) : []
  const key = others.map(m => `${m.userId}:${m.characterId}`).join(',')
  useEffect(() => {
    let live = true
    const list = key ? key.split(',').map(x => { const [userId, characterId] = x.split(':'); return { userId, characterId } }) : []
    ;(async () => {
      const local = await Promise.all(list.map(m => getCharacter(m.characterId)))
      const missing = list.filter((_, i) => !local[i]).map(m => m.characterId)
      const remote = new Map((missing.length ? await fetchPartyCharacters(missing).catch(() => []) : []).map(c => [c.id, c]))
      const found = list.flatMap((m, i) => {
        const c = local[i] ?? remote.get(m.characterId)
        return c ? [{ ...m, name: c.name, inspired: !!c.state?.inspiration }] : []
      })
      if (live) setAllies(found)
    })()
    return () => { live = false }
  }, [key])
  return allies
}

export function InspirationLine({ character, apply, party, userId }: { character: Character; apply: Apply; party?: Party; userId?: string }) {
  const { t } = useI18n()
  const rolls = useSheetRolls(character)
  const [last, setLast] = useState<Shown | null>(null)
  const [note, setNote] = useState('')
  const [giving, setGiving] = useState(false)
  const edition = rulesEdition(character)
  const name = t(edition === '2024' ? 'insp.name2024' : 'insp.name2014')
  const inspired = !!character.state.inspiration
  const spare = !!character.state.spareInspiration
  const canGive = !!party && !!userId && bringsCharacter(party, userId, character.id) && canPassInspiration(character)
  const allies = useAllies(party, character.id, canGive)

  const use = () => {
    const roll = rolls.any('1d20', t(edition === '2024' ? 'insp.roll2024' : 'insp.roll2014'))
    if (roll) setLast({ roll, what: name })
    apply(t('insp.log.spend', { name }), spendInspiration)
  }
  const give = async (a: Ally) => {
    if (!party || !userId) return
    setGiving(true)
    const res = await updateStash(party.id, userId, {
      type: 'gift', inspiration: true, to: [{ userId: a.userId, characterId: a.characterId }], names: [a.name], byName: character.name,
    })
    setGiving(false)
    if (!res.ok) { setNote(res.reason); return }
    setNote('')
    apply(t('insp.log.passed', { what: name, name: a.name }), passInspiration)
  }
  const allyButtons = canGive && allies.length > 0 && (
    <span className="cs-insp-allies">
      {allies.map(a => (
        <button key={a.characterId} type="button" className="btn small" disabled={giving || a.inspired}
          aria-label={t('insp.giveLabel', { what: name, name: a.name })} title={a.inspired ? t('insp.hasIt', { name: a.name }) : undefined}
          onClick={() => give(a)}>
          {t('insp.give', { name: a.name })}{a.inspired && <span aria-hidden="true"> ★</span>}
        </button>
      ))}
    </span>
  )

  return (
    <div className={`cs-insp${inspired ? ' on' : ''}`}>
      <div className="cs-insp-row">
        <span className="cs-insp-name">
          <span className="cs-insp-star" aria-hidden="true">{inspired ? '★' : '☆'}</span>
          {inspired ? t('insp.have', { name }) : t('insp.none', { name })}
        </span>
        {inspired
          ? (
            <>
              <button type="button" className="btn small primary" onClick={use}>{t(edition === '2024' ? 'insp.use2024' : 'insp.use2014')}</button>
              {!spare && allyButtons}
              <button type="button" className="btn ghost small" onClick={() => apply(t('insp.log.drop', { name }), spendInspiration)}>{t('insp.drop')}</button>
            </>
          )
          : <button type="button" className="btn small" title={t('insp.gainTitle')} onClick={() => apply(t('insp.log.gain', { name }), gainInspiration)}>{t('insp.gain')}</button>}
        <details className="cs-insp-how">
          <summary>{t('insp.how')}</summary>
          <p className="hint">{t(edition === '2024' ? 'insp.rule2024' : 'insp.rule2014')}</p>
        </details>
      </div>
      {spare && (
        <p className="cs-insp-spare" role="status">
          {t('insp.spare')} {allyButtons}
          <button type="button" className="btn ghost small" onClick={() => apply(t('insp.log.spareDrop'), dropSpareInspiration)}>{t('insp.spareDrop')}</button>
        </p>
      )}
      {note && <p className="hint" role="alert">{note}</p>}
      {last && <LastRoll key={last.roll.id} rolls={[last]} onDone={() => setLast(null)} />}
    </div>
  )
}
