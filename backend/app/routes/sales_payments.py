# backend/app/routes/sales_payments.py
from flask import Blueprint, request, jsonify
from datetime import date
from uuid import uuid4
from calendar import monthrange

from app.models import (
    db,
    Sale,
    SalePayment,
    FinancialEntry,
)

sales_payments_bp = Blueprint("sales_payments", __name__, url_prefix="/api/sales")

# Conjunto de métodos válidos
VALID_METHODS = {
    "DINHEIRO",
    "PIX",
    "BOLETO",
    "TRANSFERENCIA",
    "CARTAO_CREDITO",
    "CARTAO_DEBITO",
    "CREDITO",  # crédito do cliente (gerenciado em /customers/<id>/credits/liquidate)
}

# Métodos que, por padrão, entram como "PAGO" se o status não for informado
DEFAULT_PAID_METHODS = {"DINHEIRO", "PIX", "CARTAO_DEBITO", "CREDITO"}

# Métodos que, por padrão, entram como "PENDENTE" se o status não for informado
DEFAULT_PENDING_METHODS = {"BOLETO", "TRANSFERENCIA", "CARTAO_CREDITO"}


# -----------------------------
# Utilitários de data/parcelas
# -----------------------------
def _parse_date(s):
    """Parse simples YYYY-MM-DD -> date. Fallback para hoje."""
    if not s:
        return date.today()
    try:
        y, m, d = [int(x) for x in s.split("-")]
        return date(y, m, d)
    except Exception:
        return date.today()


def _add_months(d: date, months: int) -> date:
    """Soma meses à data, preservando o dia quando possível."""
    y = d.year + (d.month - 1 + months) // 12
    m = (d.month - 1 + months) % 12 + 1
    last_day = monthrange(y, m)[1]
    day = min(d.day, last_day)
    return date(y, m, day)


def _split_amount(amount: float, installments: int):
    """
    Divide um valor em N parcelas (duas casas), ajustando a última para fechar.
    Retorna lista de floats com soma == amount.
    """
    if installments <= 1:
        return [round(float(amount), 2)]
    base = round(float(amount) / installments, 2)
    parts = [base] * (installments - 1)
    last = round(float(amount) - sum(parts), 2)
    parts.append(last)
    return parts


def _default_status_for(method: str, provided: str | None) -> str:
    s = (provided or "").upper().strip()
    if s in ("PENDENTE", "PAGO", "CANCELADO"):
        return s
    if method in DEFAULT_PAID_METHODS:
        return "PAGO"
    return "PENDENTE"


def _create_financial_entry_for_payment(sale: Sale, amount: float, method: str, due_date: date, status: str):
    """
    Cria uma RECEITA no financeiro para o pagamento informado, exceto quando o método é 'CREDITO'.
    """
    if method == "CREDITO":
        return None

    entry = FinancialEntry(
        id=str(uuid4()),
        type="RECEITA",
        description=f"Recebimento venda #{str(sale.id)[:8]} ({method})",
        amount=float(amount),
        due_date=due_date or date.today(),
        payment_method=method,
        status=status,
    )
    db.session.add(entry)
    return entry


# -----------------------------
# Endpoints
# -----------------------------
@sales_payments_bp.get("/<sale_id>/payments")
def list_sale_payments(sale_id):
    sale = Sale.query.get_or_404(sale_id)
    items = []
    for p in sale.payments:
        items.append({
            "id": p.id,
            "saleId": p.sale_id,
            "dueDate": p.due_date.isoformat() if p.due_date else None,
            "amount": float(p.amount or 0.0),
            "paymentMethod": p.payment_method,
            "status": p.status,
            "createdAt": p.created_at.isoformat() if p.created_at else None,
        })
    return jsonify(items), 200


