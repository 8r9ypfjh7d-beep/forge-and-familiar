import { useI18n } from '../i18n'
import type { Party } from './types'

/** The campaign switch in the player menu. */
export function PartySwitcher({ parties, party, onPick }: { parties: Party[]; party?: Party; onPick: (partyId: string | null) => void }) {
  const { t } = useI18n()
  if (parties.length === 0) return null
  return (
    <div className="row profile">
      <label className="muted small" htmlFor="campaign">{t('party.pick.campaign')}</label>
      <select id="campaign" value={party?.id ?? ''} onChange={e => onPick(e.target.value || null)}>
        {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        <option value="">{t('party.pick.none')}</option>
      </select>
    </div>
  )
}
