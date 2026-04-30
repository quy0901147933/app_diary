"""Single-shot AI chat with RAG over the user's photos + daily blogs.

NOT realtime/streaming. Returns one complete reply per request, plus an
optional auto-reaction the AI puts on the user's latest message.
"""

import json
import logging
from typing import Any

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from app.core.config import get_settings
from app.core.prompts import CHAT_SYSTEM
from app.core.supabase_client import get_service_client
from app.services._gemini_retry import with_retry
from app.services.mood_events import record_mood_event
from app.services.persona import build_persona_block, fetch_persona as _shared_fetch_persona

log = logging.getLogger("chat")

PHOTO_LIMIT = 12
BLOG_LIMIT = 5
HISTORY_LIMIT = 16


def _load_persona(user_id: str) -> dict[str, Any] | None:
    return _shared_fetch_persona(user_id)


def _persona_directive(p: dict[str, Any] | None) -> str:
    """Backward-compat wrapper: chat_engine internals + proactive.py import this."""
    return build_persona_block(p, mode="chat")


def _build_rag_context(user_id: str) -> str:
    sb = get_service_client()

    photos = (
        sb.table("photos")
        .select("ai_commentary, location_text, taken_at, ai_mood, note")
        .eq("user_id", user_id)
        .eq("status", "ready")
        .order("taken_at", desc=True)
        .limit(PHOTO_LIMIT)
        .execute()
    )

    blogs = (
        sb.table("daily_blogs")
        .select("date, title, body_md, mood_emoji")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .limit(BLOG_LIMIT)
        .execute()
    )

    photo_lines: list[str] = []
    for p in photos.data or []:
        bits: list[str] = []
        if p.get("taken_at"):
            bits.append(p["taken_at"][:16])
        if p.get("location_text"):
            bits.append(p["location_text"])
        head = " · ".join(bits) if bits else "—"
        body = p.get("ai_commentary") or ""
        extras: list[str] = []
        if p.get("ai_mood"):
            extras.append(f"mood {p['ai_mood']}")
        if p.get("note"):
            extras.append(f"note: {p['note']}")
        suffix = f" ({', '.join(extras)})" if extras else ""
        photo_lines.append(f"- [{head}] {body}{suffix}")

    blog_lines: list[str] = []
    for b in blogs.data or []:
        title = b.get("title") or "(không tiêu đề)"
        body_excerpt = (b.get("body_md") or "").strip().replace("\n", " ")[:240]
        mood = b.get("mood_emoji") or ""
        blog_lines.append(f"- {b['date']} {mood} \"{title}\" — {body_excerpt}")

    parts: list[str] = []
    if photo_lines:
        parts.append("KHOẢNH KHẮC GẦN ĐÂY:\n" + "\n".join(photo_lines))
    if blog_lines:
        parts.append("BÀI BLOG GẦN ĐÂY:\n" + "\n".join(blog_lines))
    return "\n\n".join(parts)


def _load_history(user_id: str) -> list[dict[str, Any]]:
    sb = get_service_client()
    res = (
        sb.table("chat_messages")
        .select("role, content")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(HISTORY_LIMIT)
        .execute()
    )
    rows = list(reversed(res.data or []))
    return [
        {"role": "user" if r["role"] == "user" else "model", "parts": [{"text": r["content"]}]}
        for r in rows
    ]


VALID_REACTIONS = {"love", "like", "haha", "dislike"}


def _parse_chat_output(raw: str) -> tuple[str, str | None, Any, Any]:
    raw = (raw or "").strip()
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: model didn't emit JSON — treat raw as plain reply.
        return raw, None, None, None
    reply = str(obj.get("reply") or "").strip()
    reaction = obj.get("react_to_user")
    if isinstance(reaction, str) and reaction.lower() in VALID_REACTIONS:
        reaction = reaction.lower()
    else:
        reaction = None
    sentiment_score = obj.get("user_sentiment_score")
    emotion_tag = obj.get("user_emotion_tag")
    return reply, reaction, sentiment_score, emotion_tag


async def reply_to(user_id: str, content: str) -> tuple[str, str | None]:
    settings = get_settings()
    sb = get_service_client()

    persona = _load_persona(user_id)
    persona_block = _persona_directive(persona)
    rag = _build_rag_context(user_id)

    system = CHAT_SYSTEM
    if persona_block:
        system = persona_block + "\n\n" + system
    if rag:
        system += "\n\nNGỮ CẢNH NGƯỜI DÙNG (chỉ tham khảo, không liệt kê):\n" + rag

    contents: list[Any] = _load_history(user_id)
    contents.append({"role": "user", "parts": [{"text": content}]})

    client = genai.Client(api_key=settings.gemini_api_key)

    chain = [settings.chat_model, *settings.chat_fallback_models]
    last_exc: Exception | None = None
    result = None
    used_model: str | None = None
    for model_name in chain:
        try:
            result = await with_retry(
                lambda m=model_name: client.models.generate_content(
                    model=m,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system,
                        temperature=0.85,
                        response_mime_type="application/json",
                    ),
                ),
                attempts=2,
            )
            used_model = model_name
            break
        except (genai_errors.ServerError, genai_errors.ClientError) as exc:
            last_exc = exc
            log.warning("chat model %s failed (%s) — falling back", model_name, exc)
            continue

    if result is None:
        assert last_exc is not None
        raise last_exc

    reply, user_reaction, sent_score, emotion_tag = _parse_chat_output(result.text or "")
    if not reply:
        reply = "Mình đang lắng nghe bạn đây."
    log.info(
        "chat reply via %s (%d chars, react=%s sent=%s/%s)",
        used_model,
        len(reply),
        user_reaction or "—",
        sent_score,
        emotion_tag,
    )

    inserted = (
        sb.table("chat_messages")
        .insert(
            [
                {
                    "user_id": user_id,
                    "role": "user",
                    "content": content,
                    "reaction": user_reaction,
                },
                {"user_id": user_id, "role": "assistant", "content": reply},
            ]
        )
        .execute()
    )

    user_msg_id = None
    if inserted.data:
        user_row = next((r for r in inserted.data if r.get("role") == "user"), None)
        if user_row:
            user_msg_id = user_row.get("id")

    record_mood_event(
        user_id=user_id,
        source="chat",
        source_id=user_msg_id,
        sentiment_score=sent_score,
        emotion_tag=emotion_tag,
    )

    return reply, user_reaction
