# backend/app/routes/sales.py

from flask import Blueprint, request, jsonify
from app.models import db, Sale, SaleItem, Product, Customer, SalePayment, FinancialEntry
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime, timedelta, date

sales_bp = Blueprint('sales', __name__)

# -----------------------------
# Helpers
# -----------------------------
IMMEDIATE_METHODS = {'PIX', 'DINHEIRO', 'CARTAO_DEBITO'}

def compute_totals(items, discount_type, discount_value, freight):
    """
    items: [{ price: float, quantity: int }, ...]
    discount_type: 'PERCENT' | 'VALUE' | None
    discount_value: float (percentual quando PERCENT; valor quando VALUE)
    freight: float
    """
    subtotal = sum((float(i.get('price', 0)) * int(i.get('quantity', 0))) for i in items)
    discount = 0.0
    if discount_type and (discount_value is not None):
        dv = float(discount_value or 0)
        if discount_type == 'PERCENT':
            discount = min(subtotal * (dv / 100.0), subtotal)
        elif discount_type == 'VALUE':
            discount = min(dv, subtotal)
    total = max(subtotal - discount + float(freight or 0), 0.0)
    return subtotal, discount, total

def next_month(d: date) -> date:
    """Retorna o mesmo dia no mês seguinte (ajustando fim do mês)."""
    year = d.year + (d.month // 12)
    month = 1 if d.month == 12 else d.month + 1
    day = d.day
    # Ajuste para meses com menos dias
    while True:
        try:
            return date(year, month, day)
        except ValueError:
            day -= 1
            if day <= 0:
                # fallback para 1
                return date(year, month, 1)

def split_installments(total: float, n: int):
    """
    Divide o total em n parcelas com 2 casas, ajustando centavos na última.
    Retorna uma lista de valores (len=n).
    """
    if n <= 1:
        return [round(float(total), 2)]
    base = int(round(total * 100)) // n
    parts = [base] * n
    remainder = int(round(total * 100)) - base * n
    # distribui os centavos que sobraram
    for i in range(remainder):
        parts[i] += 1
    return [round(p / 100.0, 2) for p in parts]

def create_payments_for_sale(sale: Sale, method: str, installments: int, created_at: datetime):
    """
    Cria registros SalePayment para a venda.
    - Métodos imediatos (PIX, DINHEIRO, CARTAO_DEBITO):
      * 1 parcela hoje, status PAGO
    - Parcelado (CARTAO_CREDITO/BOLETO):
      * N parcelas mensais, status PENDENTE por padrão
    """
    payments = []
    installments = max(int(installments or 1), 1)
    amounts = split_installments(sale.total, installments)

    today = created_at.date()
    for i in range(installments):
        if installments == 1 and method in IMMEDIATE_METHODS:
            due = today
            status = 'PAGO'
        else:
            # primeira parcela para o próximo mês por padrão
            base_date = next_month(today) if installments > 1 else today
            due = base_date
            # parcelas subsequentes
            for _ in range(i):
                due = next_month(due)
            status = 'PENDENTE'

        sp = SalePayment(
            sale_id=sale.id,
            amount=amounts[i],
            due_date=due,
            status=status,
            payment_method=method
        )
        db.session.add(sp)
        payments.append(sp)
    return payments

def create_financial_entries_for_payments(sale: Sale, payments):
    """
    Cria lançamentos financeiros (RECEITA) a partir das parcelas.
    - Usa o status da parcela para definir status inicial no financeiro.
    - Descrição padrão inclui ID da venda e nº da parcela.
    """
    for idx, p in enumerate(payments, start=1):
        entry = FinancialEntry(
            type='RECEITA',
            description=f'Venda {sale.id} - Parcela {idx}/{len(payments)}',
            amount=p.amount,
            due_date=p.due_date or datetime.utcnow().date(),
            payment_method=p.payment_method or (sale.payment_method or 'PIX'),
            status='PAGO' if p.status == 'PAGO' else 'PENDENTE'
        )
        db.session.add(entry)

def sale_to_dict(sale: Sale):
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
        'validUntil': sale.valid_until.isoformat() if sale.valid_until else None,
        'paymentMethod': sale.payment_method,
        'installments': sale.installments,
        'createdAt': sale.created_at.isoformat(),
        'items': [
            {
                'productId': i.product_id,
                'productName': i.product_name,
                'quantity': i.quantity,
                'price': i.price
            } for i in sale.items
        ],
        'payments': [
            {
                'id': p.id,
                'amount': p.amount,
                'dueDate': p.due_date.isoformat() if p.due_date else None,
                'status': p.status,
                'paymentMethod': p.payment_method
            } for p in sorted(sale.payments, key=lambda x: (x.due_date or date.min))
        ]
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
        # 'customerEmail': se tiver no modelo futuramente
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

    # Quando COMPLETED
    payment_method = data.get('paymentMethod')
    installments = int(data.get('installments', 1) or 1)

    # Calcula totais no servidor (fonte da verdade)
    subtotal, _discount_calc, total = compute_totals(items, discount_type, discount_value, freight)

    try:
        created_at = datetime.utcnow()

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
            valid_until=(created_at + timedelta(days=10)) if status == 'QUOTE' else None,
            payment_method=payment_method if status == 'COMPLETED' else None,
            installments=installments if status == 'COMPLETED' else 1
        )
        db.session.add(sale)
        db.session.flush()  # obter ID

        # Itens
        for item in items:
            sale_item = SaleItem(
                sale_id=sale.id,
                product_id=item['productId'],
                product_name=item['productName'],
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

        # Gera parcelas e financeiro se COMPLETED
        if status == 'COMPLETED':
            if not payment_method:
                db.session.rollback()
                return jsonify({'error': 'Forma de pagamento é obrigatória para venda direta'}), 400
            payments = create_payments_for_sale(sale, payment_method, installments, created_at)
            create_financial_entries_for_payments(sale, payments)

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

        # Mantém created_at; atualiza/garante valid_until
        if sale.valid_until is None:
            sale.valid_until = (sale.created_at + timedelta(days=10))

        # Substitui itens
        SaleItem.query.filter_by(sale_id=sale.id).delete()
        for item in items:
            db.session.add(SaleItem(
                sale_id=sale.id,
                product_id=item['productId'],
                product_name=item['productName'],
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
    now = datetime.utcnow()
    if sale.valid_until and now > sale.valid_until:
        return jsonify({'error': 'Orçamento expirado', 'code': 'QUOTE_EXPIRED'}), 422

    payload = request.get_json() or {}
    payment_method = payload.get('paymentMethod')
    installments = int(payload.get('installments', 1) or 1)

    if not payment_method:
        return jsonify({'error': 'Forma de pagamento é obrigatória para conversão'}), 400

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
        sale.payment_method = payment_method
        sale.installments = max(installments, 1)

        # Cria parcelas e financeiro
        payments = create_payments_for_sale(sale, payment_method, sale.installments, now)
        create_financial_entries_for_payments(sale, payments)

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

    try:
        sale.status = 'CANCELLED'

        # Marca parcelas pendentes como "CANCELADO" e remove/atualiza financeiro pendente
        pendentes_ids = []
        for p in sale.payments:
            if p.status != 'PAGO':
                p.status = 'CANCELADO'
                pendentes_ids.append(p.id)

        # Remove entradas financeiras não pagas (simples)
        if pendentes_ids:
            FinancialEntry.query.filter(
                FinancialEntry.description.like(f'Venda {sale.id}%'),
                FinancialEntry.status != 'PAGO'
            ).delete(synchronize_session=False)

        db.session.commit()
        return jsonify({'message': 'Venda cancelada com sucesso'}), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Erro ao cancelar venda', 'details': str(e)}), 500
