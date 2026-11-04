-- 0001_init.sql
-- Initial schema for Biblioteca (draft, NOT applied in M0).
--
-- Targets PostgreSQL 15+ on Supabase (eu-central-1). Design rules:
--   * Two schemas: `public` (exposed through PostgREST) and `content` (NOT exposed).
--   * Deny by default: every table has RLS enabled, privileges are revoked first and then granted
--     one by one. New functions created by the migration role are not executable by PUBLIC (see
--     the global ALTER DEFAULT PRIVILEGES below). supabase/tests/grants.sql enumerates the
--     privileges of `anon` and `authenticated` and fails on anything outside its allow list.
--   * Canonical text lives only in `content.paragraph_revisions`. Clients reach text exclusively
--     through SECURITY DEFINER RPCs (`get_chapter`, `get_paragraphs`) whose EXECUTE is granted to
--     the gateway role only; the `anon` key shipped in the app bundle can never read the library.
--   * All SECURITY DEFINER functions pin `search_path` (empty, everything schema-qualified).
--   * Owner policies use `(select auth.uid())` so Postgres evaluates it once per statement.
--   * No secrets here. The login password of `gateway_role` is set out of band (see
--     supabase/README.md).

-- ---------------------------------------------------------------------------------------------
-- 0. Roles, schemas, default privileges
-- ---------------------------------------------------------------------------------------------

-- Supabase already provides anon, authenticated and service_role. `gateway_role` is used by the
-- AI gateway / content proxy (apps/api, later milestone). It is created NOLOGIN here.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'gateway_role') then
    create role gateway_role nologin noinherit;
  end if;
end
$$;

create schema if not exists content;
comment on schema content is
  'Canonical text and internal search data. Not exposed through PostgREST; no client role has access.';

revoke all on schema content from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;

grant usage on schema content to service_role, gateway_role;
grant usage on schema public to gateway_role;

-- Objects created later by this role must not be reachable by clients unless granted explicitly.
--
-- PostgreSQL gives EXECUTE on every new function to PUBLIC through its built-in global default.
-- A per-schema `ALTER DEFAULT PRIVILEGES ... IN SCHEMA ... REVOKE ... FROM PUBLIC` cannot remove
-- it (per-schema defaults are only added to the global default), so the revoke below is
-- deliberately global (no IN SCHEMA): it applies to every function this role creates from now
-- on, in any schema. supabase/tests/grants.sql probes this with a throw-away function.
-- Not done for `supabase_admin` on purpose: that platform role installs extensions, and its
-- defaults are not ours to change. Migrations must run as `postgres`.
alter default privileges revoke execute on functions from public;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

alter default privileges in schema content revoke all on tables from public, anon, authenticated;
alter default privileges in schema content revoke all on sequences from public, anon, authenticated;
alter default privileges in schema content grant all on tables to service_role;
alter default privileges in schema content grant all on sequences to service_role;

-- ---------------------------------------------------------------------------------------------
-- 1. Shared helpers
-- ---------------------------------------------------------------------------------------------

-- Stable content identifiers are ULIDs generated once at ingest (packages/shared `stableId`).
create domain public.ulid as text
  check (value ~ '^[0-9A-HJKMNP-TV-Z]{26}$');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- Per-user row quotas (insert-time). SECURITY INVOKER on purpose: the count goes through RLS, so
-- it sees exactly the caller's own rows. Limits are generous; they only stop unbounded storage.
create function public.enforce_user_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_rows constant integer := case tg_table_name
    when 'highlights' then 20000
    when 'notes' then 5000
    when 'bookmarks' then 5000
    else 2147483647
  end;
  current_rows bigint;
begin
  execute format('select count(*) from %I.%I where user_id = $1', tg_table_schema, tg_table_name)
    into current_rows using new.user_id;
  if current_rows >= max_rows then
    raise exception 'quota exceeded for %', tg_table_name using errcode = '54000';
  end if;
  return new;
end
$$;

-- Used on append-only tables (paragraph revisions, audit log).
create function content.forbid_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. Catalogue (public metadata, no text)
-- ---------------------------------------------------------------------------------------------

