-- Shared Open Food Facts observations stay in their own ODbL-1.0 layer.
-- Retailer-page records must never be inserted here.
create table if not exists public.shared_open_food_facts_products (
  gtin text primary key check (gtin ~ '^[0-9]{14}$'),
  identity_hash text not null check (identity_hash ~ '^[0-9a-f]{64}$'),
  composition_hash text not null check (composition_hash ~ '^[0-9a-f]{64}$'),
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  checked_at timestamptz not null,
  blocked boolean not null default false,
  attribution text not null default 'Open Food Facts contributors',
  license text not null default 'ODbL-1.0',
  check (record->>'code' = gtin)
);

create table if not exists public.shared_open_food_facts_aliases (
  alias_key text primary key check (alias_key ~ '^off-v1:[0-9a-f]{64}$'),
  gtin text not null references public.shared_open_food_facts_products(gtin) on delete restrict,
  blocked boolean not null default false
);

create table if not exists public.shared_open_food_facts_observations (
  version_hash text primary key check (version_hash ~ '^[0-9a-f]{64}$'),
  gtin text not null check (gtin ~ '^[0-9]{14}$'),
  alias_key text not null default '' check (alias_key = '' or alias_key ~ '^off-v1:[0-9a-f]{64}$'),
  identity_hash text not null check (identity_hash ~ '^[0-9a-f]{64}$'),
  composition_hash text not null check (composition_hash ~ '^[0-9a-f]{64}$'),
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  decision text not null check (decision in ('accepted', 'conflict')),
  observed_at timestamptz not null
);

alter table public.shared_open_food_facts_products enable row level security;
alter table public.shared_open_food_facts_aliases enable row level security;
alter table public.shared_open_food_facts_observations enable row level security;
revoke all on public.shared_open_food_facts_products, public.shared_open_food_facts_aliases, public.shared_open_food_facts_observations from public, anon, authenticated, service_role;
grant select, insert, update on public.shared_open_food_facts_products to service_role;
grant select, insert, update on public.shared_open_food_facts_aliases to service_role;
grant select, insert on public.shared_open_food_facts_observations to service_role;

create or replace function public.promote_shared_open_food_facts_product(
  p_gtin text,
  p_alias_key text,
  p_record jsonb,
  p_checked_at timestamptz,
  p_identity_hash text,
  p_composition_hash text,
  p_version_hash text
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  current_row public.shared_open_food_facts_products%rowtype;
  current_alias public.shared_open_food_facts_aliases%rowtype;
begin
  if p_gtin !~ '^[0-9]{14}$'
     or jsonb_typeof(p_record) <> 'object'
     or p_record->>'code' <> p_gtin
     or p_identity_hash !~ '^[0-9a-f]{64}$'
     or p_composition_hash !~ '^[0-9a-f]{64}$'
     or p_version_hash !~ '^[0-9a-f]{64}$'
     or (p_alias_key <> '' and p_alias_key !~ '^off-v1:[0-9a-f]{64}$') then
    raise exception 'invalid shared Open Food Facts observation';
  end if;

  if p_alias_key <> '' then
    perform pg_advisory_xact_lock(hashtext(p_alias_key));
    select * into current_alias from public.shared_open_food_facts_aliases where alias_key = p_alias_key;
    if found and (current_alias.blocked or current_alias.gtin <> p_gtin) then
      update public.shared_open_food_facts_aliases set blocked = true where alias_key = p_alias_key;
      insert into public.shared_open_food_facts_observations
        (version_hash, gtin, alias_key, identity_hash, composition_hash, record, decision, observed_at)
        values (p_version_hash, p_gtin, p_alias_key, p_identity_hash, p_composition_hash, p_record, 'conflict', p_checked_at)
        on conflict do nothing;
      return jsonb_build_object('status', 'conflict');
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_gtin));
  select * into current_row from public.shared_open_food_facts_products where gtin = p_gtin;

  if found and (current_row.blocked or current_row.identity_hash <> p_identity_hash or current_row.composition_hash <> p_composition_hash) then
    update public.shared_open_food_facts_products set blocked = true where gtin = p_gtin;
    if p_alias_key <> '' then
      insert into public.shared_open_food_facts_aliases (alias_key, gtin, blocked)
        values (p_alias_key, p_gtin, true)
        on conflict (alias_key) do update set blocked = true;
    end if;
    insert into public.shared_open_food_facts_observations
      (version_hash, gtin, alias_key, identity_hash, composition_hash, record, decision, observed_at)
      values (p_version_hash, p_gtin, p_alias_key, p_identity_hash, p_composition_hash, p_record, 'conflict', p_checked_at)
      on conflict do nothing;
    return jsonb_build_object('status', 'conflict');
  end if;

  insert into public.shared_open_food_facts_products
    (gtin, identity_hash, composition_hash, record, checked_at)
    values (p_gtin, p_identity_hash, p_composition_hash, p_record, p_checked_at)
  on conflict (gtin) do update set
    record = case when excluded.checked_at >= shared_open_food_facts_products.checked_at then excluded.record else shared_open_food_facts_products.record end,
    checked_at = greatest(shared_open_food_facts_products.checked_at, excluded.checked_at);

  if p_alias_key <> '' then
    insert into public.shared_open_food_facts_aliases (alias_key, gtin)
      values (p_alias_key, p_gtin)
      on conflict (alias_key) do nothing;
  end if;

  insert into public.shared_open_food_facts_observations
    (version_hash, gtin, alias_key, identity_hash, composition_hash, record, decision, observed_at)
    values (p_version_hash, p_gtin, p_alias_key, p_identity_hash, p_composition_hash, p_record, 'accepted', p_checked_at)
    on conflict do nothing;
  return jsonb_build_object('status', 'accepted');
end;
$$;

revoke all on function public.promote_shared_open_food_facts_product(text,text,jsonb,timestamptz,text,text,text) from public, anon, authenticated;
grant execute on function public.promote_shared_open_food_facts_product(text,text,jsonb,timestamptz,text,text,text) to service_role;

comment on table public.shared_open_food_facts_products is
  'Server-only shared Open Food Facts observations. ODbL attribution and share-alike apply.';
