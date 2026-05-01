-- Proactive mood-low check: track last time we sent a low-mood nudge so we
-- can throttle (cooldown ≥ 2 days) and not spam users during a hard week.

alter table profiles
  add column if not exists last_mood_proactive_at timestamptz;
