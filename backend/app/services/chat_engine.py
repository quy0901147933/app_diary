"""Single-shot AI chat with RAG over the user's photos + daily blogs.

NOT realtime/streaming. Returns one complete reply per request, plus an
optional auto-reaction the AI puts on the user's latest message.
"""

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
from app.core.prompts import CHAT_SYSTEM
from supabase import Client

from app.core.supabase_client import get_service_client
from app.services._gemini_retry import with_retry
from app.services.embeddings import embed_text
from app.services.mood_events import record_mood_event
from app.services.persona import build_persona_block, fetch_persona as _shared_fetch_persona

log = logging.getLogger("chat")

PHOTO_LIMIT = 12
BLOG_LIMIT = 5
HISTORY_LIMIT = 16
MOOD_TIMELINE_DAYS = 7


def _load_persona(user_id: str) -> dict[str, Any] | None:
    return _shared_fetch_persona(user_id)


def _persona_directive(p: dict[str, Any] | None) -> str:
    """Backward-compat wrapper: chat_engine internals + proactive.py import this."""
    return build_persona_block(p, mode="chat")


def _build_mood_timeline(user_id: str) -> str:
    """Render emotional momentum across the last few days as a chained arrow.

    Letting Lumina see "[3 ngày trước: Hào hứng] → [Hôm qua: Hơi mệt] → [Hôm nay: Áp lực]"
    means she replies in context of the trajectory, not just the latest message.
    """
    settings = get_settings()
    tz = ZoneInfo(settings.scheduler_timezone)
    today_local = datetime.now(tz).date()
    earliest = today_local - timedelta(days=MOOD_TIMELINE_DAYS - 1)

    sb = get_service_client()
    res = (
        sb.table("mood_events")
        .select("sentiment_score, emotion_tag, hidden_need, created_at")
        .eq("user_id", user_id)
        .gte("created_at", earliest.isoformat())
        .order("created_at", desc=False)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return ""

    grouped: dict[date, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        created = row.get("created_at")
        if not isinstance(created, str):
            continue
        try:
            local_day = (
                datetime.fromisoformat(created.replace("Z", "+00:00"))
                .astimezone(tz)
                .date()
            )
        except ValueError:
            continue
        grouped[local_day].append(row)

    if not grouped:
        return ""

    chain: list[str] = []
    for d in sorted(grouped.keys()):
        events = grouped[d]
        scores = [e["sentiment_score"] for e in events if isinstance(e.get("sentiment_score"), (int, float))]
        avg = sum(scores) / len(scores) if scores else None
        tags = Counter(e["emotion_tag"] for e in events if isinstance(e.get("emotion_tag"), str))
        dominant = tags.most_common(1)[0][0] if tags else "—"

        # Latest hidden_need for that day — most informative single signal.
        latest_need: str | None = None
        for e in reversed(events):
            need = e.get("hidden_need")
            if isinstance(need, str) and need.strip():
                latest_need = need.strip()
                break

        delta = (today_local - d).days
        if delta == 0:
            label = "Hôm nay"
        elif delta == 1:
            label = "Hôm qua"
        else:
            label = f"{delta} ngày trước"

        score_part = f"{avg:.1f}/10" if avg is not None else "—"
        seg = f"[{label}: {dominant} ({score_part})"
        if latest_need:
            seg += f" — \"{latest_need[:80]}\""
        seg += "]"
        chain.append(seg)

    return "DIỄN BIẾN TÂM LÝ GẦN ĐÂY (cũ → mới):\n" + " → ".join(chain)


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


def _parse_chat_output(
    raw: str,
) -> tuple[str, str | None, Any, Any, str | None, str | None]:
    """Parse the internal-monologue chat JSON.

    Returns: (reply, reaction, sentiment_score, emotion_tag, hidden_need, strategy)
    """
    raw = (raw or "").strip()
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: model didn't emit JSON — treat raw as plain reply.
        return raw, None, None, None, None, None

    thought = obj.get("thought") or {}
    if not isinstance(thought, dict):
        thought = {}

    reply = str(obj.get("reply") or "").strip()
    reaction = obj.get("react_to_user")
    if isinstance(reaction, str) and reaction.lower() in VALID_REACTIONS:
        reaction = reaction.lower()
    else:
        reaction = None

    # Prefer nested thought block, fallback to top-level (for backward compat).
    sentiment_score = thought.get("user_sentiment_score", obj.get("user_sentiment_score"))
    emotion_tag = thought.get("user_emotion_tag", obj.get("user_emotion_tag"))
    hidden_need_raw = thought.get("user_emotion_analysis")
    strategy_raw = thought.get("response_strategy")
    hidden_need = hidden_need_raw if isinstance(hidden_need_raw, str) else None
    strategy = strategy_raw if isinstance(strategy_raw, str) else None

    return reply, reaction, sentiment_score, emotion_tag, hidden_need, strategy


async def _retrieve_emotional_memories(
    user_id: str, query_text: str
) -> tuple[str, list[float] | None]:
    """Hybrid emotional RAG: embed the new message and pull the user's past
    turns that semantically + emotionally resemble it.

    Returns (formatted_block, embedding_for_reuse). The embedding is reused
    when we later persist the user's row → only one embed API call per turn.
    """
    embedding = await embed_text(query_text)
    if embedding is None:
        return "", None

    sb = get_service_client()
    try:
        res = sb.rpc(
            "match_emotional_memories",
            {
                "p_user_id": user_id,
                "p_query_embedding": embedding,
                "p_match_count": 3,
                "p_min_similarity": 0.55,
            },
        ).execute()
    except Exception as exc:  # noqa: BLE001
        log.warning("emotional-RAG search failed: %s", exc)
        return "", embedding

    rows = res.data or []
    if not rows:
        return "", embedding

    lines: list[str] = []
    for r in rows:
        when = (r.get("created_at") or "")[:10]
        emotion = r.get("emotion_tag") or "—"
        score = r.get("sentiment_score")
        score_str = f"{score}/10" if isinstance(score, (int, float)) else "—"
        sim = r.get("similarity")
        sim_str = f"{sim:.2f}" if isinstance(sim, (int, float)) else "—"
        content_excerpt = (r.get("content") or "")[:140].replace("\n", " ")
        need = (r.get("hidden_need") or "").strip()

        seg = f"- [{when} · {emotion} · {score_str} · sim={sim_str}] \"{content_excerpt}\""
        if need:
            seg += f"\n    └ Lúc đó nhu cầu ẩn: {need[:100]}"
        lines.append(seg)

    block = (
        "KÝ ỨC CẢM XÚC TƯƠNG TỰ (chỉ tham khảo để hiểu pattern, KHÔNG quote nguyên văn):\n"
        + "\n".join(lines)
    )
    return block, embedding


async def reply_to(user_id: str, content: str) -> tuple[str, str | None]:
    settings = get_settings()
    sb = get_service_client()

    persona = _load_persona(user_id)
    persona_block = _persona_directive(persona)
    rag = _build_rag_context(user_id)
    mood_timeline = _build_mood_timeline(user_id)
    emotional_memories, query_embedding = await _retrieve_emotional_memories(user_id, content)

    system = CHAT_SYSTEM
    if persona_block:
        system = persona_block + "\n\n" + system
    if mood_timeline:
        system += "\n\n" + mood_timeline
    if emotional_memories:
        system += "\n\n" + emotional_memories
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

    (
        reply,
        user_reaction,
        sent_score,
        emotion_tag,
        hidden_need,
        strategy,
    ) = _parse_chat_output(result.text or "")
    if not reply:
        reply = "Mình đang lắng nghe bạn đây."
    log.info(
        "chat reply via %s (%d chars, react=%s sent=%s/%s strategy=%.40s)",
        used_model,
        len(reply),
        user_reaction or "—",
        sent_score,
        emotion_tag,
        strategy or "",
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
    assistant_msg_id = None
    if inserted.data:
        for r in inserted.data:
            if r.get("role") == "user":
                user_msg_id = r.get("id")
            elif r.get("role") == "assistant":
                assistant_msg_id = r.get("id")

    # Persist embedding + denormalized emotion metadata onto the user row so
    # future emotional-RAG searches can filter without joining mood_events.
    if user_msg_id and query_embedding is not None:
        try:
            update_payload: dict[str, Any] = {"embedding": query_embedding}
            if isinstance(sent_score, (int, float)):
                update_payload["sentiment_score"] = int(sent_score)
            if isinstance(emotion_tag, str) and emotion_tag.strip():
                update_payload["emotion_tag"] = emotion_tag.strip()
            sb.table("chat_messages").update(update_payload).eq("id", user_msg_id).execute()
        except Exception as exc:  # noqa: BLE001
            log.warning("failed to attach embedding/emotion to %s: %s", user_msg_id, exc)

    # Embed the assistant reply too (background-friendly: don't block, ignore failure).
    if assistant_msg_id:
        try:
            assistant_emb = await embed_text(reply)
            if assistant_emb is not None:
                sb.table("chat_messages").update({"embedding": assistant_emb}).eq(
                    "id", assistant_msg_id
                ).execute()
        except Exception as exc:  # noqa: BLE001
            log.debug("assistant embed skipped: %s", exc)

    record_mood_event(
        user_id=user_id,
        source="chat",
        source_id=user_msg_id,
        sentiment_score=sent_score,
        emotion_tag=emotion_tag,
        hidden_need=hidden_need,
    )

    # Feedback loop: nếu user vừa được Lumina hỏi thăm (last_mood_proactive_at < 24h)
    # và họ trả lời với sentiment cao (≥ 6) → reset cooldown để Lumina không lặp lại
    # sự quan tâm khi họ đã ổn. Đây là RLHF nhẹ thông qua giao tiếp tự nhiên.
    _maybe_reset_mood_cooldown(sb, user_id, sent_score)

    return reply, user_reaction


def _maybe_reset_mood_cooldown(sb: Client, user_id: str, sent_score: Any) -> None:
    """If the user came back with positive sentiment within 24h of a mood-low push,
    clear last_mood_proactive_at so the next genuine low day can re-trigger sooner."""
    try:
        score = int(sent_score) if isinstance(sent_score, (int, float)) else None
    except (TypeError, ValueError):
        score = None
    if score is None or score < 6:
        return

    res = (
        sb.table("profiles")
        .select("last_mood_proactive_at")
        .eq("id", user_id)
        .single()
        .execute()
    )
    last_str = (res.data or {}).get("last_mood_proactive_at") if res.data else None
    if not isinstance(last_str, str):
        return
    try:
        last_at = datetime.fromisoformat(last_str.replace("Z", "+00:00"))
    except ValueError:
        return
    from datetime import timezone as _tz
    if datetime.now(_tz.utc) - last_at > timedelta(hours=24):
        return  # too old — don't bother resetting

    sb.table("profiles").update({"last_mood_proactive_at": None}).eq("id", user_id).execute()
    log.info("mood-low cooldown reset for %s (positive feedback %d)", user_id, score)
