# backend/app/routes/sales.py
# ======================================================================================
# Rotas de Vendas (Sales) – criação, listagem, edição, conversão de orçamentos
# e utilitário de validação de estoque para uso em tempo real no formulário.
# ======================================================================================

from flask import Blueprint, request, jsonify
from app.models import db, Sale, SaleItem, Product, Customer, SalePayment
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime, timedelta, date, timezone

sales_bp = Blueprint('sales', __name__)

# --------------------------------------------------------------------------------------
# Helpers (cálculo, normalização, utilitários)
# --------------------------------------------------------------------------------------
def compute_totals(items, discount_type, discount_value, freight):
    """Calcula subtotal/total considerando desconto e frete."""
    subtotal = sum((float(i.get('price', 0)) * int(i.get('quantity', 0))) for i in items)
    discount = 0.0
    if discount_type and discount_value:
        if discount_type == 'PERCENT':
            discount = min(subtotal * (float(discount_value) / 100.0), subtotal)
        elif discount_type == 'VALUE':
            discount = min(float(discount_value), subtotal)
    total = max(subtotal - discount + float(freight or 0), 0.0)
    return subtotal, discount, total


def add_months_safe(d: date, months: int) -> date:
    """Adiciona meses preservando o dia quando possível (ex.: 31/jan + 1 -> 29/fev ou 28/fev)."""
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    days_in_month = [31, 29 if (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)) else 28,
                     31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month-1]
    day = min(d.day, days_in_month)
    return date(year, month, day)


def normalize_method(m: str) -> str:
    """Normaliza grafias de métodos para o conjunto oficial."""
    if not m:
        return 'PIX'
    t = str(m).strip().upper().replace(' ', '_')
    t = (t.replace('Ó','O').replace('Ô','O').replace('Á','A').replace('Ã','A')
           .replace('É','E').replace('Ê','E').replace('Í','I').replace('Ú','U'))
    if t in {'CARTAO_DEBITO', 'DEBITO', 'CARTAO_DEBITO_', 'CARTAO__DEBITO'}:
        return 'CARTAO_DEBITO'
    if t in {'CARTAO_CREDITO', 'CREDITO_CARTAO', 'CARTAO_CREDITO_', 'CARTAO__CREDITO'}:
        return 'CARTAO_CREDITO'
    if t in {'TRANSFERENCIA', 'TRANSFERENCIA_BANCARIA', 'TED', 'DOC', 'PIX_TRANSFERENCIA'}:
        return 'TRANSFERENCIA'
    if t in {'CREDITO_DO_CLIENTE', 'CREDITO_CLIENTE', 'CREDITO_DO__CLIENTE', 'CREDITO'}:
        return 'CREDITO'
    if t in {'MONEY', 'CASH'}:
        return 'DINHEIRO'
    if t in {'BILL', 'BOLETO_BANCARIO'}:
        return 'BOLETO'
    if t in {'PIX_QR', 'PIX_COPIA_E_COLA'}:
        return 'PIX'
    if t in {'PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO', 'TRANSFERENCIA', 'CREDITO'}:
        return t
    return t


def normalize_status(s: str) -> str:
    """Normaliza status de parcela vindos do frontend."""
    t = str(s or '').strip().upper().replace(' ', '_')
    if t in {'', 'ABERTO', 'EM_ABERTO', 'OPEN', 'AGUARDANDO'}:
        return 'PENDENTE'
    if t in {'PENDENTE'}:
        return 'PENDENTE'
    if t in {'PAGO', 'PAID'}:
        return 'PAGO'
    if t in {'VENCIDO', 'OVERDUE'}:
        return 'VENCIDO'
    if t in {'CANCELADO', 'CANCELLED', 'CANCELED'}:
        return 'CANCELADO'
    return 'PENDENTE'


def parse_due_date(value) -> date:
    """Aceita 'YYYY-MM-DD' ou ISO completo; retorna date (fallback hoje)."""
    if not value:
        return datetime.utcnow().date()
    s = str(value)
    if 'T' in s:
        s = s.split('T', 1)[0]
    try:
        return datetime.strptime(s, '%Y-%m-%d').date()
    except Exception:
        try:
            return datetime.fromisoformat(s).date()
        except Exception:
            return datetime.utcnow().date()


