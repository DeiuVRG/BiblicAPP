-- pgTAP: privilege allow list and behavioural checks for the client roles.
--
-- Run with the Supabase CLI against a local stack:  supabase start && supabase test db
-- (see supabase/README.md). Part 1 enumerates what `anon` and `authenticated` can actually do in
-- schemas `public` and `content` and FAILS on anything outside the allow list below, so a new
-- table, function or GRANT cannot silently open the library to the anon key bundled in the app.
-- Part 2 checks row level security with real role switches.
--
-- To allow something new, add it to the allow list in the same pull request that adds the grant.

begin;

-- Supabase installs extensions in schema `extensions`; harmless if pgTAP is already enabled.
create extension if not exists pgtap with schema extensions;
-- The migration removes the built-in EXECUTE for PUBLIC from functions created by the migration
-- role, and this extension is created by that same role. The test switches to anon and
-- authenticated, which still have to call the pgTAP functions (transaction-local, rolled back).
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

select plan(53);

-- ---------------------------------------------------------------------------------------------
-- Allow list
-- ---------------------------------------------------------------------------------------------

create temp table _client_roles (role_name text primary key);
insert into _client_roles values ('anon'), ('authenticated');

-- Table-wide privileges (every column). Column privileges: SELECT, INSERT, UPDATE, REFERENCES.
create temp table _allow_tables (role_name text, rel text, priv text);
insert into _allow_tables (role_name, rel, priv)
select r, t, 'SELECT'
from unnest(array['anon', 'authenticated']) r,
     unnest(array['public.authors', 'public.works', 'public.sections',
                  'public.paragraphs', 'public.app_config']) t;
insert into _allow_tables (role_name, rel, priv)
select 'authenticated', t, p
from unnest(array['public.highlights', 'public.notes', 'public.bookmarks',
                  'public.reading_progress']) t,
     unnest(array['SELECT', 'INSERT', 'UPDATE']) p;
insert into _allow_tables values ('authenticated', 'public.profiles', 'SELECT');

-- Column-level privileges.
create temp table _allow_columns (role_name text, rel text, col text, priv text);
insert into _allow_columns (role_name, rel, col, priv)
select r, 'public.licences', c, 'SELECT'
from unnest(array['anon', 'authenticated']) r,
     unnest(array['id', 'code', 'licensor', 'status', 'allows_offline', 'share_alike',
                  'attribution_required', 'attribution_text']) c;
-- Editions: everything except `provenance`.
insert into _allow_columns (role_name, rel, col, priv)
select r, 'public.editions', c, 'SELECT'
from unnest(array['anon', 'authenticated']) r,
     unnest(array['id', 'work_id', 'language', 'kind', 'licence_id', 'access', 'status',
                  'source_edition_id', 'created_at', 'updated_at']) c;
insert into _allow_columns (role_name, rel, col, priv)
select 'authenticated', 'public.profiles', c, 'INSERT'
from unnest(array['user_id', 'display_name', 'preferred_tradition', 'locale']) c;
insert into _allow_columns (role_name, rel, col, priv)
select 'authenticated', 'public.profiles', c, 'UPDATE'
from unnest(array['display_name', 'preferred_tradition', 'locale']) c;

-- Table-level only privileges (no column variant).
create temp table _allow_table_only (role_name text, rel text, priv text);
insert into _allow_table_only
select 'authenticated', t, 'DELETE'
from unnest(array['public.highlights', 'public.notes', 'public.bookmarks',
                  'public.reading_progress']) t;

-- EXECUTE (schema.name, overloads not distinguished).
create temp table _allow_functions (role_name text, fn text);
insert into _allow_functions values ('authenticated', 'public.has_active_entitlement');

-- Relations we own (exclude anything that belongs to an extension, e.g. pgTAP itself).
create temp view _our_relations as
select c.oid as relid, n.nspname || '.' || c.relname as rel, c.relkind
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'content')
  and not exists (
    select 1 from pg_depend d
    where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e'
  );

create temp view _our_functions as
select p.oid as fnid, n.nspname || '.' || p.proname as fn, p.prosecdef, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'content')
  and p.prokind in ('f', 'p')
  and not exists (
    select 1 from pg_depend d
    where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
  );

create temp view _expected_column_privs as
select t.role_name, t.rel, a.attname::text as col, t.priv
from _allow_tables t
join _our_relations o on o.rel = t.rel
join pg_attribute a on a.attrelid = o.relid and a.attnum > 0 and not a.attisdropped
where t.priv in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
union
select role_name, rel, col, priv from _allow_columns;

