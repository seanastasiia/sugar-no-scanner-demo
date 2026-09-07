create table if not exists public.scanner_entitlements (
  id uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  email text,
  status text not null check (status in ('active', 'expired', 'refunded', 'revoked')),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scanner_entitlement_window check (expires_at > starts_at)
);

create table if not exists public.scanner_access_tokens (
  token_hash text primary key check (length(token_hash) = 64),
  entitlement_id uuid not null references public.scanner_entitlements(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.scanner_restore_tokens (
  token_hash text primary key check (length(token_hash) = 64),
  entitlement_id uuid not null references public.scanner_entitlements(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists scanner_entitlements_email_idx on public.scanner_entitlements(lower(email), expires_at desc);
create index if not exists scanner_access_tokens_entitlement_idx on public.scanner_access_tokens(entitlement_id);

alter table public.scanner_entitlements enable row level security;
alter table public.scanner_access_tokens enable row level security;
alter table public.scanner_restore_tokens enable row level security;

comment on table public.scanner_entitlements is 'Server-only Stripe entitlement records for the isolated willingness-to-pay pilot.';
comment on table public.scanner_access_tokens is 'One-way hashes only. Raw browser access tokens are never stored.';
comment on table public.scanner_restore_tokens is 'Short-lived one-time hashes for restoring paid access by email.';

create or replace function public.claim_scanner_restore_token(
  p_restore_hash text,
  p_access_hash text
)
returns table(expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_entitlement public.scanner_entitlements%rowtype;
begin
  select entitlement.* into selected_entitlement
  from public.scanner_restore_tokens restore
  join public.scanner_entitlements entitlement on entitlement.id = restore.entitlement_id
  where restore.token_hash = p_restore_hash
    and restore.used_at is null
    and restore.expires_at > now()
    and entitlement.status = 'active'
    and entitlement.expires_at > now()
  for update of restore;

  if not found then return; end if;

  update public.scanner_restore_tokens set used_at = now() where token_hash = p_restore_hash;
  insert into public.scanner_access_tokens(token_hash, entitlement_id)
  values (p_access_hash, selected_entitlement.id)
  on conflict (token_hash) do update set entitlement_id = excluded.entitlement_id;

  return query select selected_entitlement.expires_at;
end;
$$;

revoke all on function public.claim_scanner_restore_token(text, text) from public, anon, authenticated;
grant execute on function public.claim_scanner_restore_token(text, text) to service_role;
