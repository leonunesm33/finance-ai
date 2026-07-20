import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.core.database import async_session_factory
from app.core.security import hash_password
from app.models.category import Category
from app.models.user import User

SYSTEM_CATEGORIES: list[tuple[str, str, str]] = [
    ("Alimentação", "expense", "#f97316"),
    ("Assinaturas", "expense", "#8b5cf6"),
    ("Beleza", "expense", "#ec4899"),
    ("Casa", "expense", "#14b8a6"),
    ("Combustível", "expense", "#f59e0b"),
    ("Educação", "expense", "#3b82f6"),
    ("Entretenimento", "expense", "#a855f7"),
    ("Lazer", "expense", "#06b6d4"),
    ("Moradia", "expense", "#6366f1"),
    ("Pets", "expense", "#84cc16"),
    ("Roupas", "expense", "#f43f5e"),
    ("Saúde", "expense", "#ef4444"),
    ("Seguros", "expense", "#64748b"),
    ("Serviços", "expense", "#0ea5e9"),
    ("Taxas Bancárias", "expense", "#78716c"),
    ("Transporte", "expense", "#eab308"),
    ("Viagem", "expense", "#22c55e"),
    ("Salário", "income", "#22c55e"),
    ("Freelance", "income", "#10b981"),
    ("Investimentos", "income", "#059669"),
    ("Reembolso", "income", "#14b8a6"),
    ("Outros", "income", "#6b7280"),
    ("Transferência", "both", "#94a3b8"),
]


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
            role="admin",
        )
        db.add(admin)
        await db.commit()
        print(f"Usuário admin '{settings.ADMIN_EMAIL}' criado com sucesso.")

        if settings.ADMIN_PASSWORD == "troque-esta-senha":
            print(
                "AVISO: ADMIN_PASSWORD ainda é o valor padrão do .env.example — "
                "troque-a antes de expor este ambiente."
            )


async def seed_categories() -> None:
    async with async_session_factory() as db:
        existing_count = await db.scalar(select(Category).where(Category.user_id.is_(None)).limit(1))
        if existing_count is not None:
            print("Categorias do sistema já existem — nada a fazer.")
            return

        for name, category_type, color in SYSTEM_CATEGORIES:
            db.add(Category(user_id=None, name=name, type=category_type, color=color))

        await db.commit()
        print(f"{len(SYSTEM_CATEGORIES)} categorias do sistema criadas com sucesso.")


async def main() -> None:
    await seed_admin()
    await seed_categories()


if __name__ == "__main__":
    asyncio.run(main())
