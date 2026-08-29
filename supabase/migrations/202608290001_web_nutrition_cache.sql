create table if not exists public.web_nutrition_cache (
  cache_key text primary key,
  brand text not null,
  name text not null,
  variant text,
  pack_size text,
  status text not null check (status in ('success', 'miss')),
  result jsonb,
  model text not null,
  checked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint web_nutrition_cache_result_check check (
    (status = 'success' and result is not null) or
    (status = 'miss' and result is null)
  )
);

create index if not exists web_nutrition_cache_expires_at_idx
  on public.web_nutrition_cache (expires_at);

alter table public.web_nutrition_cache enable row level security;

revoke all on table public.web_nutrition_cache from anon, authenticated;
grant select, insert, update, delete on table public.web_nutrition_cache to service_role;

comment on table public.web_nutrition_cache is
  'Server-only exact-SKU nutrition cache. Access is restricted to the Supabase service role.';
