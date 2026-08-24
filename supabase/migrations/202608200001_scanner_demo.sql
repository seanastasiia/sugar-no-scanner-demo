create extension if not exists pgcrypto;

create table if not exists public.products (
  id text primary key,
  retailer_product_id text not null unique,
  brand text not null,
  name text not null,
  short_name text not null,
  aliases text[] not null default '{}',
  format text not null check (format in ('bar', 'cookie', 'truffle', 'puree', 'other')),
  pack_size_g numeric not null check (pack_size_g > 0),
  gtin text,
  protein_g_100 numeric,
  fiber_g_100 numeric,
  total_sugar_g_100 numeric,
  no_added_sugar_claim boolean not null default false,
  image_url text,
  retailer_url text not null,
  is_golden boolean not null default false,
  accent text not null default 'coral',
  updated_at timestamptz not null default now(),
  constraint nutrients_nonnegative check (
    coalesce(protein_g_100, 0) >= 0 and
    coalesce(fiber_g_100, 0) >= 0 and
    coalesce(total_sugar_g_100, 0) >= 0
  )
);

create table if not exists public.product_sources (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  label text not null,
  url text not null,
  checked_at date not null,
  fields text[] not null default '{}',
  status text not null check (status in ('verified', 'secondary', 'pending')),
  unique(product_id, url)
);

create table if not exists public.retailer_offers (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  retailer text not null,
  url text not null,
  affiliate boolean not null default false,
  checked_at date not null,
  active boolean not null default true,
  unique(product_id, retailer)
);

create table if not exists public.scan_sessions (
  id uuid primary key,
  started_at timestamptz not null default now(),
  source text not null check (source in ('camera', 'upload', 'sample-shelf', 'sample-conveyor')),
  user_agent_class text,
  completed_at timestamptz
);

create table if not exists public.scan_events (
  id uuid primary key,
  session_id uuid not null references public.scan_sessions(id) on delete cascade,
  event_name text not null,
  source text not null check (source in ('camera', 'upload', 'sample-shelf', 'sample-conveyor')),
  product_id text references public.products(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists scan_events_session_idx on public.scan_events(session_id, created_at);
create index if not exists scan_events_name_idx on public.scan_events(event_name, created_at);

alter table public.products enable row level security;
alter table public.product_sources enable row level security;
alter table public.retailer_offers enable row level security;
alter table public.scan_sessions enable row level security;
alter table public.scan_events enable row level security;

-- No anon/authenticated policies are created. The private server uses the service-role key.
comment on table public.scan_events is 'Metadata only. Raw product images must never be stored here.';
