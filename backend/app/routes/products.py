from flask import Blueprint, request, jsonify
from app.models import db, Product
from datetime import datetime, timezone

products_bp = Blueprint('products', __name__, url_prefix='/api/products')


# 🔍 GET /api/products/ - Lista todos os produtos
@products_bp.route('/', methods=['GET'])
def list_products():
    try:
        products = Product.query.order_by(Product.created_at.desc()).all()
        result = [
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
        ]
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': f'Erro ao listar produtos: {str(e)}'}), 500


# ➕ POST /api/products/ - Adiciona novo produto
@products_bp.route('/', methods=['POST'])
def add_product():
    try:
        data = request.get_json()
        required_fields = ['name', 'sku', 'price', 'cost', 'quantity', 'minStock']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Todos os campos obrigatórios devem ser preenchidos'}), 400

        # Verifica SKU duplicado
        if Product.query.filter_by(sku=data['sku']).first():
            return jsonify({'error': 'O SKU informado já está em uso'}), 409

        new_product = Product(
            name=data['name'],
            sku=data['sku'],
            price=float(data['price']),
            cost=float(data['cost']),
            quantity=int(data['quantity']),
            min_stock=int(data['minStock']),
            created_at=datetime.now(timezone.utc)
        )

        db.session.add(new_product)
        db.session.commit()

        return jsonify({'message': 'Produto cadastrado com sucesso', 'id': new_product.id}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Erro ao cadastrar produto: {str(e)}'}), 500


# ✏️ PUT /api/products/<string:product_id> - Atualiza produto existente
@products_bp.route('/<string:product_id>', methods=['PUT'])
def update_product(product_id):
    try:
        product = Product.query.get_or_404(product_id)
        data = request.get_json()

        for field in ['name', 'sku', 'price', 'cost', 'quantity', 'minStock']:
            if field in data:
                setattr(product, field if field != 'minStock' else 'min_stock', data[field])

        db.session.commit()
        return jsonify({'message': 'Produto atualizado com sucesso'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Erro ao atualizar produto: {str(e)}'}), 500


# ❌ DELETE /api/products/<string:product_id> - Remove produto
@products_bp.route('/<string:product_id>', methods=['DELETE'])
def delete_product(product_id):
    try:
        product = Product.query.get_or_404(product_id)
        db.session.delete(product)
        db.session.commit()
        return jsonify({'message': 'Produto removido com sucesso'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Erro ao remover produto: {str(e)}'}), 500
