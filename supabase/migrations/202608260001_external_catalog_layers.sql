create table if not exists public.catalog_sources (
  id text primary key,
  display_name text not null,
  layer text not null check (layer in ('retailer_snapshot', 'odbl_bulk')),
  license text not null,
  attribution text not null,
  terms_url text not null,
  data_url text not null,
  redistributable boolean not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.retailer_catalog_products (
  source_id text not null references public.catalog_sources(id) on delete restrict,
  source_product_id text not null,
  retailer text not null check (retailer in ('Rimi', 'Livin')),
  url text not null,
  title text not null,
  brand text not null,
  gtin text,
  sku text,
  category text,
  pack_size text not null default '',
  nutrition_basis text not null check (nutrition_basis in ('100g', '100ml')),
  energy_kcal_100 numeric not null check (energy_kcal_100 >= 0),
  protein_g_100 numeric not null check (protein_g_100 >= 0),
  total_sugar_g_100 numeric not null check (total_sugar_g_100 >= 0),
  image_url text,
  price numeric check (price >= 0),
  currency text check (currency is null or currency = 'EUR'),
  available boolean,
  checked_at timestamptz not null,
  primary key (source_id, source_product_id)
);

-- Open Food Facts stays isolated because the database is ODbL. Do not merge
-- retailer-owned catalog rows into this table or publish a mixed derived dump.
create table if not exists public.open_food_facts_products (
  gtin text primary key,
  source_product_id text not null,
  url text not null,
  title text not null,
  brand text not null,
  category text,
  pack_size text not null default '',
  nutrition_basis text not null check (nutrition_basis in ('100g', '100ml')),
  energy_kcal_100 numeric not null check (energy_kcal_100 >= 0),
  protein_g_100 numeric not null check (protein_g_100 >= 0),
  total_sugar_g_100 numeric not null check (total_sugar_g_100 >= 0),
  image_url text,
  checked_at timestamptz not null,
  attribution text not null default 'Open Food Facts contributors',
  license text not null default 'ODbL-1.0'
);

create index if not exists retailer_catalog_gtin_idx on public.retailer_catalog_products(gtin);
create index if not exists retailer_catalog_identity_idx on public.retailer_catalog_products(lower(brand), lower(title));
create index if not exists open_food_facts_identity_idx on public.open_food_facts_products(lower(brand), lower(title));

alter table public.catalog_sources enable row level security;
alter table public.retailer_catalog_products enable row level security;
alter table public.open_food_facts_products enable row level security;

comment on table public.retailer_catalog_products is 'Non-redistributable retailer-page snapshots. Keep separate from ODbL data.';
comment on table public.open_food_facts_products is 'Isolated Open Food Facts ODbL subset for Latvia. Attribution is mandatory.';
