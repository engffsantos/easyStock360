# backend/app/routes/products.py
from flask import Blueprint, request, jsonify, Response
from app.models import db, Product, ProductHistory
from datetime import datetime, timezone
from sqlalchemy import inspect as sa_inspect
import csv
import io

products_bp = Blueprint('products', __name__, url_prefix='/api/products')

# ===============================
# Helpers de data/hora (stdlib)
# ===============================
def ensure_aware_utc(dt: datetime | None) -> datetime | None:
    """
    Garante que dt seja timezone-aware em UTC.
    Se vier naïve (sem tz), assume UTC.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def to_iso_utc(dt: datetime | None) -> str | None:
    """
    Serializa datetime em ISO 8601 com offset (UTC).
    """
    dt = ensure_aware_utc(dt)
    return dt.isoformat() if dt else None


def generate_sku():
    # Gera um SKU único baseado em data/hora atual (apenas string; pode ser naive sem problemas)
    return f"SKU-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"

# --------------------------------------
# Funções auxiliares
# --------------------------------------
def save_product_history(product: Product, original_data: dict):
    """
    Compara os campos do produto com o snapshot original e grava entradas no histórico
    apenas para o que mudou. O timestamp é sempre UTC-aware.
    """
    mapper = sa_inspect(Product)
    for attr in mapper.attrs:
        field = attr.key
        if field not in original_data:
            continue
        old_value = original_data[field]
        new_value = getattr(product, field)
        if str(old_value) != str(new_value):
            history_entry = ProductHistory(
                product_id=product.id,
                changed_field=field,
                old_value=str(old_value),
                new_value=str(new_value),
                changed_at=datetime.now(timezone.utc)  # sempre UTC-aware
            )
            db.session.add(history_entry)

def table_has_column(table: str, column: str) -> bool:
    insp = sa_inspect(db.engine)
    cols = [c["name"] for c in insp.get_columns(table)]
    return column in cols

# ======================================
# GET /api/products/  (lista de produtos)
#   Padrão: apenas ativos
#   ?include_inactive=1  -> inclui inativos também
#   ?is_active=0         -> somente inativos
# ======================================
@products_bp.route('/', methods=['GET'])
def list_products():
    include_inactive = str(request.args.get('include_inactive', '')).lower() in ('1', 'true', 'yes')
    only_inactive = str(request.args.get('is_active', '')).lower() in ('0', 'false')

    query = Product.query
    if table_has_column('products', 'is_active'):
        if only_inactive:
            query = query.filter(Product.is_active.is_(False))
        elif not include_inactive:
            query = query.filter(Product.is_active.is_(True))

    products = query.order_by(Product.created_at.desc()).all()
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
            'isActive': bool(getattr(p, 'is_active', True)),
            # Datas sempre em ISO 8601 com offset (+00:00)
            'createdAt': to_iso_utc(p.created_at),
        } for p in products
    ]
    return jsonify(result), 200

# =======================================
# POST /api/products/  (criação de produto)
# =======================================
@products_bp.route('/', methods=['POST'])
def add_product():
    data = request.get_json(silent=True) or {}
    required_fields = ['name', 'price', 'cost', 'quantity', 'minStock', 'marca']
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Todos os campos obrigatórios devem ser preenchidos'}), 400

    # SKU automático se não informado
    sku = (data.get('sku') or '').strip() or generate_sku()

    # Verifica SKU duplicado
    if Product.query.filter_by(sku=sku).first():
        return jsonify({'error': 'O SKU informado já está em uso'}), 409

    new_product = Product(
        name=str(data['name']).strip(),
        sku=sku,
        marca=str(data['marca']).strip(),
        tipo=(str(data.get('tipo') or '').strip() or None),
        price=float(data['price']),
        cost=float(data['cost']),
        quantity=int(data['quantity']),
        min_stock=int(data['minStock']),
        created_at=datetime.now(timezone.utc)  # ✅ salva UTC-aware
    )

    db.session.add(new_product)
    db.session.commit()

    # Histórico de criação (opcional, mas útil)
    history_entry = ProductHistory(
        product_id=new_product.id,
        changed_field='Criação',
        old_value=None,
        new_value='Produto criado',
        changed_at=datetime.now(timezone.utc)  # ✅ salva UTC-aware
    )
    db.session.add(history_entry)
    db.session.commit()

    return jsonify({'message': 'Produto cadastrado com sucesso', 'id': new_product.id}), 201

# ===========================================
# PUT /api/products/<id>/  (atualização)
# ===========================================
@products_bp.route('/<string:product_id>/', methods=['PUT'])
def update_product(product_id):
    product = Product.query.get_or_404(product_id)

    # Snapshot antes das mudanças
    original_data = {
        'name': product.name,
        'sku': product.sku,
        'marca': product.marca,
        'tipo': product.tipo,
        'price': product.price,
        'cost': product.cost,
        'quantity': product.quantity,
        'min_stock': product.min_stock,
        # se existir, também comparar is_active
        **({'is_active': product.is_active} if hasattr(product, 'is_active') else {}),
    }

    data = request.get_json(silent=True) or {}

    # Campos editáveis (mapeando minStock -> min_stock)
    mapping = {
        'name': 'name',
        'sku': 'sku',
        'marca': 'marca',
        'tipo': 'tipo',
        'price': 'price',
        'cost': 'cost',
        'quantity': 'quantity',
        'minStock': 'min_stock',
        # isActive não deve ser alterado por PUT comum
    }
    for k_json, k_model in mapping.items():
        if k_json in data:
            setattr(product, k_model, data[k_json])

    # Grava histórico das alterações
    save_product_history(product, original_data)

    db.session.commit()
    return jsonify({'message': 'Produto atualizado com sucesso'}), 200

# =======================================
# DELETE /api/products/<id>/  (descontinuado)
# =======================================
@products_bp.route('/<string:product_id>/', methods=['DELETE'])
def delete_product(product_id):
    return jsonify({'error': 'DELETE descontinuado. Use PATCH /api/products/<id>/deactivate.'}), 405

# =======================================
# PATCH /api/products/<id>/deactivate
# =======================================
@products_bp.route('/<string:product_id>/deactivate', methods=['PATCH'])
def deactivate_product(product_id):
    product = Product.query.get_or_404(product_id)
    if not table_has_column('products', 'is_active'):
        return jsonify({'error': 'Coluna is_active ausente no banco. Atualize o schema.'}), 500

    if product.is_active is False:
        return jsonify({'message': 'Produto já está inativo.'}), 200

    old_val = str(product.is_active)
    product.is_active = False
    db.session.add(ProductHistory(
        product_id=product.id,
        changed_field='is_active',
        old_value=old_val,
        new_value=str(product.is_active),
        changed_at=datetime.now(timezone.utc)
    ))
    db.session.commit()
    return jsonify({'message': 'Produto desativado com sucesso'}), 200

# (Opcional) reativar para gestão do estoque
@products_bp.route('/<string:product_id>/activate', methods=['PATCH'])
def activate_product(product_id):
    product = Product.query.get_or_404(product_id)
    if not table_has_column('products', 'is_active'):
        return jsonify({'error': 'Coluna is_active ausente no banco. Atualize o schema.'}), 500

    if product.is_active is True:
        return jsonify({'message': 'Produto já está ativo.'}), 200

    old_val = str(product.is_active)
    product.is_active = True
    db.session.add(ProductHistory(
        product_id=product.id,
        changed_field='is_active',
        old_value=old_val,
        new_value=str(product.is_active),
        changed_at=datetime.now(timezone.utc)
    ))
    db.session.commit()
    return jsonify({'message': 'Produto reativado com sucesso'}), 200

# ====================================================
# POST /api/products/import_csv  (importação via CSV)
# ====================================================
@products_bp.route('/import_csv', methods=['POST'])
def import_products_csv():
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400

    file = request.files['file']
    if not file.filename.lower().endswith('.csv'):
        return jsonify({'error': 'Formato inválido, envie um arquivo CSV'}), 400

    try:
        stream = io.StringIO(file.stream.read().decode('utf-8'), newline=None)
        reader = csv.DictReader(stream)

        required_fields = ['name', 'sku', 'marca', 'tipo', 'cost', 'price', 'quantity', 'minStock']
        created_count = 0
        skus_existentes = {p.sku for p in Product.query.with_entities(Product.sku).all()}

        for row in reader:
            if not all(field in row for field in required_fields):
                return jsonify({'error': f'Campos obrigatórios ausentes. Esperado: {required_fields}'}), 400

            sku = (row.get('sku') or '').strip() or generate_sku()
            if sku in skus_existentes:
                # evita duplicata
                continue

            product = Product(
                name=(row.get('name') or '').strip(),
                sku=sku,
                marca=(row.get('marca') or '').strip(),
                tipo=((row.get('tipo') or '').strip() or None),
                cost=float(row.get('cost') or 0),
                price=float(row.get('price') or 0),
                quantity=int(row.get('quantity') or 0),
                min_stock=int(row.get('minStock') or 0),
                created_at=datetime.now(timezone.utc)  # ✅ salva UTC-aware
            )

            db.session.add(product)
            created_count += 1
            skus_existentes.add(sku)

        db.session.commit()
        return jsonify({'message': f'{created_count} produtos importados com sucesso.'}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Erro ao processar CSV: {str(e)}'}), 500

# ======================================================
# GET /api/products/<id>/history  (histórico do produto)
# ======================================================
@products_bp.route('/<string:product_id>/history', methods=['GET'])
def get_product_history(product_id):
    product = Product.query.get_or_404(product_id)
    history = (ProductHistory.query
               .filter_by(product_id=product.id)
               .order_by(ProductHistory.changed_at.desc())
               .all())

    result = [{
        'id': h.id,
        'changedAt': to_iso_utc(h.changed_at),  # ✅ ISO 8601 com offset
        'changedField': h.changed_field,
        'oldValue': h.old_value,
        'newValue': h.new_value,
    } for h in history]

    return jsonify(result), 200