create temp view _actual_column_privs as
select r.role_name, o.rel, a.attname::text as col, p.priv
from _client_roles r
cross join _our_relations o
join pg_attribute a on a.attrelid = o.relid and a.attnum > 0 and not a.attisdropped
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) p(priv)
where o.relkind in ('r', 'p', 'v', 'm', 'f')
  and has_column_privilege(r.role_name, o.relid, a.attnum, p.priv);

create temp view _actual_table_only_privs as
select r.role_name, o.rel, p.priv
from _client_roles r
cross join _our_relations o
cross join (values ('DELETE'), ('TRUNCATE'), ('TRIGGER')) p(priv)
where o.relkind in ('r', 'p', 'v', 'm', 'f')
  and has_table_privilege(r.role_name, o.relid, p.priv);

-- ---------------------------------------------------------------------------------------------
-- Part 1: structure and privileges (run as the migration owner)
-- ---------------------------------------------------------------------------------------------

select is_empty(
  $q$ select rel from _our_relations o
      join pg_class c on c.oid = o.relid
      where o.relkind in ('r', 'p') and not c.relrowsecurity $q$,
  'RLS is enabled on every table in public and content'
);

select is_empty(
  $q$ select * from _actual_column_privs
      except select * from _expected_column_privs $q$,
  'anon/authenticated have no column privileges outside the allow list'
);

select is_empty(
  $q$ select * from _expected_column_privs
      except select * from _actual_column_privs $q$,
  'every allow-listed column privilege is actually granted (allow list is not stale)'
);

select is_empty(
  $q$ select * from _actual_table_only_privs
      except select * from _allow_table_only $q$,
  'anon/authenticated have no DELETE/TRUNCATE/TRIGGER outside the allow list'
);

select is_empty(
  $q$ select * from _allow_table_only
      except select * from _actual_table_only_privs $q$,
  'every allow-listed DELETE privilege is actually granted'
);

select is_empty(
  $q$ select r.role_name, o.rel, p.priv
      from _client_roles r
      cross join _our_relations o
      cross join (values ('USAGE'), ('SELECT'), ('UPDATE')) p(priv)
      where o.relkind = 'S' and has_sequence_privilege(r.role_name, o.relid, p.priv) $q$,
  'anon/authenticated have no privileges on sequences'
);

select is_empty(
  $q$ select r.role_name, f.fn
      from _client_roles r
      cross join _our_functions f
      where has_function_privilege(r.role_name, f.fnid, 'EXECUTE')
      except select role_name, fn from _allow_functions $q$,
  'anon/authenticated cannot EXECUTE any function outside the allow list'
);

select ok(
  has_function_privilege('authenticated', 'public.has_active_entitlement(text)', 'EXECUTE'),
  'authenticated can execute has_active_entitlement'
);

select is_empty(
  $q$ select fn from _our_functions
      where prosecdef
        and not exists (select 1 from unnest(coalesce(proconfig, '{}')) c
                        where c like 'search_path=%') $q$,
  'every SECURITY DEFINER function pins search_path'
);

-- Default privileges: a function added by a later migration must not be callable by clients.
create function public._probe_default_privileges() returns integer
language sql as 'select 1';
select ok(
  not has_function_privilege('anon', 'public._probe_default_privileges()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public._probe_default_privileges()', 'EXECUTE'),
  'a new function is not executable by anon/authenticated (default privileges)'
);
drop function public._probe_default_privileges();

select ok(
  not has_table_privilege('service_role', 'public.audit_log', 'TRUNCATE')
    and not has_table_privilege('service_role', 'public.audit_log', 'DELETE')
    and not has_table_privilege('service_role', 'content.paragraph_revisions', 'TRUNCATE')
    and not has_table_privilege('service_role', 'content.paragraph_revisions', 'UPDATE'),
  'service_role cannot truncate, update or delete the append-only tables'
);

select ok(not has_schema_privilege('anon', 'content', 'USAGE'), 'anon has no USAGE on schema content');
select ok(not has_schema_privilege('authenticated', 'content', 'USAGE'),
          'authenticated has no USAGE on schema content');
select ok(not has_schema_privilege('anon', 'public', 'CREATE'), 'anon cannot create objects in public');
select ok(not has_schema_privilege('authenticated', 'public', 'CREATE'),
          'authenticated cannot create objects in public');

