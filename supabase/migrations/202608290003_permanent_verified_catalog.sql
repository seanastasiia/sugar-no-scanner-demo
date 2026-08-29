alter table public.retailer_catalog_products
  add column if not exists nutrition_source_kind text,
  add column if not exists nutrition_verified_at timestamptz,
  add column if not exists nutrition_revalidate_after timestamptz,
  add column if not exists price_verified_at timestamptz,
  add column if not exists price_revalidate_after timestamptz,
  add column if not exists snapshot_checked_at timestamptz;

update public.retailer_catalog_products
set nutrition_source_kind = coalesce(nutrition_source_kind, 'retailer'),
    nutrition_verified_at = coalesce(nutrition_verified_at, checked_at),
    nutrition_revalidate_after = coalesce(nutrition_revalidate_after, checked_at + interval '90 days'),
    price_verified_at = case when price is not null then coalesce(price_verified_at, checked_at) else null end,
    price_revalidate_after = case when price is not null then coalesce(price_revalidate_after, checked_at + interval '24 hours') else null end,
    snapshot_checked_at = coalesce(snapshot_checked_at, checked_at);

alter table public.retailer_catalog_products
  alter column nutrition_source_kind set default 'retailer',
  alter column nutrition_source_kind set not null,
  alter column nutrition_verified_at set not null,
  alter column nutrition_revalidate_after set not null,
  alter column snapshot_checked_at set not null;

alter table public.retailer_catalog_products
  drop constraint if exists retailer_catalog_products_nutrition_source_kind_check;
alter table public.retailer_catalog_products
  add constraint retailer_catalog_products_nutrition_source_kind_check
  check (nutrition_source_kind in ('web', 'retailer', 'manufacturer', 'label', 'database'));

create table if not exists public.retailer_catalog_product_versions (
  source_id text not null references public.catalog_sources(id) on delete restrict,
  source_product_id text not null,
  version_hash text not null,
  nutrition_source_kind text not null check (nutrition_source_kind in ('web', 'retailer', 'manufacturer', 'label', 'database')),
  source_url text not null,
  title text not null,
  nutrition_basis text not null check (nutrition_basis in ('100g', '100ml')),
  energy_kcal_100 numeric not null check (energy_kcal_100 >= 0),
  protein_g_100 numeric not null check (protein_g_100 >= 0),
  total_sugar_g_100 numeric not null check (total_sugar_g_100 >= 0),
  image_url text,
  verified_at timestamptz not null,
  revalidate_after timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (source_id, source_product_id, version_hash)
);

alter table public.web_nutrition_cache
  add column if not exists revalidate_after timestamptz,
  add column if not exists last_revalidation_attempt_at timestamptz,
  add column if not exists last_revalidation_error text;

update public.web_nutrition_cache
set revalidate_after = coalesce(revalidate_after, expires_at);

alter table public.web_nutrition_cache
  alter column revalidate_after set not null;

create table if not exists public.web_nutrition_cache_versions (
  cache_key text not null,
  version_hash text not null,
  result jsonb not null,
  model text not null,
  verified_at timestamptz not null,
  revalidate_after timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (cache_key, version_hash)
);

drop table if exists public.retailer_catalog_discovery;

create index if not exists retailer_catalog_revalidate_idx
  on public.retailer_catalog_products(source_id, nutrition_revalidate_after);
create index if not exists retailer_catalog_versions_product_idx
  on public.retailer_catalog_product_versions(source_id, source_product_id, verified_at desc);
create index if not exists web_nutrition_revalidate_idx
  on public.web_nutrition_cache(status, revalidate_after);
create index if not exists web_nutrition_versions_key_idx
  on public.web_nutrition_cache_versions(cache_key, verified_at desc);

alter table public.retailer_catalog_product_versions enable row level security;
alter table public.web_nutrition_cache_versions enable row level security;

revoke all on table public.retailer_catalog_product_versions from anon, authenticated;
revoke all on table public.web_nutrition_cache_versions from anon, authenticated;
grant select, insert, update, delete on table public.catalog_sources to service_role;
grant select, insert, update, delete on table public.retailer_catalog_products to service_role;
grant select, insert, update, delete on table public.open_food_facts_products to service_role;
grant select, insert, update, delete on table public.catalog_sync_runs to service_role;
grant select, insert, update, delete on table public.retailer_catalog_product_versions to service_role;
grant select, insert, update, delete on table public.web_nutrition_cache_versions to service_role;

comment on table public.retailer_catalog_products is
  'Current verified retailer nutrition. Barbora contains only exact SKUs with source-backed protein and total sugar. Revalidation dates never delete a verified row.';
comment on table public.retailer_catalog_product_versions is
  'Append-only verified retailer nutrition versions. Camera images are never stored.';
comment on table public.web_nutrition_cache is
  'Permanent current exact-SKU web nutrition. revalidate_after schedules a refresh and is not an expiry date.';
comment on table public.web_nutrition_cache_versions is
  'Append-only exact-SKU web nutrition versions. Failed refreshes do not replace a previously verified result.';