create table public.licences (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique,
  licensor             text not null,
  status               text not null default 'unknown'
                         check (status in ('public-domain', 'licensed', 'unknown')),
  scope                text,
  allows_offline       boolean not null default false,
  allows_commercial    boolean not null default false,
  allows_ai_context    boolean not null default false,
  allows_normalization boolean not null default false,
  allows_soft_hyphens  boolean not null default false,
  share_alike          boolean not null default false,
  attribution_required boolean not null default false,
  attribution_text     text,
  term_end             date,
  document_url         text,
  note                 text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table public.licences is
  'One record per licence agreement or public-domain determination. Publishing refuses editions without one.';

create table public.authors (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name       text not null,
  born       smallint,
  died       smallint,
  tradition  text not null default 'other'
               check (tradition in ('undivided', 'orthodox', 'catholic', 'protestant', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.works (
  id             public.ulid primary key,
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  author_id      uuid not null references public.authors (id),
  title_ro       text not null,
  title_orig     text not null,
  language_orig  text not null,
  year           smallint,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.editions (
  id                public.ulid primary key,
  work_id           public.ulid not null references public.works (id),
  language          text not null,
  kind              text not null check (kind in ('source', 'translation')),
  -- Mandatory for source editions and translations alike.
  licence_id        uuid not null references public.licences (id),
  access            text not null default 'member'
                      check (access in ('public', 'account', 'member')),
  status            text not null default 'draft'
                      check (status in ('draft', 'review', 'published', 'withdrawn')),
  source_edition_id public.ulid references public.editions (id),
  provenance        jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.edition_revisions (
  id          uuid primary key default gen_random_uuid(),
  edition_id  public.ulid not null references public.editions (id),
  revision    integer not null check (revision >= 1),
  note        text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (edition_id, revision)
);

create table public.sections (
  id          public.ulid primary key,
  edition_id  public.ulid not null references public.editions (id),
  ordinal     integer not null check (ordinal >= 0),
  kind        text not null check (kind in ('chapter', 'section')),
  heading     text not null,
  parent_id   public.ulid references public.sections (id),
  unique (edition_id, ordinal)
);

-- Paragraph METADATA only. The text is in content.paragraph_revisions.
create table public.paragraphs (
  id          public.ulid primary key,
  edition_id  public.ulid not null references public.editions (id),
  section_id  public.ulid not null references public.sections (id),
  ordinal     integer not null check (ordinal >= 0),
  kind        text not null default 'p' check (kind in ('p', 'heading', 'quote', 'note')),
  created_at  timestamptz not null default now(),
  unique (section_id, ordinal)
);
comment on table public.paragraphs is
  'Immutable paragraph identity and position. Never deleted, so user data can keep pointing at it.';

-- ---------------------------------------------------------------------------------------------
-- 3. Canonical text (schema content, not exposed)
-- ---------------------------------------------------------------------------------------------

create table content.paragraph_revisions (
  id               uuid primary key default gen_random_uuid(),
  paragraph_id     public.ulid not null references public.paragraphs (id),
  revision_id      uuid not null references public.edition_revisions (id),
  text_canonical   text not null,
  text_display     text,
  text_search      text,
  state            text not null default 'draft'
                     check (state in ('draft', 'reviewed', 'published')),
  reviewer_id      uuid references auth.users (id) on delete set null,
  qc_signals       jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  unique (paragraph_id, revision_id)
);
comment on table content.paragraph_revisions is
  'Append-only text revisions. Reachable only through SECURITY DEFINER RPCs and service roles.';

create trigger paragraph_revisions_append_only
  before update or delete on content.paragraph_revisions
  for each row execute function content.forbid_modification();
create trigger paragraph_revisions_no_truncate
  before truncate on content.paragraph_revisions
  for each statement execute function content.forbid_modification();

-- ---------------------------------------------------------------------------------------------
-- 4. User data (owner rows)
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  display_name        text check (char_length(display_name) <= 80),
  preferred_tradition text check (preferred_tradition in
                        ('undivided', 'orthodox', 'catholic', 'protestant', 'other')),
  locale              text not null default 'ro'
                        check (locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$'),
  -- Versioned consent records are written by the server (service role), never by the client.
  consents            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.highlights (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  paragraph_id public.ulid not null references public.paragraphs (id),
  start_offset integer not null check (start_offset >= 0),
  end_offset   integer not null check (end_offset > start_offset and end_offset <= 1000000),
  color        text not null default 'yellow'
                 check (color in ('yellow', 'green', 'blue', 'pink')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  paragraph_id public.ulid not null references public.paragraphs (id),
  body         text not null check (char_length(body) between 1 and 10000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.bookmarks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  paragraph_id public.ulid not null references public.paragraphs (id),
  label        text check (char_length(label) <= 200),
  created_at   timestamptz not null default now(),
  unique (user_id, paragraph_id)
);

create table public.reading_progress (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  work_id      public.ulid not null references public.works (id),
  section_id   public.ulid not null references public.sections (id),
  paragraph_id public.ulid references public.paragraphs (id),
  updated_at   timestamptz not null default now(),
  primary key (user_id, work_id)
);

-- ---------------------------------------------------------------------------------------------
-- 5. Server-only tables
-- ---------------------------------------------------------------------------------------------

-- Written only by the `ops` service (webhook handler) with the service role.
create table public.entitlements (
  user_id         uuid not null references auth.users (id) on delete cascade,
  entitlement     text not null,
  active          boolean not null default false,
  store           text,
  product_id      text,
  period_type     text,
  purchased_at    timestamptz,
  expires_at      timestamptz,
  grace_until     timestamptz,
  will_renew      boolean,
  rc_customer_id  text,
  source_event_id text,
  updated_at      timestamptz not null default now(),
  primary key (user_id, entitlement)
);

create table public.app_config (
  key        text primary key,
  value      jsonb not null,
  -- Only keys flagged public are readable with the anon key (feature flags, minimum version).
  is_public  boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor_id   uuid,
  action     text not null,
  entity     text,
  entity_id  text,
  details    jsonb not null default '{}'::jsonb
);

create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function content.forbid_modification();
create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function content.forbid_modification();

-- ---------------------------------------------------------------------------------------------
-- 6. updated_at triggers and indexes (every foreign key and every column used in a policy)
-- ---------------------------------------------------------------------------------------------

create trigger licences_set_updated_at before update on public.licences
  for each row execute function public.set_updated_at();
create trigger authors_set_updated_at before update on public.authors
  for each row execute function public.set_updated_at();
create trigger works_set_updated_at before update on public.works
  for each row execute function public.set_updated_at();
create trigger editions_set_updated_at before update on public.editions
  for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger highlights_quota before insert on public.highlights
  for each row execute function public.enforce_user_quota();
create trigger notes_quota before insert on public.notes
  for each row execute function public.enforce_user_quota();
create trigger bookmarks_quota before insert on public.bookmarks
  for each row execute function public.enforce_user_quota();
create trigger highlights_set_updated_at before update on public.highlights
  for each row execute function public.set_updated_at();
create trigger notes_set_updated_at before update on public.notes
  for each row execute function public.set_updated_at();
create trigger reading_progress_set_updated_at before update on public.reading_progress
  for each row execute function public.set_updated_at();
create trigger entitlements_set_updated_at before update on public.entitlements
  for each row execute function public.set_updated_at();
create trigger app_config_set_updated_at before update on public.app_config
  for each row execute function public.set_updated_at();

create index works_author_id_idx on public.works (author_id);
create index editions_work_id_idx on public.editions (work_id);
create index editions_licence_id_idx on public.editions (licence_id);
create index editions_status_idx on public.editions (status);
create index editions_source_edition_id_idx on public.editions (source_edition_id);
create index edition_revisions_created_by_idx on public.edition_revisions (created_by);
create index sections_parent_id_idx on public.sections (parent_id);
create index paragraphs_edition_id_idx on public.paragraphs (edition_id);
create index paragraph_revisions_revision_id_idx on content.paragraph_revisions (revision_id);
create index paragraph_revisions_reviewer_id_idx on content.paragraph_revisions (reviewer_id);

create index highlights_user_id_idx on public.highlights (user_id);
create index highlights_paragraph_id_idx on public.highlights (paragraph_id);
create index notes_user_id_idx on public.notes (user_id);
create index notes_paragraph_id_idx on public.notes (paragraph_id);
create index bookmarks_paragraph_id_idx on public.bookmarks (paragraph_id);
create index reading_progress_work_id_idx on public.reading_progress (work_id);
create index reading_progress_section_id_idx on public.reading_progress (section_id);
create index reading_progress_paragraph_id_idx on public.reading_progress (paragraph_id);

-- ---------------------------------------------------------------------------------------------
-- 7. Privileges: revoke everything, then grant the minimum
-- ---------------------------------------------------------------------------------------------

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all tables in schema content from public, anon, authenticated;
revoke all on all sequences in schema content from public, anon, authenticated;
revoke all on all functions in schema content from public, anon, authenticated;

grant all on all tables in schema content to service_role;
grant all on all sequences in schema content to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
-- Append-only tables: even a leaked service key cannot rewrite or wipe them (the triggers above
-- are the second line of defence).
revoke truncate, update, delete on content.paragraph_revisions from service_role;
revoke truncate, update, delete on public.audit_log from service_role;

-- Read-only catalogue for clients (rows are further limited by RLS to published editions).
grant select on public.authors, public.works, public.sections, public.paragraphs
  to anon, authenticated;
-- Editions: every column except `provenance` (internal extraction notes). Clients must list the
-- columns they read; `select *` on this table is a permission error by design.
-- NOTE (intended): headings, paragraph ids and positions of published editions are visible to
-- everybody, including editions with access 'account' or 'member'. That is the public table of
-- contents / teaser. The text is not here: it lives in schema `content` and is served only by the
-- gateway after the access check.
grant select (id, work_id, language, kind, licence_id, access, status, source_edition_id,
              created_at, updated_at)
  on public.editions to anon, authenticated;
-- Licences: only the columns a client needs to show attribution; contract details stay private.
grant select (id, code, licensor, status, allows_offline, share_alike, attribution_required,
              attribution_text)
  on public.licences to anon, authenticated;
grant select on public.app_config to anon, authenticated;

-- Profiles: read/insert own row; only harmless columns are writable (consents are server-written).
grant select on public.profiles to authenticated;
grant insert (user_id, display_name, preferred_tradition, locale) on public.profiles to authenticated;
grant update (display_name, preferred_tradition, locale) on public.profiles to authenticated;

-- Owner tables. (Later, writes move behind a `sync_push` RPC; the policies stay as defence in depth.)
grant select, insert, update, delete on public.highlights to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.bookmarks to authenticated;
grant select, insert, update, delete on public.reading_progress to authenticated;

-- Server-side access for the gateway (read-only on the catalogue and text).
grant select on public.licences, public.editions, public.edition_revisions, public.sections,
                public.paragraphs, public.entitlements, public.app_config
  to gateway_role;
grant select on content.paragraph_revisions to gateway_role;

-- ---------------------------------------------------------------------------------------------
-- 8. Row level security
-- ---------------------------------------------------------------------------------------------

alter table public.licences          enable row level security;
alter table public.authors           enable row level security;
alter table public.works             enable row level security;
alter table public.editions          enable row level security;
alter table public.edition_revisions enable row level security;
alter table public.sections          enable row level security;
alter table public.paragraphs        enable row level security;
alter table content.paragraph_revisions enable row level security;
alter table public.profiles          enable row level security;
alter table public.highlights        enable row level security;
alter table public.notes             enable row level security;
alter table public.bookmarks         enable row level security;
alter table public.reading_progress  enable row level security;
alter table public.entitlements      enable row level security;
alter table public.app_config        enable row level security;
alter table public.audit_log         enable row level security;

-- No policies (hence no access for client roles; service_role bypasses RLS) on:
--   edition_revisions, content.paragraph_revisions, entitlements, audit_log.
-- gateway_role has SELECT grants but no policy yet; it is meant to read through SECURITY DEFINER
-- functions, and gets explicit policies in the migration that implements them.

-- Catalogue: only published editions and what hangs off them.
create policy editions_read_published on public.editions
  for select to anon, authenticated
  using (status = 'published');

create policy works_read_published on public.works
  for select to anon, authenticated
  using (exists (
    select 1 from public.editions e
    where e.work_id = works.id and e.status = 'published'
  ));

create policy authors_read_published on public.authors
  for select to anon, authenticated
  using (exists (
    select 1
    from public.works w
    join public.editions e on e.work_id = w.id
    where w.author_id = authors.id and e.status = 'published'
  ));

create policy licences_read_published on public.licences
  for select to anon, authenticated
  using (exists (
    select 1 from public.editions e
    where e.licence_id = licences.id and e.status = 'published'
  ));

create policy sections_read_published on public.sections
  for select to anon, authenticated
  using (exists (
    select 1 from public.editions e
    where e.id = sections.edition_id and e.status = 'published'
  ));

create policy paragraphs_read_published on public.paragraphs
  for select to anon, authenticated
  using (exists (
    select 1 from public.editions e
    where e.id = paragraphs.edition_id and e.status = 'published'
  ));

create policy app_config_read_public on public.app_config
  for select to anon, authenticated
  using (is_public);

-- Owner policies.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy highlights_select_own on public.highlights
  for select to authenticated using (user_id = (select auth.uid()));
-- The EXISTS runs as the caller, so RLS on paragraphs applies: an id of a draft row is
-- indistinguishable from an id that does not exist.
create policy highlights_insert_own on public.highlights
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.paragraphs r where r.id = highlights.paragraph_id));
create policy highlights_update_own on public.highlights
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.paragraphs r where r.id = highlights.paragraph_id));
create policy highlights_delete_own on public.highlights
  for delete to authenticated using (user_id = (select auth.uid()));

create policy notes_select_own on public.notes
  for select to authenticated using (user_id = (select auth.uid()));
-- The EXISTS runs as the caller, so RLS on paragraphs applies: an id of a draft row is
-- indistinguishable from an id that does not exist.
create policy notes_insert_own on public.notes
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.paragraphs r where r.id = notes.paragraph_id));
create policy notes_update_own on public.notes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.paragraphs r where r.id = notes.paragraph_id));
create policy notes_delete_own on public.notes
  for delete to authenticated using (user_id = (select auth.uid()));

create policy bookmarks_select_own on public.bookmarks
  for select to authenticated using (user_id = (select auth.uid()));
-- The EXISTS runs as the caller, so RLS on paragraphs applies: an id of a draft row is
-- indistinguishable from an id that does not exist.
create policy bookmarks_insert_own on public.bookmarks
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.paragraphs r where r.id = bookmarks.paragraph_id));
create policy bookmarks_update_own on public.bookmarks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.paragraphs r where r.id = bookmarks.paragraph_id));
create policy bookmarks_delete_own on public.bookmarks
  for delete to authenticated using (user_id = (select auth.uid()));

