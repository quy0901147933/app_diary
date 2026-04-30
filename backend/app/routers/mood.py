from fastapi import APIRouter, Depends

from app.deps import get_current_user_id
from app.models.schemas import MoodChartResponse, MoodDayPoint
from app.services.mood_chart import compute_daily_buckets, generate_lumina_nudge

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/mood-chart", response_model=MoodChartResponse)
async def get_mood_chart(
    user_id: str = Depends(get_current_user_id),
) -> MoodChartResponse:
    days = compute_daily_buckets(user_id)
    message = await generate_lumina_nudge(days)
    return MoodChartResponse(
        days=[MoodDayPoint(**d) for d in days],
        message=message,
    )
