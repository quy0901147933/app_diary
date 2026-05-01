-- Granular control for proactive empathy + crisis-mode tracking.
-- mood_proactive_enabled: user can opt out of low-mood nudges WHILE
-- still keeping morning/inactivity proactive messages.
-- last_mood_crisis_at: separate cooldown (7 days) for crisis cards so
-- we never mix a "report a hotline" message with a normal nudge cadence.

alter table profiles
  add column if not exists mood_proactive_enabled boolean not null default true;

alter table profiles
  add column if not exists last_mood_crisis_at timestamptz;