def generate_payments_for_sale(sale: Sale, method: str, installments: int):
    """
    Gera parcelas simples com base no total da venda.
    - PIX/DINHEIRO/DÉBITO: parcela única vencendo no dia (PAGO se 1x).
    - Crédito/boletos/transferência: parcelas mensais a partir do mês atual.
    """
    installments = max(1, int(installments or 1))
    method = normalize_method(method)

    created_local_date = (sale.created_at or datetime.utcnow()).date()
    total = float(sale.total or 0)

    base = round(total / installments, 2)
    amounts = [base] * installments
    diff = round(total - sum(amounts), 2)
    if diff != 0:
        amounts[-1] = round(amounts[-1] + diff, 2)

    for i in range(installments):
        if method in ('PIX', 'DINHEIRO', 'CARTAO_DEBITO'):
            due = created_local_date
        else:
            due = add_months_safe(created_local_date, i)
        status = 'PAGO' if (installments == 1 and method in ('PIX', 'DINHEIRO', 'CARTAO_DEBITO')) else 'PENDENTE'

        db.session.add(SalePayment(
            sale_id=sale.id,
            due_date=due,
            amount=amounts[i],
            payment_method=method,
            status=status
        ))


def sale_to_dict(sale: Sale):
    """
    Serializa venda + "linha virtual" de Crédito do Cliente quando houver diferença entre:
      total da venda  vs  soma das parcelas não-crédito.
    """
    created_at = sale.created_at
    if created_at and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    valid_until = sale.valid_until
    if valid_until and valid_until.tzinfo is None:
        valid_until = valid_until.replace(tzinfo=timezone.utc)

    real_payments = sorted(sale.payments, key=lambda x: x.due_date)
    payments_list = [
        {
            'id': p.id,
            'dueDate': p.due_date.isoformat(),
            'amount': p.amount,
            'paymentMethod': p.payment_method,
            'status': p.status
        } for p in real_payments
    ]

    total_non_credit = round(sum(float(p.amount or 0)
                                 for p in real_payments
                                 if normalize_method(p.payment_method) != 'CREDITO'), 2)
    sale_total = round(float(sale.total or 0), 2)
    credit_used = round(max(0.0, sale_total - total_non_credit), 2)

    if credit_used > 0:
        payments_list.append({
            'id': None,
            'dueDate': (created_at.isoformat() if created_at else datetime.utcnow().date().isoformat()),
            'amount': credit_used,
            'paymentMethod': 'CREDITO DO CLIENTE',
            'status': 'PAGO',
            'isCredit': True,
            'label': 'Crédito do cliente utilizado'
        })

    return {
        'id': sale.id,
        'customerId': sale.customer_id,
        'customerName': sale.customer_name,
        'status': sale.status,
        'subtotal': sale.subtotal,
        'discountType': sale.discount_type,
        'discountValue': sale.discount_value,
        'freight': sale.freight,
        'total': sale.total,
        'paymentMethod': sale.payment_method,
        'installments': sale.installments,
        'validUntil': valid_until.isoformat() if valid_until else None,
        'createdAt': created_at.isoformat() if created_at else None,
        'items': [
            {
                'productId': i.product_id,
                'productName': i.product_name,
                'quantity': i.quantity,
                'price': i.price
            } for i in sale.items
        ],
        'payments': payments_list,
        'creditUsedAmount': credit_used,
        'usedCustomerCredit': bool(credit_used > 0),
    }


def payment_to_dict(p: SalePayment):
    return {
        'id': p.id,
        'saleId': p.sale_id,
        'dueDate': p.due_date.isoformat() if p.due_date else None,
        'amount': p.amount,
        'paymentMethod': p.payment_method,
        'status': p.status,
    }

# --------------------------------------------------------------------------------------
# Validação/abate de estoque (para conversão e vendas diretas COMPLETED)
# --------------------------------------------------------------------------------------
def compute_insufficient_items(sale_items):
    """
    Retorna itens com estoque insuficiente:
    [{ productId, productName, available, requested }]
    - available = 0 quando o produto não for encontrado.
    """
    insuff = []
    for item in sale_items:
        product = Product.query.get(item.product_id)
        if not product:
            insuff.append({
                'productId': item.product_id,
                'productName': item.product_name,
                'available': 0,
                'requested': int(item.quantity)
            })
            continue
        if product.quantity < int(item.quantity):
            insuff.append({
                'productId': item.product_id,
                'productName': item.product_name or product.name,
                'available': int(product.quantity),
                'requested': int(item.quantity)
            })
    return insuff


