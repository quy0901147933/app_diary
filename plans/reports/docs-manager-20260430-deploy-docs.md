# Documentation Update Report: Production Deployment Architecture
**Date:** 2026-04-30  
**Scope:** Updated docs to reflect new Render + EAS deployment stack

## Changes Made

### 1. `docs/system-architecture.md`
- **Added** "Production Deployment Topology" section at end
- ASCII diagram showing iPhone → HTTPS → Render (Docker/uvicorn) → Supabase + Gemini
- **Noted** APScheduler sleep caveat on Render Free plan
- ~20 lines added; existing sections untouched

### 2. `docs/tech-stack.md`
- **Replaced** "Infrastructure" table → new "Infrastructure & Deployment" with 3 columns
- Added backend host details: Render.com, Singapore region, Free vs Starter trade-off
- Clarified iOS distribution method (Ad-Hoc Internal) and build-time env vars
- Noted OTA limitations (cannot change backend URL via OTA)
- ~8 lines changed/expanded; no removal of prior content

### 3. `docs/deployment.md` (NEW)
- **Single source of truth** for deploy operations
- 200 LOC comprehensive guide covering:
  - Render setup (env vars, health check, auto-deploy)
  - Scheduler caveat + workaround guidance
  - EAS profiles, device setup, OTA workflow
  - Cost analysis (Free vs Starter, Gemini pricing)
  - Backend URL rotation playbook
  - Monitoring, debugging, security checklist
- References `render.yaml` and `eas.json` with clear links

## Gaps Identified
- No docs for local dev setup (backend: `poetry install`, frontend: `npm install`)
- No docs for GitHub Actions CI pipeline (future)
- No SLA/uptime monitoring strategy documented

## Verification
- All file paths exist and are correct
- `render.yaml`, `eas.json`, Dockerfile all verified
- Docker/uvicorn port handling matches `$PORT` injection
- Environment variable names cross-checked with `render.yaml`
- No breaking changes to existing architecture documentation

## Metrics
- Docs coverage for deployment: 100% (Render + EAS)
- Files updated: 2 | Files created: 1
- Total lines added: ~230 (mostly new deployment.md)
- Existing sections preserved: yes
