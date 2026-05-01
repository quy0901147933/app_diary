import json
import logging
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from app.core.config import Settings, get_settings
from app.core.prompts import PHOTO_COMMENTARY_SYSTEM
from app.services._gemini_retry import with_retry
from app.services.persona import build_persona_block

log = logging.getLogger("vision")


def _client(settings: Settings) -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


def _format_taken_at(taken_at: str | None, tz_name: str) -> str | None:
    if not taken_at:
        return None
    raw = taken_at.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return taken_at
    try:
        local = dt.astimezone(ZoneInfo(tz_name))
    except Exception:  # noqa: BLE001
        local = dt
    weekday = ["Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy", "CN"][local.weekday()]
    return local.strftime(f"%H:%M %d/%m/%Y (Thứ {weekday})")


async def analyze_photo(
    image_url: str,
    taken_at: str | None = None,
    location_text: str | None = None,
    persona: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Run Gemini vision with persona + metadata. Returns {commentary, mood, hashtags}."""
    settings = get_settings()
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(image_url)
        resp.raise_for_status()
        image_bytes = resp.content
        mime = resp.headers.get("content-type", "image/jpeg")

    persona_block = build_persona_block(persona, mode="vision") if persona else ""

    when_human = _format_taken_at(taken_at, settings.scheduler_timezone)
    context_lines: list[str] = []
    if when_human:
        context_lines.append(f"- Giờ chụp (giờ địa phương): {when_human}")
    if location_text:
        context_lines.append(f"- Địa điểm: {location_text}")
    context_block = (
        "NGỮ CẢNH BỨC ẢNH:\n" + "\n".join(context_lines) if context_lines else ""
    )

    system_parts: list[str] = []
    if persona_block:
        system_parts.append(persona_block)
    system_parts.append(PHOTO_COMMENTARY_SYSTEM)
    if context_block:
        system_parts.append(context_block)
    system = "\n\n".join(system_parts)

    user_prompt = (
        "Hãy nhìn bức ảnh này và bình luận đúng theo bộ gen + ngữ cảnh ở trên. "
        "Output JSON một dòng."
    )

    client_g = _client(settings)
    chain = [settings.vision_model, *settings.vision_fallback_models]
    last_exc: Exception | None = None
    result = None
    used_model: str | None = None
    for model_name in chain:
        try:
            result = await with_retry(
                lambda m=model_name: client_g.models.generate_content(
                    model=m,
                    contents=[
                        types.Part.from_bytes(data=image_bytes, mime_type=mime),
                        user_prompt,
                    ],
                    config=types.GenerateContentConfig(
                        system_instruction=system,
                        response_mime_type="application/json",
                        temperature=0.75,
                    ),
                ),
                attempts=2,
            )
            used_model = model_name
            break
        except (genai_errors.ServerError, genai_errors.ClientError) as exc:
            last_exc = exc
            log.warning("vision model %s failed (%s) — falling back", model_name, exc)
            continue
    if result is None:
        assert last_exc is not None
        raise last_exc

    parsed = _safe_json(result.text or "")
    raw_tags = parsed.get("hashtags") or []
    if not isinstance(raw_tags, list):
        raw_tags = []
    hashtags = [_normalize_tag(t) for t in raw_tags if t][:2]

    commentary = str(parsed.get("commentary", "")).strip()[:280]
    mood = str(parsed.get("mood", "")).strip()[:8]

    # Internal monologue block (nested) — fallback to top-level for backward compat.
    thought = parsed.get("thought") if isinstance(parsed.get("thought"), dict) else {}
    sentiment_score = thought.get("sentiment_score", parsed.get("sentiment_score"))
    emotion_tag = thought.get("emotion_tag", parsed.get("emotion_tag"))
    hidden_need_raw = thought.get("scene_emotion_analysis")
    hidden_need = hidden_need_raw if isinstance(hidden_need_raw, str) else None

    log.info(
        "vision via %s → %.40s... mood=%s tags=%s sent=%s/%s persona=%s",
        used_model,
        commentary,
        mood,
        hashtags,
        sentiment_score,
        emotion_tag,
        bool(persona),
    )
    return {
        "commentary": commentary,
        "mood": mood,
        "hashtags": hashtags,
        "sentiment_score": sentiment_score,
        "emotion_tag": emotion_tag,
        "hidden_need": hidden_need,
    }


def _normalize_tag(t: Any) -> str:
    s = str(t).strip().replace(" ", "")
    if not s:
        return s
    return s if s.startswith("#") else f"#{s}"


def _safe_json(raw: str) -> dict[str, Any]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}
