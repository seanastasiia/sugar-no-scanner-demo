-- Additive, server-only CAPI consent/receipt ledger. No billing tables are changed.
create table if not exists public.scanner_meta_purchases (
  checkout_id text primary key,
  event_id text not null unique,
  access_token_hash text not null check (length(access_token_hash) = 64),
  consent boolean not null default false,
  context jsonb,
  event_time bigint,
  delivered_at timestamptz,
  attempt_id uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists scanner_meta_purchases_access_idx on public.scanner_meta_purchases(access_token_hash);
alter table public.scanner_meta_purchases enable row level security;
revoke all on public.scanner_meta_purchases from public, anon, authenticated;
grant select, insert, update, delete on public.scanner_meta_purchases to service_role;

create or replace function public.claim_scanner_meta_purchase(p_checkout_id text, p_event_time bigint, p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.scanner_meta_purchases%rowtype;
begin
  -- Opportunistic data minimisation: purge abandoned matching context after seven days.
  update public.scanner_meta_purchases set context = null, consent = false
    where context is not null and created_at < now() - interval '7 days';
  select * into r from public.scanner_meta_purchases where checkout_id = p_checkout_id for update;
  if not found or not r.consent then return jsonb_build_object('state', 'no_consent'); end if;
  if r.delivered_at is not null then return jsonb_build_object('state', 'already_delivered'); end if;
  if coalesce(r.event_time, p_event_time) < extract(epoch from now() - interval '7 days') or coalesce(r.event_time, p_event_time) > extract(epoch from now() + interval '5 minutes') then
    return jsonb_build_object('state', 'expired');
  end if;
  if r.lease_until > now() then return jsonb_build_object('state', 'busy'); end if;
  update public.scanner_meta_purchases set attempt_id = p_attempt_id, lease_until = now() + interval '30 seconds',
    event_time = coalesce(event_time, p_event_time) where checkout_id = p_checkout_id;
  return jsonb_build_object('state', 'claimed', 'context', r.context, 'event_time', coalesce(r.event_time, p_event_time));
end;
$$;
revoke all on function public.claim_scanner_meta_purchase(text, bigint, uuid) from public, anon, authenticated;
grant execute on function public.claim_scanner_meta_purchase(text, bigint, uuid) to service_role;
