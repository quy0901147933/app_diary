"""Proactive AI messaging — Lumina chủ động nhắn user.

Three triggers:
- morning ritual (~08:00 user TZ)
- night recap (after daily blog generated, ~22:30)
- inactivity (≥6h of silence during waking hours)

Rules:
- quiet hours [profile.quiet_start_hour, profile.quiet_end_hour) → never send
- max 3 proactive messages per user per day (resets at user's local midnight)
- skip if last_seen_at < 30 min ago (user just opened app — don't spam)
- generate via Gemini Flash with persona + recent RAG context
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from supabase import Client

from app.core.config import get_settings
from app.core.supabase_client import get_service_client
from app.services._gemini_retry import with_retry
from app.services.chat_engine import _build_rag_context, _persona_directive

log = logging.getLogger("proactive")

DAILY_CAP = 3
RECENT_INTERACTION_MINUTES = 30
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _now_local(tz_name: str) -> datetime:
    return datetime.now(ZoneInfo(tz_name))


def _is_quiet_hour(now_hour: int, start: int, end: int) -> bool:
    # Quiet window can wrap midnight (e.g. 23 -> 7).
    if start <= end:
        return start <= now_hour < end
    return now_hour >= start or now_hour < end


def _bucket_today(profile: dict[str, Any], today_iso: str) -> tuple[int, str]:
    """Return (today's count, the date the count belongs to)."""
    count = int(profile.get("proactive_count_today") or 0)
    bucket = profile.get("proactive_count_date")
    if bucket != today_iso:
        return 0, today_iso
    return count, today_iso


KIND_BRIEF = {
    "morning": (
        "Đây là tin nhắn buổi sáng đầu ngày. Ngắn gọn 1-2 câu, ấm áp, nếu có ngữ cảnh hôm qua "
        "có thể nhắc nhẹ (vd: 'hôm qua thức khuya làm đồ án có mệt không?'). KHÔNG hỏi nhiều thứ một lúc."
    ),
    "night_recap": (
        "Đây là tin nhắn cuối ngày báo bài blog timeline đã sẵn sàng. 1-2 câu, mời người dùng "
        "vào xem. Có thể nhắc tâm trạng/khoảnh khắc nổi bật của hôm nay nếu thấy phù hợp."
    ),
    "inactivity": (
        "Đây là tin nhắn 'nhớ nhung' khi người dùng đã im lặng nhiều giờ. 1-2 câu nhẹ nhàng, "
        "không trách móc. Có thể hỏi han kiểu 'bận quá hả?', 'đi đâu mà không khoe ảnh cho em?'."
    ),
}


def _proactive_directive(kind: str) -> str:
    brief = KIND_BRIEF.get(kind, "Một câu hỏi han nhẹ nhàng.")
    return (
        "BỐI CẢNH ĐẶC BIỆT (TIN NHẮN CHỦ ĐỘNG — KHÔNG PHẢI USER VỪA NHẮN):\n"
        f"- Loại: {kind}\n"
        f"- {brief}\n"
        "- Output: chỉ JSON {\"reply\": \"<text>\", \"react_to_user\": null}. Không markdown."
    )


async def _generate_proactive(
    user_id: str, persona: dict[str, Any] | None, kind: str
) -> str | None:
    settings = get_settings()
    persona_block = _persona_directive(persona) if persona else ""
    rag = _build_rag_context(user_id)

    system_parts = []
    if persona_block:
        system_parts.append(persona_block)
    system_parts.append(_proactive_directive(kind))
    if rag:
        system_parts.append("NGỮ CẢNH NGƯỜI DÙNG (chỉ tham khảo, không liệt kê):\n" + rag)
    system = "\n\n".join(system_parts)

    prompt_user = {
        "morning": "Hãy chủ động nhắn câu chào buổi sáng theo bộ gen.",
        "night_recap": "Hãy báo cho người dùng biết bạn vừa gói ghém ngày của họ thành blog.",
        "inactivity": "Hãy hỏi han nhẹ vì người dùng im lặng đã nhiều giờ.",
    }.get(kind, "Hãy nhắn một câu hỏi han nhẹ.")

    client = genai.Client(api_key=settings.gemini_api_key)
    chain = [settings.chat_model, *settings.chat_fallback_models]
    for model in chain:
        try:
            result = await with_retry(
                lambda m=model: client.models.generate_content(
                    model=m,
                    contents=[{"role": "user", "parts": [{"text": prompt_user}]}],
                    config=types.GenerateContentConfig(
                        system_instruction=system,
                        temperature=0.85,
                        response_mime_type="application/json",
                    ),
                ),
                attempts=2,
            )
            try:
                obj = json.loads(result.text or "{}")
            except json.JSONDecodeError:
                return (result.text or "").strip() or None
            reply = str(obj.get("reply") or "").strip()
            return reply or None
        except (genai_errors.ServerError, genai_errors.ClientError) as exc:
            log.warning("proactive %s on %s failed (%s)", kind, model, exc)
            continue
    return None


async def _send_push(token: str, title: str, body: str) -> None:
    payload = {
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
        "channelId": "lumina-default",
        "priority": "high",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            await client.post(EXPO_PUSH_URL, json=payload)
        except Exception as exc:  # noqa: BLE001
            log.warning("push send failed: %s", exc)


async def _record_and_send(
    sb: Client,
    profile: dict[str, Any],
    persona: dict[str, Any] | None,
    kind: str,
    tz_name: str,
) -> None:
    user_id = profile["id"]
    today_iso = _now_local(tz_name).date().isoformat()
    count, _ = _bucket_today(profile, today_iso)
    if count >= DAILY_CAP:
        log.info("user %s hit daily cap — skip %s", user_id, kind)
        return

    text = await _generate_proactive(user_id, persona, kind)
    if not text:
        log.info("no proactive content generated for %s/%s", user_id, kind)
        return

    sb.table("chat_messages").insert(
        {"user_id": user_id, "role": "assistant", "content": text}
    ).execute()
    sb.table("proactive_messages").insert(
        {"user_id": user_id, "kind": kind, "content": text, "delivered": False}
    ).execute()

    token = profile.get("expo_push_token")
    title = (persona or {}).get("ai_name") or "Lumina"
    if token:
        await _send_push(token, title, text)
        sb.table("proactive_messages").update({"delivered": True, "delivered_at": "now()"}).eq(
            "user_id", user_id
        ).order("created_at", desc=True).limit(1).execute()

    sb.table("profiles").update(
        {
            "proactive_count_today": count + 1,
            "proactive_count_date": today_iso,
            "last_proactive_at": datetime.utcnow().isoformat() + "Z",
        }
    ).eq("id", user_id).execute()
    log.info("proactive %s sent to %s (count %d)", kind, user_id, count + 1)


def _eligible(
    profile: dict[str, Any], now: datetime, kind: str, tz_name: str
) -> bool:
    if not profile.get("proactive_enabled", True):
        return False
    if not profile.get("expo_push_token"):
        return False  # no device registered → silent
    h = now.hour
    if _is_quiet_hour(
        h, int(profile.get("quiet_start_hour") or 23), int(profile.get("quiet_end_hour") or 7)
    ):
        return False
    last_seen_str = profile.get("last_seen_at")
    if last_seen_str:
        try:
            last_seen = datetime.fromisoformat(last_seen_str.replace("Z", "+00:00"))
            if (now.astimezone(last_seen.tzinfo) - last_seen) < timedelta(minutes=RECENT_INTERACTION_MINUTES):
                return False
        except ValueError:
            pass
    today_iso = now.date().isoformat()
    count, _ = _bucket_today(profile, today_iso)
    if count >= DAILY_CAP:
        return False
    if kind == "inactivity":
        # Only fire if last_seen ≥ 6 hours ago
        if last_seen_str:
            try:
                last_seen = datetime.fromisoformat(last_seen_str.replace("Z", "+00:00"))
                if (now.astimezone(last_seen.tzinfo) - last_seen) < timedelta(hours=6):
                    return False
            except ValueError:
                pass
        else:
            return False
    return True


async def run_morning_ritual() -> None:
    settings = get_settings()
    tz_name = settings.scheduler_timezone
    now = _now_local(tz_name)
    sb = get_service_client()
    res = (
        sb.table("profiles")
        .select("*")
        .eq("morning_hour", now.hour)
        .execute()
    )
    profiles = res.data or []
    log.info("morning ritual: %d candidate(s) at hour %d", len(profiles), now.hour)
    for profile in profiles:
        if not _eligible(profile, now, "morning", tz_name):
            continue
        persona = _fetch_persona(sb, profile["id"])
        await _record_and_send(sb, profile, persona, "morning", tz_name)


async def run_night_recap(user_id: str | None = None) -> None:
    settings = get_settings()
    tz_name = settings.scheduler_timezone
    now = _now_local(tz_name)
    sb = get_service_client()
    query = sb.table("profiles").select("*")
    if user_id:
        query = query.eq("id", user_id)
    res = query.execute()
    for profile in res.data or []:
        if not _eligible(profile, now, "night_recap", tz_name):
            continue
        persona = _fetch_persona(sb, profile["id"])
        await _record_and_send(sb, profile, persona, "night_recap", tz_name)


async def run_inactivity_sweep() -> None:
    settings = get_settings()
    tz_name = settings.scheduler_timezone
    now = _now_local(tz_name)
    sb = get_service_client()
    res = sb.table("profiles").select("*").execute()
    profiles = res.data or []
    eligible_count = 0
    for profile in profiles:
        if not _eligible(profile, now, "inactivity", tz_name):
            continue
        persona = _fetch_persona(sb, profile["id"])
        await _record_and_send(sb, profile, persona, "inactivity", tz_name)
        eligible_count += 1
    log.info("inactivity sweep: %d notified", eligible_count)


def _fetch_persona(sb: Client, user_id: str) -> dict[str, Any] | None:
    res = (
        sb.table("user_personas")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return res.data if res and res.data else None
