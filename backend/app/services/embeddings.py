"""Gemini text-embedding-004 wrapper for emotional RAG.

768-dim, multi-lingual (Vietnamese works well), free tier covers personal use:
  - 1500 requests/day free
  - $0.025 per 1M tokens beyond that

Failure-soft: return None on any error so chat replies don't get blocked
just because embedding lagged or quota hit a temporary cap.
"""

from __future__ import annotations

import logging
from typing import Optional

from google import genai
from google.genai import errors as genai_errors

from app.core.config import get_settings
from app.services._gemini_retry import with_retry

log = logging.getLogger("embed")

EMBEDDING_MODEL = "text-embedding-004"
EMBEDDING_DIM = 768
MAX_INPUT_CHARS = 2000  # safe well below the 2048-token model cap


async def embed_text(text: str) -> Optional[list[float]]:
    if not text or not text.strip():
        return None
    snippet = text.strip()[:MAX_INPUT_CHARS]
    settings = get_settings()
    client = genai.Client(api_key=settings.gemini_api_key)
    try:
        result = await with_retry(
            lambda: client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=snippet,
            ),
            attempts=2,
        )
    except (genai_errors.ServerError, genai_errors.ClientError, Exception) as exc:  # noqa: BLE001
        log.warning("embed failed for %d chars: %s", len(snippet), exc)
        return None

    embeddings = getattr(result, "embeddings", None) or []
    if not embeddings:
        return None
    values = getattr(embeddings[0], "values", None)
    if not values or len(values) != EMBEDDING_DIM:
        log.warning("embed returned unexpected dim: %s", len(values) if values else 0)
        return None
    return list(values)
