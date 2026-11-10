// The DM screen's Party tab: the players' cards (HP, AC, passive Perception, open sheet), party level and XP, and
// Inspiration and rewards. The campaign page keeps only the table's admin for the DM (invite, next session, stash).
import { useI18n } from '../i18n'
import { GiveRewards, GiveXp, PartyLevelUp, type Party } from '../party'
import { usePartyCharacters } from '../party/PartyLevelUp'
import { MemberCard } from '../party/PartyView'
import '../party/party.css'

export function PartyTab({ party, userId, nameOf, onOpenSheet }: {
  party: Party
  userId: string
  nameOf: (userId: string) => string
  /** Opens a player's sheet, view only. */
  onOpenSheet?: (characterId: string) => void
}) {
  const { t } = useI18n()
  const { chars } = usePartyCharacters(party)
  const players = party.members.filter(m => m.userId !== party.dmId)
  const characters = chars ?? {}
  return (
    <div className="ff-party dm-party">
      {players.length === 0
        ? <p className="hint">{t('dm.sheetsNone')}</p>
        : (
          <div className="member-grid">
            {players.map(m => (
              <MemberCard key={m.userId} member={m} playerName={nameOf(m.userId)} isDm={false} mine={false}
                character={m.characterId ? characters[m.characterId] : undefined}
                onOpen={m.characterId && onOpenSheet ? () => onOpenSheet(m.characterId!) : undefined} />
            ))}
          </div>
        )}
      <PartyLevelUp party={party} userId={userId} />
      <GiveXp party={party} userId={userId} characters={characters} nameOf={nameOf} milestone={false} />
      <GiveRewards party={party} userId={userId} nameOf={nameOf} />
    </div>
  )
}
