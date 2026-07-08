import json
import uuid

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.chat import ConversationResponse, MessageCreate, MessageResponse
from app.services import chat_service

router = APIRouter(prefix="/v1/chat", tags=["chat"])


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await chat_service.list_conversations(db, current_user)


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await chat_service.create_conversation(db, current_user)


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversation = await chat_service.get_owned_conversation(db, current_user, conversation_id)
    return await chat_service.list_messages(db, conversation)


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: uuid.UUID,
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await chat_service.get_owned_conversation(db, current_user, conversation_id)

    async def event_stream():
        async for chunk in chat_service.send_message(current_user, conversation_id, data.content):
            yield f"data: {json.dumps({'text': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversation = await chat_service.get_owned_conversation(db, current_user, conversation_id)
    await chat_service.delete_conversation(db, conversation)
