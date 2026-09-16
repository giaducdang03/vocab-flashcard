from app.config import settings
from app.services.ai.openai_compat import OpenAICompatProvider
from app.services.ai.provider import LLMProvider

__all__ = ["LLMProvider", "OpenAICompatProvider", "ai_available", "get_provider", "settings"]


def ai_available() -> bool:
    return bool(settings.AI_API_KEY)


def get_provider() -> LLMProvider | None:
    """Provider đã cấu hình, hoặc None khi tính năng AI đang tắt."""
    if not ai_available():
        return None

    return OpenAICompatProvider(
        base_url=settings.AI_BASE_URL,
        api_key=settings.AI_API_KEY,
        model=settings.AI_MODEL,
        timeout=settings.AI_TIMEOUT_SECONDS,
    )
