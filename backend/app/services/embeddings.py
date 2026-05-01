"""Backward-compat thin wrapper. New code should depend on
`embedding_provider.get_embedding_provider()` directly so it can swap
backends without import-site changes."""

from typing import Optional

from app.services.embedding_provider import (
    EMBEDDING_DIM,  # re-exported for callers
    get_embedding_provider,
)


async def embed_text(text: str) -> Optional[list[float]]:
    return await get_embedding_provider().embed(text)


__all__ = ["embed_text", "EMBEDDING_DIM"]