def deduct_stock(sale_items):
    """Abate do estoque a quantidade vendida (assume validação prévia)."""
    for item in sale_items:
        product = Product.query.get(item.product_id)
        if product:
            product.quantity -= int(item.quantity)


# --------------------------------------------------------------------------------------
# Rotas
# --------------------------------------------------------------------------------------
@sales_bp.route('/', methods=['GET'])
def list_sales():
    """Lista vendas com filtro opcional via ?status=..."""
    status_param = (request.args.get('status') or '').strip().upper()

    q = Sale.query
    if status_param:
        if status_param == 'ALL':
            pass
        elif ',' in status_param:
            statuses = [s.strip() for s in status_param.split(',') if s.strip()]
            q = q.filter(Sale.status.in_(statuses))
        else:
            q = q.filter_by(status=status_param)
    else:
        q = q.filter_by(status='COMPLETED')

    sales = q.order_by(Sale.created_at.desc()).all()
    return jsonify([sale_to_dict(s) for s in sales]), 200


@sales_bp.route('/quotes/', methods=['GET'])
def list_quotes():
    quotes = Sale.query.filter_by(status='QUOTE').order_by(Sale.created_at.desc()).all()
    return jsonify([sale_to_dict(q) for q in quotes]), 200


@sales_bp.route('/<id>/', methods=['GET'])
def get_transaction(id):
    sale = Sale.query.get_or_404(id)
    customer = Customer.query.get(sale.customer_id) if sale.customer_id else None

    data = sale_to_dict(sale)
    data.update({
        'customerCpfCnpj': customer.cpf_cnpj if customer else None,
        'customerPhone': customer.phone if customer else None,
        'customerAddress': customer.address if customer else None,
    })
    return jsonify(data), 200


@sales_bp.route('/', methods=['POST'])
def add_transaction():
    """Cria venda (COMPLETED) ou orçamento (QUOTE)."""
    data = request.get_json() or {}

    items = data.get('items', [])
    if not items:
        return jsonify({'error': 'Venda/Orçamento sem itens'}), 400

    status = data.get('status', 'QUOTE')
    customer_id = data.get('customerId')
    customer_name = data.get('customerName', 'Consumidor Final')

    discount_type = data.get('discountType')
    discount_value = float(data.get('discountValue', 0) or 0)
    freight = float(data.get('freight', 0) or 0)

    subtotal, _discount_calc, total = compute_totals(items, discount_type, discount_value, freight)

    try:
        created_at = datetime.now(timezone.utc)

        sale = Sale(
            customer_id=customer_id,
            customer_name=customer_name,
            status=status,
            subtotal=subtotal,
            discount_type=discount_type,
            discount_value=discount_value,
            freight=freight,
            total=total,
            created_at=created_at,
            valid_until=(created_at + timedelta(days=10)) if status == 'QUOTE' else None
        )

        sale.payment_method = data.get('paymentMethod')
        sale.installments = int(data.get('installments') or 1) if data.get('installments') is not None else None

        db.session.add(sale)
        db.session.flush()  # pega o ID

        # Itens
        for item in items:
            db.session.add(SaleItem(
                sale_id=sale.id,
                product_id=item['productId'],
                product_name=item.get('ProductName') or item['productName'],
                quantity=int(item['quantity']),
                price=float(item['price'])
            ))

        # Vendas diretas: valida estoque imediatamente
        if status == 'COMPLETED':
            insuff = compute_insufficient_items(sale.items)
            if insuff:
                db.session.rollback()
                return jsonify({
                    'error': 'OUT_OF_STOCK',
                    'message': 'Estoque insuficiente para um ou mais itens',
                    'items': insuff
                }), 409

            deduct_stock(sale.items)

            method = normalize_method(sale.payment_method or 'PIX')
            installments = sale.installments or 1
            SalePayment.query.filter_by(sale_id=sale.id).delete()
            generate_payments_for_sale(sale, method, installments)

        db.session.commit()
        return jsonify({'message': 'Transação registrada com sucesso', 'id': sale.id}), 201

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Erro ao salvar transação', 'details': str(e)}), 500


