alter table if exists public.retailer_catalog_products
  add column if not exists aliases text[] not null default '{}'::text[];

create index if not exists retailer_catalog_aliases_idx
  on public.retailer_catalog_products using gin (aliases);

comment on column public.retailer_catalog_products.aliases is
  'Source-backed multilingual names and alternate product-page slugs for exact SKU matching.';

create table if not exists public.retailer_catalog_food_identities (
  source_id text not null references public.catalog_sources(id) on delete restrict,
  source_product_id text not null,
  retailer text not null check (retailer = 'Livin'),
  url text not null,
  title text not null,
  aliases text[] not null default '{}'::text[],
  brand text not null,
  gtin text,
  sku text not null,
  category text not null,
  pack_size text not null default '',
  image_url text,
  price numeric check (price >= 0),
  currency text check (currency is null or currency = 'EUR'),
  available boolean,
  checked_at timestamptz not null,
  primary key (source_id, source_product_id)
);

create index if not exists retailer_food_identity_gtin_idx
  on public.retailer_catalog_food_identities(gtin);
create index if not exists retailer_food_identity_name_idx
  on public.retailer_catalog_food_identities(lower(brand), lower(title));
create index if not exists retailer_food_identity_aliases_idx
  on public.retailer_catalog_food_identities using gin (aliases);

alter table public.retailer_catalog_food_identities enable row level security;

comment on table public.retailer_catalog_food_identities is
  'Non-redistributable edible retailer identities used for exact multilingual SKU matching. Missing nutrition stays null by design in the separate rated-product layer.';
