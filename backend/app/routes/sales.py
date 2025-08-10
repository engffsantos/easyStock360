# backend/app/routes/sales.py

from flask import Blueprint, request, jsonify
from app.models import db, Sale, SaleItem, Product, Customer, SalePayment
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime, timedelta, date, timezone

sales_bp = Blueprint('sales', __name__)

# -----------------------------
# Helpers
# -----------------------------
def compute_totals(items, discount_type, discount_value, freight):
    """
    items: [{ price: float, quantity: int }, ...]
    discount_type: 'PERCENT' | 'VALUE' | None
    discount_value: float (percentual quando PERCENT; valor quando VALUE)
    freight: float
    """
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
    """Adiciona meses preservando dia quando possível."""
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    # dias por mês (com ano bissexto)
    days_in_month = [31, 29 if (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)) else 28,
                     31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month-1]
    day = min(d.day, days_in_month)
    return date(year, month, day)

def generate_payments_for_sale(sale: Sale, method: str, installments: int):
    """Gera as parcelas (SalePayment) de acordo com a forma/parcela."""
    installments = max(1, int(installments or 1))
    method = method or 'PIX'
    # base para o cálculo e primeira data
    created_local_date = (sale.created_at or datetime.utcnow()).date()
    total = float(sale.total or 0)

    # rateio simples com ajuste no último para corrigir arredondamento
    base = round(total / installments, 2)
    amounts = [base] * installments
    diff = round(total - sum(amounts), 2)
    if diff != 0:
        amounts[-1] = round(amounts[-1] + diff, 2)

    for i in range(installments):
        if method in ('PIX', 'DINHEIRO', 'CARTAO_DEBITO'):
            due = created_local_date
        else:  # CARTAO_CREDITO ou BOLETO → mensal
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
    created_at = sale.created_at
    if created_at and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    valid_until = sale.valid_until
    if valid_until and valid_until.tzinfo is None:
        valid_until = valid_until.replace(tzinfo=timezone.utc)

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
        # payments ordenados por due_date
        'payments': [
            {
                'id': p.id,
                'dueDate': p.due_date.isoformat(),
                'amount': p.amount,
                'paymentMethod': p.payment_method,
                'status': p.status
            } for p in sorted(sale.payments, key=lambda x: x.due_date)
        ]
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

# -----------------------------
# GET /api/sales/ - Vendas (status COMPLETED)
# -----------------------------
@sales_bp.route('/', methods=['GET'])
def list_sales():
    sales = Sale.query.filter_by(status='COMPLETED').order_by(Sale.created_at.desc()).all()
    return jsonify([sale_to_dict(s) for s in sales]), 200

# -----------------------------
# GET /api/sales/quotes/ - Orçamentos (status QUOTE)
# -----------------------------
@sales_bp.route('/quotes/', methods=['GET'])
def list_quotes():
    quotes = Sale.query.filter_by(status='QUOTE').order_by(Sale.created_at.desc()).all()
    return jsonify([sale_to_dict(q) for q in quotes]), 200

# -----------------------------
# GET /api/sales/<id>/ - Detalhe
# -----------------------------
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

