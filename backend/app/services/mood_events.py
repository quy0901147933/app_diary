"""Helper to persist mood signals extracted silently from photo + chat flows."""

from __future__ import annotations

import logging
from typing import Any, Literal

from app.core.supabase_client import get_service_client

log = logging.getLogger("mood")

VALID_TAGS = {
    "Vui vẻ",
    "Bình yên",
    "Ấm áp",
    "Phấn khích",
    "Hoài niệm",
    "Mệt mỏi",
    "Áp lực",
    "Cô đơn",
    "Buồn",
    "Lo âu",
    "Trung tính",
}


def _coerce_score(value: Any) -> int | None:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None
    if 1 <= n <= 10:
        return n
    return None


def _coerce_tag(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    s = value.strip()
    if not s:
        return None
    if s in VALID_TAGS:
        return s
    return "Trung tính"


def record_mood_event(
    user_id: str,
    source: Literal["photo", "chat"],
    source_id: str | None,
    sentiment_score: Any,
    emotion_tag: Any,
) -> None:
    score = _coerce_score(sentiment_score)
    tag = _coerce_tag(emotion_tag)
    if score is None or tag is None:
        log.debug("skip mood event (invalid score/tag): %r %r", sentiment_score, emotion_tag)
        return
    try:
        get_service_client().table("mood_events").insert(
            {
                "user_id": user_id,
                "source": source,
                "source_id": source_id,
                "sentiment_score": score,
                "emotion_tag": tag,
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001
        log.warning("failed to record mood event: %s", exc)
