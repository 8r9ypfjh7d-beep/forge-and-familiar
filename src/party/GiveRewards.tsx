// The DM's "Inspiration and rewards" card, on the campaign page and the DM screen: one tap gives a player
// Inspiration, and a short form hands out a charm (a few uses) or a blessing (stays, changes the sheet).
import { useEffect, useState } from 'react'
import { EffectsEditor } from '../inventory'
import { useI18n, type MessageKey } from '../i18n'
import type { BoonRoll, Character } from '../model/character'
import type { ItemEffect } from '../rules/types'
import { boonRollText } from '../sheet/boons'
import { getCharacter, onCharactersChanged } from '../storage'
import { fetchPartyCharacters, watchPartyCharacters } from './cloud'
import { updateStash } from './store'
import type { GiftBoon, Party } from './types'
import './rewards.css'

type RollKind = BoonRoll['kind'] | 'none'

interface Preset { id: string; name: MessageKey; text?: MessageKey; boon: Omit<GiftBoon, 'name' | 'text'> }

/** Starting points with original wording; every field stays editable. */
const PRESETS: Preset[] = [
  { id: 'luck', name: 'rewards.preset.luck', text: 'rewards.preset.luck.text', boon: { kind: 'charm', uses: 1, roll: { kind: 'bonusDie', dice: '1d4' } } },
  { id: 'second', name: 'rewards.preset.second', text: 'rewards.preset.second.text', boon: { kind: 'charm', uses: 1, roll: { kind: 'reroll' } } },
  { id: 'mend', name: 'rewards.preset.mend', text: 'rewards.preset.mend.text', boon: { kind: 'charm', uses: 1, roll: { kind: 'heal', dice: '2d4+2' } } },
  { id: 'stout', name: 'rewards.preset.stout', text: 'rewards.preset.stout.text', boon: { kind: 'charm', uses: 1, roll: { kind: 'tempHp', value: 10 } } },
  { id: 'ward', name: 'rewards.preset.ward', text: 'rewards.preset.ward.text', boon: { kind: 'blessing', stats: [{ kind: 'ac', value: 1 }] } },
  { id: 'charm', name: 'rewards.preset.charm', boon: { kind: 'charm', uses: 1 } },
  { id: 'blessing', name: 'rewards.preset.blessing', boon: { kind: 'blessing' } },
]

interface Draft { kind: 'charm' | 'blessing'; name: string; text: string; uses: string; roll: RollKind; dice: string; amount: string; stats: ItemEffect[] }

const DICE = ['1d4', '1d6', '1d8', '1d10', '1d12', '2d4+2', '2d6']
const DICE_RE = /^\d{1,2}d(4|6|8|10|12|20)([+-]\d{1,3})?$/

function draftRoll(d: Draft): BoonRoll | undefined | null {
  switch (d.roll) {
    case 'none': return undefined
    case 'reroll': return { kind: 'reroll' }
    case 'tempHp': { const n = Math.floor(Number(d.amount)); return n > 0 ? { kind: 'tempHp', value: Math.min(n, 999) } : null }
    default: { const dice = d.dice.replace(/\s/g, ''); return DICE_RE.test(dice) ? { kind: d.roll, dice } : null }
  }
}

/** The players' characters, fresh from this device or the cloud party, so the card knows who holds Inspiration. */
function usePartyCharacters(party: Party): Record<string, Character | undefined> {
  const [chars, setChars] = useState<Record<string, Character | undefined>>({})
  const ids = party.members.filter(m => m.userId !== party.dmId).flatMap(m => (m.characterId ? [m.characterId] : []))
  const key = ids.join(',')
  useEffect(() => {
    let live = true
    const list = key ? key.split(',') : []
    const load = async () => {
      const local = await Promise.all(list.map(getCharacter))
      const remote = new Map((await fetchPartyCharacters(list).catch(() => [])).map(c => [c.id, c]))
      // The newer copy wins: the player's device writes the cloud one.
      const pick = (a?: Character | null, b?: Character) => (!a ? b : !b ? a : (b.updatedAt ?? '') > (a.updatedAt ?? '') ? b : a)
      if (live) setChars(Object.fromEntries(list.map((id, i) => [id, pick(local[i], remote.get(id))])))
    }
    load()
    const off = onCharactersChanged(load)
    const offRemote = watchPartyCharacters(list, load)
    return () => { live = false; off(); offRemote() }
  }, [key])
  return chars
}

