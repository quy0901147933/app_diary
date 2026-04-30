# LuminaDiary ✨

AI-powered personal diary that turns daily photos into emotional, real-time commentary and weaves them into a cohesive end-of-day blog. Inspired by Diarly. Modern, minimal, warm-luxurious.

## Stack

| Layer | Tech |
|---|---|
| Mobile | **Expo SDK 52** + React Native 0.76, TypeScript, Expo Router v4 |
| State | Zustand + TanStack Query |
| Animations | react-native-reanimated v3, Skia, expo-blur |
| BaaS | **Supabase** (Auth, Postgres, Storage, Realtime) |
| AI Backend | **FastAPI** (Python 3.12) + **Gemini 2.5 Flash** |

See [docs/tech-stack.md](docs/tech-stack.md) for the full breakdown.

## Quick Start

### 1. Mobile

```bash
npm install
cp .env.example .env  # fill EXPO_PUBLIC_SUPABASE_URL + ANON_KEY + AI_API_BASE_URL
npx expo start
```

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill Supabase service-role + JWT secret + Gemini key
uvicorn app.main:app --reload --port 8000
```

### 3. Supabase

In the Supabase SQL editor, run the contents of `supabase/migrations/0001_init.sql`. This creates:
- Tables: `profiles`, `photos`, `daily_blogs`, `chat_messages`
- RLS policies (per-user row access)
- Storage bucket `photos` + folder-scoped policies
- Trigger that auto-creates a profile on signup

## Project Structure

```
app_diary/
├── src/                     # Mobile app
│   ├── app/                 # Expo Router routes
│   │   ├── _layout.tsx      # Root + auth gate + fonts
│   │   ├── index.tsx        # Home (segmented today/archive)
│   │   ├── auth.tsx         # Sign in / sign up
│   │   ├── capture.tsx      # FAB → camera/gallery flow
│   │   └── chat.tsx         # AI chat modal
│   ├── components/          # TimelineCard, DailyPhotoItem, SparkleEffect, GlassOverlay, Fab, ...
│   ├── hooks/               # useTodayPhotos, useArchive, useAuthSession
│   ├── services/            # supabase, ai-api, exif
│   ├── stores/              # Zustand: photo-store, auth-store
│   ├── theme/               # colors, typography, tokens, shadow, motion
│   └── types/               # Domain types
├── backend/                 # FastAPI AI service
│   └── app/{routers,services,core,models}
├── supabase/migrations/     # SQL schema + RLS
├── docs/                    # tech-stack, design-guidelines, system-architecture, code-standards
└── plans/                   # Implementation plans (per /ck:plan)
```

## Core UX

| Tab | Purpose |
|---|---|
| **Hành trình hôm nay** | Live photo stream with AI commentary, sparkle FX, glass overlays, EXIF hashtags |
| **Ký ức đã đóng gói** | Daily blog cards (AI-written summary + thumbnails + hashtags) |

| FAB | Action |
|---|---|
| Right (primary, large) | New moment → camera/gallery → save → AI comments in real time |
| Left (small) | Open AI chat with today's photo context |

## Privacy Stance

No likes, hearts, comments, or share affordances. This is a private diary, not a social feed. See [docs/design-guidelines.md §10](docs/design-guidelines.md).

## Docs

- [Tech Stack](docs/tech-stack.md)
- [Design Guidelines](docs/design-guidelines.md)
- [System Architecture](docs/system-architecture.md)
- [Code Standards](docs/code-standards.md)

## License

MIT — see [LICENSE](LICENSE).
