-- Identity-only OFF rows improve exact recognition but must never imply that
-- nutrition or ingredients are known. Keep this ODbL data isolated from
-- retailer snapshots and from the nutrition-complete OFF table.
create table if not exists public.open_food_facts_product_identities (
  gtin text primary key check (gtin ~ '^[0-9]{14}$'),
  source_product_id text not null unique check (source_product_id ~ '^[0-9]{8,14}$'),
  url text not null,
  title text not null,
  aliases text[] not null default '{}'::text[],
  brand text not null,
  category text,
  pack_size text not null default '',
  checked_at timestamptz not null,
  attribution text not null default 'Open Food Facts contributors',
  license text not null default 'ODbL-1.0'
);

create index if not exists open_food_facts_product_identities_name_idx
  on public.open_food_facts_product_identities(lower(brand), lower(title));
create index if not exists open_food_facts_product_identities_aliases_idx
  on public.open_food_facts_product_identities using gin (aliases);

alter table public.open_food_facts_product_identities enable row level security;
revoke all on table public.open_food_facts_product_identities from public, anon, authenticated;
grant select, insert, update, delete on table public.open_food_facts_product_identities to service_role;

comment on table public.open_food_facts_product_identities is
  'ODbL Open Food Facts product identities for exact recognition. No nutrition, ingredient, score or user-image fields are stored.';
