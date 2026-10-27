# Cloud (Supabase)

The Supabase client, cloud sign-in and the row shapes of the database. Other modules build their sync on this. Without cloud settings the app runs on the device only, exactly as before.

## Files Covered

| File | Purpose |
|------|---------|
| `config.ts` | `cloudConfig` from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; `isCloudEnabled()` |
| `client.ts` | `getSupabase()`: the one shared client, loaded lazily; `null` when off or offline |
| `auth.ts` | `linkCloudAccount(code)`, `getCloudAccountId()`, `getCloudStatus()`, `onCloudChanged`, `unlinkCloud()` |
| `types.ts` | `AccountRow`, `CharacterRow`, `DmStateRow`, `CloudStatus` |
| `cloud.test.ts` | Config parsing; the database roster matches `src/accounts/roster.ts` |
| `../../supabase/migrations/` | The schema, access rules and roster seed (SQL) |
| `../../supabase/tests/` | `run.sh` + `rls_test.sql`: access rules checked on a local Postgres |

## Sign-in

Each device signs in anonymously, then calls `claim_account(code)`, which hashes the code the same way as `src/accounts/codes.ts` and links the device's auth user to that account (`account_devices`). `activate()` in `src/accounts/session.ts` does this after a successful local activation. Devices activated before the cloud existed link the next time the code is entered (player menu, "Enter activation code…").

`getCloudAccountId()` returns the linked account id (`acct-roy`...), the same id as the local profile and `owner_id` in the database. It is cached in `ff.cloud.v1`, so it works offline.

## Database

| Table | Key | Who can read and write |
|-------|-----|------------------------|
| `accounts` | `id` | Linked devices read id, name, role, is_admin. `code_hash` is never readable |
| `account_devices` | `user_id` (auth uid) | Own row; written only by `claim_account` |
| `characters` | `id`, `owner_id`, `data` jsonb, `rev`, `deleted`, `updated_at` | Owner, and the admin |
| `dm_state` | `account_id`, `data` jsonb, `updated_at` | Owner, and the admin |

SQL helpers for policies: `current_account_id()`, `is_admin()`, `is_dm()`. `updated_at` is set by the database on every write. Conditional writes: `update ... .eq('rev', base)` with `rev: base + 1`; zero rows back means someone else wrote first. Realtime is on for `characters` and `dm_state`. The DM has no extra access to player sheets.

Add a feature's tables in a new, later migration file that reuses the helpers, and add its checks to `rls_test.sql`.

## Setup (once)

1. In Supabase, create a project, then Authentication > Sign In / Providers > turn on **Anonymous sign-ins**.
2. SQL Editor: run the migration files in `supabase/migrations/` in order.
3. Render > the site > Environment: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings > API, the anon public key; never the service_role key), then redeploy. Locally, put them in `.env.local`.

Adding a friend: add the account to `src/accounts/roster.ts` and insert the same row into `accounts` (a new migration).

## Testing the rules

`PGHOST=... PGUSER=postgres supabase/tests/run.sh` creates a throwaway database with a stand-in for Supabase's auth schema, runs the migrations and checks who can see what.
