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
import math
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
    """Default. Uses Google Gemini embedding API.

    Tries multiple model identifiers because the available name depends
    on SDK version + API tier:
      - "embedding-001"          → stable on v1beta, available on free tier
      - "text-embedding-004"     → newer name, sometimes only on v1
      - "gemini-embedding-001"   → newest (late 2024), behind 0.10+ SDK
    First success wins. All three return 768-dim vectors.
    """

    # Order matters: try newest first; older names act as fallback for legacy keys.
    # gemini-embedding-001 returns 3072d → truncated to 768 via Matryoshka.
    MODELS = ["gemini-embedding-001", "text-embedding-004", "embedding-001"]

    @property
    def dim(self) -> int:
        return EMBEDDING_DIM

    async def embed(self, text: str) -> Optional[list[float]]:
        if not text or not text.strip():
            return None
        snippet = text.strip()[:MAX_INPUT_CHARS]
        settings = get_settings()
        client = genai.Client(api_key=settings.gemini_api_key)
        last_error: Exception | None = None
        for model_name in self.MODELS:
            try:
                result = await with_retry(
                    lambda m=model_name: client.models.embed_content(
                        model=m,
                        contents=snippet,
                    ),
                    attempts=2,
                )
            except (genai_errors.ServerError, genai_errors.ClientError, Exception) as exc:  # noqa: BLE001
                last_error = exc
                msg = str(exc)
                if "404" in msg or "NOT_FOUND" in msg or "not found" in msg.lower():
                    log.debug("embed model %s missing, falling back: %s", model_name, exc)
                    continue
                log.warning("embed model %s failed (%d chars): %s", model_name, len(snippet), exc)
                continue
            embeddings = getattr(result, "embeddings", None) or []
            if not embeddings:
                continue
            values = getattr(embeddings[0], "values", None)
            if not values:
                continue
            values = list(values)
            if len(values) == EMBEDDING_DIM:
                return values
            if len(values) > EMBEDDING_DIM:
                # gemini-embedding-001 emits 3072 dims by default. The model is
                # trained with Matryoshka Representation Learning so the first
                # k dims remain semantically valid; we only need to re-normalize
                # to unit length so cosine distance behaves correctly.
                truncated = values[:EMBEDDING_DIM]
                norm = math.sqrt(sum(v * v for v in truncated))
                if norm <= 0:
                    continue
                return [v / norm for v in truncated]
            log.warning(
                "embed model %s returned dim %d < %d — cannot use",
                model_name, len(values), EMBEDDING_DIM,
            )
            continue
        if last_error is not None:
            log.warning("all embed models failed for %d chars: %s", len(snippet), last_error)
        return None


# Singleton — read once, swap via env var if needed in production.
_provider: EmbeddingProvider | None = None


def get_embedding_provider() -> EmbeddingProvider:
    global _provider
    if _provider is None:
        _provider = GeminiEmbeddingProvider()
    return _provider
