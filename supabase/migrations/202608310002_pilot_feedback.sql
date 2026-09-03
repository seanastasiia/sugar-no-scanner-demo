create table if not exists public.pilot_feedback (
  id uuid primary key,
  session_id uuid not null references public.scan_sessions(id) on delete cascade,
  helpful boolean not null,
  reason text,
  comment text,
  context text not null,
  user_agent_class text not null default 'unknown',
  created_at timestamptz not null default now(),
  constraint pilot_feedback_reason_check check (
    (helpful = true and reason is null)
    or
    (helpful = false and reason in ('wrong_product', 'no_result', 'too_slow', 'unclear', 'other'))
  ),
  constraint pilot_feedback_comment_length check (comment is null or char_length(comment) <= 300),
  constraint pilot_feedback_context_check check (context in ('camera', 'results', 'demo', 'permission_error'))
);

create index if not exists pilot_feedback_created_at_idx on public.pilot_feedback(created_at desc);
create index if not exists pilot_feedback_session_id_idx on public.pilot_feedback(session_id);

alter table public.pilot_feedback enable row level security;

-- The project is created with automatic Data API exposure disabled. Grant only
-- the server role used by Railway; browser roles receive no table access.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.scan_sessions to service_role;
grant select, insert, update, delete on table public.scan_events to service_role;
grant select, insert, update, delete on table public.pilot_feedback to service_role;
revoke all on table public.scan_sessions from anon, authenticated;
revoke all on table public.scan_events from anon, authenticated;
revoke all on table public.pilot_feedback from anon, authenticated;

comment on table public.pilot_feedback is
  'Anonymous pilot feedback only. Never store images, frames, OCR text, contact details, or other personal data.';
