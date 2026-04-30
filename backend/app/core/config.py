from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str = Field(..., alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(..., alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_jwt_secret: str = Field(..., alias="SUPABASE_JWT_SECRET")
    supabase_photo_bucket: str = Field("photos", alias="SUPABASE_PHOTO_BUCKET")

    gemini_api_key: str = Field(..., alias="GEMINI_API_KEY")
    gemini_model: str = Field("gemini-2.5-flash", alias="GEMINI_MODEL")
    gemini_vision_model: str | None = Field(None, alias="GEMINI_VISION_MODEL")
    gemini_blog_model: str | None = Field(None, alias="GEMINI_BLOG_MODEL")
    gemini_chat_model: str | None = Field(None, alias="GEMINI_CHAT_MODEL")
    gemini_chat_fallback_models: str = Field(
        "gemini-2.5-flash,gemini-2.5-flash-lite",
        alias="GEMINI_CHAT_FALLBACK_MODELS",
    )
    gemini_vision_fallback_models: str = Field(
        "gemini-2.5-flash,gemini-2.5-flash-lite",
        alias="GEMINI_VISION_FALLBACK_MODELS",
    )

    @property
    def chat_fallback_models(self) -> list[str]:
        return [m.strip() for m in self.gemini_chat_fallback_models.split(",") if m.strip()]

    @property
    def vision_fallback_models(self) -> list[str]:
        return [m.strip() for m in self.gemini_vision_fallback_models.split(",") if m.strip()]

    @property
    def vision_model(self) -> str:
        return self.gemini_vision_model or self.gemini_model

    @property
    def blog_model(self) -> str:
        return self.gemini_blog_model or self.gemini_model

    @property
    def chat_model(self) -> str:
        return self.gemini_chat_model or self.gemini_model

    cors_origins: str = Field("*", alias="CORS_ORIGINS")
    log_level: str = Field("info", alias="LOG_LEVEL")

    daily_package_hour: int = Field(22, alias="DAILY_PACKAGE_HOUR")
    scheduler_timezone: str = Field("Asia/Ho_Chi_Minh", alias="SCHEDULER_TIMEZONE")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
