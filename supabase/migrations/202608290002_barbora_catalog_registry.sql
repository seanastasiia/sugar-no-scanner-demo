alter table public.retailer_catalog_products
  drop constraint if exists retailer_catalog_products_retailer_check;

alter table public.retailer_catalog_products
  add constraint retailer_catalog_products_retailer_check
  check (retailer in ('Barbora', 'Rimi', 'Livin'));

create table if not exists public.retailer_catalog_discovery (
  source_id text not null references public.catalog_sources(id) on delete restrict,
  source_product_id text not null,
  retailer text not null check (retailer in ('Barbora', 'Rimi', 'Livin')),
  url text not null,
  in_product_index boolean not null default true,
  is_food boolean not null default false,
  has_complete_nutrition boolean not null default false,
  active_in_snapshot boolean not null default true,
  snapshot_checked_at timestamptz not null,
  primary key (source_id, source_product_id)
);

create table if not exists public.catalog_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.catalog_sources(id) on delete restrict,
  status text not null check (status in ('running', 'complete', 'failed')),
  snapshot_checksum text not null,
  discovered_count integer not null default 0 check (discovered_count >= 0),
  registry_count integer not null default 0 check (registry_count >= 0),
  food_count integer not null default 0 check (food_count >= 0),
  food_outside_discovery_count integer not null default 0 check (food_outside_discovery_count >= 0),
  complete_nutrition_count integer not null default 0 check (complete_nutrition_count >= 0),
  priced_count integer not null default 0 check (priced_count >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  unique(source_id, snapshot_checksum)
);

create index if not exists retailer_catalog_discovery_food_idx
  on public.retailer_catalog_discovery(source_id, is_food, has_complete_nutrition);
create index if not exists catalog_sync_runs_source_completed_idx
  on public.catalog_sync_runs(source_id, completed_at desc);

alter table public.retailer_catalog_discovery enable row level security;
alter table public.catalog_sync_runs enable row level security;

comment on table public.retailer_catalog_discovery is
  'Compact retailer discovery registry. A row proves only that the exact page was discovered, not that nutrition or a current price was verified.';
comment on table public.catalog_sync_runs is
  'Auditable catalog snapshot counts and checksum. Camera images are never stored here.';
