import asyncio
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.supabase_client import get_service_client
from app.deps import get_current_user_id
from app.models.schemas import CommentRequest, CommentResponse
from app.services.embeddings import embed_text
from app.services.mood_events import record_mood_event
from app.services.persona import fetch_persona
from app.services.vision import analyze_photo

log = logging.getLogger("photos")

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/comment", response_model=CommentResponse)
async def post_comment(
    body: CommentRequest,
    user_id: str = Depends(get_current_user_id),
) -> CommentResponse:
    sb = get_service_client()

    res = (
        sb.table("photos")
        .select("id, user_id, storage_path, status, taken_at, location_text")
        .eq("id", body.photo_id)
        .single()
        .execute()
    )
    photo = res.data
    if not photo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo not found")
    if photo["user_id"] != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your photo")

    persona = fetch_persona(user_id)

    try:
        analysis = await analyze_photo(
            photo["storage_path"],
            taken_at=photo.get("taken_at"),
            location_text=photo.get("location_text"),
            persona=persona,
        )
    except Exception as exc:
        sb.table("photos").update({"status": "failed"}).eq("id", body.photo_id).execute()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Vision failed: {exc}") from exc

    update_payload: dict[str, Any] = {
        "ai_commentary": analysis["commentary"],
        "ai_mood": analysis["mood"],
        "ai_hashtags": analysis["hashtags"],
        "status": "ready",
    }
    object_tags = analysis.get("object_tags")
    if isinstance(object_tags, list) and object_tags:
        update_payload["object_tags"] = object_tags

    # Write commentary immediately so the user sees a fast result.
    sb.table("photos").update(update_payload).eq("id", body.photo_id).execute()

    record_mood_event(
        user_id=user_id,
        source="photo",
        source_id=body.photo_id,
        sentiment_score=analysis.get("sentiment_score"),
        emotion_tag=analysis.get("emotion_tag"),
        hidden_need=analysis.get("hidden_need"),
    )

    # Embed in the background — saves ~1-2s on user-facing latency.
    embed_input_parts = [analysis["commentary"]]
    if object_tags:
        embed_input_parts.append(" ".join(object_tags))
    embed_input = " ".join(p for p in embed_input_parts if p).strip()

    if embed_input:
        photo_id = body.photo_id

        async def _embed_photo_bg(pid: str, text: str) -> None:
            try:
                emb = await embed_text(text)
                if emb is not None:
                    sb.table("photos").update({"embedding": emb}).eq("id", pid).execute()
            except Exception as exc:  # noqa: BLE001
                log.debug("bg photo embed skipped %s: %s", pid, exc)

        asyncio.create_task(_embed_photo_bg(photo_id, embed_input))

    return CommentResponse(
        photo_id=body.photo_id,
        commentary=analysis["commentary"],
        mood=analysis["mood"],
        hashtags=analysis["hashtags"],
    )
