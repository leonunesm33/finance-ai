import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import HTTPException

from app.core.database import get_db
from app.core.deps import get_current_user, require_ai
from app.models.user import User
from app.schemas.imports import ImportCommitRequest, ImportCommitResult, ImportPreviewResponse
from app.schemas.transaction import (
    CsvImportResult,
    TransactionCreate,
    TransactionListResponse,
    TransactionParseRequest,
    TransactionParseResponse,
    TransactionResponse,
    TransactionUpdate,
)
from app.services import import_service, transaction_service

router = APIRouter(prefix="/v1/transactions", tags=["transactions"])


@router.post("/import/preview", response_model=ImportPreviewResponse)
async def import_preview(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Detecta formato (CSV/XLS/XLSX/PDF), classifica extrato × fatura e extrai lançamentos."""
    content = await file.read()
    try:
        return import_service.build_preview(file.filename or "", content)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error))


@router.post("/import/commit", response_model=ImportCommitResult)
async def import_commit(
    data: ImportCommitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Persiste os lançamentos confirmados no preview (com reconciliação anti-duplicidade)."""
    return await import_service.commit_import(db, current_user, data)


@router.get("/", response_model=TransactionListResponse)
async def list_transactions(
    type: str | None = None,
    account_id: uuid.UUID | None = None,
    category_id: uuid.UUID | None = None,
    origin: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await transaction_service.list_transactions(
        db,
        current_user,
        type_=type,
        account_id=account_id,
        category_id=category_id,
        origin=origin,
        date_from=date_from,
        date_to=date_to,
        search=search,
        page=page,
        page_size=page_size,
    )
    return TransactionListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await transaction_service.create_transaction(db, current_user, data)


@router.post("/parse", response_model=TransactionParseResponse)
async def parse_transaction(
    data: TransactionParseRequest,
    current_user: User = Depends(require_ai),
    db: AsyncSession = Depends(get_db),
):
    return await transaction_service.parse_transaction(db, current_user, data.text)


@router.get("/export-csv")
async def export_csv(
    type: str | None = None,
    account_id: uuid.UUID | None = None,
    category_id: uuid.UUID | None = None,
    origin: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = await transaction_service.export_csv(
        db,
        current_user,
        type_=type,
        account_id=account_id,
        category_id=category_id,
        origin=origin,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transacoes.csv"},
    )


@router.post("/import-csv", response_model=CsvImportResult)
async def import_csv(
    file: UploadFile = File(...),
    date_column: str = Form(...),
    description_column: str = Form(...),
    amount_column: str = Form(...),
    type_column: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raw = await file.read()
    return await transaction_service.import_csv(
        db, current_user, raw.decode("utf-8-sig"), date_column, description_column, amount_column, type_column
    )


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await transaction_service.get_owned_transaction(db, current_user, transaction_id)


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: uuid.UUID,
    data: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await transaction_service.update_transaction(db, current_user, transaction_id, data)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await transaction_service.delete_transaction(db, current_user, transaction_id)
