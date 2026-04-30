# LuminaDiary — Deployment Guide

Single source of truth for production deployment operations.

## Backend Deployment (Render)

### Overview

The FastAPI backend runs on **Render.com** (Singapore region) as a Docker container, automatically deployed from the main branch via Render Blueprint (`render.yaml`).

### Setup

1. **Create Render service** from Blueprint:
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - New → Blueprint → select this repo
   - Render auto-detects `render.yaml` and creates the service

2. **Set environment variables** (manual, in Render Dashboard):
   - `SUPABASE_URL` — Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Service role key (NEVER commit to git)
   - `SUPABASE_JWT_SECRET` — JWT signing key from Supabase
   - `GEMINI_API_KEY` — Google Gemini API key
   - All other vars (PHOTO_BUCKET, CORS_ORIGINS, LOG_LEVEL, etc.) are pre-set in `render.yaml`

3. **Verify deployment**:
   ```bash
   curl https://lumina-diary-backend.onrender.com/health
   # Expected: 200 OK with {"status": "healthy"}
   ```

### Scheduler Caveat (Render Free)

The backend runs an **APScheduler** job for daily blog packaging at 22:00 (Asia/Ho_Chi_Minh timezone).

- **Free plan**: Container sleeps after 15 min inactivity → APScheduler job may NOT run if container is asleep.
- **Starter plan** ($7/mo): No sleep, scheduler runs reliably.
- **Workaround** (if stuck on Free): Implement external trigger (webhook from GitHub Actions or Supabase Edge Function).

### Auto-Deploy

Enabled by default (`autoDeploy: true` in `render.yaml`). Every push to main → Render rebuilds and redeploys.

### Health Check

Render pings `/health` every 10s. If unhealthy 3× in a row, the service is marked down. Endpoint is defined in `backend/app/main.py`.

---

## Mobile Deployment (EAS Build)

### Overview

The iOS app is built and distributed via **EAS Build**, using profiles defined in `eas.json`. Each profile targets a different channel and distribution method.

### Profiles

| Profile | Channel | Distribution | Use Case |
|---|---|---|---|
| `development` | `development` | Internal (dev client) | Local testing with Expo Go (simulator) |
| `preview` | `preview` | Ad-Hoc Internal | Team testing on physical devices |
| `production` | `production` | App Store (implied) | Future: TestFlight or production release |

### Environment Variables (Baked at Build Time)

All three profiles have `env` vars pre-set:
- `EXPO_PUBLIC_AI_API_BASE_URL` — Points to Render backend
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Anon key for client auth

These are embedded into the binary at build time. **To change backend URL, you MUST rebuild and redeploy the app** (OTA via EAS Update is not applicable for base endpoint changes).

### Build Commands

```bash
# Preview build (Ad-Hoc Internal)
eas build --platform ios --profile preview

# Production build (App Store, future)
eas build --platform ios --profile production

# Monitor build in dashboard:
eas build:list
```

### Device Setup

Before first preview build, register devices:
```bash
eas device:create
```

This creates an ad-hoc provisioning profile on Apple Developer account and adds your device UDID.

### Over-the-Air Updates (OTA)

Non-critical updates (UI fixes, logic changes, new features not requiring backend changes) can be pushed via EAS Update without rebuilding:

```bash
# Increment version, then publish
eas update --channel preview

# Users on the "preview" channel auto-fetch the update on next launch
```

Cannot use OTA to change `EXPO_PUBLIC_AI_API_BASE_URL` or other build-time secrets.

---

## Cost & Sleep Trade-offs

### Render Free vs Starter

| Feature | Free | Starter |
|---|---|---|
| Monthly cost | Free | $7 |
| Sleep behavior | Sleep after 15 min inactivity | No sleep |
| Scheduler reliability | Unreliable (may sleep during scheduled job) | Reliable |
| Suitable for MVP | Yes, with workaround | Recommended for production |

**Decision**: Start on Free, move to Starter once daily blog packaging must be reliable.

### Gemini API Costs

- **Vision calls** (`/ai/comment` per photo): ~$0.15 per 1M tokens (flash-lite cheaper, flash more accurate)
- **Blog generation** (end-of-day): ~$0.075 per 1M tokens
- **Chat** (per user turn): ~$0.30 per 1M tokens (pro-level model)

At MVP scale (<100 daily users): ~$5-20/month for Gemini.

---

## Rotation Playbook: Changing Backend URL

If you need to change the backend URL (e.g., migrate from Render to another host):

1. **Update `eas.json`**:
   ```json
   "preview": {
     "env": {
       "EXPO_PUBLIC_AI_API_BASE_URL": "https://new-backend-url.example.com"
     }
   },
   "production": {
     "env": {
       "EXPO_PUBLIC_AI_API_BASE_URL": "https://new-backend-url.example.com"
     }
   }
   ```

2. **Rebuild and redeploy**:
   ```bash
   eas build --platform ios --profile preview
   # Wait for build to complete, then distribute to testers
   ```

3. **Increment app version** (optional, but recommended):
   ```json
   "autoIncrement": true  // auto-bumps build number
   ```

4. **Monitor new backend** for health/logs after rollout.

---

## Monitoring & Debugging

### Backend Logs

In Render Dashboard:
- Service → Logs tab
- Filter by timestamp or grep patterns
- Look for `ERROR` or `WARNING` at startup

### Mobile Crash Reporting

Once EAS build is live, use **EAS Update** dashboard to track OTA adoption. For crash reporting, integrate Sentry (optional).

### Database Queries

Access Supabase dashboard → SQL Editor to manually query `photos`, `daily_blogs`, `chat_messages` if needed.

---

## Security Checklist

- [ ] Do NOT commit `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY` to git
- [ ] Set all env vars in Render Dashboard (use `sync: false` in `render.yaml`)
- [ ] Rotate Gemini API key every 90 days
- [ ] Regularly audit Supabase RLS policies
- [ ] Use signed URLs for photo downloads (already in code via `@supabase/supabase-js`)
