import { useState } from 'react'
import { ConfirmDialog } from '../builder/ConfirmDialog'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import { ITEMS } from '../rules'
import { COINS, getStash, parseStashLog, splitCoins, toCp, type StashAction } from './stash'
import { updateStash } from './store'
import type { Coin, Coins, Party } from './types'

type I18n = ReturnType<typeof useI18n>

/** "12 gp 5 sp" in the current language. Zero coins are left out; an empty purse reads "0 gp". */
function coinText(c: Partial<Coins>, t: I18n['t']): string {
  const parts = COINS.filter(k => (c[k] ?? 0) !== 0).map(k => `${c[k]} ${t(`stash.coin.${k}`)}`)
  return parts.length ? parts.join(' ') : `0 ${t('stash.coin.gp')}`
}

const ITEM_BY_NAME = new Map(ITEMS.map(i => [i.name.toLowerCase(), i]))

/** Shows an item name in the current language (SRD items only; homebrew names stay as typed). */
function itemText(name: string, itemId: string | undefined, i18n: I18n): string {
  const id = itemId ?? ITEM_BY_NAME.get(name.toLowerCase())?.id
  return id ? i18n.item(id, name) : name
}

const ERRORS: Record<string, MessageKey> = {
  "You're not in this party.": 'stash.err.notMember',
  "Can't reach the party right now. Try again when you're online.": 'stash.err.offline',
  'Give the item a name.': 'stash.err.noName',
  'Quantity must be at least 1.': 'stash.err.qty',
  'That item is gone.': 'stash.err.gone',
  "The stash doesn't have those coins.": 'stash.err.noCoins',
  'Nobody to split with.': 'stash.err.nobody',
  'Not enough coin to split.': 'stash.err.tooLittle',
}

/** The English log line the stash stores, shown in the current language. */
function logText(text: string, i18n: I18n): string {
  const { t } = i18n
  const p = parseStashLog(text)
  switch (p.kind) {
    case 'added': case 'used': case 'removed': case 'carrying': case 'putBack': {
      const name = itemText(p.name, undefined, i18n)
      return t(`stash.log.${p.kind}`, { what: p.qty === 1 ? name : t('stash.qtyName', { qty: p.qty, name }) })
    }
    case 'coins': {
      const words = [
        p.added && t('stash.log.coinsAdded', { coins: coinText(p.added, t) }),
        p.took && t('stash.log.coinsTook', { coins: coinText(p.took, t) }),
      ].filter(Boolean).join(', ')
      return p.reason ? `${words} (${p.reason})` : words
    }
    case 'split': return t('stash.log.split', { ways: p.ways, coins: coinText(p.share, t) })
    case 'milestone': return t('stash.log.milestone', { who: p.who })
    case 'toLevel': return t('stash.log.toLevel', { who: p.who, level: p.level })
    case 'xp': return t('stash.log.xp', { xp: p.xp, who: p.who })
    default: return p.text
  }
}

