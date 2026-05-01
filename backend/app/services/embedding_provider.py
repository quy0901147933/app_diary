"""Pluggable embedding backend.

Today we use Gemini text-embedding-004 (768d, multilingual, free tier).
Tomorrow we may swap in a self-hosted Llama-3 / sentence-transformers
checkpoint without touching the rest of the stack — chat_engine and the
backfill script depend ONLY on `EmbeddingProvider.embed(text)`.

To swap models:
  1. Subclass EmbeddingProvider.
  2. Set EMBEDDING_PROVIDER env var to your new class path.
  3. Done. Vector dim must stay 768 to match the existing index, OR
     drop & recreate the HNSW index with the new dim.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Optional

from google import genai
from google.genai import errors as genai_errors

from app.core.config import get_settings
from app.services._gemini_retry import with_retry

log = logging.getLogger("embed")

# Vector dim is fixed at the SQL/index level — providers MUST output this.
EMBEDDING_DIM = 768
MAX_INPUT_CHARS = 2000


class EmbeddingProvider(ABC):
    """Contract: turn arbitrary text into a fixed-length float vector."""

    @abstractmethod
    async def embed(self, text: str) -> Optional[list[float]]:
        ...

    @property
    @abstractmethod
    def dim(self) -> int:
        ...


class GeminiEmbeddingProvider(EmbeddingProvider):
    """Default. Uses Google Gemini text-embedding-004."""

    MODEL = "text-embedding-004"

    @property
    def dim(self) -> int:
        return EMBEDDING_DIM

    async def embed(self, text: str) -> Optional[list[float]]:
        if not text or not text.strip():
            return None
        snippet = text.strip()[:MAX_INPUT_CHARS]
        settings = get_settings()
        client = genai.Client(api_key=settings.gemini_api_key)
        try:
            result = await with_retry(
                lambda: client.models.embed_content(
                    model=self.MODEL,
                    contents=snippet,
                ),
                attempts=2,
            )
        except (genai_errors.ServerError, genai_errors.ClientError, Exception) as exc:  # noqa: BLE001
            log.warning("gemini embed failed for %d chars: %s", len(snippet), exc)
            return None
        embeddings = getattr(result, "embeddings", None) or []
        if not embeddings:
            return None
        values = getattr(embeddings[0], "values", None)
        if not values or len(values) != EMBEDDING_DIM:
            log.warning("embed returned wrong dim: %s", len(values) if values else 0)
            return None
        return list(values)


# Singleton — read once, swap via env var if needed in production.
_provider: EmbeddingProvider | None = None


def get_embedding_provider() -> EmbeddingProvider:
    global _provider
    if _provider is None:
        _provider = GeminiEmbeddingProvider()
    return _provider
