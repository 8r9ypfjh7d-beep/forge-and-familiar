import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ROSTER } from '../accounts/roster'
import { getCloudStatus, onCloudChanged, type CharacterRow } from '../cloud'
import { useI18n, type MessageKey } from '../i18n'
import type { Character, UserProfile } from '../model/character'
import { deleteSnapshotsFor, downloadText } from '../portability'
import { decide, removeRequest, updateRequests, useRequests, type RequestStatus } from '../requests'
import {
  deleteCharacter, listAllCharacters, listProfiles, onCharactersChanged, saveCharacter, saveProfile,
} from '../storage'
import {
  deleteCloudCharacter, deleteCloudDm, loadCloud, moveCloudCharacter, pushCloudCharacter, unlinkCloudDevice, watchCloud, type CloudData,
} from './cloud'
import { buildBackup, cloudPeople, deviceOnly, hasUnsentEdits, keyRows, parseBackup, people } from './logic'
import { readDevice, removeKey, restoreDevice } from './store'
import './admin.css'

type Tab = 'people' | 'characters' | 'requests' | 'dmScreens' | 'device'
const TABS: Tab[] = ['people', 'characters', 'requests', 'dmScreens', 'device']
const STATUSES: RequestStatus[] = ['pending', 'later', 'granted', 'denied']

/**
 * For the admin account: everyone's accounts, characters and DM screens live from the server when
 * this device is signed in to it, plus DM requests and this device's raw data.
 */
