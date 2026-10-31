import { useState } from 'react'
import { ConfirmDialog } from '../builder/ConfirmDialog'
import { ITEMS } from '../rules'
import { COINS, formatCoins, getStash, splitCoins, toCp, type StashAction } from './stash'
import { updateStash } from './store'
import type { Coin, Party } from './types'

/** Shared loot and gold for one party. Every member can change it; the log says who did what. */
export function PartyStash({ party, userId, nameOf }: { party: Party; userId: string; nameOf: (id: string) => string }) {
  const stash = getStash(party)
  const [error, setError] = useState('')
  const act = async (action: StashAction) => {
    const res = await updateStash(party.id, userId, action)
    setError(res.ok ? '' : res.reason)
    return res.ok
  }
  // Split among members who bring a character; the DM watching doesn't take a share.
  const players = party.members.filter(m => m.characterId).length

  return (
    <section className="glass stash" aria-labelledby="stash-title">
      <div className="stash-head">
        <h3 id="stash-title">Party stash</h3>
        <span className="muted small">Shared loot and gold. Anyone in the party can change it.</span>
      </div>

      <div className="stash-cols">
        <CoinPurse coins={stash.coins} players={players} act={act} />
        <ItemList party={party} userId={userId} nameOf={nameOf} act={act} />
      </div>

      {error && <p className="bad small" role="alert">{error}</p>}

      {stash.log.length > 0 && (
        <details className="stash-log">
          <summary className="small strong">Recent changes</summary>
          <ul>
            {stash.log.map((e, i) => (
              <li key={i} className="small">
                <strong>{nameOf(e.userId)}</strong> {e.text}
                <time className="muted" dateTime={e.at}>{when(e.at)}</time>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function CoinPurse({ coins, players, act }: {
  coins: ReturnType<typeof getStash>['coins']
  players: number
  act: (a: StashAction) => Promise<boolean>
}) {
  const [amount, setAmount] = useState('')
  const [coin, setCoin] = useState<Coin>('gp')
  const [reason, setReason] = useState('')
  const [splitting, setSplitting] = useState(false)
  const n = Math.floor(Number(amount))
  const valid = n > 0
  const move = async (sign: 1 | -1) => {
    if (await act({ type: 'coins', delta: { [coin]: sign * n }, reason })) { setAmount(''); setReason('') }
  }
  const split = splitCoins(coins, players)
  const canSplit = players > 0 && toCp(split.share) > 0

  return (
    <div className="purse">
      <h4 className="glass-eyebrow">Coin</h4>
      <dl className="coins">
        {COINS.map(k => <div key={k} className={coins[k] ? '' : 'none'}><dt>{k}</dt><dd>{coins[k]}</dd></div>)}
      </dl>
      <p className="muted small">Worth {formatCoins({ gp: Math.floor(toCp(coins) / 100) })} in total.</p>

      <form className="row" onSubmit={e => { e.preventDefault(); if (valid) move(1) }}>
        <input className="glass-field amount" type="number" min={1} inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="Amount" aria-label="Amount" />
        <select className="glass-field" value={coin} onChange={e => setCoin(e.target.value as Coin)} aria-label="Coin">
          {COINS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <input className="glass-field grow" value={reason} onChange={e => setReason(e.target.value)} placeholder="What for? (optional)" aria-label="Reason" />
        <button className="glass-btn small prominent" disabled={!valid}>Add</button>
        <button type="button" className="glass-btn small" disabled={!valid} onClick={() => move(-1)}>Take</button>
      </form>

      <button className="glass-btn small" disabled={!canSplit} onClick={() => setSplitting(true)}>
        {canSplit ? `Split ${players} ways: ${formatCoins(split.share)} each` : 'Split among players'}
      </button>
      <ConfirmDialog open={splitting} title={`Give each of the ${players} players ${formatCoins(split.share)} and empty the stash?`} yes="Split"
        onYes={() => void act({ type: 'split', ways: players })} onClose={() => setSplitting(false)} />
      {canSplit && split.leftoverCp > 0 && <p className="muted small">{split.leftoverCp} cp doesn't divide evenly and stays in the stash.</p>}
    </div>
  )
}

const ITEM_BY_NAME = new Map(ITEMS.map(i => [i.name.toLowerCase(), i]))

function ItemList({ party, userId, nameOf, act }: {
  party: Party
  userId: string
  nameOf: (id: string) => string
  act: (a: StashAction) => Promise<boolean>
}) {
  const { items } = getStash(party)
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [note, setNote] = useState('')
  const [removing, setRemoving] = useState<(typeof items)[number] | null>(null)
  const add = async () => {
    const srd = ITEM_BY_NAME.get(name.trim().toLowerCase())
    const ok = await act({ type: 'add', name: srd?.name ?? name, qty: Number(qty) || 1, itemId: srd?.id, note })
    if (ok) { setName(''); setQty('1'); setNote('') }
  }

  return (
    <div className="loot">
      <h4 className="glass-eyebrow">Items</h4>
      {items.length === 0
        ? <p className="muted small">Nothing yet. Add loot as the party finds it.</p>
        : (
          <ul className="stash-items">
            {items.map(it => {
              const mine = it.heldBy === userId
              return (
                <li key={it.id}>
                  <div className="grow">
                    <span className="strong">{it.name}</span>
                    {it.note && <span className="muted small"> · {it.note}</span>}
                    <div className="muted small">{it.heldBy ? `Carried by ${mine ? 'you' : nameOf(it.heldBy)}` : 'In the party bag'}</div>
                  </div>
                  <div className="qty" role="group" aria-label={`${it.name} quantity`}>
                    <button className="glass-btn small ghost icon" onClick={() => act({ type: 'qty', id: it.id, delta: -1 })} aria-label={`Use one ${it.name}`}>−</button>
                    <span>{it.qty}</span>
                    <button className="glass-btn small ghost icon" onClick={() => act({ type: 'qty', id: it.id, delta: 1 })} aria-label={`Add one ${it.name}`}>+</button>
                  </div>
                  <button className="glass-btn small" onClick={() => act({ type: 'hold', id: it.id, carry: !mine })}>
                    {mine ? 'Put back' : it.heldBy ? 'Take it' : 'Carry'}
                  </button>
                  <button className="glass-btn small ghost icon" onClick={() => setRemoving(it)}
                    aria-label={`Remove ${it.name}`} title="Remove">✕</button>
                </li>
              )
            })}
          </ul>
        )}
      <ConfirmDialog open={!!removing} title={`Remove ${removing?.name ?? ''} from the stash?`} yes="Remove"
        onYes={() => { if (removing) void act({ type: 'remove', id: removing.id }) }} onClose={() => setRemoving(null)} />

      <form className="row add-item" onSubmit={e => { e.preventDefault(); if (name.trim()) add() }}>
        <input className="glass-field grow" list="stash-srd-items" value={name} onChange={e => setName(e.target.value)} placeholder="Item, e.g. Potion of Healing" aria-label="Item name" />
        <datalist id="stash-srd-items">{ITEMS.map(i => <option key={i.id} value={i.name} />)}</datalist>
        <input className="glass-field amount" type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} aria-label="Quantity" />
        <input className="glass-field grow" value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />
        <button className="glass-btn small prominent" disabled={!name.trim()}>Add item</button>
      </form>
    </div>
  )
}

function when(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  return new Date(iso).toLocaleDateString()
}
