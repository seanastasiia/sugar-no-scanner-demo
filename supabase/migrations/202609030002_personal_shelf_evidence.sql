-- Additive evidence only. Legacy Fit tables and scoring are unchanged.
-- Keep retailer data and ODbL data physically separate. No anonymous writes.
create table if not exists public.retailer_shelf_evidence (
  product_id text primary key,
  evidence jsonb not null,
  checked_at timestamptz not null,
  constraint retailer_shelf_identity check ((evidence->>'productId' = product_id) is true),
  constraint retailer_shelf_source check ((evidence->>'source' in ('barbora_lv', 'rimi_lv', 'livinn_lt')) is true)
);
alter table public.retailer_shelf_evidence enable row level security;
revoke all on public.retailer_shelf_evidence from anon, authenticated;
grant all on public.retailer_shelf_evidence to service_role;

create table if not exists public.open_food_facts_shelf_evidence (
  product_id text primary key,
  evidence jsonb not null,
  checked_at timestamptz not null,
  constraint off_shelf_identity check ((evidence->>'productId' = product_id) is true),
  constraint off_shelf_source check ((evidence->>'source' = 'open_food_facts') is true)
);
alter table public.open_food_facts_shelf_evidence enable row level security;
revoke all on public.open_food_facts_shelf_evidence from anon, authenticated;
grant all on public.open_food_facts_shelf_evidence to service_role;

-- A replay/older batch cannot overwrite a newer observation. Keep each source's
-- entire table together: this lane never merges fields across shops or recipes.
create or replace function public.upsert_personal_shelf_evidence(p_evidence jsonb)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  product text := p_evidence->>'productId';
  source_name text := p_evidence->>'source';
  observed_at timestamptz;
  affected integer;
begin
  if jsonb_typeof(p_evidence) is distinct from 'object' or product is null
    or (p_evidence->>'checkedAt') is null then raise exception 'Invalid shelf evidence'; end if;
  observed_at := (p_evidence->>'checkedAt')::timestamptz;
  if source_name = 'open_food_facts' and product ~ '^off:[0-9]{8,14}$' then
    insert into public.open_food_facts_shelf_evidence(product_id, evidence, checked_at)
    values (product, p_evidence, observed_at)
    on conflict (product_id) do update set evidence = excluded.evidence, checked_at = excluded.checked_at
    where open_food_facts_shelf_evidence.checked_at < excluded.checked_at;
  elsif (source_name = 'barbora_lv' and product ~ '^barbora:[a-z0-9-]+$')
    or (source_name = 'rimi_lv' and product ~ '^rimi_lv:[A-Za-z0-9._~-]+$')
    or (source_name = 'livinn_lt' and product ~ '^livinn_lt:[A-Za-z0-9._~-]+$') then
    insert into public.retailer_shelf_evidence(product_id, evidence, checked_at)
    values (product, p_evidence, observed_at)
    on conflict (product_id) do update set evidence = excluded.evidence, checked_at = excluded.checked_at
    where retailer_shelf_evidence.checked_at < excluded.checked_at;
  else raise exception 'Shelf source and identity conflict'; end if;
  get diagnostics affected = row_count;
  return case when affected = 1 then 'written' else 'not_newer' end;
end $$;
revoke all on function public.upsert_personal_shelf_evidence(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_personal_shelf_evidence(jsonb) to service_role;
