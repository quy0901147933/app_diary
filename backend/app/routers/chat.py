import logging

from fastapi import APIRouter, Depends, HTTPException, status
from google.genai import errors as genai_errors

from app.deps import get_current_user_id
from app.models.schemas import ChatMessageRequest, ChatMessageResponse
from app.services.chat_engine import reply_to

router = APIRouter(prefix="/chat", tags=["chat"])
log = logging.getLogger("chat-router")


@router.post("/message", response_model=ChatMessageResponse)
async def post_message(
    body: ChatMessageRequest,
    user_id: str = Depends(get_current_user_id),
) -> ChatMessageResponse:
    try:
        reply, user_reaction = await reply_to(user_id=user_id, content=body.content)
    except genai_errors.ServerError as exc:
        log.warning("Gemini busy after retries: %s", exc)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Lumina đang nghỉ một chút — bạn thử lại sau 10 giây nhé.",
        ) from exc
    except genai_errors.ClientError as exc:
        log.warning("Gemini client error: %s", exc)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Lumina chưa nói được lúc này. Bạn thử lại nhé.",
        ) from exc
    return ChatMessageResponse(reply=reply, user_reaction=user_reaction)
