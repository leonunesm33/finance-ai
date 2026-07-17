import hashlib
import hmac
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session_factory, get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.open_finance import BankConnectionResponse, ConnectTokenResponse, ItemCreatedRequest
from app.services import open_finance_service
from app.tasks.pluggy_sync import sync_connection

router = APIRouter(prefix="/v1/open-finance", tags=["open-finance"])


@router.post("/connect-token", response_model=ConnectTokenResponse)
async def get_connect_token(current_user: User = Depends(get_current_user)):
    token = await open_finance_service.create_connect_token()
    return ConnectTokenResponse(connect_token=token)


@router.post("/items", response_model=BankConnectionResponse, status_code=status.HTTP_201_CREATED)
async def register_item(
    data: ItemCreatedRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    connection = await open_finance_service.register_connection(db, current_user, data.item_id)
    sync_connection.delay(str(connection.id))
    return connection


@router.post("/webhook", status_code=status.HTTP_204_NO_CONTENT)
async def pluggy_webhook(request: Request, x_pluggy_signature: str | None = Header(default=None)):
    # Fail-closed: sem segredo configurado não há como autenticar o webhook — não processar nada.
    if not settings.PLUGGY_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook indisponível: segredo não configurado",
        )

    body = await request.body()

    expected = hmac.new(settings.PLUGGY_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    if not x_pluggy_signature or not hmac.compare_digest(expected, x_pluggy_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Assinatura inválida")

    payload = await request.json()
    item_id = payload.get("itemId")
    if item_id:
        async with async_session_factory() as db:
            connection = await open_finance_service.get_connection_by_item_id(db, item_id)
            if connection is not None:
                sync_connection.delay(str(connection.id))


@router.get("/connections", response_model=list[BankConnectionResponse])
async def list_connections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await open_finance_service.list_connections(db, current_user)


@router.delete("/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await open_finance_service.delete_connection(db, current_user, connection_id)


@router.post("/connections/{connection_id}/sync", status_code=status.HTTP_202_ACCEPTED)
async def trigger_sync(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    connection = await open_finance_service.get_owned_connection(db, current_user, connection_id)
    sync_connection.delay(str(connection.id))
