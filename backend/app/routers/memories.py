"""User-curated 'core memories'. Toggle is_pinned on a chat message or photo.

Pinned rows skip time decay AND get a 1.5x similarity boost in
match_unified_memories, so they keep showing up in Lumina's context.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.supabase_client import get_service_client
from app.deps import get_current_user_id

router = APIRouter(prefix="/memories", tags=["memories"])


class PinRequest(BaseModel):
    source: str = Field(..., pattern="^(chat|photo)$")
    id: str = Field(..., min_length=1)
    pinned: bool


class PinResponse(BaseModel):
    source: str
    id: str
    is_pinned: bool


@router.post("/pin", response_model=PinResponse)
async def pin_memory(
    body: PinRequest,
    user_id: str = Depends(get_current_user_id),
) -> PinResponse:
    sb = get_service_client()
    table = "chat_messages" if body.source == "chat" else "photos"

    res = sb.table(table).select("user_id").eq("id", body.id).single().execute()
    row = res.data
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Memory not found")
    if row["user_id"] != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not yours")

    sb.table(table).update({"is_pinned": body.pinned}).eq("id", body.id).execute()
    return PinResponse(source=body.source, id=body.id, is_pinned=body.pinned)
