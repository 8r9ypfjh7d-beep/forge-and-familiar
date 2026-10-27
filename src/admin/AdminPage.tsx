import { useEffect, useRef, useState } from 'react'
import { ROSTER } from '../accounts/roster'
import { useI18n, type MessageKey } from '../i18n'
import type { Character, UserProfile } from '../model/character'
import { deleteSnapshotsFor, downloadText } from '../portability'
import { decide, removeRequest, updateRequests, useRequests, type RequestStatus } from '../requests'
import {
  deleteCharacter, listAllCharacters, listProfiles, onCharactersChanged, saveCharacter, saveProfile,
} from '../storage'
import { buildBackup, keyRows, parseBackup, people } from './logic'
import { readDevice, removeKey, restoreDevice } from './store'
import './admin.css'

type Tab = 'people' | 'characters' | 'requests' | 'device'
const TABS: Tab[] = ['people', 'characters', 'requests', 'device']
const STATUSES: RequestStatus[] = ['pending', 'later', 'granted', 'denied']

/** Everything saved on this device, for the admin account: people, characters, DM requests and raw data. */
export function AdminPage({ onOpenAs, onOpenSheet, onEdit, onOpenDm }: {
  /** Switches the app to that profile, making it first if it is a roster account with none here. */
  onOpenAs: (id: string) => void
  onOpenSheet: (id: string) => void
  onEdit: (id: string) => void
  onOpenDm: () => void
}) {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('people')
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [characters, setCharacters] = useState<Character[]>([])

  useEffect(() => {
    const load = () => Promise.all([listProfiles(), listAllCharacters()]).then(([p, c]) => { setProfiles(p); setCharacters(c) })
    load()
    return onCharactersChanged(load)
  }, [])

  const everyone = people(ROSTER, profiles, characters)
  const nameOf = (id: string) => everyone.find(p => p.id === id)?.name ?? id

  const openAs = async (id: string) => {
    if (!profiles.some(p => p.id === id)) await saveProfile({ id, displayName: nameOf(id) })
    onOpenAs(id)
  }

  return (
    <section className="ff-admin">
      <div className="row spread">
        <h2>{t('admin.title')}</h2>
        <button className="btn small" onClick={onOpenDm}>{t('admin.openDm')}</button>
      </div>
      <p className="panel admin-note small">{t('admin.deviceOnly')}</p>
      <div className="row" role="tablist">
        {TABS.map(k => (
          <button key={k} role="tab" aria-selected={tab === k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
            {t(`admin.tab.${k}` as MessageKey)}
          </button>
        ))}
      </div>
      {tab === 'people' && (
        <div className="panel">
          <table className="admin-table">
            <thead><tr><th>{t('admin.name')}</th><th>{t('admin.role')}</th><th>{t('admin.characters')}</th><th /></tr></thead>
            <tbody>
              {everyone.map(p => (
                <tr key={p.id}>
                  <td>{p.name}<div className="muted small" dir="ltr">{p.id}</div></td>
                  <td>
                    {p.account ? t(p.role === 'dm' ? 'admin.role.dm' : 'admin.role.player') : t(p.local ? 'admin.role.local' : 'admin.role.missing')}
                    {p.admin && <> · {t('admin.role.admin')}</>}
                  </td>
                  <td>{p.characters}</td>
                  <td>{(p.account || p.local) && <button className="btn small" onClick={() => openAs(p.id)}>{t('admin.openAs')}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'characters' && (
        <CharactersTab characters={characters} owners={everyone} nameOf={nameOf} onOpenSheet={onOpenSheet} onEdit={onEdit} />
      )}
      {tab === 'requests' && <RequestsTab />}
      {tab === 'device' && <DeviceTab nameOf={nameOf} />}
    </section>
  )
}

function CharactersTab({ characters, owners, nameOf, onOpenSheet, onEdit }: {
  characters: Character[]
  owners: { id: string; name: string }[]
  nameOf: (id: string) => string
  onOpenSheet: (id: string) => void
  onEdit: (id: string) => void
}) {
  const { t, classLine, date } = useI18n()
  if (characters.length === 0) return <p className="panel muted">{t('admin.noCharacters')}</p>
  const sorted = [...characters].sort((a, b) => nameOf(a.ownerId).localeCompare(nameOf(b.ownerId)) || a.name.localeCompare(b.name))
  return (
    <div className="panel">
      <table className="admin-table">
        <thead><tr><th>{t('admin.character')}</th><th>{t('admin.owner')}</th><th>{t('admin.updated')}</th><th /></tr></thead>
        <tbody>
          {sorted.map(c => (
            <tr key={c.id}>
              <td>{c.name}<div className="muted small">{classLine(c.classes)}</div></td>
              <td>
                <select
                  value={c.ownerId}
                  aria-label={t('admin.moveTo', { name: c.name })}
                  onChange={e => saveCharacter({ ...c, ownerId: e.target.value })}
                >
                  {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </td>
              <td className="small">{c.updatedAt ? date(c.updatedAt) : ''}</td>
              <td>
                <div className="row">
                  <button className="btn primary small" onClick={() => onOpenSheet(c.id)}>{t('common.openSheet')}</button>
                  <button className="btn small" onClick={() => onEdit(c.id)}>{t('list.edit')}</button>
                  <button
                    className="btn ghost small"
                    onClick={async () => {
                      if (!confirm(t('list.confirmDelete', { name: c.name }))) return
                      await deleteCharacter(c.id)
                      await deleteSnapshotsFor(c.id)
                    }}
                  >{t('common.delete')}</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RequestsTab() {
  const { t, date } = useI18n()
  const list = useRequests()
  if (list === null) return null
  if (list.length === 0) return <p className="panel muted">{t('admin.noRequests')}</p>
  const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <div className="panel">
      <p className="muted small">{t('admin.requestsHint')}</p>
      <table className="admin-table">
        <thead><tr><th>{t('admin.request')}</th><th>{t('admin.from')}</th><th>{t('admin.status')}</th><th /></tr></thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.id}>
              <td>
                {r.title} <span className="muted small">· {t(`req.kind.${r.kind}` as MessageKey)}</span>
                {r.details && <div className="muted small">{r.details}</div>}
              </td>
              <td>{r.fromName}<div className="muted small">{r.characterName} · {date(r.createdAt)}</div></td>
              <td>
                <select
                  value={r.status}
                  aria-label={t('admin.status')}
                  onChange={e => updateRequests(l => decide(l, r.id, e.target.value as RequestStatus, new Date().toISOString()))}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{t(`admin.status.${s}` as MessageKey)}</option>)}
                </select>
              </td>
              <td>
                <button
                  className="btn ghost small"
                  onClick={() => confirm(t('admin.confirmDeleteRequest', { title: r.title })) && updateRequests(l => removeRequest(l, r.id))}
                >{t('common.delete')}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DeviceTab({ nameOf }: { nameOf: (id: string) => string }) {
  const { t } = useI18n()
  const [rows, setRows] = useState(() => keyRows(readDevice()))
  const [error, setError] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const reload = () => setRows(keyRows(readDevice()))
  const total = rows.reduce((n, r) => n + r.bytes, 0)

  return (
    <div className="panel">
      <p className="muted small">{t('admin.backupHint')}</p>
      <div className="row">
        <button
          className="btn primary small"
          onClick={() => downloadText(`forge-and-familiar-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(buildBackup(readDevice(), new Date().toISOString()), null, 1))}
        >{t('admin.download')}</button>
        <button className="btn small" onClick={() => file.current?.click()}>{t('admin.restore')}</button>
        <input
          ref={file} type="file" accept="application/json,.json" hidden
          onChange={async e => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            const backup = parseBackup(await f.text())
            setError(!backup)
            if (backup && confirm(t('admin.confirmRestore'))) {
              restoreDevice(backup)
              location.reload()
            }
          }}
        />
        {error && <p className="bad small" role="alert">{t('admin.badBackup')}</p>}
      </div>
      <table className="admin-table">
        <thead><tr><th>{t('admin.what')}</th><th>{t('admin.size')}</th><th /></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key}>
              <td>
                {t(`admin.key.${r.kind}` as MessageKey)}{r.ownerId && <> · {nameOf(r.ownerId)}</>}
                <div className="muted small" dir="ltr">{r.key}</div>
              </td>
              <td className="small">
                <span dir="ltr">{kb(r.bytes)}</span>{r.items !== undefined && <div className="muted">{t('admin.items', { count: r.items })}</div>}
              </td>
              <td>
                <button
                  className="btn ghost small"
                  onClick={() => { if (confirm(t('admin.confirmDeleteKey', { key: r.key }))) { removeKey(r.key); reload() } }}
                >{t('common.delete')}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">{t('admin.total', { size: kb(total) })}</p>
    </div>
  )
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`
