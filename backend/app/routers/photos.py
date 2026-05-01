from fastapi import APIRouter, Depends, HTTPException, status

from app.core.supabase_client import get_service_client
from app.deps import get_current_user_id
from app.models.schemas import CommentRequest, CommentResponse
from app.services.mood_events import record_mood_event
from app.services.persona import fetch_persona
from app.services.vision import analyze_photo

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

    sb.table("photos").update(
        {
            "ai_commentary": analysis["commentary"],
            "ai_mood": analysis["mood"],
            "ai_hashtags": analysis["hashtags"],
            "status": "ready",
        }
    ).eq("id", body.photo_id).execute()

    record_mood_event(
        user_id=user_id,
        source="photo",
        source_id=body.photo_id,
        sentiment_score=analysis.get("sentiment_score"),
        emotion_tag=analysis.get("emotion_tag"),
        hidden_need=analysis.get("hidden_need"),
    )

    return CommentResponse(
        photo_id=body.photo_id,
        commentary=analysis["commentary"],
        mood=analysis["mood"],
        hashtags=analysis["hashtags"],
    )
