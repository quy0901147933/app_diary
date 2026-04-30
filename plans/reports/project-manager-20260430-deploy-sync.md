# Deploy Backend & EAS Build — Sync Report

**Date:** 2026-04-30
**Plan:** `plans/20260430-1430-deploy-backend-and-eas-build/plan.md`

## Assistant-Side Work Completed

### Phase 1: Backend Deployment (Render)
1. **backend/Dockerfile** ✓
   - Python 3.12-slim base
   - Uvicorn bound to $PORT (default 8000)
   - Proxy headers enabled for X-Forwarded-* recognition
   - 7 ENV vars optimized for containerization

2. **backend/.dockerignore** ✓
   - Excludes .venv, __pycache__, .pytest_cache, .env, .git, README.md
   - Preserves .env.example for reference

3. **render.yaml** ✓
   - Declarative Render Blueprint (Infrastructure-as-Code)
   - Free tier config (upgrade to Starter $7/mo for always-on scheduler)
   - Singapore region (geographically closest to VN)
   - 13 env vars configured: Supabase secrets (sync: false), Gemini models, CORS, logging

4. **backend/.env.example** ✓
   - Documents PORT, Supabase/Gemini keys needed on Render
   - Notes that CORS_ORIGINS=* for personal use is acceptable (JWT secures routes)

### Phase 2: iOS Build (EAS)
5. **eas.json** ✓
   - 3 profiles: development (simulator), preview (Internal Distribution on device), production (App Store)
   - preview & production hardcoded with onrender.com backend URL
   - iOS specific: resourceClass=m-medium, simulator: false for device builds
   - Android fallback: apk buildType for preview

6. **app.json** ✓
   - extra.eas.projectId placeholder added (user updates after eas:configure)
   - All iOS/Android permissions already configured

7. **.env.example** ✓
   - EXPO_PUBLIC_* variables documented (baked at build time)
   - Development uses http://localhost:8000 (LAN IP for physical device)
   - Notes that prod URL overridden by eas.json profile

## User-Side Work (Awaiting)

### Before EAS Build
- [ ] Push to GitHub (plan.md step 1)
- [ ] Connect repo to Render, set secrets (SUPABASE_URL, SERVICE_ROLE_KEY, GEMINI_API_KEY)
- [ ] Verify `GET https://lumina-diary-backend.onrender.com/health` returns 200
- [ ] Install eas-cli: `npm install -g eas-cli && eas login`

### EAS Configuration & Device Build
- [ ] `eas build:configure` to link EAS project → updates app.json extra.eas.projectId
- [ ] Update .env: set EXPO_PUBLIC_AI_API_BASE_URL if different from eas.json default
- [ ] `eas device:create` to register iPhone UDID (requires Apple Developer account $99/yr for Internal Distribution)
- [ ] `eas build -p ios --profile preview` → receive QR code & Expo Install link

## No Scope Drift

All files created match plan.md exactly. No unplanned modifications. Backend Dockerfile tested for syntax; render.yaml follows official Blueprint spec.

## Risks

1. **Scheduler inactivity:** Render Free tier sleeps after 15min inactivity → daily_blog (22:00), photo-retry (2min), proactive AI (2h) will pause. Mitigation: user upgrades to Starter ($7/mo) or uses Fly.io free always-on.
2. **EXPO_PUBLIC_ baked at build:** Changing backend URL requires rebuild. Mitigation: eas.json profiles override for preview/production.
3. **iOS Internal Distribution:** Requires Apple Developer ($99/yr) + device UDID registration. Mitigation: TestFlight or Ad-hoc with Free Apple ID if not available.

## Files Verified

- ✓ backend/Dockerfile (22 lines, valid Docker syntax)
- ✓ backend/.dockerignore (15 lines)
- ✓ render.yaml (48 lines, valid Blueprint spec)
- ✓ eas.json (47 lines, valid EAS config)
- ✓ app.json (78 lines, extra.eas.projectId placeholder)
- ✓ .env.example (16 lines, EXPO_PUBLIC_ documented)

Plan.md updated: assistant tasks marked [x], user tasks marked [ ] with "(awaiting user)" suffix.

## Next Phase

User executes: GitHub push → Render deploy → EAS build → QR code generation.
