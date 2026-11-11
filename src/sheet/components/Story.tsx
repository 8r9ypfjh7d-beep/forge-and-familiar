import { useEffect, useRef } from 'react'
import { useI18n } from '../../i18n'
import type { Character } from '../../model/character'
import { BackstoryHelper } from '../../backstory'
import { MyNotes } from '../../notes/PartyNotes'
import { oldNotesToNote } from '../../notes/logic'
import { hasNote, saveNote } from '../../notes/store'
import type { Party } from '../../party/types'
import { setNotes } from '../engine'
import type { Apply } from '../types'

/**
 * "My notes": the player's notes in the campaign this character plays in (src/notes). Shown only when the
 * character is in the campaign in play; a character outside a campaign has no notes card. Text from the old
 * private Notes box moves in once as the player's first "only me" note.
 */
export function Notes({ character, apply, party, userId }: { character: Character; apply: Apply; party?: Party; userId?: string }) {
  const { t } = useI18n()
  const old = character.notes.trim()
  const moving = useRef(false)
  useEffect(() => {
    if (!party || !userId || !old || moving.current) return
    moving.current = true
    const note = oldNotesToNote(party.id, userId, character.id, old, t('notes.oldTitle', { name: character.name }))
    void (async () => {
      if (!hasNote(note.id)) await saveNote(note)
      apply(t('notes.oldMoved'), c => setNotes(c, ''))
      moving.current = false
    })()
  }, [party, userId, old, character.id, character.name, apply, t])
  if (!party || !userId) return null
  const addBackstory = (text: string) => {
    const at = new Date().toISOString()
    void saveNote({ id: crypto.randomUUID(), partyId: party.id, authorId: userId, kind: 'page', title: t('backstory.title'), text, category: 'other', to: 'me', createdAt: at, updatedAt: at })
  }
  return (
    <MyNotes party={party} userId={userId}>
      <BackstoryHelper character={character} apply={apply} onAdd={addBackstory} />
    </MyNotes>
  )
}
