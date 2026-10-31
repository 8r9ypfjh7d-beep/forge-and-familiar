# The Familiar (AI assistant)

An in-app assistant for players (plan characters, explain spells, features and rules) and the DM (rulings, monsters, encounters), on Google Gemini. Plan and later units: `/mnt/project-files/ai-assistant/plan.md` in the project folder.

## Files Covered

| File | Purpose |
|------|---------|
| `index.ts` | Public API; importing it registers the content tools |
| `types.ts` | `Content`/`Part` (Gemini `contents` format), `FamiliarContext`, `Thread`, `ToolUse`, `FamiliarError` + `errorKey` |
| `api.ts` | `edgeTransport`: POST to the Edge Function with the device's Supabase session, streaming (SSE) when `onText` is given; `parseSse`, `mergeChunks` |
| `chat.ts` | `runTurn(history, text, prompt, env, transport, events)`: the tool loop (at most `MAX_TOOL_ROUNDS`, the last round has no tools); `trimHistory` |
| `prompt.ts` | `systemInstruction`: persona, copyright rules, language (EN/HE), player or DM role, context card |
| `context.ts` | `characterCard(c)`: compact text summary from `derive()`; `draftCard(draft, step?)`: the builder draft so far and what each step still misses |
| `screen.ts` | What is on screen: `setFamiliarScreen` / `getFamiliarScreen` / `subscribeFamiliarScreen` (`FamiliarScreen`: context, card, edition, role, tool `data`, chip keys); `askFamiliar({ prompt })` opens the panel, which registers with `onFamiliarOpen` |
| `ui/screen.ts` | Hooks: `useFamiliarScreen(screen)` (publish while mounted; pass a memoized object), `useFamiliarScreenValue()`, `useFamiliarAvailable()` |
| `ui/AskFamiliar.tsx` | "✦ Ask the Familiar" button; renders only while a panel is registered |
| `tools/character.ts` | `get_character` (sections summary, abilities, features, spells, inventory, state, plan), `explain_stat` (src/explain `explain()`), `builder_options` (per step: options, `stepIssues`, `stepWarnings`); `resolveCharacter`, `draftCharacter` |
| `character.test.ts` | Player tools over a David Jones-like warlock and builder drafts, draft card, screen store |
| `tools/registry.ts` | `registerTool`, `declarations(env)`, `runTool` (errors become a readable `error` result); `ToolEnv` carries who asks and what is on screen |
| `tools/content.ts` | `search_content`, `get_entry`, `rules_lookup` over `src/content` and `src/rulesqa`; `sourceNote` says how a source may be used |
| `tools/dm.ts` | DM only: `get_party`, `encounter_check`, `find_monsters`, `get_monster` (library monsters and `npc:<id>` NPC sheets); `dmAllowed(env)` gate; `DmToolData` |
| `dm.ts` | `dmCard` (DM screen context card), `dmToolData(userId, campaign)` (fills `ToolEnv.data.dm`), `DM_CHIPS` |
| `dm.test.ts` | DM gating, party, encounter math, monster tools, card, prompt, chips EN+HE |
| `store.ts` | Conversations on the device only: `ff.familiar.v1.<userId>`, newest 20 |
| `familiar.test.ts` | Tools over the bundled data, prompt, card, SSE, tool loop with a fake transport, store |
| `ui/Familiar.tsx` | `FamiliarFab` (sparkle button above the dice, opens a side sheet on wide screens and a bottom sheet on phones) and `FamiliarPage` (`#/familiar`); both take a `FamiliarSetup` and check sign-in, cloud and connection before sending |
| `ui/FamiliarChat.tsx` | The conversation: header (History, New chat, Close), intro and starter chips, messages with "Looked up" tool chips, streaming text with a thinking shimmer, error box with Try again, blocked box (not set up, sign-in with `CodeForm`, offline), composer with Stop, SRD attribution and caveat footer |
| `ui/useFamiliarChat.ts` | State: open thread (kept per user across sheet and page), streaming `pending`, `error`, history; `send` runs `runTurn` with `edgeTransport`; `prepare()` loads fresh card and data at send time |
| `ui/view.ts` | Pure: `bubbles` (questions and final answers only), `chipKeys` per context and role, `blockedReason`, `canRetry`, `resetText` |
| `ui/markdown.ts`, `ui/ChatMarkdown.tsx` | Gemini's markdown: headings, lists right under a sentence, tables, bold/italic/code; no HTML |
| `ui/onScreen.ts` | `screenFor(view, …)`: context, role, edition, card and subject from the screen in App; `dmPrepare` fills the DM card and `data.dm` |
| `ui/familiar.css` | Liquid Glass, logical properties, solid fallbacks and high contrast |
| `ui/ui.test.tsx` | View helpers, markdown, panel states (SSR) EN+HE, screen mapping, route and nav |
| `../../supabase/functions/familiar/index.ts` | Deno Edge Function: auth, daily limits, Gemini proxy |
| `../../supabase/migrations/20261031100000_assistant_usage.sql` | `assistant_usage`, `assistant_limits`, `assistant_consume()`; no client access |

## How it works

