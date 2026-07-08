import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.core.database import async_session_factory
from app.core.security import hash_password
from app.models.user import User


async def seed_admin() -> None:
    async with async_session_factory() as db:
        existing = await db.scalar(select(User).where(User.email == settings.ADMIN_EMAIL))
        if existing is not None:
            print(f"Usuário admin '{settings.ADMIN_EMAIL}' já existe — nada a fazer.")
            return

        admin = User(
            email=settings.ADMIN_EMAIL,
            password_hash=hash_password(settings.ADMIN_PASSWORD),
            name="Admin",
        )
        db.add(admin)
        await db.commit()
        print(f"Usuário admin '{settings.ADMIN_EMAIL}' criado com sucesso.")

        if settings.ADMIN_PASSWORD == "troque-esta-senha":
            print(
                "AVISO: ADMIN_PASSWORD ainda é o valor padrão do .env.example — "
                "troque-a antes de expor este ambiente."
            )


if __name__ == "__main__":
    asyncio.run(seed_admin())
