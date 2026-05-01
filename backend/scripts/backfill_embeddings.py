"""Backfill `embedding` column for chat_messages + photos.

Idempotent: skips rows that already have an embedding.
Rate-limit aware: small batches with a sleep between each.

Run from project root:
    cd backend
    source .venv/bin/activate
    python -m scripts.backfill_embeddings --table all
    python -m scripts.backfill_embeddings --table chat_messages --batch-size 10 --sleep 1.5
    python -m scripts.backfill_embeddings --table photos --max-rows 200
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import time
from typing import Any, Iterable

# Allow `python scripts/backfill_embeddings.py` from inside `backend/`.
if __package__ is None or __package__ == "":
    import os

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.supabase_client import get_service_client
from app.services.embedding_provider import get_embedding_provider

log = logging.getLogger("backfill")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def chunked(seq: list[Any], size: int) -> Iterable[list[Any]]:
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


async def backfill_chat(batch_size: int, sleep_s: float, max_rows: int | None) -> int:
    sb = get_service_client()
    provider = get_embedding_provider()
    total = 0

    while True:
        q = (
            sb.table("chat_messages")
            .select("id, content")
            .is_("embedding", "null")
            .not_.is_("content", "null")
            .order("created_at", desc=False)
            .limit(batch_size)
        )
        res = q.execute()
        rows = res.data or []
        if not rows:
            break

        for row in rows:
            content = row.get("content")
            if not isinstance(content, str) or not content.strip():
                continue
            try:
                vec = await provider.embed(content)
            except Exception as exc:  # noqa: BLE001
                log.warning("embed crash on chat %s: %s", row["id"], exc)
                continue
            if vec is None:
                log.warning("embed returned None for chat %s", row["id"])
                continue
            sb.table("chat_messages").update({"embedding": vec}).eq("id", row["id"]).execute()
            total += 1
            if max_rows and total >= max_rows:
                log.info("chat: hit max_rows=%d", max_rows)
                return total

        log.info("chat: backfilled %d so far", total)
        time.sleep(sleep_s)

    log.info("chat: done. total=%d", total)
    return total


async def backfill_photos(batch_size: int, sleep_s: float, max_rows: int | None) -> int:
    sb = get_service_client()
    provider = get_embedding_provider()
    total = 0

    while True:
        q = (
            sb.table("photos")
            .select("id, ai_commentary, object_tags")
            .is_("embedding", "null")
            .eq("status", "ready")
            .not_.is_("ai_commentary", "null")
            .order("created_at", desc=False)
            .limit(batch_size)
        )
        res = q.execute()
        rows = res.data or []
        if not rows:
            break

        for row in rows:
            commentary = row.get("ai_commentary") or ""
            tags = row.get("object_tags") or []
            parts = [commentary]
            if isinstance(tags, list) and tags:
                parts.append(" ".join(t for t in tags if isinstance(t, str)))
            text = " ".join(p for p in parts if p).strip()
            if not text:
                continue
            try:
                vec = await provider.embed(text)
            except Exception as exc:  # noqa: BLE001
                log.warning("embed crash on photo %s: %s", row["id"], exc)
                continue
            if vec is None:
                continue
            sb.table("photos").update({"embedding": vec}).eq("id", row["id"]).execute()
            total += 1
            if max_rows and total >= max_rows:
                log.info("photos: hit max_rows=%d", max_rows)
                return total

        log.info("photos: backfilled %d so far", total)
        time.sleep(sleep_s)

    log.info("photos: done. total=%d", total)
    return total


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--table", choices=["chat_messages", "photos", "all"], default="all")
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--sleep", type=float, default=1.0, help="seconds between batches")
    parser.add_argument("--max-rows", type=int, default=None)
    args = parser.parse_args()

    if args.table in ("chat_messages", "all"):
        await backfill_chat(args.batch_size, args.sleep, args.max_rows)
    if args.table in ("photos", "all"):
        await backfill_photos(args.batch_size, args.sleep, args.max_rows)


if __name__ == "__main__":
    asyncio.run(main())
