"""Helpers for resilient Gemini calls.

The Gemini API occasionally returns 503 UNAVAILABLE during demand spikes.
This module retries those transient failures with exponential backoff
before bubbling the error up.
"""

import asyncio
import logging
from typing import Awaitable, Callable, TypeVar

from google.genai import errors

log = logging.getLogger("gemini")

T = TypeVar("T")

_TRANSIENT_STATUS = {429, 500, 502, 503, 504}


async def with_retry(
    call: Callable[[], T] | Callable[[], Awaitable[T]],
    *,
    attempts: int = 3,
    base_delay: float = 1.5,
) -> T:
    """Run a Gemini call with retry on transient ServerError / 5xx codes."""
    last_exc: BaseException | None = None
    for attempt in range(attempts):
        try:
            result = call()
            if asyncio.iscoroutine(result):
                return await result  # type: ignore[return-value]
            return result  # type: ignore[return-value]
        except errors.ServerError as exc:
            last_exc = exc
            log.warning(
                "Gemini transient error (attempt %d/%d): %s",
                attempt + 1,
                attempts,
                exc,
            )
        except errors.ClientError as exc:
            code = getattr(exc, "code", None)
            if code in _TRANSIENT_STATUS:
                last_exc = exc
                log.warning(
                    "Gemini retriable client error %s (attempt %d/%d): %s",
                    code,
                    attempt + 1,
                    attempts,
                    exc,
                )
            else:
                raise
        if attempt < attempts - 1:
            await asyncio.sleep(base_delay * (2**attempt))
    assert last_exc is not None
    raise last_exc
