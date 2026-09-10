-- Run in Supabase SQL Editor. All fixture writes are rolled back.
begin;
do $$
declare a text:=repeat('a',64); b text:=repeat('b',64); job text:=repeat('f',64); n integer; lease uuid;
begin
  perform public.enqueue_shelf_research(a,job,'{"brand":"SQL QA","name":"Lease test","variant":"","packSize":"100g"}');
  perform public.enqueue_shelf_research(a,job,'{"brand":"SQL QA","name":"Lease test","variant":"","packSize":"100g"}');
  select count(*) into n from public.shelf_research_receipts where owner_hash=a and job_id=job;
  assert n=1,'duplicate receipt';
  select count(*) into n from public.shelf_research_receipts where owner_hash=b and job_id=job;
  assert n=0,'owner isolation';
  assert not has_table_privilege('anon','public.shelf_research_jobs','SELECT'),'anon table exposed';
  assert not has_function_privilege('authenticated','public.claim_shelf_research()','EXECUTE'),'claim exposed';
  -- Test only when the real worker has no active lease; never modify production jobs.
  if not exists(select 1 from public.shelf_research_jobs where status='searching' and lease_until>now()) then
    update public.shelf_research_jobs set available_at='2000-01-01' where id=job;
    select lease_token into lease from public.claim_shelf_research() where id=job;
    assert lease is not null,'claim failed';
    select count(*) into n from public.claim_shelf_research();
    assert n=0,'two concurrent claims';
    update public.shelf_research_jobs set lease_until=now()-interval '1 second' where id=job;
    select count(*) into n from public.claim_shelf_research() where id=job and lease_token<>lease;
    assert n=1,'expired lease not reclaimed';
  end if;
end; $$;
rollback;
