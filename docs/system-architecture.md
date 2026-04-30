# LuminaDiary — System Architecture

## High-Level Diagram

```
┌──────────────────────────┐         ┌──────────────────────────┐
│  Mobile App (Expo / RN)  │  HTTPS  │  FastAPI AI Backend      │
│                          │ ───────▶│  (photo analysis,        │
│  - Expo Router           │         │   blog gen, chat)        │
│  - Zustand + React Query │◀─────── │                          │
└────────────┬─────────────┘         └────────────┬─────────────┘
             │                                    │
             │  @supabase/supabase-js            │ supabase-py (service role)
             │                                    │
             ▼                                    ▼
        ┌─────────────────────────────────────────────┐
        │  Supabase                                    │
        │  ├─ Auth (JWT)                               │
        │  ├─ Postgres (RLS per user_id)               │
        │  │    users · photos · daily_blogs · messages│
        │  └─ Storage bucket: photos/ (signed URLs)    │
        └─────────────────────────────────────────────┘
                          │
                          ▼ (backend only)
                  ┌──────────────────┐
                  │  Gemini 2.5 Flash │
                  │  (vision + text)  │
                  └──────────────────┘
```

## Data Flow — Capture & Real-time AI Comment

1. User opens Capture flow (FAB → modal).
2. `expo-camera` produces local URI; user can add note + tags.
3. Mobile reads EXIF via `expo-media-library.getAssetInfoAsync`.
4. Mobile uploads image directly to **Supabase Storage** (`photos/{user_id}/{photo_id}.jpg`) via signed-URL or authenticated client.
5. Mobile inserts a `photos` row (status=`pending_ai`).
6. Mobile POSTs `{ photo_id }` to `POST /ai/comment` on backend.
7. Backend fetches the image (service-role download), calls Gemini 2.5 Flash with safety-tuned prompt, writes `commentary` + `mood` back to the `photos` row.
8. Mobile (subscribed to Supabase Realtime on its photos) receives the update → triggers Sparkle + Glass overlay reveal.

## Data Flow — End-of-Day Packaging

1. Trigger: user button "Gói ghém ngày hôm nay" or scheduled at 00:05 (Edge Function or backend cron).
2. Backend collects all `photos` for the user where `created_at::date = today` and ai-commented.
3. Sends curated prompt to Gemini text → gets cohesive blog (markdown) + 3-5 hashtags + dominant emoji mood.
4. Writes a `daily_blogs` row, links photo IDs.
5. Mobile updates Archive tab via Realtime.

## Data Flow — Chat

1. Mobile opens chat modal (Chat FAB).
2. Each message: POST `/chat/message { history, today_context }`.
3. Backend builds system prompt with today's photo summaries (cached per session) → Gemini.
4. Streams tokens (SSE) to mobile.
5. Persists user + assistant turns to `chat_messages`.

## Database Schema (initial)

```sql
-- users (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text default 'vi',
  created_at timestamptz default now()
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  taken_at timestamptz,
  location_text text,            -- "Hue", "Hanoi"
  exif jsonb,
  note text,
  tags text[],
  ai_commentary text,
  ai_mood text,                  -- emoji or short label
  status text default 'pending_ai', -- pending_ai | ready | failed
  created_at timestamptz default now()
);
create index on photos (user_id, created_at desc);

create table daily_blogs (
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

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,            -- user | assistant
  content text not null,
  context_date date,
  created_at timestamptz default now()
);
```

## RLS (sketch)

```sql
alter table photos enable row level security;
create policy "own photos" on photos for all using (user_id = auth.uid());
-- repeat for daily_blogs, chat_messages, profiles
```

Storage policy: object path must start with `auth.uid()/`.

## Module Boundaries (Backend)

```
backend/app/
  main.py              # FastAPI app, CORS, lifespan
  routers/
    photos.py          # POST /ai/comment, GET /photos/{id}
    blog.py            # POST /day/package, GET /blogs/{date}
    chat.py            # POST /chat/message (SSE stream)
  services/
    vision.py          # Gemini vision wrapper
    blog_generator.py  # Day-to-blog prompt + post-process
    chat_engine.py     # Chat turn assembly + streaming
  models/schemas.py    # Pydantic request / response
  core/
    config.py          # Settings (env)
    supabase_client.py # Singleton service-role client
    prompts.py         # Centralized prompt templates
  deps.py              # FastAPI deps (auth, db)
```

## Production Deployment Topology

```
┌──────────────────────────────────────────────────────┐
│  iOS Device (4G/5G)                                  │
│  Expo SDK 52+                                        │
│  EAS-built binary (Ad-Hoc Internal Distribution)     │
└────────────────────┬─────────────────────────────────┘
                     │ HTTPS
                     ▼
┌──────────────────────────────────────────────────────┐
│  Render.com (Singapore region)                       │
│  Backend service: Docker container                   │
│  - Python 3.12-slim + uvicorn                        │
│  - Binds to $PORT (8000 or injected)                 │
│  - Plan: Free (sleep after inactivity) or           │
│    Starter ($7/mo, no sleep + stable scheduler)      │
│  - Health check: GET /health                         │
│  - Auto-redeploy on git push                         │
└────────────────────┬─────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────────┐    ┌──────────────────┐
│  Supabase        │    │  Google Gemini   │
│  Postgres + Auth │    │  2.5 Flash/Pro   │
│  + Storage       │    │  (vision + text) │
└──────────────────┘    └──────────────────┘

Scheduler Caveat (Render Free):
- APScheduler tasks (daily_package at 22:00) may not run if container is asleep.
- Solution: upgrade to Starter plan for reliable cron, or implement external trigger (webhook).
```

## Auth Strategy

- Mobile signs in via Supabase Auth (email/password initially).
- Supabase issues JWT; client sends `Authorization: Bearer <jwt>` to FastAPI.
- FastAPI verifies JWT against Supabase JWKS in a dependency, extracts `sub` (user_id).
- Backend uses service-role key only for privileged writes after authorization.

## Security Notes

- Never embed service-role key in mobile.
- Storage uploads from mobile use anon key + RLS-restricted policy.
- AI prompts pass through safety filter; refuse-and-rephrase if content violates policy.
- Rate-limit `/chat/message` and `/ai/comment` per user (e.g. token bucket in Redis later; in-memory for MVP).
