import json
from typing import Any

from google import genai
from google.genai import types

from app.core.config import get_settings
from app.core.prompts import DAILY_BLOG_SYSTEM


async def write_daily_blog(photos: list[dict[str, Any]]) -> dict[str, Any]:
    """photos: ordered list of {commentary, note, location, taken_at}."""
    settings = get_settings()
    bullets = "\n".join(
        f"- [{p.get('taken_at', '')}] {p.get('location', '')} — "
        f"{p.get('commentary') or ''} (note: {p.get('note') or '—'})"
        for p in photos
    )
    prompt = f"Today's photos in chronological order:\n{bullets}"

    client = genai.Client(api_key=settings.gemini_api_key)
    result = client.models.generate_content(
        model=settings.blog_model,
        contents=[prompt],
        config=types.GenerateContentConfig(
            system_instruction=DAILY_BLOG_SYSTEM,
            response_mime_type="application/json",
            temperature=0.8,
        ),
    )

    parsed = _safe_json(result.text or "")
    return {
        "title": str(parsed.get("title", "Một ngày của tôi")).strip()[:80],
        "body_md": str(parsed.get("body_md", "")).strip(),
        "hashtags": [str(h).strip() for h in parsed.get("hashtags", [])][:5],
        "mood_emoji": str(parsed.get("mood_emoji", "✨")).strip()[:8],
    }


def _safe_json(raw: str) -> dict[str, Any]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}
