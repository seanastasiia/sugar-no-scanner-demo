-- Private pilot queue. No images, account identifiers, scan histories or public table access.
create table if not exists public.shelf_research_jobs (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  lookup jsonb not null,
  status text not null default 'queued' check (status in ('queued','searching','ready','needs_info','review','retry','failed')),
  reason text not null default '',
  missing jsonb not null default '[]',
  result jsonb,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.shelf_research_receipts (
  owner_hash text not null check (owner_hash ~ '^[a-f0-9]{64}$'),
  job_id text not null references public.shelf_research_jobs(id),
  created_at timestamptz not null default now(),
  primary key(owner_hash, job_id)
);
alter table public.shelf_research_jobs enable row level security;
alter table public.shelf_research_receipts enable row level security;
revoke all on public.shelf_research_jobs, public.shelf_research_receipts from public, anon, authenticated;
grant all on public.shelf_research_jobs, public.shelf_research_receipts to service_role;
create index if not exists shelf_research_work on public.shelf_research_jobs(status, available_at);

create or replace function public.enqueue_shelf_research(p_owner text, p_id text, p_lookup jsonb)
returns text language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('shelf-research-enqueue', 0));
  if exists(select 1 from shelf_research_receipts where owner_hash=p_owner and job_id=p_id) then return p_id; end if;
  if (select count(*) from shelf_research_receipts where owner_hash=p_owner) >= 100
     or (select count(*) from shelf_research_receipts where owner_hash=p_owner and created_at > now()-interval '1 day') >= 30
     or (not exists(select 1 from shelf_research_jobs where id=p_id) and
         (select count(*) from shelf_research_jobs where created_at > now()-interval '1 day') >= 200) then
    raise exception 'queue_limit';
  end if;
  insert into shelf_research_jobs(id,lookup) values(p_id,p_lookup) on conflict do nothing;
  insert into shelf_research_receipts(owner_hash,job_id) values(p_owner,p_id) on conflict do nothing;
  return p_id;
end; $$;
create or replace function public.claim_shelf_research()
returns setof public.shelf_research_jobs language plpgsql security definer set search_path = public as $$
begin
  -- Across replicas, bound research to one lease at a time. Expired work is reclaimable.
  perform pg_advisory_xact_lock(hashtextextended('shelf-research-worker',0));
  if exists(select 1 from shelf_research_jobs where status='searching' and lease_until>now()) then return; end if;
  return query
  update shelf_research_jobs set status='searching', attempts=attempts+1,
    lease_until=now()+interval '3 minutes', lease_token=gen_random_uuid(), updated_at=now()
  where id=(select id from shelf_research_jobs
    where (status in ('queued','retry') and available_at<=now())
       or (status='searching' and lease_until<now())
    order by available_at limit 1 for update skip locked)
  returning *;
end; $$;
revoke all on function public.enqueue_shelf_research(text,text,jsonb), public.claim_shelf_research() from public, anon, authenticated;
grant execute on function public.enqueue_shelf_research(text,text,jsonb), public.claim_shelf_research() to service_role;
create or replace function public.retry_shelf_research(p_owner text,p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update shelf_research_jobs set status='queued', attempts=0, available_at=now(), updated_at=now(), reason=''
  where id=p_id and status in ('needs_info','review','failed') and updated_at<now()-interval '1 hour'
    and exists(select 1 from shelf_research_receipts where owner_hash=p_owner and job_id=p_id);
  return found;
end; $$;
revoke all on function public.retry_shelf_research(text,text) from public,anon,authenticated;
grant execute on function public.retry_shelf_research(text,text) to service_role;
