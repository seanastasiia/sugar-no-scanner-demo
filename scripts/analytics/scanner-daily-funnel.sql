-- Read-only. Change report_day to a literal DATE to reproduce a past Riga day.
-- Anonymous tab visits, not people. Same-day ordered funnel; no cross-midnight window.
-- Missing historical QA labels remain unknown. Never reinterpret them as verified people.
with params as (
  select (current_timestamp at time zone 'Europe/Riga')::date - 1 as report_day
), events as (
  select e.*, coalesce(nullif(metadata->>'browserSessionId', ''), session_id::text) as visit_id
  from public.scan_events e, params p
  where created_at >= p.report_day::timestamp at time zone 'Europe/Riga'
    and created_at < (p.report_day + 1)::timestamp at time zone 'Europe/Riga'
), eligible as (
  select * from events e where not exists (
    select 1 from events q where q.visit_id=e.visit_id
      and (q.metadata->>'trafficType'='qa' or q.metadata->>'qa'='true')
  )
), visits as (
  select visit_id,
    min(created_at) filter (where event_name='app_opened') as opened_at,
    min(created_at) filter (where event_name='onboarding_step_viewed' and metadata->>'step'='1') as shown_at,
    bool_or(case when metadata ? 'entryCampaign' then metadata->>'entryCampaign'='shelf_lv_pilot_02'
      else metadata->>'utm_campaign'='shelf_lv_pilot_02' end) as campaign,
    bool_or(event_name='scan_started' and source in ('camera','upload')) as any_real_start,
    bool_or(event_name='scan_completed' and source in ('camera','upload')) as any_real_result
  from eligible group by visit_id
), choices as (
  select v.*, (select min(e.created_at) from eligible e where e.visit_id=v.visit_id
    and e.event_name='onboarding_path_selected' and e.metadata->>'path'='in_store'
    and e.created_at>=v.shown_at) as choice_at from visits v
), starts as (
  select v.*, (select min(e.created_at) from eligible e where e.visit_id=v.visit_id
    and e.event_name='scan_started' and e.source in ('camera','upload')
    and e.created_at>=v.choice_at) as started_at from choices v
), results as (
  select v.*, (select min(e.created_at) from eligible e where e.visit_id=v.visit_id
    and e.event_name='scan_completed' and e.source in ('camera','upload')
    and exists (select 1 from eligible s where s.visit_id=e.visit_id and s.session_id=e.session_id
      and s.event_name='scan_started' and s.source=e.source
      and s.created_at>=v.choice_at and s.created_at<=e.created_at)) as result_at
  from starts v
), scopes as (
  select 'all' as scope, * from results
  union all select 'shelf_lv_pilot_02' as scope, * from results where campaign is true
)
select scope,
  count(*) filter (where opened_at is not null) as opened_visits,
  count(*) filter (where shown_at is not null) as onboarding_shown,
  count(choice_at) as chose_real_scan,
  count(started_at) as started_real_scan_after_choice,
  count(result_at) as completed_real_scan_after_choice,
  round(100.0*count(result_at)/nullif(count(shown_at),0),2) as shown_to_real_result_pct,
  count(*) filter (where any_real_start) as independent_real_start_visits,
  count(*) filter (where any_real_result) as independent_real_result_visits
from scopes group by scope order by scope;