@sales_bp.route('/<id>/', methods=['PUT'])
def update_quote(id):
    """Edita um orçamento (QUOTE)."""
    sale = Sale.query.get_or_404(id)
    if sale.status != 'QUOTE':
        return jsonify({'error': 'Apenas orçamentos podem ser editados'}), 400

    data = request.get_json() or {}
    items = data.get('items', [])

    if not items:
        return jsonify({'error': 'Orçamento sem itens'}), 400

    try:
        sale.customer_id = data.get('customerId')
        sale.customer_name = data.get('customerName', 'Consumidor Final')

        sale.discount_type = data.get('discountType')
        sale.discount_value = float(data.get('discountValue', 0) or 0)
        sale.freight = float(data.get('freight', 0) or 0)

        subtotal, _discount_calc, total = compute_totals(items, sale.discount_type, sale.discount_value, sale.freight)
        sale.subtotal = subtotal
        sale.total = total

        if sale.valid_until is None and sale.created_at:
            base = sale.created_at if sale.created_at.tzinfo else sale.created_at.replace(tzinfo=timezone.utc)
            sale.valid_until = base + timedelta(days=10)

        # Substitui itens
        SaleItem.query.filter_by(sale_id=sale.id).delete()
        for item in items:
            db.session.add(SaleItem(
                sale_id=sale.id,
                product_id=item['productId'],
                product_name=item.get('ProductName') or item['productName'],
                quantity=int(item['quantity']),
                price=float(item['price'])
            ))

        # Observação: não bloqueamos orçamento por estoque aqui,
        # pois a checagem em tempo real deve ser feita no front usando /check_stock/.
        db.session.commit()
        return jsonify({'message': 'Orçamento atualizado com sucesso'}), 200

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Erro ao atualizar orçamento', 'details': str(e)}), 500


@sales_bp.route('/<id>/', methods=['DELETE'])
def delete_transaction(id):
    """
    Remove orçamento/venda.
    Corrigido: apaga parcelas e itens antes para evitar erro de integridade.
    """
    try:
        sale = Sale.query.get_or_404(id)

        # Apaga parcelas e itens vinculados (evita falha por FK)
        SalePayment.query.filter_by(sale_id=sale.id).delete(synchronize_session=False)
        SaleItem.query.filter_by(sale_id=sale.id).delete(synchronize_session=False)

        db.session.delete(sale)
        db.session.commit()
        return jsonify({'message': 'Transação excluída com sucesso'}), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Erro ao excluir transação', 'details': str(e)}), 500


