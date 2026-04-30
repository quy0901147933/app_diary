import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import blog, chat, mood, photos
from app.services.daily_packager import package_all_users
from app.services.photo_retry import retry_stuck_photos
from app.services.proactive import (
    run_inactivity_sweep,
    run_morning_ritual,
    run_night_recap,
)

log = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    scheduler = AsyncIOScheduler(timezone=settings.scheduler_timezone)
    scheduler.add_job(
        package_all_users,
        CronTrigger(hour=settings.daily_package_hour, minute=0),
        id="daily-package",
        replace_existing=True,
    )
    scheduler.add_job(
        retry_stuck_photos,
        IntervalTrigger(seconds=120),
        id="photo-retry",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    # Proactive AI messaging
    scheduler.add_job(
        run_morning_ritual,
        CronTrigger(minute=0),  # every hour at :00 — handler filters by morning_hour
        id="morning-ritual",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        run_night_recap,
        CronTrigger(hour=settings.daily_package_hour, minute=15),
        id="night-recap",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        run_inactivity_sweep,
        IntervalTrigger(hours=2),
        id="inactivity-sweep",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    log.info(
        "scheduler armed: daily-package @ %02d:00 · photo-retry every 120s · "
        "morning-ritual hourly · night-recap @ %02d:15 · inactivity every 2h (tz=%s)",
        settings.daily_package_hour,
        settings.daily_package_hour,
        settings.scheduler_timezone,
    )
    # Recover any photos that got stuck during a previous restart.
    asyncio.create_task(retry_stuck_photos())
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="LuminaDiary AI Backend", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(photos.router)
    app.include_router(blog.router)
    app.include_router(chat.router)
    app.include_router(mood.router)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
