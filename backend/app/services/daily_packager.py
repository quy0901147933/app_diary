"""Auto-package each user's day into a TimelineCard blog at a scheduled hour.

Triggered by APScheduler in app/main.py.
Also re-used by the manual /day/package endpoint for a single user.
"""

import logging
from collections import Counter
from datetime import date as date_type
from datetime import datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from supabase import Client

from app.core.config import get_settings
from app.core.supabase_client import get_service_client
from app.services.blog_generator import write_daily_blog

log = logging.getLogger("packager")


def _local_day_range_utc(day: date_type, tz_name: str) -> tuple[str, str]:
    """Convert a calendar day in the given timezone to a UTC half-open range.

    Returns ISO strings with tz, suitable for Postgres timestamptz comparisons.
    """
    tz = ZoneInfo(tz_name)
    start_local = datetime.combine(day, time.min, tzinfo=tz)
    end_local = start_local + timedelta(days=1)
    utc = ZoneInfo("UTC")
    return start_local.astimezone(utc).isoformat(), end_local.astimezone(utc).isoformat()


async def package_user_day(
    sb: Client, user_id: str, day: date_type
) -> dict[str, Any] | None:
    settings = get_settings()
    iso = day.isoformat()
    start_utc, end_utc = _local_day_range_utc(day, settings.scheduler_timezone)

    photos_res = (
        sb.table("photos")
        .select("id, ai_commentary, note, location_text, taken_at, storage_path")
        .eq("user_id", user_id)
        .gte("created_at", start_utc)
        .lt("created_at", end_utc)
        .eq("status", "ready")
        .order("taken_at", desc=False)
        .execute()
    )
    photos = photos_res.data or []
    if not photos:
        log.info("user %s has no ready photos in [%s, %s) — skip", user_id, start_utc, end_utc)
        return None

    blog = await write_daily_blog(
        [
            {
                "commentary": p.get("ai_commentary"),
                "note": p.get("note"),
                "location": p.get("location_text"),
                "taken_at": p.get("taken_at"),
            }
            for p in photos
        ]
    )

    cover_ids = [p["id"] for p in photos[:3]]
    cover_urls = [p["storage_path"] for p in photos[:3] if p.get("storage_path")]

    locs = [p["location_text"] for p in photos if p.get("location_text")]
    location_text = Counter(locs).most_common(1)[0][0] if locs else None

    sb.table("daily_blogs").upsert(
        {
            "user_id": user_id,
            "date": iso,
            "cover_photo_ids": cover_ids,
            "cover_photo_urls": cover_urls,
            "location_text": location_text,
            **blog,
        },
        on_conflict="user_id,date",
    ).execute()
    log.info("packaged %s photos for user %s on %s", len(photos), user_id, iso)
    return blog


async def package_all_users() -> None:
    """Iterate every user with at least one ready photo today; auto-package each."""
    settings = get_settings()
    sb = get_service_client()
    tz = ZoneInfo(settings.scheduler_timezone)
    today = datetime.now(tz).date()
    start_utc, end_utc = _local_day_range_utc(today, settings.scheduler_timezone)

    users_res = (
        sb.table("photos")
        .select("user_id")
        .eq("status", "ready")
        .gte("created_at", start_utc)
        .lt("created_at", end_utc)
        .execute()
    )
    user_ids = {r["user_id"] for r in (users_res.data or [])}
    log.info(
        "daily packager: %d user(s) for %s (range %s–%s)",
        len(user_ids),
        today.isoformat(),
        start_utc,
        end_utc,
    )

    for uid in user_ids:
        try:
            await package_user_day(sb, uid, today)
        except Exception as exc:  # noqa: BLE001
            log.exception("packaging failed for user %s: %s", uid, exc)
