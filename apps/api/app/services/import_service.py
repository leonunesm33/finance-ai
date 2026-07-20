"""Motor de importação de extratos bancários e faturas de cartão.

Formatos: CSV, XLS, XLSX e PDF. O fluxo tem duas fases:
1. preview  — detecta o formato, classifica o documento (extrato × fatura),
              extrai as transações e devolve tudo para conferência do usuário;
2. commit   — recebe as linhas confirmadas/ajustadas e persiste, passando pela
              reconciliação para não duplicar lançamentos já existentes.
"""
import csv
import io
import logging
import re
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.imports import (
    ImportCommitRequest,
    ImportCommitResult,
    ImportPreviewResponse,
    ImportedTransaction,
)
from app.services.reconciliation_service import find_duplicate_for_import

logger = logging.getLogger(__name__)

MAX_FILE_BYTES = 10 * 1024 * 1024  # coerente com client_max_body_size do nginx
MAX_ROWS = 5000

# ---------------------------------------------------------------- helpers

DATE_TOKEN_RE = re.compile(r"\b(\d{2}/\d{2}(?:/\d{2,4})?|\d{4}-\d{2}-\d{2})\b")
AMOUNT_TOKEN_RE = re.compile(
    r"(-?\s?(?:R\$\s?)?\d{1,3}(?:\.\d{3})*,\d{2}|-?\s?(?:R\$\s?)?\d+\.\d{2})\s*([DC])?\b"
)

FATURA_KEYWORDS = (
    "fatura", "vencimento", "pagamento mínimo", "pagamento minimo", "limite de crédito",
    "limite de credito", "total da fatura", "melhor dia de compra", "cartão final",
    "cartao final", "parcelamento da fatura", "encargos rotativo",
)
EXTRATO_KEYWORDS = (
    "extrato", "saldo anterior", "saldo do dia", "saldo em conta", "conta corrente",
    "agência", "agencia", "lançamentos", "lancamentos", "saldo disponível",
    "saldo disponivel", "ted", "doc recebido",
)
CREDIT_HINTS = ("pagamento", "estorno", "crédito", "credito", "ajuste a crédito")

DATE_HEADERS = ("data", "date", "dt", "data lançamento", "data lancamento", "data mov")
DESC_HEADERS = (
    "descrição", "descricao", "histórico", "historico", "lançamento", "lancamento",
    "description", "memo", "estabelecimento", "detalhe",
)
AMOUNT_HEADERS = ("valor", "amount", "value", "quantia", "montante", "valor (r$)", "vlr")
TYPE_HEADERS = ("tipo", "type", "d/c", "dc", "natureza")


def parse_amount(raw: str) -> Decimal:
    """Converte valores pt-BR ("1.234,56") ou US ("1234.56") em Decimal."""
    s = raw.strip().replace("R$", "").replace(" ", "").replace(" ", "")
    negative = s.startswith("-") or s.endswith("-") or (s.startswith("(") and s.endswith(")"))
    s = s.strip("()-")
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    if not s:
        raise InvalidOperation("valor vazio")
    value = Decimal(s)
    return -value if negative else value


def parse_date_token(token: str, reference_year: int | None = None) -> date:
    token = token.strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", token):
        return date.fromisoformat(token)
    parts = token.split("/")
    day, month = int(parts[0]), int(parts[1])
    if len(parts) == 3:
        year = int(parts[2])
        if year < 100:
            year += 2000
    else:
        # Fatura costuma trazer só dd/mm: assume o ano corrente e recua um ano
        # se a data cair muito no futuro (ex.: lançamento de dezembro em janeiro).
        year = reference_year or date.today().year
        candidate = date(year, month, day)
        if candidate > date.today() + timedelta(days=45):
            year -= 1
    return date(year, month, day)


# ------------------------------------------------------------ leitura bruta

def detect_format(filename: str) -> str:
    name = (filename or "").lower()
    if name.endswith(".csv") or name.endswith(".txt"):
        return "csv"
    if name.endswith(".xlsx"):
        return "xlsx"
    if name.endswith(".xls"):
        return "xls"
    if name.endswith(".pdf"):
        return "pdf"
    raise ValueError("Formato não suportado. Envie CSV, XLS, XLSX ou PDF.")


