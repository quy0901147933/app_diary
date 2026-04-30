# LuminaDiary — Tech Stack

## Mobile (Frontend)

| Layer | Choice | Notes |
|---|---|---|
| Runtime | **Expo SDK 52+** managed | Avoid bare workflow until needed (FCM) |
| Framework | **React Native 0.76+** | Hermes JS engine |
| Language | **TypeScript 5.x** strict | All `.ts` / `.tsx` |
| Routing | **Expo Router v4** (file-based) | `(tabs)` group + modals |
| State | **Zustand 4.x** | Hook-based, ~1KB; no Provider |
| Server state | **@tanstack/react-query 5.x** | Caching photo list / archive |
| Animations | **react-native-reanimated 3.x** + **react-native-gesture-handler** | Sparkle, transitions |
| Skia | **@shopify/react-native-skia** | Particle / glow effects |
| Blur / Glass | **expo-blur** | Glassmorphism overlay |
| Camera | **expo-camera** + **expo-image-picker** | Story-style capture |
| EXIF / GPS | **expo-media-library** + `expo-location` | Asset metadata |
| Backend SDK | **@supabase/supabase-js v2** | Auth + DB + Storage |
| Storage cache | **@react-native-async-storage/async-storage** | Token persistence |
| Icons | **@expo/vector-icons** (Phosphor / Lucide) | Per design system |
| Fonts | **expo-font** + Google Fonts: **Fraunces** (display) + **Inter** (body) | Loaded at boot |

## Backend (AI / Aggregation)

| Layer | Choice | Notes |
|---|---|---|
| Runtime | **Python 3.12** | |
| Framework | **FastAPI 0.115+** | Async multipart uploads |
| Server | **uvicorn** + **gunicorn** workers | Prod |
| Validation | **Pydantic v2** | Schemas |
| Vision AI | **Gemini 2.5 Flash** (`google-genai` SDK) | $0.15/1M tokens; cheapest at MVP scale |
| Text AI (blog/chat) | **Gemini 2.5 Flash** (same key) | Reuse SDK |
| Supabase client | **supabase-py v2** | Service-role for backend writes |
| HTTP client | **httpx** | Async |
| Env / config | **pydantic-settings** | `.env` |
| Test | **pytest** + **pytest-asyncio** + **httpx.AsyncClient** | |

## BaaS (Supabase)

| Service | Use |
|---|---|
| **Auth** | Email/password + Apple/Google OAuth |
| **Postgres** | Tables: `users`, `photos`, `daily_blogs`, `chat_messages` |
| **Storage** | Bucket `photos/` (RLS: user-scoped) |
| **RLS** | Enforce per-user row access on all tables |
| **Edge Functions** | Optional later (cron for end-of-day packaging) |

## Infrastructure & Deployment

| Item | Choice | Notes |
|---|---|---|
| Backend host | **Render.com** (docker container) | Singapore region; Free plan with sleep caveat, Starter ($7/mo) recommended for stable scheduler |
| Backend runtime | **Python 3.12-slim + uvicorn** | Containerized via Dockerfile; health check at `/health` |
| Mobile build | **EAS Build** (Expo) | iOS: Ad-Hoc Internal Distribution profile (TestFlight alternative) |
| Mobile distribution | **EAS internal distribution** | Env vars baked at build time (no OTA for backend URL changes) |
| OTA updates | **EAS Update** | Non-critical app updates (UI, logic); requires full rebuild for backend URL change |
| Secrets | Manual Render Dashboard env vars | `SUPABASE_*` and `GEMINI_API_KEY` set in Render service config (not synced from git) |
| CI | **GitHub Actions** | Lint, typecheck, test on PR; auto-deploy from main |

## Notable Trade-offs

- **JS SDK over @react-native-firebase-style native module**: keeps Expo Go working during MVP; revisit if push notifications become critical.
- **Gemini Flash over Claude / GPT**: ~6× cheaper for high-volume photo commentary; quality acceptable for the "emotional, safe, non-speculative" tone target.
- **Zustand over Redux Toolkit**: solo-dev friendly; can migrate later if team scales.
- **Skia + Reanimated worklets over Lottie**: programmable particle behavior; runs on UI thread for 60fps sparkles.