select ok(
  has_function_privilege('gateway_role', 'public.get_chapter(public.ulid, public.ulid)', 'EXECUTE'),
  'gateway_role can execute get_chapter'
);
select ok(
  not has_table_privilege('gateway_role', 'content.paragraph_revisions', 'INSERT'),
  'gateway_role cannot write canonical text'
);

-- ---------------------------------------------------------------------------------------------
-- Fixtures (as owner; RLS does not apply)
-- ---------------------------------------------------------------------------------------------

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'b@example.test');

insert into public.licences (id, code, licensor, status, document_url) values
  ('00000000-0000-0000-0000-000000000c01', 'pd', 'Public domain', 'public-domain', 'https://example.test/secret-contract');

insert into public.authors (id, slug, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'published-author', 'Published Author'),
  ('00000000-0000-0000-0000-0000000000a2', 'draft-author', 'Draft Author');

insert into public.works (id, slug, author_id, title_ro, title_orig, language_orig) values
  ('00000000000000000000000001', 'published-work', '00000000-0000-0000-0000-0000000000a1', 'Lucrare', 'Work', 'en'),
  ('00000000000000000000000002', 'draft-work', '00000000-0000-0000-0000-0000000000a2', 'Ciornă', 'Draft', 'en');

insert into public.editions (id, work_id, language, kind, licence_id, status) values
  ('00000000000000000000000011', '00000000000000000000000001', 'en', 'source', '00000000-0000-0000-0000-000000000c01', 'published'),
  ('00000000000000000000000012', '00000000000000000000000002', 'en', 'source', '00000000-0000-0000-0000-000000000c01', 'draft');

insert into public.edition_revisions (id, edition_id, revision) values
  ('00000000-0000-0000-0000-000000000e01', '00000000000000000000000011', 1);

insert into public.sections (id, edition_id, ordinal, kind, heading) values
  ('00000000000000000000000021', '00000000000000000000000011', 0, 'chapter', 'Chapter I'),
  ('00000000000000000000000022', '00000000000000000000000012', 0, 'chapter', 'Draft chapter');

insert into public.paragraphs (id, edition_id, section_id, ordinal) values
  ('00000000000000000000000031', '00000000000000000000000011', '00000000000000000000000021', 0),
  ('00000000000000000000000032', '00000000000000000000000012', '00000000000000000000000022', 0);

insert into content.paragraph_revisions (paragraph_id, revision_id, text_canonical) values
  ('00000000000000000000000031', '00000000-0000-0000-0000-000000000e01', 'Secret canonical text.');

insert into public.profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'Original A'),
  ('00000000-0000-0000-0000-00000000000b', 'Original B');

insert into public.notes (user_id, paragraph_id, body) values
  ('00000000-0000-0000-0000-00000000000a', '00000000000000000000000031', 'A private note');

insert into public.entitlements (user_id, entitlement, active, expires_at) values
  ('00000000-0000-0000-0000-00000000000a', 'membru', true, now() + interval '30 days');

insert into public.app_config (key, value, is_public) values
  ('min_app_version', '"0.1.0"', true),
  ('internal_budget', '{"usd": 100}', false);

insert into public.audit_log (action, entity) values ('fixture', 'test');

-- ---------------------------------------------------------------------------------------------
-- Part 2a: anonymous visitor (the key shipped in the app bundle)
-- ---------------------------------------------------------------------------------------------

set local role anon;

select is((select count(*) from public.works), 1::bigint, 'anon sees only works with a published edition');
select is((select count(*) from public.editions), 1::bigint, 'anon sees only published editions');
select is((select count(*) from public.authors), 1::bigint, 'anon sees only authors of published works');
select is((select count(*) from public.paragraphs), 1::bigint, 'anon sees only paragraph metadata of published editions');
select is((select count(*) from public.app_config), 1::bigint, 'anon sees only public app_config keys');
select throws_ok(
  $q$ select document_url from public.licences $q$, '42501', null,
  'anon cannot read licence contract details'
);
select throws_ok(
  $q$ select provenance from public.editions $q$, '42501', null,
  'anon cannot read edition provenance'
);
select throws_ok(
  $q$ select text_canonical from content.paragraph_revisions $q$, '42501', null,
  'anon cannot read canonical text'
);
select throws_ok(
  $q$ select * from public.entitlements $q$, '42501', null,
  'anon cannot read entitlements'
);
select throws_ok($q$ select * from public.audit_log $q$, '42501', null, 'anon cannot read the audit log');
select throws_ok($q$ select * from public.notes $q$, '42501', null, 'anon cannot read notes');
select throws_ok(
  $q$ select * from public.get_chapter('00000000000000000000000011', '00000000000000000000000021') $q$,
  '42501', null, 'anon cannot call get_chapter'
);
select throws_ok(
  $q$ insert into public.works (id, slug, author_id, title_ro, title_orig, language_orig)
      values ('00000000000000000000000099', 'x', '00000000-0000-0000-0000-0000000000a1', 'x', 'x', 'en') $q$,
  '42501', null, 'anon cannot write the catalogue'
);

