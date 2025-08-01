from flask import Blueprint, request, jsonify
from app.models import db, Product, ProductHistory
from datetime import datetime, timezone
from sqlalchemy import inspect

products_bp = Blueprint('products', __name__, url_prefix='/api/products')

def generate_sku():
    # Gera um SKU único baseado em data/hora atual
    return f"SKU-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"

# Função auxiliar para gravar histórico
def save_product_history(product, original_data):
    mapper = inspect(Product)
    for attr in mapper.attrs:
        field = attr.key
        if field in original_data:
            old_value = original_data[field]
            new_value = getattr(product, field)
            if str(old_value) != str(new_value):
                history_entry = ProductHistory(
                    product_id=product.id,
                    changed_field=field,
                    old_value=str(old_value),
                    new_value=str(new_value),
                    changed_at=datetime.now(timezone.utc)
                )
                db.session.add(history_entry)

# 🔍 GET /api/products/ - Lista produtos
@products_bp.route('/', methods=['GET'])
def list_products():
    products = Product.query.order_by(Product.created_at.desc()).all()
    result = [
        {
            'id': p.id,
            'name': p.name,
            'sku': p.sku,
            'marca': p.marca,
            'tipo': p.tipo,
            'price': p.price,
            'cost': p.cost,
            'quantity': p.quantity,
            'minStock': p.min_stock,
            'createdAt': p.created_at.isoformat()
        } for p in products
    ]
    return jsonify(result), 200

# ➕ POST /api/products/ - Novo produto
@products_bp.route('/', methods=['POST'])
def add_product():
    data = request.get_json()
    required_fields = ['name', 'price', 'cost', 'quantity', 'minStock', 'marca']
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Todos os campos obrigatórios devem ser preenchidos'}), 400

    # SKU automático se não informado
    sku = data.get('sku') or generate_sku()

    # Verifica SKU duplicado
    if Product.query.filter_by(sku=sku).first():
        return jsonify({'error': 'O SKU informado já está em uso'}), 409

    new_product = Product(
        name=data['name'],
        sku=sku,
        marca=data['marca'],
        tipo=data.get('tipo'),  # Opcional
        price=float(data['price']),
        cost=float(data['cost']),
        quantity=int(data['quantity']),
        min_stock=int(data['minStock']),
        created_at=datetime.now(timezone.utc)
    )

    db.session.add(new_product)
    db.session.commit()

    # Histórico da criação
    history_entry = ProductHistory(
        product_id=new_product.id,
        changed_field='Criação',
        old_value=None,
        new_value='Produto criado',
        changed_at=datetime.now(timezone.utc)
    )
    db.session.add(history_entry)
    db.session.commit()

    return jsonify({'message': 'Produto cadastrado com sucesso', 'id': new_product.id}), 201

# ✏️ PUT /api/products/<id>/ - Atualiza produto
@products_bp.route('/<string:product_id>/', methods=['PUT'])
def update_product(product_id):
    product = Product.query.get_or_404(product_id)
    original_data = {
        'name': product.name,
        'sku': product.sku,
        'marca': product.marca,
        'tipo': product.tipo,
        'price': product.price,
        'cost': product.cost,
        'quantity': product.quantity,
        'min_stock': product.min_stock,
    }

    data = request.get_json()

    for field in ['name', 'sku', 'marca', 'tipo', 'price', 'cost', 'quantity', 'minStock']:
        if field in data:
            setattr(product, field if field != 'minStock' else 'min_stock', data[field])

    save_product_history(product, original_data)  # Salva o histórico antes do commit final
    db.session.commit()

    return jsonify({'message': 'Produto atualizado com sucesso'}), 200

# ❌ DELETE /api/products/<id>/ - Remove produto
@products_bp.route('/<string:product_id>/', methods=['DELETE'])
def delete_product(product_id):
    product = Product.query.get_or_404(product_id)
    db.session.delete(product)
    db.session.commit()

    # Histórico da exclusão
    history_entry = ProductHistory(
        product_id=product.id,
        changed_field='Exclusão',
        old_value='Produto excluído',
        new_value=None,
        changed_at=datetime.now(timezone.utc)
    )
    db.session.add(history_entry)
    db.session.commit()

    return jsonify({'message': 'Produto removido com sucesso'}), 200