def read_tabular_rows(file_format: str, content: bytes) -> list[list[str]]:
    """Linhas (listas de células como texto) de CSV/XLS/XLSX."""
    if file_format == "csv":
        text = content.decode("utf-8-sig", errors="replace")
        sample = text[:4096]
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel
        reader = csv.reader(io.StringIO(text), dialect)
        return [[(c or "").strip() for c in row] for row in reader if any((c or "").strip() for c in row)]

    if file_format == "xlsx":
        from openpyxl import load_workbook

        wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active
        rows = []
        for row in ws.iter_rows(values_only=True):
            cells = ["" if c is None else str(c).strip() for c in row]
            if any(cells):
                rows.append(cells)
            if len(rows) > MAX_ROWS:
                break
        wb.close()
        return rows

    if file_format == "xls":
        import xlrd

        book = xlrd.open_workbook(file_contents=content)
        sheet = book.sheet_by_index(0)
        rows = []
        for i in range(min(sheet.nrows, MAX_ROWS)):
            cells = []
            for j in range(sheet.ncols):
                cell = sheet.cell(i, j)
                if cell.ctype == xlrd.XL_CELL_DATE:
                    y, m, d, *_ = xlrd.xldate_as_tuple(cell.value, book.datemode)
                    cells.append(f"{y:04d}-{m:02d}-{d:02d}")
                else:
                    cells.append(str(cell.value).strip())
            if any(cells):
                rows.append(cells)
        return rows

    raise ValueError(f"Formato tabular desconhecido: {file_format}")


def extract_pdf_text(content: bytes) -> str:
    import pdfplumber

    parts: list[str] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            parts.append(page.extract_text() or "")
    return "\n".join(parts)


# ------------------------------------------------------------ classificação

def classify_document(text: str) -> tuple[str, float]:
    """Distingue fatura de cartão de extrato bancário por palavras-chave.

    Retorna (tipo, confiança 0..1). Empate ou nenhum sinal → extrato (mais
    comum e de tratamento mais neutro).
    """
    lowered = text.lower()
    fatura_score = sum(lowered.count(k) for k in FATURA_KEYWORDS)
    extrato_score = sum(lowered.count(k) for k in EXTRATO_KEYWORDS)

    total = fatura_score + extrato_score
    if total == 0:
        return "extrato", 0.3
    if fatura_score > extrato_score:
        return "fatura", min(0.5 + fatura_score / (2 * total), 0.99)
    return "extrato", min(0.5 + extrato_score / (2 * total), 0.99)


# ------------------------------------------------------- extração: tabular

def _match_header(cell: str, candidates: tuple[str, ...]) -> bool:
    return cell.strip().lower() in candidates


def detect_tabular_columns(rows: list[list[str]]) -> tuple[dict, int]:
    """Descobre as colunas (data, descrição, valor, tipo) e onde começam os dados.

    1º: por nome de cabeçalho; 2º: por padrão dos valores das primeiras linhas.
    """
    if not rows:
        raise ValueError("Arquivo vazio")

    header = rows[0]
    mapping: dict[str, int | None] = {"date": None, "description": None, "amount": None, "type": None}
    for idx, cell in enumerate(header):
        if mapping["date"] is None and _match_header(cell, DATE_HEADERS):
            mapping["date"] = idx
        elif mapping["description"] is None and _match_header(cell, DESC_HEADERS):
            mapping["description"] = idx
        elif mapping["amount"] is None and _match_header(cell, AMOUNT_HEADERS):
            mapping["amount"] = idx
        elif mapping["type"] is None and _match_header(cell, TYPE_HEADERS):
            mapping["type"] = idx

    if mapping["date"] is not None and mapping["amount"] is not None:
        if mapping["description"] is None:
            used = {v for v in mapping.values() if v is not None}
            mapping["description"] = next((i for i in range(len(header)) if i not in used), None)
        return mapping, 1

    # Sem cabeçalho reconhecível: infere pelas 5 primeiras linhas de dados.
    sample = rows[:5]
    n_cols = max(len(r) for r in sample)

    def col_values(idx: int) -> list[str]:
        return [r[idx] for r in sample if idx < len(r) and r[idx]]

    date_col = amount_col = None
    for idx in range(n_cols):
        values = col_values(idx)
        if not values:
            continue
        if date_col is None and all(DATE_TOKEN_RE.fullmatch(v.strip()) for v in values):
            date_col = idx
            continue
        if amount_col is None:
            try:
                for v in values:
                    parse_amount(v)
                amount_col = idx
            except (InvalidOperation, ValueError):
                pass

    if date_col is None or amount_col is None:
        raise ValueError(
            "Não foi possível identificar as colunas de data e valor. "
            "Use o mapeamento manual de colunas (CSV)."
        )

    desc_col = max(
        (i for i in range(n_cols) if i not in (date_col, amount_col)),
        key=lambda i: sum(len(v) for v in col_values(i)),
        default=None,
    )
    return {"date": date_col, "description": desc_col, "amount": amount_col, "type": None}, 0