reset role;

-- ---------------------------------------------------------------------------------------------
-- Part 2b: signed-in user A
-- ---------------------------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;

select is(auth.uid(), '00000000-0000-0000-0000-00000000000a'::uuid, 'test harness: auth.uid() is user A');
select is((select count(*) from public.notes), 1::bigint, 'A sees their own note');
select is((select count(*) from public.profiles), 1::bigint, 'A sees only their own profile');
select lives_ok(
  $q$ insert into public.notes (paragraph_id, body)
      values ('00000000000000000000000031', 'Second note') $q$,
  'A can create a note (user_id defaults to auth.uid())'
);
select throws_ok(
  $q$ insert into public.notes (user_id, paragraph_id, body)
      values ('00000000-0000-0000-0000-00000000000b', '00000000000000000000000031', 'Forged') $q$,
  '42501', null, 'A cannot create a note owned by B'
);
select throws_ok(
  $q$ insert into public.notes (paragraph_id, body)
      values ('00000000000000000000000032', 'Probe a draft paragraph id') $q$,
  '42501', null, 'A cannot attach a note to a paragraph of an unpublished edition'
);
select throws_ok(
  $q$ update public.profiles set locale = 'not a locale!' $q$, '23514', null,
  'profiles.locale must look like a language tag'
);
select lives_ok(
  $q$ update public.profiles set display_name = 'Changed A' $q$,
  'A can update their display name'
);
select is((select display_name from public.profiles), 'Changed A', 'the profile update took effect');
select throws_ok(
  $q$ update public.profiles set consents = '{"ai": true}' $q$, '42501', null,
  'A cannot write consent records from the client'
);
select ok(public.has_active_entitlement(), 'A has an active membership entitlement');
select throws_ok($q$ select * from public.entitlements $q$, '42501', null, 'A cannot read the entitlements table');
select throws_ok(
  $q$ select text_canonical from content.paragraph_revisions $q$, '42501', null,
  'authenticated cannot read canonical text'
);
select throws_ok(
  $q$ select * from public.get_paragraphs(array['00000000000000000000000031']::public.ulid[]) $q$,
  '42501', null, 'authenticated cannot call get_paragraphs'
);

reset role;

-- ---------------------------------------------------------------------------------------------
-- Part 2c: signed-in user B (must not see or touch A's rows)
-- ---------------------------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.notes), 0::bigint, 'B does not see A''s notes');
-- RLS filters foreign rows out silently: the statements succeed but affect nothing (verified below).
select lives_ok(
  $q$ update public.notes set body = 'hacked' $q$,
  'B''s update of A''s notes is filtered out by RLS'
);
select lives_ok(
  $q$ delete from public.notes $q$,
  'B''s delete of A''s notes is filtered out by RLS'
);
select ok(not public.has_active_entitlement(), 'B has no membership entitlement');

reset role;

-- ---------------------------------------------------------------------------------------------
-- Part 2d: append-only tables (even for the owner)
-- ---------------------------------------------------------------------------------------------

select is(
  (select count(*) from public.notes where user_id = '00000000-0000-0000-0000-00000000000a' and body <> 'hacked'),
  2::bigint, 'A''s two notes are untouched after B''s update and delete attempts'
);
select throws_ok(
  $q$ update content.paragraph_revisions set text_canonical = 'rewritten' $q$, '42501', null,
  'paragraph revisions are append-only'
);
select throws_ok(
  $q$ delete from public.audit_log $q$, '42501', null,
  'the audit log is append-only'
);
select throws_ok(
  $q$ truncate public.audit_log $q$, '42501', null,
  'the audit log cannot be truncated'
);
select throws_ok(
  $q$ truncate content.paragraph_revisions $q$, '42501', null,
  'paragraph revisions cannot be truncated'
);

select * from finish();

rollback;
