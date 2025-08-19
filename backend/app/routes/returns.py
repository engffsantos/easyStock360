# backend/app/routes/returns.py
from flask import Blueprint, request, jsonify
from datetime import date
from uuid import uuid4

from app.models import (
    db,
    Sale,
    SaleItem,
    Product,
    FinancialEntry,
    Return,
    ReturnItem,
    CustomerCredit,   # novo: usamos para gerar créditos quando resolution = CREDITO
)

returns_bp = Blueprint("returns", __name__, url_prefix="/api/returns")


# -----------------------------
# Helpers
# -----------------------------
def _calc_total(items):
    """items: [{price, quantity}] -> soma total"""
    return float(sum((float(i["price"]) * int(i["quantity"])) for i in items))


def _get_sold_quantities(sale):
    """Dict product_id -> quantidade vendida na venda."""
    sold = {}
    for it in sale.items:
        sold[str(it.product_id)] = sold.get(str(it.product_id), 0) + int(it.quantity)
    return sold


def _get_already_returned_quantities(sale_id):
    """Dict product_id -> quantidade já devolvida nessa venda (exceto CANCELADA)."""
    returned = {}
    q = (
        db.session.query(ReturnItem)
        .join(Return, ReturnItem.return_id == Return.id)
        .filter(Return.sale_id == sale_id)
        .filter(Return.status != "CANCELADA")
        .all()
    )
    for it in q:
        pid = str(it.product_id)
        returned[pid] = returned.get(pid, 0) + int(it.quantity)
    return returned


def _validate_items(sale, items):
    """
    Valida se cada item pertence à venda e se a quantidade é <= (vendida - já devolvida).
    items: [{productId, quantity, price, productName}]
    """
    if not items:
        raise ValueError("Selecione pelo menos um item para devolver.")

    sold = _get_sold_quantities(sale)
    already = _get_already_returned_quantities(sale.id)

    for i in items:
        pid = str(i.get("productId"))
        if pid not in sold:
            raise ValueError(f"Produto {pid} não pertence à venda.")
        qty = int(i.get("quantity") or 0)
        if qty <= 0:
            raise ValueError(f"Quantidade inválida para {pid}.")
        max_allowed = sold[pid] - int(already.get(pid, 0))
        if qty > max_allowed:
            raise ValueError(f"Quantidade para {pid} excede o permitido. Máximo: {max_allowed}.")


def _create_financial_expense_for_return(ret_obj):
    """
    Cria uma DESPESA no financeiro para resolução REEMBOLSO.
    """
    desc = f"Devolução da venda #{str(ret_obj.sale_id)[:8]}"
    entry = FinancialEntry(
        id=str(uuid4()),
        type="DESPESA",
        description=desc,
        amount=float(ret_obj.total),
        due_date=date.today(),
        payment_method="AJUSTE",
        status="PENDENTE",
    )
    db.session.add(entry)


# -----------------------------
# Endpoints
# -----------------------------
@returns_bp.get("")
def list_returns():
    rs = Return.query.order_by(Return.created_at.desc()).all()
    data = []
    for r in rs:
        # nome do cliente via relação, ou fallback via venda
        customer_name = None
        try:
            customer_name = r.customer.name if r.customer else None
        except Exception:
            customer_name = None
        if not customer_name and r.sale:
            customer_name = getattr(r.sale, "customer_name", None)

        data.append({
            "id": r.id,
            "saleId": r.sale_id,
            "customerId": r.customer_id,
            "customerName": customer_name,
            "createdAt": r.created_at.isoformat() if r.created_at else None,
            "resolution": r.resolution,   # "REEMBOLSO" | "CREDITO"
            "status": r.status,           # "ABERTA" | "CONCLUIDA" | "CANCELADA"
            "total": float(r.total or 0.0),
        })
    return jsonify(data), 200