@sales_payments_bp.post("/<sale_id>/payments")
def create_sale_payments(sale_id):
    """
    Cria pagamentos (parcelas) para a venda.
    Espera JSON no formato *A* (manual) ou *B* (assistido):

    A) Manual (lista de pagamentos):
    {
      "payments": [
        {"amount": 100.0, "paymentMethod": "PIX", "dueDate": "2025-08-18", "status": "PAGO"},
        {"amount": 50.0, "paymentMethod": "CARTAO_CREDITO", "dueDate": "2025-09-10"}
      ]
    }

    B) Assistido (cria e parcela automaticamente um único pagamento):
    {
      "amount": 600.00,
      "paymentMethod": "CARTAO_CREDITO",
      "installments": 6,
      "firstDueDate": "2025-09-05",   # opcional; default hoje
      "status": "PENDENTE"            # opcional
    }

    Regras:
    - CARTAO_DEBITO: não permite installments > 1 (erro 400).
    - CARTAO_CREDITO: se installments > 1, divide amount automaticamente e agenda mensalmente.
    - PIX/DINHEIRO: default status=PAGO (se não informado) e dueDate=hoje.
    - BOLETO/TRANSFERENCIA/CARTAO_CREDITO: default status=PENDENTE (se não informado).
    - CREDITO (crédito de cliente): status sempre forçado para PAGO e não gera FinancialEntry.
    """
    sale = Sale.query.get_or_404(sale_id)
    body = request.get_json(silent=True) or {}

    normalized = []  # lista de dicts normalizados: {amount, method, due_date, status}

    # Caminho A: lista manual
    if isinstance(body.get("payments"), list) and body["payments"]:
        for idx, p in enumerate(body["payments"]):
            try:
                amount = float(p.get("amount") or 0.0)
                method = (p.get("paymentMethod") or "").upper().strip()
                due_date = _parse_date(p.get("dueDate"))
                installments = int(p.get("installments") or 1)
                status = _default_status_for(method, p.get("status"))

                if amount <= 0:
                    return jsonify({"error": f"[payments[{idx}]] Valor do pagamento inválido."}), 400
                if method not in VALID_METHODS:
                    return jsonify({"error": f"[payments[{idx}]] Método inválido: {method}"}), 400

                if method == "CARTAO_DEBITO" and installments > 1:
                    return jsonify({"error": f"[payments[{idx}]] CARTAO_DEBITO não permite parcelamento."}), 400

                # Força comportamento específico
                if method == "CREDITO":
                    status = "PAGO"  # consumo imediato; a baixa do saldo é feita no endpoint /customers/<id>/credits/liquidate

                if installments <= 1:
                    normalized.append({
                        "amount": round(amount, 2),
                        "method": method,
                        "due_date": due_date,
                        "status": status,
                    })
                else:
                    # Parcelamento automático para a entrada manual
                    parts = _split_amount(amount, installments)
                    for i, part in enumerate(parts):
                        normalized.append({
                            "amount": part,
                            "method": method,
                            "due_date": _add_months(due_date, i),
                            "status": status if method != "CARTAO_CREDITO" else "PENDENTE" if status not in ("PAGO", "CANCELADO") else status,
                        })
            except Exception as e:
                return jsonify({"error": f"[payments[{idx}]] Erro ao processar pagamento: {str(e)}"}), 400

    else:
        # Caminho B: modo assistido (um pagamento com possível parcelamento)
        try:
            amount = float(body.get("amount") or 0.0)
            method = (body.get("paymentMethod") or "").upper().strip()
            installments = int(body.get("installments") or 1)
            first_due = _parse_date(body.get("firstDueDate") or body.get("dueDate"))
            status = _default_status_for(method, body.get("status"))

            if amount <= 0:
                return jsonify({"error": "Valor do pagamento inválido."}), 400
            if method not in VALID_METHODS:
                return jsonify({"error": f"Método inválido: {method}"}), 400

            if method == "CARTAO_DEBITO" and installments > 1:
                return jsonify({"error": "CARTAO_DEBITO não permite parcelamento."}), 400

            if method == "CREDITO":
                status = "PAGO"

            if installments <= 1:
                normalized.append({
                    "amount": round(amount, 2),
                    "method": method,
                    "due_date": first_due,
                    "status": status,
                })
            else:
                parts = _split_amount(amount, installments)
                for i, part in enumerate(parts):
                    normalized.append({
                        "amount": part,
                        "method": method,
                        "due_date": _add_months(first_due, i),
                        "status": status if method != "CARTAO_CREDITO" else "PENDENTE" if status not in ("PAGO", "CANCELADO") else status,
                    })
        except Exception as e:
            return jsonify({"error": f"Erro ao processar dados: {str(e)}"}), 400

    # Persistência
    created = []
    try:
        for spec in normalized:
            sp = SalePayment(
                sale_id=sale.id,
                amount=float(spec["amount"]),
                payment_method=spec["method"],
                due_date=spec["due_date"],
                status=spec["status"],
            )
            db.session.add(sp)

            # Cria lançamento financeiro (exceto CREDITO)
            _create_financial_entry_for_payment(
                sale=sale,
                amount=spec["amount"],
                method=spec["method"],
                due_date=spec["due_date"],
                status=spec["status"],
            )

            created.append({
                "id": None,  # será preenchido após commit, se desejar você pode expor o ID real
                "saleId": sale.id,
                "dueDate": spec["due_date"].isoformat() if spec["due_date"] else None,
                "amount": float(spec["amount"]),
                "paymentMethod": spec["method"],
                "status": spec["status"],
            })

        db.session.commit()

        # Atualiza os IDs após commit
        # (Recarrega pagamentos da venda e faz um "join" simples na ordem de criação)
        persisted = SalePayment.query.filter_by(sale_id=sale.id).order_by(SalePayment.created_at.desc()).limit(len(created)).all()
        # Como não temos uma relação direta item-a-item, apenas garantimos que existem novos registros.
        # Se você precisar mapear estritamente, armazene os objetos sp numa lista e serialize após commit.

        return jsonify({"ok": True, "payments": created}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Falha ao registrar pagamentos: {str(e)}"}), 400


@sales_payments_bp.post("/payments/<payment_id>/pay")
def mark_sale_payment_as_paid(payment_id):
    """
    Marca uma parcela específica como 'PAGO'.
    """
    p = SalePayment.query.get(payment_id)
    if not p:
        return jsonify({"error": "Parcela não encontrada."}), 404

    if p.status == "PAGO":
        return jsonify({"error": "Parcela já está paga."}), 400

    p.status = "PAGO"
    db.session.commit()
    return jsonify({"ok": True, "id": payment_id}), 200