/** Shared loot and gold for one party. Every member can change it; the log says who did what. */
export function PartyStash({ party, userId, nameOf }: { party: Party; userId: string; nameOf: (id: string) => string }) {
  const i18n = useI18n()
  const { t } = i18n
  const stash = getStash(party)
  const [error, setError] = useState('')
  const act = async (action: StashAction) => {
    const res = await updateStash(party.id, userId, action)
    setError(res.ok ? '' : ERRORS[res.reason] ? t(ERRORS[res.reason]) : res.reason)
    return res.ok
  }
  // Split among members who bring a character; the DM watching doesn't take a share.
  const players = party.members.filter(m => m.characterId).length

  return (
    <section className="glass stash" aria-labelledby="stash-title">
      <div className="stash-head">
        <h3 id="stash-title">{t('stash.title')}</h3>
        <span className="muted small">{t('stash.intro')}</span>
      </div>

      <div className="stash-cols">
        <CoinPurse coins={stash.coins} players={players} act={act} />
        <ItemList party={party} userId={userId} nameOf={nameOf} act={act} />
      </div>

      {error && <p className="bad small" role="alert">{error}</p>}

      {stash.log.length > 0 && (
        <details className="stash-log">
          <summary className="small strong">{t('stash.recent')}</summary>
          <ul>
            {stash.log.map((e, i) => (
              <li key={i} className="small">
                <strong>{nameOf(e.userId)}</strong> {logText(e.text, i18n)}
                <time className="muted" dateTime={e.at}>{when(e.at, i18n)}</time>
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
  const { t } = useI18n()
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
      <h4 className="glass-eyebrow">{t('stash.coin')}</h4>
      <dl className="coins">
        {COINS.map(k => <div key={k} className={coins[k] ? '' : 'none'}><dt>{t(`stash.coin.${k}`)}</dt><dd>{coins[k]}</dd></div>)}
      </dl>
      <p className="muted small">{t('stash.worth', { coins: coinText({ gp: Math.floor(toCp(coins) / 100) }, t) })}</p>

      <form className="row" onSubmit={e => { e.preventDefault(); if (valid) move(1) }}>
        <input className="glass-field amount" type="number" min={1} inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder={t('stash.amount')} aria-label={t('stash.amount')} />
        <select className="glass-field" value={coin} onChange={e => setCoin(e.target.value as Coin)} aria-label={t('stash.coin')}>
          {COINS.map(k => <option key={k} value={k}>{t(`stash.coin.${k}`)}</option>)}
        </select>
        <input className="glass-field grow" value={reason} onChange={e => setReason(e.target.value)} placeholder={t('stash.reasonPlaceholder')} aria-label={t('stash.reason')} />
        <button className="glass-btn small prominent" disabled={!valid}>{t('stash.add')}</button>
        <button type="button" className="glass-btn small" disabled={!valid} onClick={() => move(-1)}>{t('stash.take')}</button>
      </form>

      <button className="glass-btn small" disabled={!canSplit} onClick={() => setSplitting(true)}>
        {canSplit ? t('stash.splitWays', { count: players, coins: coinText(split.share, t) }) : t('stash.splitAmong')}
      </button>
      <ConfirmDialog open={splitting} title={t('stash.splitConfirm', { count: players, coins: coinText(split.share, t) })} yes={t('stash.split')}
        onYes={() => void act({ type: 'split', ways: players })} onClose={() => setSplitting(false)} />
      {canSplit && split.leftoverCp > 0 && <p className="muted small">{t('stash.leftover', { count: split.leftoverCp })}</p>}
    </div>
  )
}

function ItemList({ party, userId, nameOf, act }: {
  party: Party
  userId: string
  nameOf: (id: string) => string
  act: (a: StashAction) => Promise<boolean>
}) {
  const i18n = useI18n()
  const { t } = i18n
  const { items } = getStash(party)
  // Typed names match SRD items in English or in the current language.
  const byName = new Map(ITEMS.flatMap(i => [[i.name.toLowerCase(), i], [i18n.item(i.id, i.name).toLowerCase(), i]] as const))
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [note, setNote] = useState('')
  const [removing, setRemoving] = useState<(typeof items)[number] | null>(null)
  const add = async () => {
    const srd = byName.get(name.trim().toLowerCase())
    const ok = await act({ type: 'add', name: srd?.name ?? name, qty: Number(qty) || 1, itemId: srd?.id, note })
    if (ok) { setName(''); setQty('1'); setNote('') }
  }

  return (
    <div className="loot">
      <h4 className="glass-eyebrow">{t('stash.items')}</h4>
      {items.length === 0
        ? <p className="muted small">{t('stash.empty')}</p>
        : (
          <ul className="stash-items">
            {items.map(it => {
              const mine = it.heldBy === userId
              return (
                <li key={it.id}>
                  <div className="grow">
                    <span className="strong">{itemText(it.name, it.itemId, i18n)}</span>
                    {it.note && <span className="muted small"> · {it.note}</span>}
                    <div className="muted small">{mine ? t('stash.carriedByYou') : it.heldBy ? t('stash.carriedBy', { name: nameOf(it.heldBy) }) : t('stash.inBag')}</div>
                  </div>
                  <div className="qty" role="group" aria-label={t('stash.qtyLabel', { name: itemText(it.name, it.itemId, i18n) })}>
                    <button className="glass-btn small ghost icon" onClick={() => act({ type: 'qty', id: it.id, delta: -1 })} aria-label={t('stash.useOne', { name: itemText(it.name, it.itemId, i18n) })}>−</button>
                    <span>{it.qty}</span>
                    <button className="glass-btn small ghost icon" onClick={() => act({ type: 'qty', id: it.id, delta: 1 })} aria-label={t('stash.addOne', { name: itemText(it.name, it.itemId, i18n) })}>+</button>
                  </div>
                  <button className="glass-btn small" onClick={() => act({ type: 'hold', id: it.id, carry: !mine })}>
                    {mine ? t('stash.putBack') : it.heldBy ? t('stash.takeIt') : t('stash.carry')}
                  </button>
                  <button className="glass-btn small ghost icon" onClick={() => setRemoving(it)}
                    aria-label={t('stash.removeLabel', { name: itemText(it.name, it.itemId, i18n) })} title={t('stash.remove')}>✕</button>
                </li>
              )
            })}
          </ul>
        )}
      <ConfirmDialog open={!!removing} title={t('stash.removeConfirm', { name: removing ? itemText(removing.name, removing.itemId, i18n) : '' })} yes={t('stash.remove')}
        onYes={() => { if (removing) void act({ type: 'remove', id: removing.id }) }} onClose={() => setRemoving(null)} />

      <form className="row add-item" onSubmit={e => { e.preventDefault(); if (name.trim()) add() }}>
        <input className="glass-field grow" list="stash-srd-items" value={name} onChange={e => setName(e.target.value)} placeholder={t('stash.itemPlaceholder')} aria-label={t('stash.itemName')} />
        <datalist id="stash-srd-items">{ITEMS.map(i => <option key={i.id} value={i18n.item(i.id, i.name)} />)}</datalist>
        <input className="glass-field amount" type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} aria-label={t('stash.quantity')} />
        <input className="glass-field grow" value={note} onChange={e => setNote(e.target.value)} placeholder={t('stash.notePlaceholder')} aria-label={t('stash.note')} />
        <button className="glass-btn small prominent" disabled={!name.trim()}>{t('stash.addItem')}</button>
      </form>
    </div>
  )
}

function when(iso: string, { t, locale }: I18n): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return t('stash.ago.now')
  if (mins < 60) return t('stash.ago.min', { n: mins })
  const hours = Math.round(mins / 60)
  if (hours < 24) return t('stash.ago.hours', { n: hours })
  return new Date(iso).toLocaleDateString(locale)
}