# -----------------------------
# POST /api/sales/ - Cria venda ou orçamento
# -----------------------------
@sales_bp.route('/', methods=['POST'])
def add_transaction():
    data = request.get_json() or {}

    items = data.get('items', [])
    if not items:
        return jsonify({'error': 'Venda/Orçamento sem itens'}), 400

    status = data.get('status', 'QUOTE')
    customer_id = data.get('customerId')
    customer_name = data.get('customerName', 'Consumidor Final')

    # Novos campos
    discount_type = data.get('discountType')  # 'PERCENT' | 'VALUE' | None
    discount_value = float(data.get('discountValue', 0) or 0)
    freight = float(data.get('freight', 0) or 0)

    # Calcula totais no servidor (fonte da verdade)
    subtotal, _discount_calc, total = compute_totals(items, discount_type, discount_value, freight)

    try:
        # UTC timezone-aware
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

        # Se já vier forma/parcela na criação, guarda
        sale.payment_method = data.get('paymentMethod')
        sale.installments = int(data.get('installments') or 1) if data.get('installments') is not None else None

        db.session.add(sale)
        db.session.flush()  # obter ID

        # Itens
        for item in items:
            sale_item = SaleItem(
                sale_id=sale.id,
                product_id=item['productId'],
                product_name=item['ProductName'] if 'ProductName' in item else item['productName'],
                quantity=int(item['quantity']),
                price=float(item['price'])
            )
            db.session.add(sale_item)

            # Se venda direta (COMPLETED), abate estoque
            if status == 'COMPLETED':
                product = Product.query.get(item['productId'])
                if not product:
                    db.session.rollback()
                    return jsonify({'error': f'Produto não encontrado: {item["productId"]}'}), 400
                if product.quantity < int(item['quantity']):
                    db.session.rollback()
                    return jsonify({'error': f'Estoque insuficiente para: {product.name}'}), 400
                product.quantity -= int(item['quantity'])

        # Se for venda direta COMPLETED, gerar as parcelas agora (se informadas)
        if status == 'COMPLETED':
            method = sale.payment_method or 'PIX'
            installments = sale.installments or 1
            generate_payments_for_sale(sale, method, installments)

        db.session.commit()
        return jsonify({'message': 'Transação registrada com sucesso', 'id': sale.id}), 201

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Erro ao salvar transação', 'details': str(e)}), 500

# -----------------------------
# PUT /api/sales/<id>/ - Edita um orçamento
# -----------------------------
@sales_bp.route('/<id>/', methods=['PUT'])
def update_quote(id):
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

        # Novos campos
        sale.discount_type = data.get('discountType')
        sale.discount_value = float(data.get('discountValue', 0) or 0)
        sale.freight = float(data.get('freight', 0) or 0)

        # Recalcula
        subtotal, _discount_calc, total = compute_totals(items, sale.discount_type, sale.discount_value, sale.freight)
        sale.subtotal = subtotal
        sale.total = total

        # Mantém created_at; não altera valid_until (baseado no created_at original)
        if sale.valid_until is None and sale.created_at:
            # 10 dias padrão
            base = sale.created_at if sale.created_at.tzinfo else sale.created_at.replace(tzinfo=timezone.utc)
            sale.valid_until = base + timedelta(days=10)

        # Substitui itens
        SaleItem.query.filter_by(sale_id=sale.id).delete()
        for item in items:
            db.session.add(SaleItem(
                sale_id=sale.id,
                product_id=item['productId'],
                product_name=item['ProductName'] if 'ProductName' in item else item['productName'],
                quantity=int(item['quantity']),
                price=float(item['price'])
            ))

        db.session.commit()
        return jsonify({'message': 'Orçamento atualizado com sucesso'}), 200

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Erro ao atualizar orçamento', 'details': str(e)}), 500

# -----------------------------
# DELETE /api/sales/<id>/ - Remove orçamento ou venda
# -----------------------------
@sales_bp.route('/<id>/', methods=['DELETE'])
def delete_transaction(id):
    try:
        sale = Sale.query.get_or_404(id)
        db.session.delete(sale)
        db.session.commit()
        return jsonify({'message': 'Transação excluída com sucesso'}), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Erro ao excluir transação', 'details': str(e)}), 500

