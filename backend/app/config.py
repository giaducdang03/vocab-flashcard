from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://vocabflash:changeme_secret_123@localhost:5432/vocabflash"
    JWT_SECRET: str = "change_me_super_secret_key"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    AI_BASE_URL: str = "https://api.openai.com/v1"
    AI_API_KEY: str = ""
    AI_MODEL: str = "gpt-4o-mini"
    AI_MAX_CARDS_PER_PROMPT: int = 120
    AI_DAILY_QUIZ_LIMIT: int = 20
    AI_TIMEOUT_SECONDS: int = 90

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
