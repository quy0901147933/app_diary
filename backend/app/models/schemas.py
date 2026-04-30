from datetime import date

from pydantic import BaseModel, Field


class CommentRequest(BaseModel):
    photo_id: str = Field(..., min_length=1)


class CommentResponse(BaseModel):
    photo_id: str
    commentary: str
    mood: str
    hashtags: list[str] = []


class PackageDayRequest(BaseModel):
    date: date


class DailyBlogResponse(BaseModel):
    date: date
    title: str
    body_md: str
    hashtags: list[str]
    mood_emoji: str


class ChatMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class ChatMessageResponse(BaseModel):
    reply: str
    user_reaction: str | None = None


class MoodDayPoint(BaseModel):
    day: date
    label: str  # "Hôm nay" or "dd/M"
    average_score: float | None = None
    sample_count: int = 0
    dominant_emotion: str | None = None


class MoodChartResponse(BaseModel):
    days: list[MoodDayPoint]
    message: str