def extract_from_tabular(rows: list[list[str]], document_type: str) -> tuple[list[ImportedTransaction], list[str]]:
    mapping, data_start = detect_tabular_columns(rows)
    transactions: list[ImportedTransaction] = []
    warnings: list[str] = []

    for line_no, row in enumerate(rows[data_start:], start=data_start + 1):
        try:
            raw_date = row[mapping["date"]]
            raw_amount = row[mapping["amount"]]
            description = row[mapping["description"]] if mapping["description"] is not None else ""
            amount = parse_amount(raw_amount)
            tx_date = parse_date_token(DATE_TOKEN_RE.search(raw_date).group(1))
        except (IndexError, AttributeError, InvalidOperation, ValueError):
            warnings.append(f"Linha {line_no} ignorada: formato não reconhecido")
            continue

        raw_type = (row[mapping["type"]].strip().upper() if mapping["type"] is not None and mapping["type"] < len(row) else "")
        tx_type = _resolve_type(amount, raw_type, description, document_type)

        transactions.append(
            ImportedTransaction(
                date=tx_date,
                description=description.strip() or "Lançamento importado",
                amount=abs(amount),
                type=tx_type,
            )
        )

    return transactions, warnings


# ----------------------------------------------------------- extração: PDF

def extract_from_text(text: str, document_type: str) -> tuple[list[ImportedTransaction], list[str]]:
    """Extrai transações de texto corrido (PDF): data + descrição + valor por linha."""
    transactions: list[ImportedTransaction] = []
    warnings: list[str] = []

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        date_match = DATE_TOKEN_RE.search(line)
        if not date_match:
            continue
        amount_matches = list(AMOUNT_TOKEN_RE.finditer(line))
        if not amount_matches:
            continue

        # Valor do lançamento é o ÚLTIMO da linha (colunas de saldo vêm depois
        # em alguns extratos; nesses casos o penúltimo é o valor — heurística:
        # se houver 2+, usa o primeiro após a descrição, que é o mais comum).
        amount_match = amount_matches[0] if len(amount_matches) > 1 else amount_matches[-1]

        try:
            amount = parse_amount(amount_match.group(1))
        except (InvalidOperation, ValueError):
            continue
        if amount == 0:
            continue

        dc_suffix = (amount_match.group(2) or "").upper()
        description = line[date_match.end():amount_match.start()].strip(" -–|\t")
        if not description or len(description) < 2:
            continue
        # Linhas de saldo/total não são lançamentos
        if re.search(r"\bsaldo\b|\btotal\b|subtotal", description, re.IGNORECASE):
            continue

        try:
            tx_date = parse_date_token(date_match.group(1))
        except ValueError:
            continue

        tx_type = _resolve_type(amount, dc_suffix, description, document_type)
        transactions.append(
            ImportedTransaction(
                date=tx_date, description=description, amount=abs(amount), type=tx_type
            )
        )

    if not transactions:
        warnings.append(
            "Nenhum lançamento reconhecido no PDF. Se o arquivo for digitalizado "
            "(imagem), exporte o extrato em CSV/OFX no seu banco."
        )
    return transactions, warnings


def _resolve_type(amount: Decimal, dc_marker: str, description: str, document_type: str) -> str:
    """Regra de tipo: fatura → gasto (créditos viram receita); extrato → pelo sinal/D-C."""
    marker = dc_marker.strip().upper()
    lowered = description.lower()

    if document_type == "fatura":
        if amount < 0 or marker == "C" or any(h in lowered for h in CREDIT_HINTS):
            return "income"
        return "expense"

    if marker == "D":
        return "expense"
    if marker == "C":
        return "income"
    return "expense" if amount < 0 else "income" if amount > 0 else "expense"


# --------------------------------------------------------------- orquestra

def build_preview(filename: str, content: bytes) -> ImportPreviewResponse:
    if len(content) > MAX_FILE_BYTES:
        raise ValueError("Arquivo maior que 10 MB")

    file_format = detect_format(filename)

    if file_format == "pdf":
        text = extract_pdf_text(content)
        document_type, confidence = classify_document(text)
        transactions, warnings = extract_from_text(text, document_type)
    else:
        rows = read_tabular_rows(file_format, content)
        flat_text = "\n".join(" ".join(r) for r in rows[:50])
        document_type, confidence = classify_document(flat_text)
        transactions, warnings = extract_from_tabular(rows, document_type)

    return ImportPreviewResponse(
        file_format=file_format,
        document_type=document_type,
        confidence=confidence,
        transactions=transactions[:MAX_ROWS],
        warnings=warnings[:50],
    )


async def commit_import(db: AsyncSession, user: User, data: ImportCommitRequest) -> ImportCommitResult:
    created = reconciled = 0
    for item in data.transactions:
        match = await find_duplicate_for_import(db, user.id, item.description, item.amount, item.date)
        if match is not None:
            reconciled += 1
            continue
        db.add(
            Transaction(
                user_id=user.id,
                description=item.description,
                amount=item.amount,
                type=item.type,
                date=item.date,
                category_id=item.category_id,
                origin="csv_import",
            )
        )
        created += 1

    await db.commit()
    return ImportCommitResult(created=created, reconciled=reconciled, skipped=0)
