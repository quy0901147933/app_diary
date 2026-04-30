# Base Scaffolding — LuminaDiary

**Status:** ✅ Complete
**Created:** 2026-04-27
**Mode:** /ck:bootstrap --auto (scoped to base scaffolding only)

## Goal

Stand up a runnable skeleton for LuminaDiary: Expo + Supabase + FastAPI + Gemini, with all signature components stubbed and core flows wired end-to-end (auth → capture → AI comment → archive).

## Phase Status

| Phase | Status | Notes |
|---|---|---|
| 01 Docs (tech-stack, design, architecture, code-standards) | ✅ Done | `docs/*.md` |
| 02 Mobile config (package.json, app.json, tsconfig, babel) | ✅ Done | RN 0.76 + Expo SDK 52 |
| 03 Theme tokens + types | ✅ Done | `src/theme`, `src/types` |
| 04 Services (supabase, ai-api, exif) | ✅ Done | `src/services` |
| 05 State (Zustand: photo, auth) + hooks | ✅ Done | `src/stores`, `src/hooks` |
| 06 UI components (sparkle, glass, fab, cards, segmented, empty) | ✅ Done | `src/components` |
| 07 Routes (root layout, home, auth, capture, chat) | ✅ Done | `src/app` |
| 08 Backend (FastAPI + routers + services + Gemini) | ✅ Done | `backend/app` |
| 09 Supabase migration (schema + RLS + storage) | ✅ Done | `supabase/migrations/0001_init.sql` |
| 10 README | ✅ Done | top-level + backend |

## What Works (skeleton)

- Auth gate (Supabase email/password) → sign in/up modal redirects.
- Today tab: live realtime subscription on `photos`; sparkle while AI thinking; glass overlay reveal when AI ready; EXIF-derived hashtag display.
- Archive tab: queries `daily_blogs`, renders TimelineCard summaries.
- Capture flow: pick from camera/gallery → upload to Supabase Storage → insert row → fire `/ai/comment`.
- Chat modal: posts to `/chat/message`, renders bubble thread.
- Backend: `/health`, `/ai/comment`, `/day/package`, `/chat/message` with JWT-verified auth.

## Not Yet Implemented (post-base, follow-up phases)

- Skia particle upgrade for sparkle (currently SVG + Reanimated — works but lower fidelity).
- "Gói ghém ngày hôm nay" gather animation (cards collapsing into the new TimelineCard).
- ~~Streaming SSE for chat~~ — **explicitly out of scope per user (2026-04-27): chat stays single-shot, no realtime.**
- Push notifications (deferred until prebuild / @react-native-firebase migration if needed).
- Tests (planned phase). No tests written in base scaffold — mark as known gap.
- Apple/Google OAuth providers (only email/password wired).
- Offline cache / optimistic insert for photos pending upload.
- Backend rate-limiting + structured logging (loguru / OpenTelemetry).

## Known Gaps / Risks

- `expo-media-library` EXIF on Android API 30 has known issues — exif.ts currently returns `{}` on failure. Plan a `react-native-exif` fallback before public release.
- `@expo-google-fonts/fraunces` and `inter` packages need `npm install` before first run.
- Supabase `photos` bucket is public for read (signed-URL flow not yet wired); switch to signed URLs before production.
- No `.env` file shipped — onboarding requires manually copying `.env.example` and providing keys.

## Next Recommended Phase

`/ck:plan --auto "Implement Skia-based sparkle particles and end-of-day 'gói ghém' gather animation per design-guidelines §6 + §8"`
