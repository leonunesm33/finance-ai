import uuid

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryUpdate


async def list_categories(db: AsyncSession, user: User) -> list[Category]:
    result = await db.scalars(
        select(Category)
        .where(Category.is_active.is_(True), or_(Category.user_id.is_(None), Category.user_id == user.id))
        .order_by(Category.type, Category.name)
    )
    return list(result.all())


async def create_category(db: AsyncSession, user: User, data: CategoryCreate) -> Category:
    category = Category(user_id=user.id, **data.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def get_owned_category(db: AsyncSession, user: User, category_id: uuid.UUID) -> Category:
    category = await db.get(Category, category_id)
    if category is None or category.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoria não encontrada")
    return category


async def update_category(db: AsyncSession, user: User, category_id: uuid.UUID, data: CategoryUpdate) -> Category:
    category = await get_owned_category(db, user, category_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    await db.commit()
    await db.refresh(category)
    return category


async def delete_category(db: AsyncSession, user: User, category_id: uuid.UUID) -> None:
    category = await get_owned_category(db, user, category_id)
    category.is_active = False
    await db.commit()
