# LuminaDiary Backend

FastAPI service for vision-based photo commentary, end-of-day blog packaging, and AI chat.

## Quickstart

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in keys
uvicorn app.main:app --reload --port 8000
```

Health check: `curl http://localhost:8000/health` → `{"status":"ok"}`

## Env

See [.env.example](.env.example). Required: Supabase URL + service-role key + JWT secret, Gemini API key.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| POST | `/ai/comment` | `{ photo_id }` → run vision, persist commentary |
| POST | `/day/package` | `{ date }` → aggregate photos into a blog |
| POST | `/chat/message` | `{ content, context_date? }` → AI chat reply |

All non-health endpoints require `Authorization: Bearer <supabase_jwt>`.

## Layout

```
app/
  main.py         FastAPI factory + CORS
  deps.py         JWT auth dependency
  routers/        Thin HTTP layer
  services/       Vision / blog / chat business logic
  models/         Pydantic schemas
  core/           Config, Supabase client, prompt templates
```

See top-level [docs/system-architecture.md](../docs/system-architecture.md) for data flow.