# -----------------------------
# POST /api/sales/<id>/convert/ - Converte orçamento em venda (com validação de estoque rica)
# -----------------------------
@sales_bp.route('/<id>/convert/', methods=['POST'])
def convert_quote_to_sale(id):
    sale = Sale.query.get_or_404(id)
    if sale.status != 'QUOTE':
        return jsonify({'error': 'Apenas orçamentos podem ser convertidos'}), 400

    # Orçamento expirado?
    now = datetime.now(timezone.utc)
    if sale.valid_until:
        vu = sale.valid_until if sale.valid_until.tzinfo else sale.valid_until.replace(tzinfo=timezone.utc)
        if now > vu:
            return jsonify({'error': 'Orçamento expirado', 'code': 'QUOTE_EXPIRED'}), 422

    body = request.get_json(silent=True) or {}

    # 1) Valida estoque (sem abater ainda) – retorna 409 com lista se faltar
    insuff = compute_insufficient_items(sale.items)
    if insuff:
        return jsonify({
            'error': 'OUT_OF_STOCK',
            'message': 'Estoque insuficiente para um ou mais itens',
            'items': insuff
        }), 409

    # 2) Estoque ok → abate
    deduct_stock(sale.items)

    # =========================
    # MODO A: payments[] explícitos
    # =========================
    if isinstance(body.get('payments'), list):
        payments_in = body.get('payments') or []

        try:
            SalePayment.query.filter_by(sale_id=sale.id).delete()

            allowed_methods = {'PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO', 'TRANSFERENCIA', 'CREDITO'}
            allowed_status = {'PENDENTE', 'PAGO', 'CANCELADO', 'VENCIDO'}
            non_credit_methods = set()

            for p in payments_in:
                raw_method = p.get('paymentMethod', '')
                method = normalize_method(raw_method)
                if method not in allowed_methods:
                    db.session.rollback()
                    return jsonify({'error': f'Forma de pagamento inválida: {raw_method}'}), 400

                if method == 'CREDITO':
                    continue  # crédito já foi baixado via endpoint próprio

                try:
                    amount = float(p.get('amount', 0))
                except Exception:
                    db.session.rollback()
                    return jsonify({'error': 'Valor de parcela inválido'}), 400
                if amount <= 0:
                    db.session.rollback()
                    return jsonify({'error': 'Valor de parcela deve ser > 0'}), 400

                due_date = parse_due_date(p.get('dueDate'))
                status_in = normalize_status(p.get('status', ''))
                if status_in not in allowed_status:
                    db.session.rollback()
                    return jsonify({'error': f'Status inválido ({status_in}).'}), 400

                non_credit_methods.add(method)

                db.session.add(SalePayment(
                    sale_id=sale.id,
                    due_date=due_date,
                    amount=amount,
                    payment_method=method,
                    status=status_in
                ))

            sale.status = 'COMPLETED'
            non_credit_methods.discard('CREDITO')
            if len(non_credit_methods) == 1:
                sale.payment_method = list(non_credit_methods)[0]
                count_installments = SalePayment.query.filter_by(
                    sale_id=sale.id, payment_method=sale.payment_method
                ).count()
                sale.installments = count_installments or None
            elif len(non_credit_methods) > 1:
                sale.payment_method = 'MIXED'
                sale.installments = None
            else:
                sale.payment_method = 'CREDITO'
                sale.installments = None

            db.session.commit()
            return jsonify({'message': 'Orçamento convertido em venda com sucesso (modo avançado)'}), 200

        except SQLAlchemyError as e:
            db.session.rollback()
            return jsonify({'error': 'Erro ao converter orçamento', 'details': str(e)}), 500

    # =========================
    # MODO B: paymentMethod + installments (compat)
    # =========================
    raw_method = body.get('paymentMethod', '')
    method = normalize_method(raw_method)
    installments = body.get('installments')

    allowed_simple = {'PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO', 'TRANSFERENCIA'}
    if method not in allowed_simple:
        db.session.rollback()
        return jsonify({'error': f'Forma de pagamento inválida: {raw_method}'}), 400
    try:
        installments = int(installments)
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Número de parcelas inválido'}), 400
    if installments < 1:
        db.session.rollback()
        return jsonify({'error': 'Número de parcelas deve ser >= 1'}), 400

    try:
        sale.status = 'COMPLETED'
        sale.payment_method = method
        sale.installments = installments

        SalePayment.query.filter_by(sale_id=sale.id).delete()
        generate_payments_for_sale(sale, method, installments)

        db.session.commit()
        return jsonify({'message': 'Orçamento convertido em venda com sucesso'}), 200

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Erro ao converter orçamento', 'details': str(e)}), 500


@sales_bp.route('/<id>/cancel', methods=['PUT'])
def cancel_sale(id):
    """Cancela venda COMPLETED."""
    sale = Sale.query.get_or_404(id)
    if sale.status != 'COMPLETED':
        return jsonify({'error': 'Somente vendas podem ser canceladas'}), 400
    sale.status = 'CANCELLED'
    db.session.commit()
    return jsonify({'message': 'Venda cancelada com sucesso'}), 200


# --------------------------------------------------------------------------------------
# Utilitário: validação de estoque em tempo real (para o formulário)
# --------------------------------------------------------------------------------------
@sales_bp.route('/check_stock/', methods=['POST'])
def check_stock():
    """
    POST body:
      { "items": [ { "productId": "...", "quantity": 3 }, ... ] }
    Retorna:
      - 200 + { "ok": true,  "items": [] } se tudo OK
      - 200 + { "ok": false, "items": [ { productId, productName, available, requested }, ... ] }
    Observação: status 200 para facilitar uso no front (sem try/catch por status).
    """
    data = request.get_json(silent=True) or {}
    raw_items = data.get('items') or []

    if not isinstance(raw_items, list) or not raw_items:
        return jsonify({'ok': True, 'items': []}), 200

    # Convertendo em objetos "fake" para reusar compute_insufficient_items
    class FakeItem:
        def __init__(self, pid, qty):
            self.product_id = pid
            self.product_name = None
            self.quantity = qty

    fake_list = []
    for it in raw_items:
        try:
            pid = it.get('productId')
            qty = int(it.get('quantity') or 0)
            if not pid or qty <= 0:
                continue
            fake_list.append(FakeItem(pid, qty))
        except Exception:
            continue

    insuff = compute_insufficient_items(fake_list)
    if insuff:
        return jsonify({'ok': False, 'items': insuff}), 200
    return jsonify({'ok': True, 'items': []}), 200
