import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# bcrypt trunca silenciosamente senhas acima de 72 bytes — limitamos aqui para
# que uma senha longa nunca seja aceita sem que os bytes além do limite contem.
PASSWORD_MAX_LENGTH = 72

AIPersonality = Literal["neutro", "direto", "motivador"]


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=PASSWORD_MAX_LENGTH)
    name: str = Field(min_length=1, max_length=255)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    ai_personality: AIPersonality | None = None
    privacy_mode: bool | None = None


class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=PASSWORD_MAX_LENGTH)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    name: str
    avatar_url: str | None
    privacy_mode: bool
    ai_personality: str
    currency: str
    timezone: str
    created_at: datetime
