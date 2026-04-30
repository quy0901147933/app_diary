"""Self-healing worker: retry photos stuck in pending_ai / failed.

Runs:
- Once at app startup (catches photos lost during a previous restart).
- Periodically via APScheduler every PHOTO_RETRY_INTERVAL_SEC.

Strategy:
- pending_ai older than 60s → retry (likely lost in flight)
- failed with ai_retry_count < MAX_RETRIES → retry (transient 503 / network)
- Cap at 3 attempts per photo to avoid infinite loops on truly bad inputs.
"""

import logging
from datetime import datetime, timedelta, timezone

from app.core.supabase_client import get_service_client
from app.services._gemini_retry import with_retry
from app.services.persona import fetch_persona
from app.services.vision import analyze_photo

log = logging.getLogger("photo-retry")

MAX_RETRIES = 3
PENDING_GRACE_SEC = 60   # let the original fire-and-forget have a minute first
LOOKBACK_HOURS = 6       # don't bother with photos older than this


async def retry_stuck_photos() -> None:
    try:
        sb = get_service_client()
        cutoff_lookback = (
            datetime.now(timezone.utc) - timedelta(hours=LOOKBACK_HOURS)
        ).isoformat()
        cutoff_pending = (
            datetime.now(timezone.utc) - timedelta(seconds=PENDING_GRACE_SEC)
        ).isoformat()

        res = (
            sb.table("photos")
            .select("id, user_id, storage_path, taken_at, location_text, status, ai_retry_count")
            .in_("status", ["pending_ai", "failed"])
            .gte("created_at", cutoff_lookback)
            .lt("ai_retry_count", MAX_RETRIES)
            .lte("created_at", cutoff_pending)
            .order("created_at", desc=False)
            .limit(20)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("photo-retry skipped (network/Supabase unreachable): %s", exc)
        return

    rows = res.data or []
    if not rows:
        return
    log.info("retrying %d stuck photo(s)", len(rows))

    persona_cache: dict[str, dict | None] = {}
    for p in rows:
        photo_id = p["id"]
        attempt = (p.get("ai_retry_count") or 0) + 1
        owner = p.get("user_id")
        if owner not in persona_cache:
            persona_cache[owner] = fetch_persona(owner) if owner else None
        try:
            analysis = await with_retry(
                lambda p=p, persona=persona_cache.get(owner): analyze_photo(
                    p["storage_path"],
                    taken_at=p.get("taken_at"),
                    location_text=p.get("location_text"),
                    persona=persona,
                ),
                attempts=2,
            )
            sb.table("photos").update(
                {
                    "ai_commentary": analysis["commentary"],
                    "ai_mood": analysis["mood"],
                    "ai_hashtags": analysis["hashtags"],
                    "ai_retry_count": attempt,
                    "status": "ready",
                }
            ).eq("id", photo_id).execute()
            log.info("recovered photo %s on attempt %d", photo_id, attempt)
        except Exception as exc:  # noqa: BLE001
            log.warning("photo %s retry %d failed: %s", photo_id, attempt, exc)
            new_status = "failed" if attempt >= MAX_RETRIES else "pending_ai"
            sb.table("photos").update(
                {"ai_retry_count": attempt, "status": new_status}
            ).eq("id", photo_id).execute()
