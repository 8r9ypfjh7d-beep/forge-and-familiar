# Cloud (Supabase)

The Supabase client, cloud sign-in and the row shapes of the database. Other modules build their sync on this. Without cloud settings the app runs on the device only, exactly as before.

## Files Covered

| File | Purpose |
|------|---------|
| `config.ts` | `cloudConfig` from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (set in `/.env`); `isCloudEnabled()` |
| `client.ts` | `getSupabase()`: the one shared client, loaded lazily; `null` when off or offline |
| `auth.ts` | `linkCloudAccount(code)`, `getCloudAccountId()`, `getCloudStatus()`, `onCloudChanged`, `unlinkCloud()` |
| `types.ts` | `AccountRow`, `CharacterRow`, `DmStateRow`, `CloudStatus` |
| `cloud.test.ts` | Config parsing; the database roster matches `src/accounts/roster.ts` |
| `../../supabase/migrations/` | The schema, access rules and roster seed (SQL) |
| `../../supabase/tests/` | `run.sh` + `rls_test.sql`: access rules checked on a local Postgres |

## Sign-in

Each device signs in anonymously, then calls `claim_account(code)`, which checks the code and links the device's auth user to that account (`account_devices`). This is the only place codes are checked: the site ships no codes or hashes, so `activate()` in `src/accounts/session.ts` needs a connection the first time. `linkCloudAccount()` answers with the account, `'wrong'`, `'limited'` (too many tries) or `'offline'`. Devices activated before the cloud existed link the next time the code is entered (player menu, "Enter activation code…").

`claim_account` refuses (`too many tries`) after 5 wrong codes from one device in 15 minutes, or 30 from everyone in a minute; misses are kept in `claim_attempts` (no client access). `code_hash` is `bcrypt(sha256 hex of the normalized code)`.

`getCloudAccountId()` returns the linked account id (`acct-roy`...), the same id as the local profile and `owner_id` in the database. It is cached in `ff.cloud.v1`, so it works offline.

## Database

| Table | Key | Who can read and write |
|-------|-----|------------------------|
| `accounts` | `id` | Linked devices read id, name, role, is_admin. `code_hash` is never readable |
| `account_devices` | `user_id` (auth uid) | Own row; written only by `claim_account` |
| `claim_attempts` | `user_id`, `at` | Nobody; `claim_account`'s rate limit |
| `characters` | `id`, `owner_id`, `data` jsonb, `rev`, `deleted`, `updated_at` | Owner, and the admin |
| `dm_state` | `account_id`, `data` jsonb, `updated_at` | Owner, and the admin |

SQL helpers for policies: `current_account_id()`, `is_admin()`, `is_dm()`. `updated_at` is set by the database on every write. Conditional writes: `update ... .eq('rev', base)` with `rev: base + 1`; zero rows back means someone else wrote first. Realtime is on for `characters` and `dm_state`. The DM has no extra access to player sheets.

Add a feature's tables in a new, later migration file that reuses the helpers, and add its checks to `rls_test.sql`. Grant only the verbs the app uses (`revoke all ... from anon, authenticated` first); never TRUNCATE, which skips RLS.

## Setup (once)

1. In Supabase, create a project, then Authentication > Sign In / Providers > turn on **Anonymous sign-ins**.
2. SQL Editor: run the migration files in `supabase/migrations/` in order.
3. The project URL and publishable key are in the repo's `.env` (public by design, guarded by RLS; never the service_role key). Override in `.env.local` or Render environment variables.

The group's project is `forge-and-familiar` (ref `roqfxquchhlvcivydbxl`, eu-west-1). New migrations must be applied there too (Supabase SQL editor, or the Supabase connector's apply_migration).

Adding a friend: add the account (no code) to `src/accounts/roster.ts` and insert the same row into `accounts` in a new migration. For `code_hash`, run `select extensions.crypt('<sha256 hex of the normalized code>', extensions.gen_salt('bf', 10))` in the SQL editor and paste the result; never commit the code or its plain SHA-256.

## Testing the rules

`PGHOST=... PGUSER=postgres supabase/tests/run.sh` creates a throwaway database with a stand-in for Supabase's auth schema, runs the migrations and checks who can see what.
