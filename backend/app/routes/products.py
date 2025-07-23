from flask import Blueprint, request, jsonify
from app.models import db, Product
from datetime import datetime

products_bp = Blueprint('products', __name__)

# GET /api/products/ - Lista todos os produtos
@products_bp.route('/', methods=['GET'])
def list_products():
    products = Product.query.order_by(Product.created_at.desc()).all()
    return jsonify([
        {
            'id': p.id,
            'name': p.name,
            'sku': p.sku,
            'price': p.price,
            'cost': p.cost,
            'quantity': p.quantity,
            'minStock': p.min_stock,
            'createdAt': p.created_at.isoformat()
        } for p in products
    ])


# POST /api/products/ - Adiciona novo produto
@products_bp.route('/', methods=['POST'])
def add_product():
    data = request.get_json()
    if not all(k in data for k in ('name', 'sku', 'price', 'cost', 'quantity', 'minStock')):
        return jsonify({'error': 'Dados incompletos'}), 400

    # Verifica SKU duplicado
    if Product.query.filter_by(sku=data['sku']).first():
        return jsonify({'error': 'SKU já existe'}), 400

    product = Product(
        name=data['name'],
        sku=data['sku'],
        price=data['price'],
        cost=data['cost'],
        quantity=data['quantity'],
        min_stock=data['minStock'],
        created_at=datetime.utcnow()
    )
    db.session.add(product)
    db.session.commit()

    return jsonify({'message': 'Produto adicionado com sucesso', 'id': product.id}), 201


# PUT /api/products/<id> - Atualiza um produto
@products_bp.route('/<id>', methods=['PUT'])
def update_product(id):
    product = Product.query.get_or_404(id)
    data = request.get_json()

    product.name = data.get('name', product.name)
    product.sku = data.get('sku', product.sku)
    product.price = data.get('price', product.price)
    product.cost = data.get('cost', product.cost)
    product.quantity = data.get('quantity', product.quantity)
    product.min_stock = data.get('minStock', product.min_stock)

    db.session.commit()
    return jsonify({'message': 'Produto atualizado com sucesso'})


# DELETE /api/products/<id> - Remove um produto
@products_bp.route('/<id>', methods=['DELETE'])
def delete_product(id):
    product = Product.query.get_or_404(id)
    db.session.delete(product)
    db.session.commit()
    return jsonify({'message': 'Produto removido com sucesso'})
