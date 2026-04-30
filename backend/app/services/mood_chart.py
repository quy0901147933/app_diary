"""Aggregate mood_events into a 7-day heatmap and generate a Lumina nudge."""

from __future__ import annotations

import json
import logging
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from app.core.config import get_settings
from app.core.prompts import MOOD_LUMINA_NUDGE
from app.core.supabase_client import get_service_client
from app.services._gemini_retry import with_retry

log = logging.getLogger("mood-chart")

DAYS_BACK = 7  # last 7 days inclusive of today


def _label(d: date, today: date) -> str:
    if d == today:
        return "Hôm nay"
    return f"{d.day}/{d.month}"


def _day_buckets() -> tuple[list[date], date]:
    settings = get_settings()
    tz = ZoneInfo(settings.scheduler_timezone)
    today_local = datetime.now(tz).date()
    days = [today_local - timedelta(days=i) for i in range(DAYS_BACK)]
    return days, today_local


def compute_daily_buckets(user_id: str) -> list[dict[str, Any]]:
    sb = get_service_client()
    days, today_local = _day_buckets()
    earliest = days[-1]

    rows = (
        sb.table("mood_events")
        .select("sentiment_score, emotion_tag, created_at")
        .eq("user_id", user_id)
        .gte("created_at", earliest.isoformat())
        .execute()
    )

    settings = get_settings()
    tz = ZoneInfo(settings.scheduler_timezone)

    grouped_scores: dict[date, list[int]] = defaultdict(list)
    grouped_tags: dict[date, Counter[str]] = defaultdict(Counter)

    for row in rows.data or []:
        created = row.get("created_at")
        if not created:
            continue
        try:
            dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
        except ValueError:
            continue
        local_day = dt.astimezone(tz).date()
        if local_day < earliest:
            continue
        score = row.get("sentiment_score")
        tag = row.get("emotion_tag")
        if isinstance(score, (int, float)):
            grouped_scores[local_day].append(int(score))
        if isinstance(tag, str) and tag:
            grouped_tags[local_day][tag] += 1

    out: list[dict[str, Any]] = []
    for d in days:
        scores = grouped_scores.get(d, [])
        tags = grouped_tags.get(d, Counter())
        avg = round(sum(scores) / len(scores), 2) if scores else None
        dominant = tags.most_common(1)[0][0] if tags else None
        out.append(
            {
                "day": d,
                "label": _label(d, today_local),
                "average_score": avg,
                "sample_count": len(scores),
                "dominant_emotion": dominant,
            }
        )
    out.reverse()  # oldest → newest left-to-right
    return out


async def generate_lumina_nudge(days: list[dict[str, Any]]) -> str:
    settings = get_settings()
    series = [
        {
            "label": d["label"],
            "score": d["average_score"],
            "emotion": d["dominant_emotion"],
            "samples": d["sample_count"],
        }
        for d in days
    ]
    user_prompt = (
        "Điểm cảm xúc 7 ngày gần nhất (oldest → newest):\n"
        + json.dumps(series, ensure_ascii=False)
        + "\nViết câu nhắn theo đúng yêu cầu, JSON một dòng."
    )
    client = genai.Client(api_key=settings.gemini_api_key)
    chain = [settings.chat_model, *settings.chat_fallback_models]
    last_exc: Exception | None = None
    for model_name in chain:
        try:
            result = await with_retry(
                lambda m=model_name: client.models.generate_content(
                    model=m,
                    contents=[user_prompt],
                    config=types.GenerateContentConfig(
                        system_instruction=MOOD_LUMINA_NUDGE,
                        temperature=0.85,
                        response_mime_type="application/json",
                    ),
                ),
                attempts=2,
            )
            try:
                obj = json.loads(result.text or "")
                msg = str(obj.get("message", "")).strip()
                if msg:
                    return msg[:240]
            except json.JSONDecodeError:
                continue
        except (genai_errors.ServerError, genai_errors.ClientError) as exc:
            last_exc = exc
            log.warning("mood-nudge model %s failed: %s", model_name, exc)
            continue
    if last_exc:
        log.warning("mood-nudge fully failed: %s", last_exc)
    return _fallback_message(days)


def _fallback_message(days: list[dict[str, Any]]) -> str:
    samples = sum(d["sample_count"] for d in days)
    if samples < 3:
        return "Em chưa có nhiều dữ liệu, anh kể em nghe hôm nay anh thấy thế nào nhé?"
    return "Em luôn ở đây cùng anh, dù tuần này có ra sao đi nữa."
