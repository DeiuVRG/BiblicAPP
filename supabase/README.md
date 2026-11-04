# Supabase

Database schema for Biblioteca. **Draft: written and reviewed, not applied in M0.** The app does
not talk to Supabase yet (no accounts, no sync); this directory exists so the security model is
reviewed before any code depends on it.

```
supabase/
  config.toml                 minimal CLI config (local stack only)
  migrations/0001_init.sql    schemas, tables, RLS, grants, SECURITY DEFINER stubs
  tests/grants.sql            pgTAP: privilege allow list + RLS behaviour
```

## Model in one page

- Schema `public` is exposed through PostgREST: catalogue metadata, user rows, `app_config`.
- Schema `content` is **not exposed**: `content.paragraph_revisions` holds the canonical text.
  `REVOKE ALL ON SCHEMA content FROM PUBLIC, anon, authenticated`, and `content` is absent from
  `[api] schemas`. The `anon` key bundled in the app can therefore never read the library.
- Every table has RLS enabled. Catalogue tables only return rows of `published` editions.
  User tables (`profiles`, `highlights`, `notes`, `bookmarks`, `reading_progress`) have owner
  policies written as `user_id = (select auth.uid())`.
- `entitlements`, `edition_revisions`, `audit_log` and `content.*` have **no client access at
  all**: they are written and read by the service role (the future `ops` service).
- Text is served by `SECURITY DEFINER` RPCs (`get_chapter`, `get_paragraphs`) with a pinned
  `search_path`. In this migration they are stubs that raise `0A000`; `EXECUTE` is granted only
  to `gateway_role` and `service_role`. Clients ask the gateway, which applies rate limits and
  entitlement checks (`has_active_entitlement()`).
- Default privileges: the migration runs `ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`
  globally for the migration role (a per-schema variant cannot remove PostgreSQL's built-in
  grant), so a function added by a later migration is not callable by `anon` until it is granted
  explicitly. Run migrations as `postgres`.
- `public.editions` is readable by clients column by column (no `provenance`): list the columns
  you need, `select *` is a permission error by design. Headings and paragraph ids of published
  editions are public on purpose (table of contents); text is only in `content`.
- `audit_log` and `content.paragraph_revisions` are append-only, including `TRUNCATE` and for
  `service_role`. User tables have per-user row quotas (highlights 20 000, notes 5 000,
  bookmarks 5 000).
- `gateway_role` is created `NOLOGIN`. Give it a login and password out of band (dashboard or
  secret manager), never in a migration or in git.
- `supabase/tests/grants.sql` lists, per role, every privilege `anon` and `authenticated` are
  allowed to have in `public` and `content`, and fails on anything else. Adding a table,
  function or GRANT means adding it to the allow list in the same pull request.

## Create the hosted project (eu-central-1)

1. In the Supabase dashboard create a project in region **eu-central-1 (Frankfurt)**. Use a
   Free project for staging and Pro for production. Enable the spend cap.
2. Save the database password in a password manager. Do not commit it.
3. Project Settings, API: keep **Exposed schemas** at `public` (and `graphql_public` if you use
   it). Do **not** add `content`.
4. Authentication: leave sign-ups for later milestones; nothing in M0 uses Auth.
5. Install the CLI (`npm i -g supabase` or `brew install supabase/tap/supabase`), then:

```bash
supabase login
supabase link --project-ref <project-ref>      # the ref is in the dashboard URL
supabase db push --dry-run                      # review what would run
supabase db push                                # apply migrations/0001_init.sql
```

Never run `supabase db push` against production from a laptop once CI deploys exist; use the
protected deploy workflow (planned for a later milestone).

6. Create the gateway login out of band (SQL editor, as `postgres`; pick a long random password
   from your password manager):

```sql
alter role gateway_role login password '<from the password manager>';
```

## Run the tests locally

Requires Docker and the Supabase CLI.

```bash
supabase start                 # local stack (Postgres 17, Auth, PostgREST)
supabase db reset              # applies migrations/ from scratch
supabase test db               # runs supabase/tests/*.sql with pg_prove
supabase stop
```

The manual workflow `.github/workflows/supabase-tests.yml` runs the same three commands on
GitHub (Actions tab, "Supabase tests", Run workflow). It is manual in M0 because the migration is
not applied anywhere yet. The migration was additionally smoke-tested on plain PostgreSQL 16
with a stand-in for the Supabase roles and `auth` schema; the pgTAP file itself needs the real
stack.

## Rules for new migrations

- New tables: enable RLS in the same migration, add policies only for what clients need, and add
  the allow-list entries to `tests/grants.sql`.
- Policies use `(select auth.uid())`; index every column used in a policy or foreign key.
- `SECURITY DEFINER` functions set `search_path` (empty, schema-qualify everything) and revoke
  `EXECUTE` from `PUBLIC` before granting it to the intended roles.
- Never edit an applied migration; add a new one.
