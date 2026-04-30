from fastapi import APIRouter, Depends, HTTPException, status

from app.core.supabase_client import get_service_client
from app.deps import get_current_user_id
from app.models.schemas import DailyBlogResponse, PackageDayRequest
from app.services.daily_packager import package_user_day

router = APIRouter(prefix="/day", tags=["day"])


@router.post("/package", response_model=DailyBlogResponse)
async def package_day(
    body: PackageDayRequest,
    user_id: str = Depends(get_current_user_id),
) -> DailyBlogResponse:
    sb = get_service_client()
    blog = await package_user_day(sb, user_id, body.date)
    if blog is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Chưa có khoảnh khắc nào sẵn sàng cho ngày này.",
        )
    return DailyBlogResponse(date=body.date, **blog)
