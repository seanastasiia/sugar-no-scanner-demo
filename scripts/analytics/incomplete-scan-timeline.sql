-- Read-only: diagnostics for the single reported attempt. No photos, tokens or raw metadata.
with day_events as (
  select e.*, coalesce(nullif(metadata->>'browserSessionId',''),session_id::text) visit_id
  from public.scan_events e
  where created_at >= timestamp '2026-09-24' at time zone 'Europe/Riga'
    and created_at < timestamp '2026-09-25' at time zone 'Europe/Riga'
), attempts as (
  select distinct visit_id from day_events
  where event_name='scan_started' and source in ('camera','upload')
)
select e.created_at at time zone 'Europe/Riga' as riga_time,
  e.visit_id, e.session_id, e.event_name, e.source,
  e.metadata->>'path' as path, e.metadata->>'count' as recognized_count,
  e.metadata->>'trafficType' as traffic_type,
  e.metadata->>'requestId' as recognition_request_id,
  left(e.metadata->>'message',80) as failure_message,
  e.metadata->>'utm_campaign' as campaign, s.user_agent_class
from day_events e join attempts a using (visit_id)
left join public.scan_sessions s on s.id=e.session_id
order by e.visit_id,e.created_at;