export function GiveRewards({ party, userId, nameOf, myName }: { party: Party; userId: string; nameOf: (id: string) => string; myName?: string }) {
  const i18n = useI18n()
  const { t } = i18n
  const chars = usePartyCharacters(party)
  const players = party.members.filter(m => m.characterId && m.userId !== party.dmId)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [off, setOff] = useState<Set<string>>(new Set())
  if (userId !== party.dmId || players.length === 0) return null

  const charName = (id: string) => chars[id]?.name ?? t('party.unknownPlayer')
  const by = myName ?? nameOf(userId)
  const inspired = (id: string) => !!chars[id]?.state?.inspiration
  const lacking = players.filter(m => !inspired(m.characterId!))

  const send = async (list: typeof players, extra: { inspiration?: boolean; boon?: GiftBoon }, done: string) => {
    setBusy(true)
    const res = await updateStash(party.id, userId, {
      type: 'gift', ...extra, byName: by,
      to: list.map(m => ({ userId: m.userId, characterId: m.characterId! })),
      names: list.map(m => charName(m.characterId!)),
    })
    setBusy(false)
    setNote(res.ok ? done : res.reason)
    return res.ok
  }
  const giveInspiration = (list: typeof players) =>
    send(list, { inspiration: true }, t('rewards.doneInsp', { who: list.map(m => charName(m.characterId!)).join(', ') }))

  const pick = (p: Preset) => {
    setPreset(p.id)
    const r = p.boon.roll
    setDraft({
      kind: p.boon.kind, name: p.text ? t(p.name) : '', text: p.text ? t(p.text) : '', uses: String(p.boon.uses ?? 1),
      roll: r?.kind ?? 'none', dice: r && 'dice' in r ? r.dice : '1d4', amount: r?.kind === 'tempHp' ? String(r.value) : '10', stats: p.boon.stats ?? [],
    })
  }
  const set = (patch: Partial<Draft>) => setDraft(d => (d ? { ...d, ...patch } : d))
  const roll = draft && draftRoll(draft)
  const picked = players.filter(m => !off.has(m.userId))
  const ready = !!draft && !!draft.name.trim() && roll !== null && picked.length > 0
  const giveBoon = async () => {
    if (!draft || roll === null) return
    const boon: GiftBoon = draft.kind === 'blessing'
      ? { kind: 'blessing', name: draft.name, text: draft.text, stats: draft.stats }
      : { kind: 'charm', name: draft.name, text: draft.text, uses: Number(draft.uses) || 1, ...(roll ? { roll } : {}) }
    const ok = await send(picked, { boon }, t('rewards.done', { name: draft.name.trim(), who: picked.map(m => charName(m.characterId!)).join(', ') }))
    if (ok) { setDraft(null); setPreset(null) }
  }
  const toggle = (id: string) => setOff(s => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <section className="glass ff-rewards" aria-labelledby={`rewards-title-${party.id}`}>
      <div className="ff-rewards-head">
        <h3 id={`rewards-title-${party.id}`}>{t('rewards.title')}</h3>
        <span className="muted small">{t('rewards.hint')}</span>
      </div>

      <div className="ff-rewards-insp">
        <span className="ff-rewards-label">★ {t('rewards.insp')}</span>
        <div className="row" role="group" aria-label={t('rewards.insp')}>
          {players.map(m => {
            const id = m.characterId!
            const has = inspired(id)
            return (
              <button key={m.userId} type="button" className={`glass-chip${has ? ' on' : ''}`} disabled={busy || has}
                aria-label={has ? t('rewards.inspired', { name: charName(id) }) : t('rewards.giveInsp', { name: charName(id) })}
                title={has ? t('rewards.inspired', { name: charName(id) }) : undefined}
                onClick={() => giveInspiration([m])}>
                <span aria-hidden="true">{has ? '★' : '☆'}</span> {charName(id)}
              </button>
            )
          })}
          {players.length > 1 && (
            <button type="button" className="glass-btn small" disabled={busy || lacking.length === 0} onClick={() => giveInspiration(lacking)}>{t('rewards.everyone')}</button>
          )}
        </div>
        <p className="muted small">{t('rewards.inspHint')}</p>
      </div>

      <div className="ff-rewards-boon">
        <button type="button" className="glass-btn small" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {open ? '▾' : '▸'} {t('rewards.reward')}
        </button>
        {open && (
          <>
            <p className="muted small">{t('rewards.rewardHint')}</p>
            <div className="row" role="group" aria-label={t('rewards.start')}>
              {PRESETS.map(p => (
                <button key={p.id} type="button" className={`glass-chip${preset === p.id ? ' on' : ''}`} aria-pressed={preset === p.id} onClick={() => pick(p)}>
                  <span aria-hidden="true">{p.boon.kind === 'charm' ? '✦' : '✺'}</span> {t(p.name)}
                </button>
              ))}
            </div>
            {draft && (
              <form className="ff-rewards-form" onSubmit={e => { e.preventDefault(); if (ready) giveBoon() }}>
                <label>{t('rewards.name')}
                  <input className="glass-field" value={draft.name} onChange={e => set({ name: e.target.value })} required maxLength={80} />
                </label>
                <label>{t('rewards.text')}
                  <textarea className="glass-field" rows={2} value={draft.text} onChange={e => set({ text: e.target.value })} maxLength={400} />
                </label>
                {draft.kind === 'charm'
                  ? (
                    <div className="row">
                      <label>{t('rewards.uses')}
                        <input className="glass-field amount" type="number" min={1} max={20} inputMode="numeric" value={draft.uses} onChange={e => set({ uses: e.target.value })} />
                      </label>
                      <label>{t('rewards.effect')}
                        <select className="glass-field" value={draft.roll} onChange={e => set({ roll: e.target.value as RollKind })}>
                          {(['none', 'bonusDie', 'reroll', 'heal', 'tempHp'] as const).map(k => <option key={k} value={k}>{t(`rewards.effect.${k}`)}</option>)}
                        </select>
                      </label>
                      {(draft.roll === 'bonusDie' || draft.roll === 'heal') && (
                        <label>{t('rewards.dice')}
                          <input className="glass-field amount" dir="ltr" list="ff-rewards-dice" value={draft.dice} onChange={e => set({ dice: e.target.value })} aria-invalid={roll === null} />
                          <datalist id="ff-rewards-dice">{DICE.map(d => <option key={d} value={d} />)}</datalist>
                        </label>
                      )}
                      {draft.roll === 'tempHp' && (
                        <label>{t('rewards.amount')}
                          <input className="glass-field amount" type="number" min={1} inputMode="numeric" value={draft.amount} onChange={e => set({ amount: e.target.value })} />
                        </label>
                      )}
                    </div>
                  )
                  : <EffectsEditor effects={draft.stats} onChange={stats => set({ stats })} legend={t('rewards.stats')} />}
                {draft.kind === 'charm' && roll && <p className="muted small">{boonRollText(t, { roll })}</p>}
                <div className="row" role="group" aria-label={t('rewards.who')}>
                  {players.map(m => (
                    <button key={m.userId} type="button" className={`glass-chip ${off.has(m.userId) ? '' : 'on'}`} aria-pressed={!off.has(m.userId)} onClick={() => toggle(m.userId)}>
                      {charName(m.characterId!)} <span className="muted small">({nameOf(m.userId)})</span>
                    </button>
                  ))}
                </div>
                <button className="glass-btn prominent" disabled={!ready || busy}>{t('rewards.give')}</button>
              </form>
            )}
          </>
        )}
      </div>
      {note && <p className="muted small" role="status">{note}</p>}
    </section>
  )
}
