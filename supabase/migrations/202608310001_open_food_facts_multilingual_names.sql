alter table if exists public.open_food_facts_products
  add column if not exists aliases text[] not null default '{}'::text[];

create index if not exists open_food_facts_aliases_idx
  on public.open_food_facts_products using gin (aliases);

comment on column public.open_food_facts_products.aliases is
  'Source-backed multilingual product_name_* values from Open Food Facts, retained for exact identity matching.';
