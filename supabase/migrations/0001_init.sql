-- LuminaDiary initial schema

create extension if not exists "pgcrypto";

-- Profiles
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text default 'vi',
  created_at timestamptz default now()
);

-- Photos
create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  taken_at timestamptz,
  location_text text,
  exif jsonb,
  note text,
  tags text[],
  ai_commentary text,
  ai_mood text,
  status text not null default 'pending_ai'
    check (status in ('pending_ai', 'ready', 'failed')),
  created_at timestamptz default now()
);
create index if not exists photos_user_created_idx
  on photos (user_id, created_at desc);

-- Daily blogs
create table if not exists daily_blogs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  title text,
  body_md text,
  hashtags text[],
  mood_emoji text,
  cover_photo_ids uuid[],
  created_at timestamptz default now(),
  unique (user_id, date)
);
create index if not exists daily_blogs_user_date_idx
  on daily_blogs (user_id, date desc);

-- Chat messages
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  context_date date,
  created_at timestamptz default now()
);
create index if not exists chat_messages_user_created_idx
  on chat_messages (user_id, created_at desc);

-- RLS
alter table profiles enable row level security;
alter table photos enable row level security;
alter table daily_blogs enable row level security;
alter table chat_messages enable row level security;

drop policy if exists "self profile" on profiles;
create policy "self profile" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own photos" on photos;
create policy "own photos" on photos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own blogs" on daily_blogs;
create policy "own blogs" on daily_blogs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own messages" on chat_messages;
create policy "own messages" on chat_messages
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "user uploads to own folder" on storage.objects;
create policy "user uploads to own folder" on storage.objects
  for insert with check (
    bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user reads photos" on storage.objects;
create policy "user reads photos" on storage.objects
  for select using (bucket_id = 'photos');

drop policy if exists "user deletes own" on storage.objects;
create policy "user deletes own" on storage.objects
  for delete using (
    bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Auto-create profile on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