create policy reading_progress_select_own on public.reading_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy reading_progress_insert_own on public.reading_progress
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.sections r where r.id = reading_progress.section_id));
create policy reading_progress_update_own on public.reading_progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.sections r where r.id = reading_progress.section_id));
create policy reading_progress_delete_own on public.reading_progress
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- 9. SECURITY DEFINER functions
-- ---------------------------------------------------------------------------------------------

-- Content access stubs. They run as the function owner, so they can read schema `content`.
-- EXECUTE is granted to the gateway only: the app talks to the gateway, never to these directly,
-- which keeps rate limits and entitlement checks in one place. Bodies arrive in a later migration.
--
-- WHEN THE BODIES ARE WRITTEN: these functions bypass RLS (they run as their owner), so they must
-- enforce `editions.access` ('public' | 'account' | 'member') and the caller's entitlement
-- themselves; `auth.uid()` is null when the gateway connects as `gateway_role`, so the user id
-- (or an already verified entitlement) has to be passed in and checked explicitly. Prefer a
-- dedicated non-superuser owner with BYPASSRLS limited to schema `content` over `postgres`.
-- Only `published` editions may ever be served. Cover each rule in tests/grants.sql.
create function public.get_chapter(p_edition_id public.ulid, p_section_id public.ulid)
returns table (paragraph_id public.ulid, ordinal integer, kind text, text_display text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  raise exception 'get_chapter is not implemented yet' using errcode = '0A000';
end
$$;

create function public.get_paragraphs(p_paragraph_ids public.ulid[])
returns table (paragraph_id public.ulid, section_id public.ulid, kind text, text_display text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  raise exception 'get_paragraphs is not implemented yet' using errcode = '0A000';
end
$$;

-- Server-side entitlement check; the client only ever learns a boolean about itself.
create function public.has_active_entitlement(p_entitlement text default 'membru')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.user_id = (select auth.uid())
      and e.entitlement = p_entitlement
      and e.active
      and (
        e.expires_at is null
        or e.expires_at > now()
        or coalesce(e.grace_until, '-infinity'::timestamptz) > now()
      )
  );
$$;

revoke all on function public.get_chapter(public.ulid, public.ulid) from public, anon, authenticated;
revoke all on function public.get_paragraphs(public.ulid[]) from public, anon, authenticated;
revoke all on function public.has_active_entitlement(text) from public, anon;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.enforce_user_quota() from public, anon, authenticated;
revoke all on function content.forbid_modification() from public, anon, authenticated;

grant execute on function public.get_chapter(public.ulid, public.ulid) to gateway_role, service_role;
grant execute on function public.get_paragraphs(public.ulid[]) to gateway_role, service_role;
grant execute on function public.has_active_entitlement(text) to authenticated, gateway_role, service_role;
