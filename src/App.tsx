import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import './a11y'
import { AccessibilityDialog, SkipLink, useFocusOnChange, useShortcuts } from './a11y/ui'
import { AccountBadge, ActivateScreen, ActivationPromptHost, CloudLinkNotice, getSession, openActivationPrompt, isAdmin, onSessionChanged, type Session } from './accounts'
import { UnfinishedDraft } from './builder/UnfinishedDraft'
import { PromptDialog } from './builder/ConfirmDialog'
import { useLiveHits } from './combat/ui/useLiveHits'
import { loadDm, saveDm } from './dm/store'
import { useDmTools } from './dm/dmTools'
import { DmRequestToast, EditRequestDialog, editState, RequestsAgent, RequestsView, spendEditPass, updateRequests, useRequests, type EditState, type Shared } from './requests'
import { DiceFab, DiceProvider } from './dice/ui'
import { FamiliarFab, FamiliarPage, dmPrepare, screenFor } from './familiar/ui'
import type { Character, UserProfile } from './model/character'
import { deleteSnapshotsFor } from './portability'
import { campaignTarget, CampaignsHome, LevelUpPrompt, PartyRollRelay, PartySwitcher, PartyView, useActiveParty, useCharacterAccess, useXpAwards, type Party } from './party'
import { xpForNextLevel, xpReady } from './rules'
import { loadHomebrew } from './homebrew'
import { useI18n } from './i18n'
import { AppNav, canOpen, useHashView } from './nav'
import { CharacterList } from './list/CharacterList'
import { InstallMenuItem } from './pwa'
import { DuplicatePrompt, SyncBadge, useCloudSync } from './sync'
import { RevealMoment } from './lore'
import {
  deleteCharacter, getActiveProfileId, listCharacters, listProfiles, onCharactersChanged, saveCharacter, saveProfile,
  setActiveProfileId,
} from './storage'


const newId = () => crypto.randomUUID()

// Every screen but the home pages is its own chunk, fetched when first opened (and kept by the service worker),
// so a phone at the table parses only what it shows.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function screen<M, K extends keyof M>(load: () => Promise<M>, name: K): M[K] & ComponentType<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return lazy(async () => ({ default: (await load())[name] as ComponentType<any> })) as never
}
const AdminPage = screen(() => import('./admin/AdminPage'), 'AdminPage')
const Builder = screen(() => import('./builder/Builder'), 'Builder')
const EditCharacter = screen(() => import('./builder/Builder'), 'EditCharacter')
const LevelUp = screen(() => import('./builder/LevelUp'), 'LevelUp')
const CombatTracker = screen(() => import('./combat/ui/CombatTracker'), 'CombatTracker')
const DmScreen = screen(() => import('./dm/DmScreen'), 'DmScreen')
const LevelHistory = screen(() => import('./portability/ui/LevelHistory'), 'LevelHistory')
const RulesQA = screen(() => import('./rulesqa/RulesQA'), 'RulesQA')
const PlanView = screen(() => import('./planner/PlanView'), 'PlanView')
const PrintSheet = screen(() => import('./print/PrintSheet'), 'PrintSheet')
const Homebrew = screen(() => import('./homebrew/ui/Homebrew'), 'Homebrew')
const CharacterSheet = screen(() => import('./sheet/CharacterSheet'), 'CharacterSheet')
const WatchSheet = screen(() => import('./sheet/WatchSheet'), 'WatchSheet')
const NpcBuilder = screen(() => import('./npc/ui/NpcBuilder'), 'NpcBuilder')
const NpcScreen = screen(() => import('./npc/ui/NpcBuilder'), 'NpcScreen')
const StarterPicker = screen(() => import('./starters/StarterPicker'), 'StarterPicker')

// Register saved homebrew items with the rules engine before any sheet derives stats.
loadHomebrew()

