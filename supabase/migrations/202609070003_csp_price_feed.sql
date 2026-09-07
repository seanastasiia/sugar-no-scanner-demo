-- CSP data is legally scoped to a free food-price-comparison purpose. It is
-- not nutrition evidence and must stay isolated from retailer/OFF composition.
alter table public.catalog_sources
  drop constraint if exists catalog_sources_layer_check;
alter table public.catalog_sources
  add constraint catalog_sources_layer_check
  check (layer in ('retailer_snapshot', 'odbl_bulk', 'government_price_feed'));

create table if not exists public.csp_food_price_records (
  price_date date not null,
  retailer text not null check (retailer in ('Rimi', 'Lidl', 'Maxima')),
  gtin text not null check (gtin ~ '^[0-9]{14}$'),
  source_gtin text not null check (source_gtin ~ '^[0-9]{8,14}$'),
  item_name text not null,
  base_price_package numeric not null check (base_price_package > 0),
  base_price_unit numeric not null check (base_price_unit > 0),
  discount_price numeric check (discount_price >= 0),
  quantity numeric not null check (quantity > 0),
  unit text not null check (unit in ('kg', 'l', 'gab')),
  store_type text,
  availability text,
  manufacturer text,
  manufacturer_country text,
  url text,
  hierarchy text[] not null default '{}'::text[],
  description text,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  imported_at timestamptz not null,
  primary key (price_date, retailer, gtin)
);

create table if not exists public.csp_product_identities (
  gtin text primary key check (gtin ~ '^[0-9]{14}$'),
  source_product_id text not null check (source_product_id ~ '^[0-9]{8,14}$'),
  title text not null,
  aliases text[] not null default '{}'::text[],
  manufacturer text not null,
  pack_size text not null,
  category text,
  source_url text not null,
  checked_at timestamptz not null,
  permitted_purpose text not null default 'free_food_price_comparison'
    check (permitted_purpose = 'free_food_price_comparison')
);

create index if not exists csp_food_price_gtin_idx on public.csp_food_price_records(gtin, price_date desc);
create index if not exists csp_product_identity_name_idx on public.csp_product_identities(lower(manufacturer), lower(title));
create index if not exists csp_product_identity_aliases_idx on public.csp_product_identities using gin(aliases);

alter table public.csp_food_price_records enable row level security;
alter table public.csp_product_identities enable row level security;
revoke all on table public.csp_food_price_records, public.csp_product_identities from public, anon, authenticated;
grant select, insert, update on table public.csp_food_price_records, public.csp_product_identities to service_role;

comment on table public.csp_food_price_records is
  'CSP daily basic-food price rows for a free consumer price-comparison purpose only. Contains no nutrition, ingredients, score or user images.';
comment on table public.csp_product_identities is
  'Identity projection of permitted CSP price rows. It cannot produce Personal Fit without separate exact composition evidence.';
