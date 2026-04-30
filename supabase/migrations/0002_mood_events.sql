-- Mood events: silent emotion analysis from photos + chat messages.
-- Used by /ai/mood-chart for the 7-week emotional heatmap.

create table if not exists mood_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('photo', 'chat')),
  source_id uuid,
  sentiment_score smallint not null check (sentiment_score between 1 and 10),
  emotion_tag text not null,
  created_at timestamptz not null default now()
);

create index if not exists mood_events_user_created_idx
  on mood_events (user_id, created_at desc);

alter table mood_events enable row level security;

drop policy if exists "own mood events" on mood_events;
create policy "own mood events" on mood_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
