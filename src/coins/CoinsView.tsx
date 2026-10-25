import { useEffect, useState } from 'react'
import type { Character, UserProfile } from '../model/character'
import { listParties, onPartiesChanged } from '../party'
import type { Party } from '../party'
import { getCharacter, listProfiles, onCharactersChanged, saveCharacter } from '../storage'
import {
  addPurses, CHANGE_DENOMS, convert, CP_VALUE, DENOM_NAMES, DENOMS, formatGp, formatPurse, fromCp, PURSE_DENOMS, splitLoot, toCp,
} from './coins'
import type { Denom, Purse } from './coins'
import './coins.css'

/** Coin converter and even loot split, optionally paid straight into party members' purses. */
export function CoinsView({ userId }: { userId: string }) {
  return (
    <section className="ff-coins">
      <h2>Coins</h2>
      <p className="muted small">1 pp = 10 gp = 20 ep = 100 sp = 1,000 cp</p>
      <div className="coins-grid">
        <Converter />
        <LootSplitter userId={userId} />
      </div>
    </section>
  )
}

const count = (v: string) => Math.max(0, Math.floor(Number(v) || 0))

function Converter() {
  const [amount, setAmount] = useState('1')
  const [from, setFrom] = useState<Denom>('gp')
  const n = count(amount)

  return (
    <div className="panel">
      <h3>Converter</h3>
      <div className="row">
        <input type="number" min={0} inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Amount" className="amount" />
        <select value={from} onChange={e => setFrom(e.target.value as Denom)} aria-label="Coin">
          {DENOMS.map(d => <option key={d} value={d}>{DENOM_NAMES[d]} ({d})</option>)}
        </select>
      </div>
      <table className="convert">
        <tbody>
          {DENOMS.filter(d => d !== from).map(d => {
            const c = convert(n, from, d)
            return (
              <tr key={d}>
                <th scope="row">{DENOM_NAMES[d]}</th>
                <td className="num">{c.coins.toLocaleString()} {d}</td>
                <td className="muted small">{c.leftoverCp > 0 ? `+ ${formatPurse(fromCp(c.leftoverCp, DENOMS.filter(x => CP_VALUE[x] < CP_VALUE[d])))}` : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="muted small">Fewest coins: {formatPurse(fromCp(n * CP_VALUE[from], CHANGE_DENOMS))}</p>
    </div>
  )
}

const NO_PARTY = ''

function LootSplitter({ userId }: { userId: string }) {
  const [pile, setPile] = useState<Record<Denom, string>>({ pp: '', gp: '', ep: '', sp: '', cp: '' })
  const [parties, setParties] = useState<Party[]>([])
  const [partyId, setPartyId] = useState(NO_PARTY)
  const [shares, setShares] = useState('4')
  const [members, setMembers] = useState<{ character: Character; player: string }[]>([])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [leftoverTo, setLeftoverTo] = useState('')
  const [paid, setPaid] = useState('')

  useEffect(() => {
    const load = () => listParties(userId).then(setParties)
    load()
    return onPartiesChanged(load)
  }, [userId])

  const party = parties.find(p => p.id === partyId)
  useEffect(() => {
    let live = true
    const load = async () => {
      if (!party) { setMembers([]); return }
      const profiles: UserProfile[] = await listProfiles()
      const rows = await Promise.all(party.members.map(async m => {
        const character = m.characterId ? await getCharacter(m.characterId) : undefined
        return character ? { character, player: profiles.find(p => p.id === m.userId)?.displayName ?? 'Unknown player' } : null
      }))
      if (live) setMembers(rows.filter(r => r !== null))
    }
    load()
    const off = onCharactersChanged(load)
    return () => { live = false; off() }
  }, [party])

  const purse: Purse = Object.fromEntries(DENOMS.map(d => [d, count(pile[d])]))
  const recipients = members.filter(m => !excluded.has(m.character.id))
  const n = party ? recipients.length : count(shares)
  const split = splitLoot(purse, n, PURSE_DENOMS)
  const total = toCp(purse)

  const toggle = (id: string) => {
    setPaid('')
    setExcluded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const payOut = async () => {
    for (const { character } of recipients) {
      // Re-read so a change made on the sheet meanwhile isn't overwritten.
      const fresh = await getCharacter(character.id)
      if (!fresh) continue
      const extra = character.id === leftoverTo ? addPurses(split.share, split.leftover) : split.share
      const next = addPurses(fresh.coins, extra)
      await saveCharacter({ ...fresh, coins: { cp: next.cp ?? 0, sp: next.sp ?? 0, gp: next.gp ?? 0 } })
    }
    setPaid(`Added ${formatPurse(split.share)} to ${recipients.length} ${recipients.length === 1 ? 'purse' : 'purses'}.`)
    setPile({ pp: '', gp: '', ep: '', sp: '', cp: '' })
  }

  return (
    <div className="panel">
      <h3>Split loot</h3>
      <div className="pile">
        {DENOMS.map(d => (
          <label key={d}>
            <span className="small strong">{d}</span>
            <input type="number" min={0} inputMode="numeric" value={pile[d]} placeholder="0"
              onChange={e => { setPaid(''); setPile({ ...pile, [d]: e.target.value }) }} aria-label={DENOM_NAMES[d]} />
          </label>
        ))}
      </div>
      <p className="muted small">Total {formatGp(total)}</p>

      <div className="row">
        <label className="small strong" htmlFor="split-party">Split among</label>
        <select id="split-party" value={partyId} onChange={e => { setPartyId(e.target.value); setExcluded(new Set()); setLeftoverTo(''); setPaid('') }}>
          <option value={NO_PARTY}>A number of people</option>
          {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {!party && (
          <input type="number" min={1} inputMode="numeric" value={shares} onChange={e => setShares(e.target.value)} aria-label="Number of people" className="amount" />
        )}
      </div>

      {party && (
        members.length === 0
          ? <p className="muted small">Nobody in {party.name} has brought a character on this device yet.</p>
          : (
            <ul className="plain recipients">
              {members.map(({ character, player }) => {
                const on = !excluded.has(character.id)
                const gets = on ? (character.id === leftoverTo ? addPurses(split.share, split.leftover) : split.share) : {}
                return (
                  <li key={character.id}>
                    <label className="row">
                      <input type="checkbox" checked={on} onChange={() => toggle(character.id)} />
                      <span className="grow"><strong>{character.name}</strong> <span className="muted small">{player}</span></span>
                      <span className="small num">{on ? `+${formatPurse(gets)}` : 'sits out'}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )
      )}

      {n > 0 && total > 0 && (
        <div className="result" aria-live="polite">
          <p><span className="muted small">Each of {n} gets</span><br /><strong className="share">{formatPurse(split.share)}</strong></p>
          {split.leftoverCp > 0 && (
            <div className="row">
              <span className="small">Left over: <strong>{formatPurse(split.leftover)}</strong></span>
              {party && recipients.length > 0 && (
                <select value={leftoverTo} onChange={e => setLeftoverTo(e.target.value)} aria-label="Who gets the leftover">
                  <option value="">Keep for the party fund</option>
                  {recipients.map(r => <option key={r.character.id} value={r.character.id}>Give to {r.character.name}</option>)}
                </select>
              )}
            </div>
          )}
          {party && recipients.length > 0 && (
            <button className="btn primary" onClick={payOut}>Add to purses</button>
          )}
        </div>
      )}
      {paid && <p className="good small" role="status">{paid}</p>}
      <p className="muted small">Shares are paid in gold, silver and copper, the coins a character's purse holds.</p>
    </div>
  )
}
