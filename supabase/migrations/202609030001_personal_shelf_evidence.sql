-- Additive evidence only. Legacy Fit tables and scoring are unchanged.
-- Keep retailer data and ODbL data physically separate. No anonymous writes.
create table if not exists public.retailer_shelf_evidence (
  product_id text primary key,
  evidence jsonb not null,
  checked_at timestamptz not null,
  constraint retailer_shelf_identity check ((evidence->>'productId' = product_id) is true),
  constraint retailer_shelf_source check ((evidence->>'source' in ('barbora_lv', 'livinn_lt')) is true)
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
