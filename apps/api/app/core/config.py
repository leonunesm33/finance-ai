from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "FinanceAI"
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"
    API_URL: str = "http://localhost:8000"
    TZ: str = "America/Sao_Paulo"

    # Banco de dados
    DATABASE_URL: str = "postgresql+asyncpg://financeai:senha@postgres:5432/financeai"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"
    SYNC_INTERVAL_HOURS: int = 6

    # Segredos
    SECRET_KEY: str = "troque-por-64-bytes-aleatorios-hex"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Pluggy
    PLUGGY_CLIENT_ID: str = ""
    PLUGGY_CLIENT_SECRET: str = ""
    PLUGGY_WEBHOOK_SECRET: str = ""

    # Anthropic
    ANTHROPIC_API_KEY: str = ""

    # Admin seed
    ADMIN_EMAIL: str = "admin@financeai.local"
    ADMIN_PASSWORD: str = "troque-esta-senha"


settings = Settings()