- **The key never reaches the browser.** The `familiar` Edge Function reads `GEMINI_API_KEY` (and optional `GEMINI_MODEL`, default `gemini-2.5-flash`) from Supabase secrets. It needs the device's Supabase JWT, maps it to an account through `account_devices` (local-only profiles cannot use it), checks today's usage, forwards the body to Gemini `generateContent` (or `streamGenerateContent?alt=sse`) and counts requests and tokens. Errors: 401 `signIn`, 429 `limit` with `resetAt`, 413 `tooLarge`, 503 `notConfigured` (no key yet), 502 `server`.
- **Limits.** Per account per UTC day: 80 requests and 400k tokens; the admin 5×. A row in `assistant_limits` overrides both for an account (SQL editor, no deploy).
- **Tools run in the browser.** The function only relays. Gemini asks for a tool, `runTurn` runs it locally over the library, rules text and (later units) the character and campaign, and sends the result back. Private data goes only to Gemini for that request. Executors check access; the model cannot widen it.
- **Nothing stored on the server** but counts. Conversations live on the device.
- **Copyright.** Tools return only what the app ships: SRD text (CC-BY-4.0) and our own book summaries, each with a `usage` note; the system instruction forbids quoting books. Screens showing answers must show the SRD attribution, as `src/rulesqa` does.
- **Language.** Answers follow the app locale; Hebrew answers add the English game term the first time. Tool calls stay English. Book spells return `descriptionHe` when the locale is Hebrew.

## The DM side

- **Gate.** The DM tools are offered and run only when `context.kind === 'dm'`, `data.dm` is present, and the asker is the campaign's DM or the admin (`canWatchSheets`; with no campaign, admin only, as `App.tsx` shows the DM screen). A `partyId` in the context must match the campaign. Every executor checks again, so a forced call from a player gets an error and no data.
- **Wiring (UI).** On the DM screen: `data: { dm: await dmToolData(userId, campaign) }`, `role: 'dm'`, `card: dmCard({ campaign, dmState, npcSheets, characters })`, chips `DM_CHIPS` (`familiar.dm.chip.*`, EN+HE), header `familiar.dm.ask`.
- **What it sees.** `get_party`: each brought character's class/level, AC, HP, conditions, concentration, passives, saves, spell DC; no notes, no rolls. Secret rolls never reach the Familiar. `encounter_check` uses the SRD 5.2 budget from `src/dm/logic` (the plan open on the DM screen, a "3 x goblin" list, or other levels) and adds table notes (CR above level, swarms, lone monsters). `find_monsters`/`get_monster` read `loadMonsters(edition)` (SRD, book summaries, packs) and the DM's NPC sheets; book monsters come back as our summaries with a usage note.

## Screens and entry points

- The sheet (`Sheet`, not view-only) publishes `{ context: character, card: characterCard, data: { character, getCharacter } }`; `getCharacter` returns only characters with the same owner. Its header has "Ask the Familiar about <name>".
- The builder publishes `{ context: builder, card: draftCard, data: { draft, step } }`; each step's help line has a compact ✦ that asks about that step.
- The panel (unit B) reads `useFamiliarScreenValue()`, builds `ToolEnv` from `context`, `edition`, `data` and `PromptInput` from `context`, `card`, `role`, `edition`, shows `chips` as `t(key)`, and calls `onFamiliarOpen` so the entry buttons appear.
- Tools find the character by: `id` arg (through `data.getCharacter`), else `data.character()` on a sheet, else the builder draft (made a character with `createCharacter`). With none, the tool returns an error asking the user to open a sheet.

## The panel

- **Where.** A sparkle button above the dice on every screen (hidden while the dice window or a phone menu is open), Familiar under More for everyone, and the full page `#/familiar`. The sheet and the page continue the same conversation.
- **What it knows.** `screenFor` in App: a character screen sends that character's card ("About Vex"), the builder says it is a draft, DM pages (DM, admin) send the DM card and tools through `dmPrepare`, anything else is general. Chips follow the context (`familiar.chip.*`, DM: `DM_CHIPS`).
- **States.** Before sending: no cloud build or a 404 from a function not deployed → not set up; a local-only profile → sign in with the activation code (inline form); offline → offline. After: `unreachable` (online but no answer, e.g. CORS on a missing function) and `server` offer Try again; `limit` shows the reset time; `tooLarge` offers a new chat. A failed or stopped question goes back into the box.
- **Display.** Only the user's questions and the final answers show; tool calls, tool responses, thoughts and "let me check" text stay in `contents`. Tools used appear as "Looked up" chips. Answers render with `dir="auto"`.

## Deploying the function

Deploy `supabase/functions/familiar/index.ts` as `familiar` with JWT verification on (Supabase connector `deploy_edge_function`, or `supabase functions deploy familiar`). Set the secrets in the Supabase dashboard: Edge Functions → Secrets. `FAMILIAR_ORIGINS` (comma list) overrides the allowed origins.

## Known tasks

- **Add a tool**: `registerTool({ declaration, available?, label?, run })` in a file under `tools/`, imported from `index.ts`. Keep results small (cut long text), English, and add a test with real bundled data.
- **Change limits**: edit `DEFAULT_LIMITS` in the function, or insert into `assistant_limits`.
- **UI text**: `familiar.*` keys in both locales.
- **Add a DM tool**: in `tools/dm.ts` with `available: dmAllowed` and `requireDm(env)` at the top of `run`; add a gating case to `dm.test.ts`.
