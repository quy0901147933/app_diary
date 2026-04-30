-- Add dominant location of the day to daily_blogs so TimelineCard can render
-- a prominent hashtag without needing to re-query photos.

alter table daily_blogs
  add column if not exists location_text text;
