"""Testes do motor de importação (CSV/XLS/XLSX/PDF, extrato × fatura)."""
import io
from datetime import date
from decimal import Decimal

import pytest

from conftest import API

# ------------------------------------------------------------ funções puras


def test_parse_amount_formatos():
    from app.services.import_service import parse_amount

    assert parse_amount("1.234,56") == Decimal("1234.56")
    assert parse_amount("-1.234,56") == Decimal("-1234.56")
    assert parse_amount("R$ 45,90") == Decimal("45.90")
    assert parse_amount("1234.56") == Decimal("1234.56")
    assert parse_amount("(100,00)") == Decimal("-100.00")


def test_parse_date_token():
    from app.services.import_service import parse_date_token

    assert parse_date_token("2026-07-17") == date(2026, 7, 17)
    assert parse_date_token("17/07/2026") == date(2026, 7, 17)
    assert parse_date_token("17/07/26") == date(2026, 7, 17)
    # dd/mm sem ano: nunca cai num futuro distante
    parsed = parse_date_token("05/12")
    assert parsed <= date.today().replace(day=28) or parsed.year == date.today().year


def test_classificacao_extrato_vs_fatura():
    from app.services.import_service import classify_document

    fatura = "FATURA DO CARTÃO\nVencimento: 10/08/2026\nPagamento mínimo R$ 120,00\nLimite de crédito"
    extrato = "EXTRATO DE CONTA CORRENTE\nAgência 1234\nSaldo anterior R$ 1.000,00\nLançamentos do período"

    tipo, conf = classify_document(fatura)
    assert tipo == "fatura" and conf > 0.5
    tipo, conf = classify_document(extrato)
    assert tipo == "extrato" and conf > 0.5
    tipo, conf = classify_document("texto qualquer sem sinais")
    assert tipo == "extrato" and conf <= 0.5


def test_extracao_texto_extrato():
    from app.services.import_service import extract_from_text

    texto = """EXTRATO CONTA CORRENTE
02/07/2026 PIX RECEBIDO FULANO 1.500,00 C
03/07/2026 SUPERMERCADO ZAFFARI 234,56 D
04/07/2026 SALDO DO DIA 10.000,00
05/07/2026 TED ENVIADA CONDOMINIO -890,00
"""
    txs, warnings = extract_from_text(texto, "extrato")
    assert len(txs) == 3  # linha de SALDO ignorada
    pix, mercado, ted = txs
    assert pix.type == "income" and pix.amount == Decimal("1500.00")
    assert mercado.type == "expense" and mercado.amount == Decimal("234.56")
    assert ted.type == "expense" and ted.amount == Decimal("890.00")


def test_extracao_texto_fatura():
    from app.services.import_service import extract_from_text

    texto = """FATURA CARTÃO FINAL 9437 Vencimento 10/08
05/07 RESTAURANTE MADERO 189,50
06/07 NETFLIX.COM 44,90
07/07 PAGAMENTO RECEBIDO -1.000,00
"""
    txs, _ = extract_from_text(texto, "fatura")
    assert len(txs) == 3
    assert txs[0].type == "expense"
    assert txs[1].type == "expense"
    assert txs[2].type == "income"  # pagamento da fatura é crédito


def test_deteccao_colunas_por_cabecalho():
    from app.services.import_service import extract_from_tabular

    rows = [
        ["Data", "Descrição", "Valor"],
        ["2026-07-01", "Padaria", "-32,50"],
        ["2026-07-02", "Salário", "12.500,00"],
    ]
    txs, warnings = extract_from_tabular(rows, "extrato")
    assert not warnings
    assert txs[0].type == "expense" and txs[0].amount == Decimal("32.50")
    assert txs[1].type == "income" and txs[1].amount == Decimal("12500.00")


def test_deteccao_colunas_sem_cabecalho():
    from app.services.import_service import extract_from_tabular

    rows = [
        ["01/07/2026", "COMPRA CARTAO PADARIA", "-15,90"],
        ["02/07/2026", "PIX RECEBIDO", "200,00"],
    ]
    txs, _ = extract_from_tabular(rows, "extrato")
    assert len(txs) == 2
    assert txs[0].description == "COMPRA CARTAO PADARIA"


def test_tabular_ilegivel_gera_erro_claro():
    from app.services.import_service import detect_tabular_columns

    with pytest.raises(ValueError):
        detect_tabular_columns([["a", "b"], ["c", "d"]])


# --------------------------------------------------------------- endpoints


def test_preview_csv_endpoint(client, auth_a):
    csv_body = "Data;Descrição;Valor\n01/07/2026;Padaria Pão Quente;-32,50\n02/07/2026;Pix recebido;150,00\n"
    r = client.post(
        f"{API}/transactions/import/preview",
        headers=auth_a,
        files={"file": ("extrato.csv", io.BytesIO(csv_body.encode("utf-8")), "text/csv")},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["file_format"] == "csv"
    assert len(body["transactions"]) == 2
    assert body["transactions"][0]["type"] == "expense"


def test_preview_xlsx_endpoint(client, auth_a):
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(["Data", "Histórico", "Valor"])
    ws.append(["2026-07-03", "Farmácia", "-87,30"])
    ws.append(["2026-07-04", "Depósito", "500,00"])
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    r = client.post(
        f"{API}/transactions/import/preview",
        headers=auth_a,
        files={"file": ("extrato.xlsx", buffer, "application/vnd.ms-excel")},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["file_format"] == "xlsx"
    assert len(body["transactions"]) == 2


def test_preview_formato_invalido(client, auth_a):
    r = client.post(
        f"{API}/transactions/import/preview",
        headers=auth_a,
        files={"file": ("dados.docx", io.BytesIO(b"x"), "application/octet-stream")},
    )
    assert r.status_code == 422


def test_commit_endpoint_cria_e_reconcilia(client, auth_a):
    import uuid as _uuid

    desc = f"Import Teste {_uuid.uuid4().hex[:8]}"
    payload = {
        "document_type": "extrato",
        "transactions": [
            {"date": "2026-07-10", "description": desc, "amount": "77.70", "type": "expense"},
        ],
    }
    r = client.post(f"{API}/transactions/import/commit", headers=auth_a, json=payload)
    assert r.status_code == 200, r.text
    assert r.json()["created"] == 1

    # Reimportar o mesmo lançamento deve reconciliar, não duplicar
    r = client.post(f"{API}/transactions/import/commit", headers=auth_a, json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == 0 and body["reconciled"] == 1


def test_import_exige_auth(client):
    r = client.post(f"{API}/transactions/import/preview")
    assert r.status_code == 401
    r = client.post(f"{API}/transactions/import/commit", json={"transactions": []})
    assert r.status_code in (401, 422)