@returns_bp.get("/<rid>")
def get_return(rid):
    r = Return.query.get_or_404(rid)

    customer_name = None
    try:
        customer_name = r.customer.name if r.customer else None
    except Exception:
        customer_name = None
    if not customer_name and r.sale:
        customer_name = getattr(r.sale, "customer_name", None)

    return jsonify({
        "id": r.id,
        "saleId": r.sale_id,
        "customerId": r.customer_id,
        "customerName": customer_name,
        "createdAt": r.created_at.isoformat() if r.created_at else None,
        "resolution": r.resolution,
        "status": r.status,
        "reason": r.reason,
        "total": float(r.total or 0),
        "items": [{
            "id": it.id,
            "productId": it.product_id,
            "productName": it.product_name,
            "quantity": int(it.quantity),
            "price": float(it.price),
            "subtotal": float(it.price) * int(it.quantity),
        } for it in r.items]
    }), 200


@returns_bp.post("")
def create_return():
    """
    Cria uma devolução. Se resolution == "CREDITO", gera CustomerCredit com amount=balance=total
    e marca a devolução como CONCLUIDA (sem criar despesa financeira).
    Se resolution == "REEMBOLSO", cria uma DESPESA no financeiro e deixa status "ABERTA" (ou conforme seu fluxo).
    """
    payload = request.get_json(silent=True) or {}
    sale_id = payload.get("saleId")
    items = payload.get("items") or []
    reason = (payload.get("reason") or "").strip()
    resolution = (payload.get("resolution") or "REEMBOLSO").upper().strip()  # REEMBOLSO|CREDITO

    if not sale_id:
        return jsonify({"error": "saleId é obrigatório."}), 400
    if not reason:
        return jsonify({"error": "Motivo da devolução é obrigatório."}), 400

    sale = Sale.query.get(sale_id)
    if not sale:
        return jsonify({"error": "Venda não encontrada."}), 404

    # valida itens
    try:
        _validate_items(sale, items)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    total = _calc_total(items)
    rid = str(uuid4())

    # cria Return
    ret = Return(
        id=rid,
        sale_id=sale.id,
        customer_id=sale.customer_id or None,
        reason=reason,
        resolution=resolution,
        status="ABERTA",  # pode mudar abaixo
        total=total,
    )
    db.session.add(ret)

    # cria ReturnItems
    for it in items:
        db.session.add(ReturnItem(
            id=str(uuid4()),
            return_id=rid,
            product_id=str(it["productId"]),
            product_name=str(it.get("productName") or ""),
            quantity=int(it["quantity"]),
            price=float(it["price"]),
        ))

    # reentrada de estoque
    for it in items:
        product = Product.query.get(str(it["productId"]))
        if product:
            product.quantity = int(product.quantity or 0) + int(it["quantity"])

    # financeiro / crédito
    if resolution == "REEMBOLSO":
        _create_financial_expense_for_return(ret)
        # mantém "ABERTA"; o fluxo pode concluir via PATCH /status
    elif resolution == "CREDITO":
        if not sale.customer_id:
            db.session.rollback()
            return jsonify({"error": "Não é possível gerar crédito: venda sem cliente vinculado."}), 400

        db.session.add(
            CustomerCredit(
                id=str(uuid4()),
                customer_id=sale.customer_id,
                return_id=rid,
                amount=float(total),
                balance=float(total),
            )
        )
        # devoluções em CRÉDITO são concluídas imediatamente
        ret.status = "CONCLUIDA"

    db.session.commit()
    return jsonify({"id": rid}), 201


@returns_bp.patch("/<rid>/status")
def update_status(rid):
    r = Return.query.get_or_404(rid)
    body = request.get_json(silent=True) or {}
    new_status = (body.get("status") or "").upper().strip()
    if new_status not in ("ABERTA", "CONCLUIDA", "CANCELADA"):
        return jsonify({"error": "Status inválido."}), 400

    r.status = new_status
    db.session.commit()
    return jsonify({"ok": True}), 200