export default function App() {
  const [profiles, setProfiles] = useState<UserProfile[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(getActiveProfileId())
  const [session, setSession] = useState<Session | null>(getSession)
  const [characters, setCharacters] = useState<Character[]>([])
  // The screen lives in the address bar (#/sheet/<id>): back, refresh and links keep your place. A bare visit opens Home.
  const [view, setView] = useHashView()
  // Where the printable sheet's Back goes: the sheet or the list it was opened from.
  const printFrom = useRef<'list' | 'sheet'>('list')
  const [diceOpen, setDiceOpen] = useState(false)
  const [familiarOpen, setFamiliarOpen] = useState(false)
  const [askEdit, setAskEdit] = useState<{ character: Character; note?: string; levelUp?: boolean } | null>(null)
  const requests = useRequests()
  const { t } = useI18n()
  const mainRef = useFocusOnChange<HTMLElement>(JSON.stringify(view))
  const a11yDialog = useRef<HTMLDialogElement>(null)
  useShortcuts({
    c: () => setView({ kind: 'list' }),
    b: () => setView({ kind: 'build' }),
    d: () => setDiceOpen(o => !o),
    p: () => setView({ kind: 'party' }),
    a: () => a11yDialog.current?.showModal(),
  })
  useEffect(() => {
    listProfiles().then(setProfiles)
  }, [])

  // Activating a code adds that friend's profile and makes it active.
  useEffect(() => onSessionChanged(async () => {
    const s = getSession()
    setSession(s)
    setProfiles(await listProfiles())
    if (s) {
      setActiveId(s.id)
      setView({ kind: 'campaigns' })
    }
  }), [setView])

  const active = profiles?.find(p => p.id === activeId) ?? profiles?.[0]

  const refresh = useCallback(() => {
    if (active) listCharacters(active.id).then(setCharacters)
  }, [active])
  useEffect(refresh, [refresh])
  // Characters pulled from the cloud show up without a reload.
  useEffect(() => onCharactersChanged(refresh), [refresh])
  useCloudSync(active?.id)

  // On entering the app the player picks the party (campaign) they play now. That party's DM gets the
  // DM pages (DM screen, combat tracker); everyone else gets the player pages. The admin (Ziv) also
  // opens the DM pages from the admin page. Roles follow the open profile, as for any player.
  const playing = useActiveParty(active?.id ?? '')
  const ownProfile = !!session && session.id === active?.id
  const admin = ownProfile && isAdmin(session.id)
  const partyDm = playing.isDm
  // A profile that has DM'd (or picked "I'm a DM") keeps the DM pages with no campaign: prep, NPCs, maps.
  const [dmTools, enableDmTools] = useDmTools(active?.id ?? '', partyDm)
  const isDm = partyDm || admin || dmTools
  useXpAwards(active?.id, playing.parties)
  useLiveHits(active?.id, playing.parties)
  const nav = { isDm, partyDm, admin, dmTools }
  // From a fight back to the plan it was started from: make it the plan the Fights tab shows, then open the DM screen.
  const openPlan = async (planId: string) => {
    if (!active) return
    await saveDm(active.id, { ...(await loadDm(active.id)), activePlanId: planId })
    setView({ kind: 'dm' })
  }
  // Tapping a campaign on the home screen plays it: the DM screen for its DM, else the sheet the player brings.
  const playCampaign = (p: Party) => {
    playing.choose(p.id)
    const to = campaignTarget(p, active?.id ?? '', characters.map(c => c.id))
    setView(to.kind === 'party' ? { kind: 'party', partyId: to.partyId } : to)
  }
  // The Campaign switch in the player menu plays the picked one, or the character list without a party.
  const switchCampaign = (id: string | null) => {
    const p = playing.parties?.find(x => x.id === id)
    if (p) playCampaign(p)
    else { playing.choose(null); setView({ kind: 'list' }) }
  }
  // A screen this account may not open (a shortcut, a link, a switched profile) falls back to its home screen.
  // The DM role is known once the parties have loaded, so a refresh on a DM page waits instead of bouncing.
  // Another player's character this profile may not see also bounces (src/party/visibility.ts).
  const characterAllowed = useCharacterAccess(view, active?.id, playing.parties ?? undefined)
  const allowed = (canOpen(view.kind, nav) || playing.parties === null) && characterAllowed
  useEffect(() => {
    if (!allowed) setView({ kind: 'campaigns' }, true)
  }, [allowed, setView])

  // Players edit a character only with the DM's OK (one edit per approval). The DM and the admin edit freely,
  // and so does a player whose character has no DM (in no party run by someone else).
  const editsFreely = partyDm || admin
  const hasDm = (id: string) => !playing.parties || playing.parties.some(p => p.dmId !== active?.id && p.members.some(m => m.characterId === id))
  const editStateOf = (id: string): EditState => (editsFreely || !hasDm(id) ? 'approved' : active ? editState(requests ?? [], active.id, id) : 'none')
  const startEdit = (id: string) => {
    const character = characters.find(c => c.id === id)
    if (editStateOf(id) === 'approved') setView({ kind: 'edit', id })
    else if (character) setAskEdit({ character })
  }
  // Levelling up needs no OK once XP reaches the next level (the DM gives XP or a milestone on the party page).
  const levelUpPass = (id: string) => editStateOf(id) === 'approved' && !editsFreely && hasDm(id)
  const startLevelUp = (id: string) => {
    const character = characters.find(c => c.id === id)
    if (!character || xpReady(character) || editStateOf(id) === 'approved') setView({ kind: 'levelup', id })
    else setAskEdit({ character, levelUp: true, note: t('levelup.needXp', { name: character.name, xp: character.xp, next: xpForNextLevel(character.classes.reduce((n, cl) => n + cl.level, 0)) ?? 0 }) })
  }

  const addProfile = async (displayName: string) => {
    const p = { id: newId(), displayName }
    await saveProfile(p)
    setProfiles(await listProfiles())
    switchProfile(p.id)
  }
  const switchProfile = (id: string) => {
    setActiveProfileId(id)
    setActiveId(id)
    setView({ kind: 'campaigns' })
  }

  // A request link opens the DM's Requests tab; an answer link opens the player's requests.
  // An answer to an edit request opens the character list, where Edit is now unlocked.
  const openRequestLink = useCallback((s: Shared) => {
    if (s.type === 'request') setView({ kind: 'dm', tab: 'requests' })
    else setView(s.request.kind === 'edit' ? { kind: 'list' } : { kind: 'requests' })
  }, [setView])

  const onScreenId = 'id' in view ? view.id : undefined
  const onScreen = characters.find(c => c.id === onScreenId)
  // The Familiar knows the screen it was opened from; it needs the profile's cloud account (activation code).
  const dmCampaign = partyDm ? playing.party : undefined
  const screen = screenFor(view, { character: onScreen, isDm, partyDm, campaign: dmCampaign })
  const familiar = active && {
    userId: active.id, signedIn: ownProfile, context: screen.context, role: screen.role, edition: screen.edition, card: screen.card,
    subject: screen.subject && t(screen.subject.key, screen.subject.vars),
    // On DM pages the campaign, plans and NPCs are read fresh for every question.
    prepare: screen.context.kind === 'dm' ? () => dmPrepare(active.id, dmCampaign) : undefined,
  }

  if (profiles === null) return null
  if (!active) return <ActivateScreen onLocal={addProfile} />

  return (
    <DiceProvider key={active.id} userId={active.id}>
    <RequestsAgent userId={active.id} onOpen={openRequestLink} />
    <PartyRollRelay userId={active.id} />
    {playing.party && <RevealMoment party={playing.party} userId={active.id} onOpen={() => setView({ kind: 'party', partyId: playing.party!.id })} />}
    {(partyDm || admin) && <DmRequestToast paused={view.kind === 'combat'} onOpenAll={() => setView({ kind: 'dm', tab: 'requests' })} />}
    {/* The DM's level (or enough XP) reached a character: ask once per level to walk through Level Up. */}
    <LevelUpPrompt characters={characters} parties={playing.parties} userId={active.id} paused={['build', 'edit', 'levelup', 'starters'].includes(view.kind)}
      onLevelUp={id => setView({ kind: 'levelup', id })} />
    <EditRequestDialog key={askEdit?.character.id} character={askEdit?.character ?? null} note={askEdit?.note} levelUp={askEdit?.levelUp} userId={active.id} userName={active.displayName} onClose={() => setAskEdit(null)} />
    <div className="app">
      <SkipLink />
      <AppNav
        viewKind={view.kind}
        onGo={key => {
          // "I'm a DM" under More turns the DM pages on for this profile, then opens the DM screen.
          if (key === 'dm' && !isDm) enableDmTools()
          setView({ kind: key })
        }}
        playerName={active.displayName}
        {...nav}
        dmBadge={<><AccountBadge dm={partyDm} /><SyncBadge compact /></>}
        onAccessibility={() => a11yDialog.current?.showModal()}
      >
        <SyncBadge />
        <ProfileSwitcher profiles={profiles} active={active} onSwitch={switchProfile} onAdd={addProfile} />
        <InstallMenuItem />
        {playing.parties && <PartySwitcher parties={playing.parties} party={playing.party} onPick={switchCampaign} />}
      </AppNav>
      <AccessibilityDialog ref={a11yDialog} />
      <main id="main" ref={mainRef} tabIndex={-1}>
        <Suspense fallback={<p className="muted screen-loading" role="status">{t('common.loading')}</p>}>
        {ownProfile && view.kind !== 'campaigns' && <CloudLinkNotice />}
        {ownProfile && <DuplicatePrompt characters={characters} />}
        {(view.kind === 'campaigns' || view.kind === 'list') && <UnfinishedDraft key={active.id} ownerId={active.id} onContinue={() => setView({ kind: 'build' })} />}
        {view.kind === 'campaigns' && (
          <CampaignsHome
            userId={active.id}
            playerName={active.displayName}
            parties={playing.parties}
            current={playing.party}
            characters={characters}
            onPlay={playCampaign}
            onJoin={() => setView({ kind: 'party', startWith: 'join' })}
            onStart={() => setView({ kind: 'party', startWith: 'start' })}
            signedIn={ownProfile}
            onOpenCharacter={id => setView({ kind: 'sheet', id })}
            onBuild={() => setView({ kind: 'build' })}
            dmTools={!partyDm && dmTools}
            onDmScreen={() => setView({ kind: 'dm' })}
          />
        )}
        {view.kind === 'list' && (
          <CharacterList
            owner={active}
            characters={characters}
            onNew={() => setView({ kind: 'build' })}
            onStarter={() => setView({ kind: 'starters' })}
            onOpen={id => setView({ kind: 'sheet', id })}
            editState={editStateOf}
            onEdit={startEdit}
            onLevels={id => setView({ kind: 'levels', id })}
            onPlan={id => setView({ kind: 'plan', id })}
            onPrint={id => { printFrom.current = 'list'; setView({ kind: 'print', id }) }}
            onImported={refresh}
            onDelete={async id => {
              await deleteCharacter(id)
              await deleteSnapshotsFor(id)
              refresh()
            }}
          />
        )}
        {view.kind === 'build' && (
          <Builder
            ownerId={active.id}
            playerName={active.displayName}
            onCancel={() => setView({ kind: 'list' })}
            onCreate={async c => {
              const saved = await saveCharacter(c)
              refresh()
              setView({ kind: 'sheet', id: saved.id })
            }}
          />
        )}
        {view.kind === 'edit' && (
          <EditCharacter
            key={view.id}
            characterId={view.id}
            onCancel={() => setView({ kind: 'sheet', id: view.id })}
            onSaved={id => {
              if (!editsFreely) updateRequests(l => spendEditPass(l, active.id, id))
              refresh()
              setView({ kind: 'sheet', id })
            }}
          />
        )}
        {view.kind === 'levelup' && (
          <LevelUp
            key={view.id}
            characterId={view.id}
            onDone={(id, saved) => {
              // A level-up that only an approval allowed (XP short of the next level) uses that approval.
              if (saved && levelUpPass(id) && !xpReady(characters.find(c => c.id === id) ?? { classes: [], xp: 0 })) updateRequests(l => spendEditPass(l, active.id, id))
              refresh()
              setView({ kind: 'sheet', id })
            }}
          />
        )}
        {view.kind === 'starters' && (
          <StarterPicker
            ownerId={active.id}
            playerName={active.displayName}
            onCancel={() => setView({ kind: 'list' })}
            onCustom={() => setView({ kind: 'build' })}
            onCreate={async c => {
              const saved = await saveCharacter(c)
              refresh()
              setView({ kind: 'sheet', id: saved.id })
            }}
          />
        )}
        {view.kind === 'sheet' && (
          <CharacterSheet
            characterId={view.id}
            party={playing.party}
            userId={active.id}
            onEdit={() => startEdit(view.id)}
            onLevelUp={() => startLevelUp(view.id)}
            onPrint={() => { printFrom.current = 'sheet'; setView({ kind: 'print', id: view.id }) }}
            onBack={() => {
              refresh()
              setView({ kind: 'list' })
            }}
          />
        )}
        {view.kind === 'watch' && isDm && (
          <WatchSheet key={view.id} characterId={view.id} parties={playing.parties ?? undefined} onBack={() => setView(partyDm ? { kind: 'dm' } : { kind: 'party' })} />
        )}
        {view.kind === 'npc' && isDm && view.id === 'new' && (
          <NpcBuilder key={active.id} ownerId={active.id} partyId={partyDm ? playing.party?.id : undefined}
            onSaved={(npc, back) => setView(back ? { kind: 'dm' } : { kind: 'npc', id: npc.id }, true)}
            onCancel={back => setView(back ? { kind: 'dm' } : { kind: 'dm', tab: 'npcs' })} />
        )}
        {view.kind === 'npc' && isDm && view.id !== 'new' && (
          <NpcScreen key={view.id} npcId={view.id} ownerId={active.id} partyId={partyDm ? playing.party?.id : undefined} onBack={() => setView({ kind: 'dm', tab: 'npcs' })} onOpenFight={id => setView({ kind: 'combat', encounterId: id })} />
        )}
        {view.kind === 'levels' && (
          <LevelHistory
            characterId={view.id}
            onOpenSheet={id => setView({ kind: 'sheet', id })}
            onBack={() => {
              refresh()
              setView({ kind: 'list' })
            }}
          />
        )}
        {view.kind === 'plan' && <PlanView characterId={view.id} onBack={() => { refresh(); setView({ kind: 'list' }) }} />}
        {view.kind === 'print' && <PrintSheet characterId={view.id} onBack={() => setView(printFrom.current === 'sheet' ? { kind: 'sheet', id: view.id } : { kind: 'list' })} />}
        {view.kind === 'rules' && <RulesQA />}
        {view.kind === 'familiar' && familiar && <FamiliarPage {...familiar} />}
        {view.kind === 'combat' && isDm && <CombatTracker key={`${active.id}:${view.encounterId ?? ''}`} ownerId={active.id} initialOpenId={view.encounterId} campaign={partyDm ? playing.party : undefined} onOpenPlan={openPlan} />}
        {view.kind === 'dm' && isDm && <DmScreen key={`${active.id}:${view.tab ?? ''}`} userId={active.id} initialTab={view.tab} party={partyDm ? playing.party : undefined} onRunEncounter={id => setView({ kind: 'combat', encounterId: id })} onOpenSheet={id => setView({ kind: 'watch', id })} onOpenNpc={id => setView({ kind: 'npc', id })}
          onNewNpc={() => setView({ kind: 'npc', id: 'new' })}
          runs={playing.parties?.filter(p => p.dmId === active.id)} onPickCampaign={playing.choose} onStartCampaign={() => setView({ kind: 'party', startWith: 'start' })} />}
        {view.kind === 'requests' && <RequestsView key={active.id} userId={active.id} userName={active.displayName} />}
        {view.kind === 'homebrew' && <Homebrew profile={active} />}
        {view.kind === 'admin' && admin && (
          <AdminPage
            onOpenAs={async id => { setProfiles(await listProfiles()); switchProfile(id) }}
            onOpenSheet={id => setView({ kind: 'sheet', id })}
            onEdit={id => setView({ kind: 'edit', id })}
            onOpenDm={() => setView({ kind: 'dm' })}
            onOpenCombat={() => setView({ kind: 'combat' })}
          />
        )}
        {view.kind === 'party' && (
          <PartyView key={active.id} userId={active.id} openId={view.partyId} startWith={view.startWith}
            onRoute={(partyId, replace) => setView(partyId ? { kind: 'party', partyId } : { kind: 'party' }, replace)}
            onOpenCharacter={id => setView({ kind: 'sheet', id })} onWatchCharacter={partyDm || admin ? id => setView({ kind: 'watch', id }) : undefined} />
        )}
        </Suspense>
      </main>
      {familiar && view.kind !== 'familiar' && <FamiliarFab {...familiar} open={familiarOpen} onOpenChange={o => { setFamiliarOpen(o); if (o) setDiceOpen(false) }} />}
      <ActivationPromptHost />
      {view.kind !== 'familiar' && <DiceFab open={diceOpen} onOpenChange={setDiceOpen} character={onScreen}
        secretTo={playing.party && !playing.isDm ? { partyId: playing.party.id, userId: active.id } : undefined} />}
    </div>
    </DiceProvider>
  )
}

function ProfileSwitcher({ profiles, active, onSwitch, onAdd }: {
  profiles: UserProfile[]
  active: UserProfile
  onSwitch: (id: string) => void
  onAdd: (name: string) => void
}) {
  const { t } = useI18n()
  const [asking, setAsking] = useState<'player' | null>(null)
  return (
    <div className="row profile">
      <label className="muted small" htmlFor="profile">{t('app.player')}</label>
      <select id="profile" value={active.id} onChange={e => onSwitch(e.target.value)}>
        {profiles.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
      </select>
      <button type="button" className="nav-item" onClick={() => setAsking('player')}>{t('app.addPlayer')}</button>
      <button type="button" className="nav-item" onClick={openActivationPrompt}>{t('account.enterCode')}</button>
      <PromptDialog open={asking === 'player'} title={t('app.newPlayerPrompt')} yes={t('app.addPlayerYes')} onClose={() => setAsking(null)} onSubmit={onAdd} />
    </div>
  )
}