export function AdminPage({ onOpenAs, onOpenSheet, onEdit, onOpenDm, onOpenCombat }: {
  /** Switches the app to that profile, making it first if it is a roster account with none here. */
  onOpenAs: (id: string) => void
  onOpenSheet: (id: string) => void
  onEdit: (id: string) => void
  onOpenDm: () => void
  onOpenCombat: () => void
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

  // The server's copy of everyone, reloaded whenever a character or DM screen changes there.
  const [status, setStatus] = useState(getCloudStatus)
  useEffect(() => onCloudChanged(() => setStatus(getCloudStatus())), [])
  const [cloud, setCloud] = useState<CloudData | null | undefined>(undefined)
  const reloadCloud = useCallback(() => loadCloud().then(setCloud), [])
  useEffect(() => {
    if (status !== 'linked') { setCloud(undefined); return }
    void reloadCloud()
    return watchCloud(() => void reloadCloud())
  }, [status, reloadCloud])

  const everyone = people(ROSTER, profiles, characters)
  const nameOf = (id: string) => cloud?.accounts.find(a => a.id === id)?.name ?? everyone.find(p => p.id === id)?.name ?? id

  const openAs = async (id: string) => {
    if (!profiles.some(p => p.id === id)) await saveProfile({ id, displayName: nameOf(id) })
    onOpenAs(id)
  }

  const tabs = TABS.filter(k => k !== 'dmScreens' || cloud)
  const note: MessageKey = status === 'off' ? 'admin.deviceOnly'
    : status === 'unlinked' ? 'admin.signInToServer'
    : cloud === null ? 'admin.serverDown'
    : 'admin.serverLive'

  return (
    <section className="ff-admin">
      <div className="admin-head">
        <h2 className="glass-title">{t('admin.title')}</h2>
        <span className="row">
          <button className="glass-btn small" onClick={onOpenDm}>{t('admin.openDm')}</button>
          <button className="glass-btn small" onClick={onOpenCombat}>{t('admin.openCombat')}</button>
        </span>
      </div>
      <p className="glass admin-card admin-note small">
        {t(note)}
        {cloud === null && <> <button className="glass-btn small" onClick={reloadCloud}>{t('admin.retry')}</button></>}
      </p>
      <div className="glass-segmented admin-tabs" role="tablist">
        {tabs.map(k => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : undefined} onClick={() => setTab(k)}>
            {t(`admin.tab.${k}` as MessageKey)}
          </button>
        ))}
      </div>
      {tab === 'people' && cloud && <CloudPeopleTab cloud={cloud} onOpenAs={openAs} onChanged={reloadCloud} />}
      {tab === 'people' && !cloud && (
        <div className="glass admin-card">
          <table className="admin-table">
            <thead><tr><th>{t('admin.name')}</th><th>{t('admin.role')}</th><th>{t('admin.characters')}</th><th /></tr></thead>
            <tbody>
              {everyone.map(p => (
                <tr key={p.id}>
                  <td>{p.name}<div className="muted small" dir="ltr">{p.id}</div></td>
                  <td data-label={t('admin.role')}>
                    {p.account ? t(p.role === 'dm' ? 'admin.role.dm' : 'admin.role.player') : t(p.local ? 'admin.role.local' : 'admin.role.missing')}
                    {p.admin && <> · {t('admin.role.admin')}</>}
                  </td>
                  <td data-label={t('admin.characters')}>{p.characters}</td>
                  <td className="admin-actions">{(p.account || p.local) && <button className="glass-btn small" onClick={() => openAs(p.id)}>{t('admin.openAs')}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'characters' && cloud && (
        <CloudCharactersTab
          cloud={cloud} local={characters} nameOf={nameOf} onOpenSheet={onOpenSheet} onEdit={onEdit} onChanged={reloadCloud}
          deviceList={<CharactersTab characters={deviceOnly(characters, cloud.characters)} owners={everyone} nameOf={nameOf} onOpenSheet={onOpenSheet} onEdit={onEdit} />}
        />
      )}
      {tab === 'characters' && !cloud && (
        <CharactersTab characters={characters} owners={everyone} nameOf={nameOf} onOpenSheet={onOpenSheet} onEdit={onEdit} />
      )}
      {tab === 'requests' && <RequestsTab />}
      {tab === 'dmScreens' && cloud && <CloudDmTab cloud={cloud} nameOf={nameOf} onOpenAs={openAs} onChanged={reloadCloud} />}
      {tab === 'device' && <DeviceTab nameOf={nameOf} />}
    </section>
  )
}

function CloudPeopleTab({ cloud, onOpenAs, onChanged }: {
  cloud: CloudData
  onOpenAs: (id: string) => void
  onChanged: () => void
}) {
  const { t, date } = useI18n()
  const list = cloudPeople(cloud.accounts, cloud.devices, cloud.characters, cloud.dm)
  return (
    <div className="glass admin-card">
      <table className="admin-table">
        <thead><tr><th>{t('admin.name')}</th><th>{t('admin.role')}</th><th>{t('admin.onServer')}</th><th>{t('admin.devices')}</th><th /></tr></thead>
        <tbody>
          {list.map(p => (
            <tr key={p.id}>
              <td>{p.name}<div className="muted small" dir="ltr">{p.id}</div></td>
              <td data-label={t('admin.role')}>{t(p.role === 'dm' ? 'admin.role.dm' : 'admin.role.player')}{p.admin && <> · {t('admin.role.admin')}</>}</td>
              <td data-label={t('admin.onServer')} className="small">
                {t('admin.characterCount', { count: p.characters })}
                {p.lastSaved && <div className="muted">{t('admin.lastSaved', { when: date(p.lastSaved) })}</div>}
                {p.dmSavedAt && <div className="muted">{t('admin.hasDm', { when: date(p.dmSavedAt) })}</div>}
              </td>
              <td data-label={t('admin.devices')} className="small">
                {p.devices.length === 0 && <span className="muted">{t('admin.noDevices')}</span>}
                {p.devices.map(d => (
                  <div key={d.userId} className="row">
                    <span>{date(d.linkedAt)}</span>
                    <button
                      className="glass-btn small danger"
                      onClick={async () => { if (confirm(t('admin.confirmUnlink', { name: p.name }))) { await unlinkCloudDevice(d.userId); onChanged() } }}
                    >{t('admin.unlink')}</button>
                  </div>
                ))}
              </td>
              <td className="admin-actions"><button className="glass-btn small" onClick={() => onOpenAs(p.id)}>{t('admin.openAs')}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CloudCharactersTab({ cloud, local, nameOf, onOpenSheet, onEdit, onChanged, deviceList }: {
  cloud: CloudData
  local: Character[]
  nameOf: (id: string) => string
  onOpenSheet: (id: string) => void
  onEdit: (id: string) => void
  onChanged: () => void
  /** Characters only this device has, shown below the server's. */
  deviceList: ReactNode
}) {
  const { t, classLine, date } = useI18n()
  const [busy, setBusy] = useState(false)
  const sorted = [...cloud.characters].sort((a, b) => nameOf(a.owner_id).localeCompare(nameOf(b.owner_id)) || a.data.name.localeCompare(b.data.name))
  const onDevice = (id: string) => local.find(c => c.id === id)

  // The sheet and builder read this device's store, so bring the server's copy here first if it is newer.
  const bringHere = async (row: CharacterRow) => {
    const mine = onDevice(row.id)
    if (!mine || (mine.updatedAt ?? '') < row.updated_at) await saveCharacter(row.data)
  }
  const act = async (fn: () => Promise<boolean>) => {
    setBusy(true)
    const ok = await fn()
    setBusy(false)
    if (!ok) alert(t('admin.serverFailed'))
    onChanged()
  }

  return (
    <>
      <div className="glass admin-card">
        {sorted.length === 0 && <p className="muted">{t('admin.noServerCharacters')}</p>}
        {sorted.length > 0 && (
          <table className="admin-table">
            <thead><tr><th>{t('admin.character')}</th><th>{t('admin.owner')}</th><th>{t('admin.updated')}</th><th /></tr></thead>
            <tbody>
              {sorted.map(row => (
                <tr key={row.id}>
                  <td>{row.data.name}<div className="muted small">{classLine(row.data.classes ?? [])}</div></td>
                  <td data-label={t('admin.owner')}>
                    <select
                      className="glass-field"
                      value={row.owner_id}
                      disabled={busy}
                      aria-label={t('admin.moveTo', { name: row.data.name })}
                      onChange={e => {
                        const owner = e.target.value
                        void act(async () => {
                          const ok = await moveCloudCharacter(row, owner)
                          const mine = onDevice(row.id)
                          if (ok && mine) await saveCharacter({ ...mine, ownerId: owner })
                          return ok
                        })
                      }}
                    >
                      {cloud.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </td>
                  <td data-label={t('admin.updated')} className="small">{date(row.updated_at)}</td>
                  <td className="admin-actions">
                    <div className="row">
                      {hasUnsentEdits(onDevice(row.id), row) && (
                        <button
                          className="glass-btn prominent small"
                          disabled={busy}
                          title={t('admin.sendEditsHint')}
                          onClick={() => void act(() => pushCloudCharacter(row, onDevice(row.id)!))}
                        >{t('admin.sendEdits')}</button>
                      )}
                      <button className="glass-btn small" onClick={async () => { await bringHere(row); onOpenSheet(row.id) }}>{t('common.openSheet')}</button>
                      <button className="glass-btn small" onClick={async () => { await bringHere(row); onEdit(row.id) }}>{t('list.edit')}</button>
                      <button
                        className="glass-btn small danger"
                        disabled={busy}
                        onClick={() => {
                          if (!confirm(t('admin.confirmDeleteEverywhere', { name: row.data.name }))) return
                          void act(async () => {
                            const ok = await deleteCloudCharacter(row)
                            if (ok && onDevice(row.id)) {
                              await deleteCharacter(row.id)
                              await deleteSnapshotsFor(row.id)
                            }
                            return ok
                          })
                        }}
                      >{t('common.delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {local.some(c => !cloud.characters.some(r => r.id === c.id)) && (
        <>
          <h3 className="glass-eyebrow admin-sub">{t('admin.deviceOnlyCharacters')}</h3>
          {deviceList}
        </>
      )}
    </>
  )
}

function CloudDmTab({ cloud, nameOf, onOpenAs, onChanged }: {
  cloud: CloudData
  nameOf: (id: string) => string
  onOpenAs: (id: string) => void
  onChanged: () => void
}) {
  const { t, date } = useI18n()
  if (cloud.dm.length === 0) return <p className="glass admin-card muted">{t('admin.noDmScreens')}</p>
  return (
    <div className="glass admin-card">
      <p className="muted small">{t('admin.dmScreensHint')}</p>
      <table className="admin-table">
        <thead><tr><th>{t('admin.name')}</th><th>{t('admin.dmContents')}</th><th>{t('admin.updated')}</th><th /></tr></thead>
        <tbody>
          {cloud.dm.map(d => (
            <tr key={d.account_id}>
              <td>{nameOf(d.account_id)}</td>
              <td data-label={t('admin.dmContents')} className="small">{t('admin.dmCounts', { plans: d.data.plans?.length ?? 0, npcs: d.data.npcs?.length ?? 0 })}</td>
              <td data-label={t('admin.updated')} className="small">{date(d.updated_at)}</td>
              <td className="admin-actions">
                <div className="row">
                  <button className="glass-btn small" onClick={() => onOpenAs(d.account_id)}>{t('admin.openAs')}</button>
                  <button
                    className="glass-btn small danger"
                    onClick={async () => {
                      if (!confirm(t('admin.confirmDeleteDm', { name: nameOf(d.account_id) }))) return
                      if (!(await deleteCloudDm(d.account_id))) alert(t('admin.serverFailed'))
                      onChanged()
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

function CharactersTab({ characters, owners, nameOf, onOpenSheet, onEdit }: {
  characters: Character[]
  owners: { id: string; name: string }[]
  nameOf: (id: string) => string
  onOpenSheet: (id: string) => void
  onEdit: (id: string) => void
}) {
  const { t, classLine, date } = useI18n()
  if (characters.length === 0) return <p className="glass admin-card muted">{t('admin.noCharacters')}</p>
  const sorted = [...characters].sort((a, b) => nameOf(a.ownerId).localeCompare(nameOf(b.ownerId)) || a.name.localeCompare(b.name))
  return (
    <div className="glass admin-card">
      <table className="admin-table">
        <thead><tr><th>{t('admin.character')}</th><th>{t('admin.owner')}</th><th>{t('admin.updated')}</th><th /></tr></thead>
        <tbody>
          {sorted.map(c => (
            <tr key={c.id}>
              <td>{c.name}<div className="muted small">{classLine(c.classes)}</div></td>
              <td data-label={t('admin.owner')}>
                <select
                  className="glass-field"
                  value={c.ownerId}
                  aria-label={t('admin.moveTo', { name: c.name })}
                  onChange={e => saveCharacter({ ...c, ownerId: e.target.value })}
                >
                  {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </td>
              <td data-label={t('admin.updated')} className="small">{c.updatedAt ? date(c.updatedAt) : ''}</td>
              <td className="admin-actions">
                <div className="row">
                  <button className="glass-btn small" onClick={() => onOpenSheet(c.id)}>{t('common.openSheet')}</button>
                  <button className="glass-btn small" onClick={() => onEdit(c.id)}>{t('list.edit')}</button>
                  <button
                    className="glass-btn small danger"
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
  if (list.length === 0) return <p className="glass admin-card muted">{t('admin.noRequests')}</p>
  const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <div className="glass admin-card">
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
              <td data-label={t('admin.from')}>{r.fromName}<div className="muted small">{r.characterName} · {date(r.createdAt)}</div></td>
              <td data-label={t('admin.status')}>
                <select
                  className="glass-field"
                  value={r.status}
                  aria-label={t('admin.status')}
                  onChange={e => updateRequests(l => decide(l, r.id, e.target.value as RequestStatus, new Date().toISOString()))}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{t(`admin.status.${s}` as MessageKey)}</option>)}
                </select>
              </td>
              <td className="admin-actions">
                <button
                  className="glass-btn small danger"
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
    <div className="glass admin-card">
      <p className="muted small">{t('admin.backupHint')}</p>
      <div className="row">
        <button
          className="glass-btn prominent small"
          onClick={() => downloadText(`forge-and-familiar-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(buildBackup(readDevice(), new Date().toISOString()), null, 1))}
        >{t('admin.download')}</button>
        <button className="glass-btn small" onClick={() => file.current?.click()}>{t('admin.restore')}</button>
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
              <td data-label={t('admin.size')} className="small">
                <span dir="ltr">{kb(r.bytes)}</span>{r.items !== undefined && <div className="muted">{t('admin.items', { count: r.items })}</div>}
              </td>
              <td className="admin-actions">
                <button
                  className="glass-btn small danger"
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