# -----------------------------
# POST /api/sales/<id>/convert/ - Converte orçamento em venda
# -----------------------------
@sales_bp.route('/<id>/convert/', methods=['POST'])
def convert_quote_to_sale(id):
    sale = Sale.query.get_or_404(id)
    if sale.status != 'QUOTE':
        return jsonify({'error': 'Apenas orçamentos podem ser convertidos'}), 400

    # Bloqueia conversão de orçamento expirado
    now = datetime.now(timezone.utc)
    if sale.valid_until:
        vu = sale.valid_until if sale.valid_until.tzinfo else sale.valid_until.replace(tzinfo=timezone.utc)
        if now > vu:
            return jsonify({'error': 'Orçamento expirado', 'code': 'QUOTE_EXPIRED'}), 422

    body = request.get_json(silent=True) or {}
    method = body.get('paymentMethod')
    installments = body.get('installments')

    if method not in ('PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO'):
        return jsonify({'error': 'Forma de pagamento inválida'}), 400
    try:
        installments = int(installments)
    except Exception:
        return jsonify({'error': 'Número de parcelas inválido'}), 400
    if installments < 1:
        return jsonify({'error': 'Número de parcelas deve ser >= 1'}), 400

    try:
        # Valida e abate estoque
        for item in sale.items:
            product = Product.query.get(item.product_id)
            if not product:
                return jsonify({'error': f'Produto não encontrado: {item.product_name}'}), 400
            if product.quantity < item.quantity:
                return jsonify({'error': f'Estoque insuficiente para: {product.name}'}), 400
            product.quantity -= item.quantity

        sale.status = 'COMPLETED'
        sale.payment_method = method
        sale.installments = installments

        # Limpa qualquer parcela anterior e gera de novo (segurança)
        SalePayment.query.filter_by(sale_id=sale.id).delete()
        generate_payments_for_sale(sale, method, installments)

        db.session.commit()
        return jsonify({'message': 'Orçamento convertido em venda com sucesso'}), 200

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Erro ao converter orçamento', 'details': str(e)}), 500

# -----------------------------
# PUT /api/sales/<id>/cancel - Cancela venda
# -----------------------------
@sales_bp.route('/<id>/cancel', methods=['PUT'])
def cancel_sale(id):
    sale = Sale.query.get_or_404(id)
    if sale.status != 'COMPLETED':
        return jsonify({'error': 'Somente vendas podem ser canceladas'}), 400
    sale.status = 'CANCELLED'
    db.session.commit()
    return jsonify({'message': 'Venda cancelada com sucesso'}), 200

# =============================
# PAGAMENTOS (PARCELAS) DA VENDA
# =============================

# POST /api/sales/payments/<payment_id>/pay  → marca parcela como PAGO
@sales_bp.route('/payments/<payment_id>/pay', methods=['POST'])
def pay_sale_payment(payment_id):
    payment = SalePayment.query.get_or_404(payment_id)
    if payment.status == 'PAGO':
        return jsonify({'error': 'Parcela já está paga'}), 400
    payment.status = 'PAGO'
    db.session.commit()
    return jsonify({'message': 'Parcela marcada como paga', 'payment': payment_to_dict(payment)}), 200

# PUT/PATCH /api/sales/payments/<payment_id>  → atualiza status (e opcionalmente outros campos)
@sales_bp.route('/payments/<payment_id>', methods=['PUT', 'PATCH'])
def update_sale_payment(payment_id):
    payment = SalePayment.query.get_or_404(payment_id)
    data = request.get_json() or {}

    # Atualiza apenas campos seguros; principal objetivo é permitir trocar STATUS
    if 'status' in data:
        new_status = str(data['status']).upper()
        # Estados aceitos (ajuste conforme seu domínio)
        allowed = {'PENDENTE', 'VENCIDO', 'PAGO', 'CANCELADO'}
        if new_status not in allowed:
            return jsonify({'error': f'Status inválido. Use um de: {", ".join(sorted(allowed))}'}), 400
        payment.status = new_status

    if 'dueDate' in data:
        # aceita "YYYY-MM-DD" ou ISO
        try:
            due = datetime.strptime(str(data['dueDate'])[:10], '%Y-%m-%d').date()
            payment.due_date = due
        except Exception:
            return jsonify({'error': 'Data de vencimento inválida (use YYYY-MM-DD)'}), 400

    if 'amount' in data:
        try:
            payment.amount = float(data['amount'])
        except Exception:
            return jsonify({'error': 'Valor inválido'}), 400

    if 'paymentMethod' in data:
        payment.payment_method = data['paymentMethod']

    db.session.commit()
    return jsonify({'message': 'Parcela atualizada com sucesso', 'payment': payment_to_dict(payment)}), 200
