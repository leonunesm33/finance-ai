import logging

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

INSECURE_SECRET_KEY_PLACEHOLDER = "troque-por-64-bytes-aleatorios-hex"
INSECURE_ADMIN_PASSWORD_PLACEHOLDER = "troque-esta-senha"
INSECURE_POSTGRES_DEFAULT = "financeai:senha@"


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
    SECRET_KEY: str = INSECURE_SECRET_KEY_PLACEHOLDER
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Open Finance — desabilitado neste primeiro momento (custo de produção).
    # A estrutura multi-provedor fica pronta; ligar exige flag + credenciais.
    OPEN_FINANCE_ENABLED: bool = False
    OPEN_FINANCE_PROVIDER: str = "pluggy"  # pluggy | polp | belvo | celcoin

    # Pluggy
    PLUGGY_CLIENT_ID: str = ""
    PLUGGY_CLIENT_SECRET: str = ""
    PLUGGY_WEBHOOK_SECRET: str = ""

    # Polp (https://www.polp.com.br)
    POLP_API_KEY: str = ""

    # Belvo (https://belvo.com)
    BELVO_SECRET_ID: str = ""
    BELVO_SECRET_PASSWORD: str = ""
    BELVO_ENVIRONMENT: str = "sandbox"  # sandbox | production

    # Celcoin
    CELCOIN_CLIENT_ID: str = ""
    CELCOIN_CLIENT_SECRET: str = ""

    # IA — provedor ativo e credenciais. "openrouter" é o padrão do projeto;
    # anthropic/openai/gemini/groq ficam prontos para uso direto no futuro.
    AI_PROVIDER: str = "openrouter"  # openrouter | anthropic | openai | gemini | groq
    OPENROUTER_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    # Modelos por tarefa. Default: modelo GRATUITO da OpenRouter (custo $0),
    # para funcionar de fábrica só com uma API key, sem crédito. Com crédito
    # na conta, troque por um modelo pago (ex.: anthropic/claude-sonnet-4.5)
    # para mais qualidade — para outro provedor, defina explicitamente no .env.
    AI_CHAT_MODEL: str = "openai/gpt-oss-20b:free"
    AI_PARSE_MODEL: str = "openai/gpt-oss-20b:free"
    AI_ANALYSIS_MODEL: str = "openai/gpt-oss-20b:free"

    @property
    def ai_enabled(self) -> bool:
        key_by_provider = {
            "openrouter": self.OPENROUTER_API_KEY,
            "anthropic": self.ANTHROPIC_API_KEY,
            "openai": self.OPENAI_API_KEY,
            "gemini": self.GEMINI_API_KEY,
            "groq": self.GROQ_API_KEY,
        }
        return bool(key_by_provider.get(self.AI_PROVIDER, ""))

    # Admin seed
    ADMIN_EMAIL: str = "admin@financeai.app"
    ADMIN_PASSWORD: str = INSECURE_ADMIN_PASSWORD_PLACEHOLDER

    def _insecure_defaults(self) -> list[str]:
        problems: list[str] = []
        if self.SECRET_KEY == INSECURE_SECRET_KEY_PLACEHOLDER or len(self.SECRET_KEY) < 32:
            problems.append("SECRET_KEY usa o placeholder padrão ou tem menos de 32 caracteres")
        if self.ADMIN_PASSWORD == INSECURE_ADMIN_PASSWORD_PLACEHOLDER:
            problems.append("ADMIN_PASSWORD usa o placeholder padrão")
        if INSECURE_POSTGRES_DEFAULT in self.DATABASE_URL:
            problems.append("DATABASE_URL usa as credenciais padrão do Postgres")
        return problems

    @model_validator(mode="after")
    def check_insecure_defaults(self) -> "Settings":
        problems = self._insecure_defaults()
        if not problems:
            return self

        message = "Configuração insegura detectada: " + "; ".join(problems)
        if self.ENVIRONMENT == "production":
            raise ValueError(message + ". Corrija as variáveis de ambiente antes de subir em produção.")

        logger.warning("%s (permitido apenas fora de produção)", message)
        return self


settings = Settings()
