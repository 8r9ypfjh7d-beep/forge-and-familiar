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
| `context.ts` | `characterCard(c)`: compact text summary from `derive()` |
| `tools/registry.ts` | `registerTool`, `declarations(env)`, `runTool` (errors become a readable `error` result); `ToolEnv` carries who asks and what is on screen |
| `tools/content.ts` | `search_content`, `get_entry`, `rules_lookup` over `src/content` and `src/rulesqa`; `sourceNote` says how a source may be used |
| `store.ts` | Conversations on the device only: `ff.familiar.v1.<userId>`, newest 20 |
| `familiar.test.ts` | Tools over the bundled data, prompt, card, SSE, tool loop with a fake transport, store |
| `../../supabase/functions/familiar/index.ts` | Deno Edge Function: auth, daily limits, Gemini proxy |
| `../../supabase/migrations/20261031100000_assistant_usage.sql` | `assistant_usage`, `assistant_limits`, `assistant_consume()`; no client access |

## How it works

- **The key never reaches the browser.** The `familiar` Edge Function reads `GEMINI_API_KEY` (and optional `GEMINI_MODEL`, default `gemini-2.5-flash`) from Supabase secrets. It needs the device's Supabase JWT, maps it to an account through `account_devices` (local-only profiles cannot use it), checks today's usage, forwards the body to Gemini `generateContent` (or `streamGenerateContent?alt=sse`) and counts requests and tokens. Errors: 401 `signIn`, 429 `limit` with `resetAt`, 413 `tooLarge`, 503 `notConfigured` (no key yet), 502 `server`.
- **Limits.** Per account per UTC day: 80 requests and 400k tokens; the admin 5×. A row in `assistant_limits` overrides both for an account (SQL editor, no deploy).
- **Tools run in the browser.** The function only relays. Gemini asks for a tool, `runTurn` runs it locally over the library, rules text and (later units) the character and campaign, and sends the result back. Private data goes only to Gemini for that request. Executors check access; the model cannot widen it.
- **Nothing stored on the server** but counts. Conversations live on the device.
- **Copyright.** Tools return only what the app ships: SRD text (CC-BY-4.0) and our own book summaries, each with a `usage` note; the system instruction forbids quoting books. Screens showing answers must show the SRD attribution, as `src/rulesqa` does.
- **Language.** Answers follow the app locale; Hebrew answers add the English game term the first time. Tool calls stay English. Book spells return `descriptionHe` when the locale is Hebrew.

## Deploying the function

Deploy `supabase/functions/familiar/index.ts` as `familiar` with JWT verification on (Supabase connector `deploy_edge_function`, or `supabase functions deploy familiar`). Set the secrets in the Supabase dashboard: Edge Functions → Secrets. `FAMILIAR_ORIGINS` (comma list) overrides the allowed origins.

## Known tasks

- **Add a tool**: `registerTool({ declaration, available?, label?, run })` in a file under `tools/`, imported from `index.ts`. Keep results small (cut long text), English, and add a test with real bundled data.
- **Change limits**: edit `DEFAULT_LIMITS` in the function, or insert into `assistant_limits`.
- **UI text**: `familiar.*` keys in both locales.
