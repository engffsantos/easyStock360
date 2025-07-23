from flask import Blueprint, request, jsonify
from app.models import db, Sale, SaleItem, Product
from datetime import datetime

sales_bp = Blueprint('sales', __name__)


# GET /api/sales/ - Lista todas as vendas (status COMPLETED)
@sales_bp.route('/', methods=['GET'])
def list_sales():
    sales = Sale.query.filter_by(status='COMPLETED').order_by(Sale.created_at.desc()).all()
    return jsonify([
        {
            'id': s.id,
            'customerId': s.customer_id,
            'customerName': s.customer_name,
            'status': s.status,
            'total': s.total,
            'createdAt': s.created_at.isoformat(),
            'items': [
                {
                    'productId': i.product_id,
                    'productName': i.product_name,
                    'quantity': i.quantity,
                    'price': i.price
                } for i in s.items
            ]
        } for s in sales
    ])


# GET /api/sales/quotes - Lista todos os orçamentos (status QUOTE)
@sales_bp.route('/quotes', methods=['GET'])
def list_quotes():
    quotes = Sale.query.filter_by(status='QUOTE').order_by(Sale.created_at.desc()).all()
    return jsonify([
        {
            'id': q.id,
            'customerId': q.customer_id,
            'customerName': q.customer_name,
            'status': q.status,
            'total': q.total,
            'createdAt': q.created_at.isoformat(),
            'items': [
                {
                    'productId': i.product_id,
                    'productName': i.product_name,
                    'quantity': i.quantity,
                    'price': i.price
                } for i in q.items
            ]
        } for q in quotes
    ])


# GET /api/sales/<id> - Detalhes da venda/orçamento
@sales_bp.route('/<id>', methods=['GET'])
def get_transaction(id):
    sale = Sale.query.get_or_404(id)
    return jsonify({
        'id': sale.id,
        'customerId': sale.customer_id,
        'customerName': sale.customer_name,
        'status': sale.status,
        'total': sale.total,
        'createdAt': sale.created_at.isoformat(),
        'items': [
            {
                'productId': i.product_id,
                'productName': i.product_name,
                'quantity': i.quantity,
                'price': i.price
            } for i in sale.items
        ]
    })


# POST /api/sales/ - Cria nova venda ou orçamento
@sales_bp.route('/', methods=['POST'])
def add_transaction():
    data = request.get_json()
    items = data.get('items', [])
    if not items:
        return jsonify({'error': 'Venda sem itens'}), 400

    status = data.get('status', 'QUOTE')
    customer_id = data.get('customerId')
    customer_name = data.get('customerName', 'Consumidor Final')

    total = sum(item['price'] * item['quantity'] for item in items)

    sale = Sale(
        customer_id=customer_id,
        customer_name=customer_name,
        status=status,
        total=total,
        created_at=datetime.utcnow()
    )
    db.session.add(sale)
    db.session.flush()  # para obter o ID antes de criar os itens

    for item in items:
        sale_item = SaleItem(
            sale_id=sale.id,
            product_id=item['productId'],
            product_name=item['productName'],
            quantity=item['quantity'],
            price=item['price']
        )
        db.session.add(sale_item)

        # Atualiza estoque se for uma venda real
        if status == 'COMPLETED':
            product = Product.query.get(item['productId'])
            if not product:
                db.session.rollback()
                return jsonify({'error': f'Produto não encontrado: {item["productId"]}'}), 400
            if product.quantity < item['quantity']:
                db.session.rollback()
                return jsonify({'error': f'Estoque insuficiente para: {product.name}'}), 400
            product.quantity -= item['quantity']

    db.session.commit()
    return jsonify({'message': 'Transação registrada com sucesso', 'id': sale.id}), 201


# PUT /api/sales/<id> - Edita um orçamento
@sales_bp.route('/<id>', methods=['PUT'])
def update_quote(id):
    sale = Sale.query.get_or_404(id)
    if sale.status != 'QUOTE':
        return jsonify({'error': 'Apenas orçamentos podem ser editados'}), 400

    data = request.get_json()
    sale.customer_id = data.get('customerId')
    sale.customer_name = data.get('customerName', 'Consumidor Final')
    sale.total = sum(item['price'] * item['quantity'] for item in data.get('items', []))

    # Remove itens antigos
    SaleItem.query.filter_by(sale_id=sale.id).delete()

    # Adiciona novos itens
    for item in data.get('items', []):
        sale_item = SaleItem(
            sale_id=sale.id,
            product_id=item['productId'],
            product_name=item['productName'],
            quantity=item['quantity'],
            price=item['price']
        )
        db.session.add(sale_item)

    db.session.commit()
    return jsonify({'message': 'Orçamento atualizado com sucesso'})


# DELETE /api/sales/<id> - Remove orçamento ou venda
@sales_bp.route('/<id>', methods=['DELETE'])
def delete_transaction(id):
    sale = Sale.query.get_or_404(id)
    db.session.delete(sale)
    db.session.commit()
    return jsonify({'message': 'Transação excluída com sucesso'})


# POST /api/sales/<id>/convert - Converte orçamento em venda
@sales_bp.route('/<id>/convert', methods=['POST'])
def convert_quote_to_sale(id):
    sale = Sale.query.get_or_404(id)
    if sale.status != 'QUOTE':
        return jsonify({'error': 'Apenas orçamentos podem ser convertidos'}), 400

    for item in sale.items:
        product = Product.query.get(item.product_id)
        if not product:
            return jsonify({'error': f'Produto não encontrado: {item.product_name}'}), 400
        if product.quantity < item.quantity:
            return jsonify({'error': f'Estoque insuficiente para: {product.name}'}), 400
        product.quantity -= item.quantity

    sale.status = 'COMPLETED'
    db.session.commit()
    return jsonify({'message': 'Orçamento convertido em venda com sucesso'})
