// A player's sheet opened by the DM (or the admin): the whole sheet, view only, kept live as the player changes it.
// The character comes from this device when it is here (local campaigns, or the DM's own copy) and from the
// cloud party otherwise; when both exist the newer copy wins. Nothing here ever saves.
import { useEffect, useState } from 'react'
import { announce } from '../a11y'
import { useI18n } from '../i18n'
import type { Character } from '../model/character'
import { fetchAccountNames, fetchPartyCharacters, watchPartyCharacters } from '../party/cloud'
import type { Party } from '../party/types'
import { getCharacter, listProfiles, onCharactersChanged } from '../storage'
import { Sheet } from './CharacterSheet'
import { normalize } from './engine'
import type { Apply } from './types'

/** Loads the character from the device and the cloud, newest copy first; null when neither has it. */
export async function loadWatched(characterId: string): Promise<Character | null> {
  const [local, remote] = await Promise.all([
    getCharacter(characterId),
    fetchPartyCharacters([characterId]).then(l => l[0] ?? null, () => null),
  ])
  if (local && remote) return (local.updatedAt ?? '') >= (remote.updatedAt ?? '') ? local : remote
  return local ?? remote ?? null
}

const noop = () => {}

export function WatchSheet({ characterId, parties, onBack }: { characterId: string; parties?: Party[]; onBack: () => void }) {
  const [character, setCharacter] = useState<Character | null | undefined>(undefined)
  const [playerName, setPlayerName] = useState('')
  const [noticed, setNoticed] = useState(false)
  const { t } = useI18n()

  useEffect(() => {
    let live = true
    const load = () => loadWatched(characterId).then(c => { if (live) setCharacter(c ? normalize(c) : null) })
    load()
    const off = onCharactersChanged(id => { if (!id || id === characterId) load() })
    const offRemote = watchPartyCharacters([characterId], load)
    return () => { live = false; off(); offRemote() }
  }, [characterId])

  // The player who brings this character, named from a profile on this device or the account list.
  const ownerId = parties?.flatMap(p => p.members).find(m => m.characterId === characterId)?.userId ?? character?.ownerId
  useEffect(() => {
    if (!ownerId) return
    let live = true
    listProfiles().then(async list => {
      const own = list.find(p => p.id === ownerId)?.displayName
      const name = own ?? (await fetchAccountNames())[ownerId] ?? ''
      if (live) setPlayerName(name)
    })
    return () => { live = false }
  }, [ownerId])

  // The notice shows for a moment after a tap that would have changed something.
  useEffect(() => {
    if (!noticed) return
    const timer = setTimeout(() => setNoticed(false), 2500)
    return () => clearTimeout(timer)
  }, [noticed])

  if (character === undefined) return <div className="ff-sheet"><p className="hint">{t('common.loading')}</p></div>
  if (character === null) {
    return (
      <div className="ff-sheet">
        <p>{t('common.notFound')}</p>
        <button type="button" className="btn" onClick={onBack}>{t('common.back')}</button>
      </div>
    )
  }

  const name = playerName || t('party.unknownPlayer')
  const apply: Apply = () => {
    setNoticed(true)
    announce(t('sheet.viewOnlyNotice', { name }))
  }
  return <Sheet character={character} apply={apply} undo={noop} undoTo={noop} log={[]} onBack={onBack} viewOnly={{ playerName: name, noticed }} />
}
